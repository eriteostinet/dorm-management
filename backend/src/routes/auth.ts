import { Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { generateTokens, hashPassword, comparePassword } from '../lib/auth';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// 登录（带失败次数限制）
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 15 * 60 * 1000; // 15分钟

router.post('/login',
  [
    body('username').trim().notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空'),
  ],
  async (req, res, next) => {
    try {
      const { username, password } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `${username}:${clientIp}`;

      // 检查是否被锁定
      const attempt = loginAttempts.get(key);
      if (attempt && attempt.lockedUntil > Date.now()) {
        const remaining = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
        throw new AppError(429, `登录失败次数过多，请${remaining}分钟后重试`);
      }

      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        // 记录失败
        recordFailedAttempt(key);
        throw new AppError(401, '用户名或密码错误');
      }

      if (user.status !== 'ACTIVE') {
        throw new AppError(401, '账号已被禁用');
      }

      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        recordFailedAttempt(key);
        throw new AppError(401, '用户名或密码错误');
      }

      // 登录成功，清除失败记录
      loginAttempts.delete(key);

      const tokens = generateTokens({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      res.json({
        success: true,
        ...tokens,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          realName: user.realName,
          phone: user.phone,
          department: user.department,
          isFirstLogin: user.isFirstLogin,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const existing = loginAttempts.get(key);
  if (existing) {
    existing.count++;
    if (existing.count >= MAX_ATTEMPTS) {
      existing.lockedUntil = now + LOCK_DURATION;
    }
  } else {
    loginAttempts.set(key, { count: 1, lockedUntil: 0 });
  }
}

// 注册（仅管理员可用）
router.post('/register',
  authenticate,
  [
    body('username').trim().isLength({ min: 3, max: 20 }).withMessage('用户名3-20个字符'),
    body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
    body('realName').trim().notEmpty().withMessage('姓名不能为空'),
    body('role').isIn(['ADMIN', 'STAFF', 'MAINTENANCE']).withMessage('无效的角色'),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      if (req.user?.role !== 'ADMIN') {
        throw new AppError(403, '只有管理员可以创建账号');
      }

      const { username, password, realName, role, phone, department } = req.body;

      const existing = await prisma.user.findUnique({
        where: { username },
      });

      if (existing) {
        throw new AppError(400, '用户名已存在');
      }

      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          username,
          passwordHash,
          realName,
          role,
          phone,
          department,
          isFirstLogin: true,
        },
      });

      res.status(201).json({
        success: true,
        userId: user.id,
        message: '账号创建成功',
      });
    } catch (error) {
      next(error);
    }
  }
);

// 获取当前用户
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        rooms: true,
      },
    });

    if (!user) {
      throw new AppError(404, '用户不存在');
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      realName: user.realName,
      phone: user.phone,
      department: user.department,
      avatar: user.avatar,
      isFirstLogin: user.isFirstLogin,
      status: user.status,
    });
  } catch (error) {
    next(error);
  }
});

// 修改密码
router.post('/change-password',
  authenticate,
  [
    body('oldPassword').notEmpty().withMessage('旧密码不能为空'),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码至少6位'),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { oldPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
      });

      if (!user) {
        throw new AppError(404, '用户不存在');
      }

      const isValid = await comparePassword(oldPassword, user.passwordHash);
      if (!isValid) {
        throw new AppError(400, '旧密码错误');
      }

      const newHash = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          isFirstLogin: false,
        },
      });

      res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
      next(error);
    }
  }
);

// 刷新令牌
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError(401, '未提供刷新令牌');
    }

    const { verifyRefreshToken } = await import('../lib/auth');
    const payload = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError(401, '令牌无效');
    }

    const tokens = generateTokens({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    res.json({ success: true, ...tokens });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
