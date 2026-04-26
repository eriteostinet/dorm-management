import { Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// 获取账单列表
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { communityId, roomId, type, status, period } = req.query;

    const where: any = {};
    
    if (req.user?.role === 'STAFF') {
      where.employeeId = req.user.userId;
    }

    if (communityId) {
      where.room = { communityId: communityId as string };
    }
    if (roomId) where.roomId = roomId as string;
    if (type) where.type = type as string;
    if (status) where.status = status as string;
    if (period) where.period = period as string;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          room: {
            include: {
              building: { include: { community: true } },
            },
          },
          employee: { select: { id: true, realName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      data: payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// 获取账单统计
router.get('/stats/overview', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { communityId, period } = req.query;

    const where: any = {};
    if (communityId) {
      where.room = { communityId: communityId as string };
    }
    if (period) where.period = period as string;

    const [total, paid, unpaid, overdue] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.count({ where: { ...where, status: 'PAID' } }),
      prisma.payment.count({ where: { ...where, status: 'UNPAID' } }),
      prisma.payment.count({ where: { ...where, status: 'OVERDUE' } }),
    ]);

    const amountStats = await prisma.payment.aggregate({
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    const paidStats = await prisma.payment.aggregate({
      where: { ...where, status: 'PAID' },
      _sum: { amount: true },
    });

    res.json({
      total,
      paid,
      unpaid,
      overdue,
      totalAmount: amountStats._sum.amount || 0,
      paidAmount: paidStats._sum.amount || 0,
      unpaidAmount: (amountStats._sum.amount || 0) - (paidStats._sum.amount || 0),
      collectionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
    });
  } catch (error) {
    next(error);
  }
});

// 创建账单
router.post('/',
  authenticate,
  requireRole('ADMIN'),
  [
    body('roomId').notEmpty(),
    body('employeeId').notEmpty(),
    body('type').isIn(['RENT', 'WATER', 'ELECTRICITY', 'OTHER']),
    body('amount').isFloat({ min: 0 }),
    body('period').trim().notEmpty(),
    body('dueDate').notEmpty(),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { roomId, employeeId, type, amount, period, dueDate, remark } = req.body;

      const payment = await prisma.payment.create({
        data: {
          roomId,
          employeeId,
          type,
          amount: parseFloat(amount),
          period,
          dueDate: new Date(dueDate),
          remark,
          status: 'UNPAID',
        },
        include: {
          room: {
            include: {
              building: { include: { community: true } },
            },
          },
          employee: { select: { id: true, realName: true } },
        },
      });

      res.status(201).json(payment);
    } catch (error) {
      next(error);
    }
  }
);

// 批量创建账单
router.post('/batch',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { communityId, type, period, dueDate, defaultAmount } = req.body;

      const rooms = await prisma.room.findMany({
        where: {
          communityId,
          status: 'OCCUPIED',
        },
        include: {
          occupant: true,
        },
      });

      const payments = [];
      let created = 0;
      let failed = 0;

      for (const room of rooms) {
        try {
          if (!room.occupantId) continue;

          const payment = await prisma.payment.create({
            data: {
              roomId: room.id,
              employeeId: room.occupantId,
              type,
              amount: parseFloat(defaultAmount) || room.pricePerMonth || 0,
              period,
              dueDate: new Date(dueDate),
              status: 'UNPAID',
            },
          });
          payments.push(payment);
          created++;
        } catch {
          failed++;
        }
      }

      res.json({
        success: true,
        created,
        failed,
        payments,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 标记缴费
router.post('/:id/pay',
  authenticate,
  requireRole('ADMIN'),
  [
    body('paymentMethod').notEmpty(),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { paymentMethod, paidBy } = req.body;

      const payment = await prisma.payment.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paidBy: paidBy || req.user!.userId,
          paymentMethod,
        },
        include: {
          room: true,
          employee: { select: { id: true, realName: true } },
        },
      });

      // 通知员工缴费成功
      if (payment.employeeId) {
        io.to(`user:${payment.employeeId}`).emit('payment:paid', payment);
      }

      res.json(payment);
    } catch (error) {
      next(error);
    }
  }
);

// 更新账单
router.patch('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { amount, dueDate, remark, status } = req.body;

      const payment = await prisma.payment.update({
        where: { id },
        data: {
          ...(amount && { amount: parseFloat(amount) }),
          ...(dueDate && { dueDate: new Date(dueDate) }),
          ...(remark && { remark }),
          ...(status && { status }),
        },
      });

      res.json(payment);
    } catch (error) {
      next(error);
    }
  }
);

// 删除账单
router.delete('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      await prisma.payment.delete({
        where: { id },
      });

      res.json({ success: true, message: '账单已删除' });
    } catch (error) {
      next(error);
    }
  }
);

export { router as paymentRouter };
