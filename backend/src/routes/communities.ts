import { Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// 获取所有小区
router.get('/', authenticate, async (_req, res, next) => {
  try {
    const communities = await prisma.community.findMany({
      where: { status: 'ACTIVE' },
      include: {
        _count: {
          select: { buildings: true, rooms: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(communities);
  } catch (error) {
    next(error);
  }
});

// 获取单个小区
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const community = await prisma.community.findUnique({
      where: { id },
      include: {
        buildings: {
          include: {
            _count: { select: { rooms: true } },
          },
        },
        rooms: {
          select: {
            id: true,
            roomNumber: true,
            status: true,
            floor: true,
            occupantName: true,
          },
        },
      },
    });

    if (!community) {
      throw new AppError(404, '小区不存在');
    }

    res.json(community);
  } catch (error) {
    next(error);
  }
});

// 创建小区
router.post('/',
  authenticate,
  requireRole('ADMIN'),
  [
    body('name').trim().notEmpty().withMessage('小区名称不能为空'),
    body('address').trim().notEmpty().withMessage('地址不能为空'),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { name, address, adminId } = req.body;

      const community = await prisma.community.create({
        data: {
          name,
          address,
          adminId: adminId || req.user!.userId,
        },
      });

      res.status(201).json(community);
    } catch (error) {
      next(error);
    }
  }
);

// 更新小区
router.patch('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { name, address, status } = req.body;

      const community = await prisma.community.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(address && { address }),
          ...(status && { status }),
        },
      });

      res.json(community);
    } catch (error) {
      next(error);
    }
  }
);

// 删除小区
router.delete('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      await prisma.community.update({
        where: { id },
        data: { status: 'DELETED' },
      });

      res.json({ success: true, message: '小区已删除' });
    } catch (error) {
      next(error);
    }
  }
);

export { router as communityRouter };
