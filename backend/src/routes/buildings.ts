import { Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// 获取楼栋列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { communityId } = req.query;

    const where: any = {};
    if (communityId) where.communityId = communityId as string;

    const buildings = await prisma.building.findMany({
      where,
      include: {
        community: true,
        _count: { select: { rooms: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(buildings);
  } catch (error) {
    next(error);
  }
});

// 获取单个楼栋
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const building = await prisma.building.findUnique({
      where: { id },
      include: {
        community: true,
        rooms: {
          orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
        },
      },
    });

    if (!building) {
      throw new AppError(404, '楼栋不存在');
    }

    res.json(building);
  } catch (error) {
    next(error);
  }
});

// 创建楼栋
router.post('/',
  authenticate,
  requireRole('ADMIN'),
  [
    body('communityId').notEmpty(),
    body('name').trim().notEmpty(),
    body('floors').isInt({ min: 1 }).withMessage('楼层数必须大于0'),
    body('units').isInt({ min: 1 }).withMessage('单元数必须大于0'),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { communityId, name, floors, units } = req.body;

      const building = await prisma.building.create({
        data: {
          communityId,
          name,
          floors: parseInt(floors),
          units: parseInt(units),
        },
      });

      res.status(201).json(building);
    } catch (error) {
      next(error);
    }
  }
);

// 更新楼栋
router.patch('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { name, floors, units } = req.body;

      const building = await prisma.building.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(floors && { floors: parseInt(floors) }),
          ...(units && { units: parseInt(units) }),
        },
      });

      res.json(building);
    } catch (error) {
      next(error);
    }
  }
);

// 删除楼栋
router.delete('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      await prisma.building.delete({
        where: { id },
      });

      res.json({ success: true, message: '楼栋已删除' });
    } catch (error) {
      next(error);
    }
  }
);

export { router as buildingRouter };
