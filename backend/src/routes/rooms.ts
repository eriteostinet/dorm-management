import { Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { io } from '../index';

const router = Router();

// 获取房间列表
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { communityId, buildingId, status, floor, search } = req.query;

    const where: any = {};

    // 员工只能看自己入住的房间
    if (req.user?.role === 'STAFF') {
      where.occupantId = req.user.userId;
    }

    if (communityId) where.communityId = communityId as string;
    if (buildingId) where.buildingId = buildingId as string;
    if (status) where.status = status as string;
    if (floor) where.floor = parseInt(floor as string);
    if (search) {
      where.OR = [
        { roomNumber: { contains: search as string, mode: 'insensitive' } },
        { occupantName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const skip = (page - 1) * limit;

  const [rooms, total] = await Promise.all([
    prisma.room.findMany({
      where,
      include: {
        building: {
          include: { community: true },
        },
        occupant: {
          select: { id: true, realName: true, phone: true, department: true },
        },
      },
      orderBy: [{ building: { name: 'asc' } }, { floor: 'asc' }, { roomNumber: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.room.count({ where }),
  ]);

  res.json({
    data: rooms,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
  } catch (error) {
    next(error);
  }
});

// 获取单个房间
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        building: { include: { community: true } },
        occupant: true,
        assets: true,
        tickets: {
          where: { status: { not: 'CONFIRMED' } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!room) {
      throw new AppError(404, '房间不存在');
    }

    res.json(room);
  } catch (error) {
    next(error);
  }
});

// 创建房间
router.post('/',
  authenticate,
  requireRole('ADMIN'),
  [
    body('buildingId').notEmpty(),
    body('communityId').notEmpty(),
    body('roomNumber').trim().notEmpty(),
    body('floor').isInt({ min: 1 }),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { buildingId, communityId, roomNumber, floor, area, bedCount, pricePerMonth } = req.body;

      const room = await prisma.room.create({
        data: {
          buildingId,
          communityId,
          roomNumber,
          floor: parseInt(floor),
          area: area ? parseFloat(area) : null,
          bedCount: bedCount ? parseInt(bedCount) : 1,
          pricePerMonth: pricePerMonth ? parseFloat(pricePerMonth) : null,
        },
      });

      res.status(201).json(room);
    } catch (error) {
      next(error);
    }
  }
);

// 更新房间
router.patch('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { roomNumber, floor, area, bedCount, pricePerMonth, status } = req.body;

      const room = await prisma.room.update({
        where: { id },
        data: {
          ...(roomNumber && { roomNumber }),
          ...(floor && { floor: parseInt(floor) }),
          ...(area && { area: parseFloat(area) }),
          ...(bedCount && { bedCount: parseInt(bedCount) }),
          ...(pricePerMonth && { pricePerMonth: parseFloat(pricePerMonth) }),
          ...(status && { status }),
        },
      });

      res.json(room);
    } catch (error) {
      next(error);
    }
  }
);

// 入住登记
router.post('/:id/checkin',
  authenticate,
  requireRole('ADMIN'),
  [
    body('occupantId').notEmpty().withMessage('入住人ID不能为空'),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { occupantId } = req.body;

      const room = await prisma.room.findUnique({
        where: { id },
        include: { occupant: true },
      });

      if (!room) {
        throw new AppError(404, '房间不存在');
      }

      if (room.status === 'OCCUPIED') {
        throw new AppError(400, '房间已入住');
      }

      const occupant = await prisma.user.findUnique({
        where: { id: occupantId },
      });

      if (!occupant) {
        throw new AppError(404, '入住人不存在');
      }

      const updatedRoom = await prisma.room.update({
        where: { id },
        data: {
          status: 'OCCUPIED',
          occupantId,
          occupantName: occupant.realName,
          checkInDate: new Date(),
        },
        include: {
          building: { include: { community: true } },
          occupant: true,
        },
      });

      // 通知入住人
      io.to(`user:${occupantId}`).emit('room:assigned', updatedRoom);

      res.json(updatedRoom);
    } catch (error) {
      next(error);
    }
  }
);

// 退房
router.post('/:id/checkout',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      const room = await prisma.room.findUnique({
        where: { id },
        include: { occupant: true },
      });

      if (!room) {
        throw new AppError(404, '房间不存在');
      }

      if (room.status !== 'OCCUPIED') {
        throw new AppError(400, '房间未入住');
      }

      const previousOccupantId = room.occupantId;

      const updatedRoom = await prisma.room.update({
        where: { id },
        data: {
          status: 'VACANT',
          occupantId: null,
          occupantName: null,
          checkInDate: null,
        },
        include: {
          building: { include: { community: true } },
        },
      });

      // 通知原入住人
      if (previousOccupantId) {
        io.to(`user:${previousOccupantId}`).emit('room:released', updatedRoom);
      }

      res.json(updatedRoom);
    } catch (error) {
      next(error);
    }
  }
);

// 调房
router.post('/:id/transfer',
  authenticate,
  requireRole('ADMIN'),
  [
    body('newRoomId').notEmpty(),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { newRoomId } = req.body;

      const oldRoom = await prisma.room.findUnique({
        where: { id },
        include: { occupant: true },
      });

      if (!oldRoom || !oldRoom.occupantId) {
        throw new AppError(400, '原房间未入住');
      }

      const newRoom = await prisma.room.findUnique({
        where: { id: newRoomId },
      });

      if (!newRoom) {
        throw new AppError(404, '新房间不存在');
      }

      if (newRoom.status === 'OCCUPIED') {
        throw new AppError(400, '新房间已入住');
      }

      const occupantId = oldRoom.occupantId;
      const occupantName = oldRoom.occupantName;

      // 事务处理
      await prisma.$transaction([
        prisma.room.update({
          where: { id },
          data: {
            status: 'VACANT',
            occupantId: null,
            occupantName: null,
            checkInDate: null,
          },
        }),
        prisma.room.update({
          where: { id: newRoomId },
          data: {
            status: 'OCCUPIED',
            occupantId,
            occupantName,
            checkInDate: new Date(),
          },
        }),
      ]);

      const result = await prisma.room.findUnique({
        where: { id: newRoomId },
        include: {
          building: { include: { community: true } },
          occupant: true,
        },
      });

      io.to(`user:${occupantId}`).emit('room:transferred', result);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// 删除房间
router.delete('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      const room = await prisma.room.findUnique({
        where: { id },
        include: {
          _count: {
            select: { tickets: true, assets: true, payments: true },
          },
        },
      });

      if (!room) throw new AppError(404, '房间不存在');
      if (room.status === 'OCCUPIED') throw new AppError(400, '房间已入住，无法删除');
      if (room._count.tickets > 0) throw new AppError(400, '房间存在关联工单，无法删除');
      if (room._count.assets > 0) throw new AppError(400, '房间存在关联资产，无法删除');
      if (room._count.payments > 0) throw new AppError(400, '房间存在关联账单，无法删除');

      await prisma.room.delete({ where: { id } });

      res.json({ success: true, message: '房间已删除' });
    } catch (error) {
      next(error);
    }
  }
);

export { router as roomRouter };
