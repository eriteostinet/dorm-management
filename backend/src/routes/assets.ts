import { Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// 获取资产列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { roomId, category, status } = req.query;

    const where: any = {};
    if (roomId) where.roomId = roomId as string;
    if (category) where.category = category as string;
    if (status) where.status = status as string;

    const assets = await prisma.asset.findMany({
      where,
      include: {
        room: {
          include: {
            building: { include: { community: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(assets);
  } catch (error) {
    next(error);
  }
});

// 获取单个资产
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        room: {
          include: {
            building: { include: { community: true } },
          },
        },
      },
    });

    if (!asset) {
      throw new AppError(404, '资产不存在');
    }

    res.json(asset);
  } catch (error) {
    next(error);
  }
});

// 创建资产
router.post('/',
  authenticate,
  requireRole('ADMIN'),
  [
    body('roomId').notEmpty(),
    body('name').trim().notEmpty(),
    body('category').trim().notEmpty(),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { roomId, name, category, status, purchaseDate, price, notes } = req.body;

      const asset = await prisma.asset.create({
        data: {
          roomId,
          name,
          category,
          status: status || 'GOOD',
          purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
          price: price ? parseFloat(price) : null,
          notes,
        },
        include: {
          room: {
            include: {
              building: { include: { community: true } },
            },
          },
        },
      });

      res.status(201).json(asset);
    } catch (error) {
      next(error);
    }
  }
);

// 更新资产
router.patch('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { name, category, status, purchaseDate, price, notes } = req.body;

      const asset = await prisma.asset.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(category && { category }),
          ...(status && { status }),
          ...(purchaseDate && { purchaseDate: new Date(purchaseDate) }),
          ...(price && { price: parseFloat(price) }),
          ...(notes !== undefined && { notes }),
        },
        include: {
          room: {
            include: {
              building: { include: { community: true } },
            },
          },
        },
      });

      res.json(asset);
    } catch (error) {
      next(error);
    }
  }
);

// 删除资产
router.delete('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      await prisma.asset.delete({
        where: { id },
      });

      res.json({ success: true, message: '资产已删除' });
    } catch (error) {
      next(error);
    }
  }
);

export { router as assetRouter };
