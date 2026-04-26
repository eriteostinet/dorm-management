import { Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { io } from '../index';

const router = Router();

// 获取工单列表
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { status, reporterId, assignedTo, communityId, urgency } = req.query;

    const where: any = {};
    
    // 普通员工只能看自己的
    if (req.user?.role === 'STAFF') {
      where.reporterId = req.user.userId;
    }
    
    // 维修工只能看分配给自己的
    if (req.user?.role === 'MAINTENANCE') {
      where.assignedTo = req.user.userId;
    }

    if (status) where.status = status as string;
    if (reporterId && req.user?.role === 'ADMIN') where.reporterId = reporterId as string;
    if (assignedTo && req.user?.role === 'ADMIN') where.assignedTo = assignedTo as string;
    if (urgency) where.urgency = urgency as string;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      prisma.repairTicket.findMany({
        where,
        include: {
          room: {
            include: {
              building: { include: { community: true } },
            },
          },
          reporter: { select: { id: true, realName: true, phone: true } },
          assignee: { select: { id: true, realName: true, phone: true } },
          approver: { select: { id: true, realName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.repairTicket.count({ where }),
    ]);

    res.json({
      data: tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// 获取单个工单
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.repairTicket.findUnique({
      where: { id },
      include: {
        room: {
          include: {
            building: { include: { community: true } },
          },
        },
        reporter: { select: { id: true, realName: true, phone: true } },
        assignee: { select: { id: true, realName: true, phone: true } },
        approver: { select: { id: true, realName: true } },
      },
    });

    if (!ticket) {
      throw new AppError(404, '工单不存在');
    }

    // 权限检查
    if (req.user?.role === 'STAFF' && ticket.reporterId !== req.user.userId) {
      throw new AppError(403, '权限不足');
    }

    if (req.user?.role === 'MAINTENANCE' && ticket.assignedTo !== req.user.userId) {
      throw new AppError(403, '权限不足');
    }

    res.json(ticket);
  } catch (error) {
    next(error);
  }
});

// 创建工单（员工）
router.post('/',
  authenticate,
  [
    body('roomId').notEmpty(),
    body('category').trim().notEmpty(),
    body('description').trim().notEmpty(),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { roomId, category, description, images, urgency } = req.body;

      const ticket = await prisma.repairTicket.create({
        data: {
          roomId,
          reporterId: req.user!.userId,
          category,
          description,
          images: images ? JSON.stringify(images) : null,
          urgency: urgency || 'NORMAL',
          status: 'PENDING',
        },
        include: {
          room: {
            include: {
              building: { include: { community: true } },
            },
          },
          reporter: { select: { id: true, realName: true } },
        },
      });

      // 通知管理员
      io.emit('ticket:new', ticket);

      res.status(201).json(ticket);
    } catch (error) {
      next(error);
    }
  }
);

// 审批工单（管理员同意，直接进入处理中）
router.post('/:id/approve',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;

      const ticket = await prisma.repairTicket.findUnique({ where: { id } });
      if (!ticket) throw new AppError(404, '工单不存在');
      if (ticket.status !== 'PENDING') throw new AppError(400, '工单不是待同意状态');

      const updateData: any = {
        status: 'PROCESSING',
        approvedBy: req.user!.userId,
        approvedAt: new Date(),
        startedAt: new Date(),
      };
      if (assignedTo) {
        updateData.assignedTo = assignedTo;
      }

      const updated = await prisma.repairTicket.update({
        where: { id },
        data: updateData,
        include: {
          room: true,
          reporter: { select: { id: true, realName: true } },
          assignee: { select: { id: true, realName: true } },
        },
      });

      if (assignedTo) {
        io.to(`user:${assignedTo}`).emit('ticket:assigned', updated);
      }
      io.to(`user:${updated.reporterId}`).emit('ticket:approved', updated);

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// 开始处理（维修工）
router.post('/:id/start',
  authenticate,
  requireRole('MAINTENANCE', 'ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      const ticket = await prisma.repairTicket.findUnique({ where: { id } });
      if (!ticket) throw new AppError(404, '工单不存在');

      // 维修工只能处理分配给自己的
      if (req.user?.role === 'MAINTENANCE' && ticket.assignedTo !== req.user.userId) {
        throw new AppError(403, '权限不足');
      }

      if (ticket.status !== 'APPROVED' && ticket.status !== 'PROCESSING') {
        throw new AppError(400, '工单不在可开始处理的状态');
      }

      const updated = await prisma.repairTicket.update({
        where: { id },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
        include: {
          room: true,
          reporter: { select: { id: true, realName: true } },
        },
      });

      io.to(`user:${updated.reporterId}`).emit('ticket:processing', updated);

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// 完成维修（维修工）
router.post('/:id/complete',
  authenticate,
  requireRole('MAINTENANCE', 'ADMIN'),
  [
    body('solution').trim().notEmpty().withMessage('解决方案不能为空'),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { solution, processImages, laborCost, materialCost } = req.body;

      const ticket = await prisma.repairTicket.findUnique({ where: { id } });
      if (!ticket) throw new AppError(404, '工单不存在');

      if (req.user?.role === 'MAINTENANCE' && ticket.assignedTo !== req.user.userId) {
        throw new AppError(403, '权限不足');
      }

      if (ticket.status !== 'PROCESSING') {
        throw new AppError(400, '工单不在处理中状态，无法完成');
      }

      const totalCost = (laborCost || 0) + (materialCost || 0);

      const updated = await prisma.repairTicket.update({
        where: { id },
        data: {
          status: 'DONE',
          solution,
          processImages: processImages ? JSON.stringify(processImages) : null,
          laborCost: laborCost || null,
          materialCost: materialCost || null,
          totalCost: totalCost || null,
          completedAt: new Date(),
        },
        include: {
          room: true,
          reporter: { select: { id: true, realName: true } },
        },
      });

      io.to(`user:${updated.reporterId}`).emit('ticket:done', updated);

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// 验收工单（员工/管理员）
router.post('/:id/confirm',
  authenticate,
  [
    body('rating').optional().isInt({ min: 1, max: 5 }),
    body('comment').optional().trim(),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { rating, comment, confirmStatus } = req.body;

      const ticket = await prisma.repairTicket.findUnique({ where: { id } });
      if (!ticket) throw new AppError(404, '工单不存在');

      // 员工只能验收自己的
      if (req.user?.role === 'STAFF' && ticket.reporterId !== req.user.userId) {
        throw new AppError(403, '权限不足');
      }

      if (ticket.status !== 'DONE') {
        throw new AppError(400, '工单未完成，无法验收');
      }

      const status = confirmStatus === 'reject' || confirmStatus === 'failed' ? 'PROCESSING' : 'CONFIRMED';

      const updated = await prisma.repairTicket.update({
        where: { id },
        data: {
          status,
          rating: rating || null,
          comment: comment || null,
          verifiedAt: new Date(),
        },
        include: {
          room: true,
          reporter: { select: { id: true, realName: true } },
          assignee: { select: { id: true, realName: true } },
        },
      });

      io.to(`user:${ticket.assignedTo}`).emit('ticket:confirmed', updated);

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// 删除工单
router.delete('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      const ticket = await prisma.repairTicket.findUnique({ where: { id } });
      if (!ticket) throw new AppError(404, '工单不存在');

      await prisma.repairTicket.delete({ where: { id } });

      res.json({ success: true, message: '工单已删除' });
    } catch (error) {
      next(error);
    }
  }
);

export { router as ticketRouter };
