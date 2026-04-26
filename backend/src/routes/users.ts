import { Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// 获取用户列表（管理员）
router.get('/',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { role, department, search } = req.query;
      
      const where: any = { status: 'ACTIVE' };
      
      if (role) where.role = role;
      if (department) where.department = department;
      if (search) {
        where.OR = [
          { username: { contains: search as string, mode: 'insensitive' } },
          { realName: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string } },
        ];
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            username: true,
            realName: true,
            role: true,
            phone: true,
            department: true,
            avatar: true,
            status: true,
            createdAt: true,
            _count: {
              select: { rooms: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      res.json({
        data: users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      next(error);
    }
  }
);

// 获取单个用户
router.get('/:id',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      
      // 普通员工只能看自己的
      if (req.user?.role === 'STAFF' && req.user.userId !== id) {
        throw new AppError(403, '权限不足');
      }

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          rooms: {
            include: {
              building: {
                include: {
                  community: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new AppError(404, '用户不存在');
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  }
);

// 更新用户
router.patch('/:id',
  authenticate,
  [
    body('realName').optional().trim().notEmpty(),
    body('phone').optional().trim(),
    body('department').optional().trim(),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      
      // 只能改自己或管理员改别人
      if (req.user?.role !== 'ADMIN' && req.user?.userId !== id) {
        throw new AppError(403, '权限不足');
      }

      const { realName, phone, department, avatar } = req.body;

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(realName && { realName }),
          ...(phone && { phone }),
          ...(department && { department }),
          ...(avatar && { avatar }),
        },
      });

      res.json(user);
    } catch (error) {
      next(error);
    }
  }
);

// 删除用户（软删除）
router.delete('/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      await prisma.user.update({
        where: { id },
        data: { status: 'DELETED' },
      });

      res.json({ success: true, message: '用户已删除' });
    } catch (error) {
      next(error);
    }
  }
);

// 重置密码（管理员）
router.post('/:id/reset-password',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      const passwordHash = await hashPassword(newPassword || '123456');

      await prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          isFirstLogin: true,
        },
      });

      res.json({ success: true, message: '密码已重置' });
    } catch (error) {
      next(error);
    }
  }
);

export { router as userRouter };
