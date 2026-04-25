import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// 看板数据
router.get('/', authenticate, requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [
      totalRooms,
      occupiedRooms,
      totalUsers,
      pendingTickets,
      processingTickets,
      monthlyPayments,
      monthlyPaid,
      communities,
      recentTickets,
      recentCheckins,
    ] = await Promise.all([
      prisma.room.count(),
      prisma.room.count({ where: { status: 'OCCUPIED' } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.repairTicket.count({ where: { status: 'PENDING' } }),
      prisma.repairTicket.count({ where: { status: 'PROCESSING' } }),
      prisma.payment.aggregate({
        where: { period: currentMonth },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: { period: currentMonth, status: 'PAID' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.community.findMany({
        where: { status: 'ACTIVE' },
        include: {
          _count: {
            select: { rooms: true },
          },
        },
      }),
      prisma.repairTicket.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          room: { include: { building: true } },
          reporter: { select: { realName: true } },
        },
      }),
      prisma.room.findMany({
        where: { status: 'OCCUPIED' },
        take: 5,
        orderBy: { checkInDate: 'desc' },
        include: {
          occupant: { select: { realName: true, department: true } },
          building: { include: { community: true } },
        },
      }),
    ]);

    const vacancyRate = totalRooms > 0 
      ? Math.round(((totalRooms - occupiedRooms) / totalRooms) * 100) 
      : 0;

    const collectionRate = monthlyPayments._count.id > 0
      ? Math.round((monthlyPaid._count.id / monthlyPayments._count.id) * 100)
      : 0;

    // 月度趋势（近6个月）
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const monthlyStats = await Promise.all(
      months.map(async (period) => {
        const [total, paid] = await Promise.all([
          prisma.payment.aggregate({
            where: { period },
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.payment.aggregate({
            where: { period, status: 'PAID' },
            _sum: { amount: true },
            _count: { id: true },
          }),
        ]);

        return {
          period,
          totalAmount: total._sum.amount || 0,
          paidAmount: paid._sum.amount || 0,
          totalCount: total._count.id,
          paidCount: paid._count.id,
        };
      })
    );

    // 工单统计
    const ticketStats = await prisma.repairTicket.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    res.json({
      overview: {
        totalRooms,
        occupiedRooms,
        vacancyRate,
        totalUsers,
        pendingTickets,
        processingTickets,
        monthlyRevenue: monthlyPayments._sum.amount || 0,
        monthlyCollected: monthlyPaid._sum.amount || 0,
        collectionRate,
      },
      communities: communities.map(c => ({
        ...c,
        occupancyRate: c._count.rooms > 0 ? 100 - Math.round(((c._count.rooms - occupiedRooms) / c._count.rooms) * 100) : 0,
      })),
      recentTickets,
      recentCheckins,
      monthlyStats,
      ticketStats,
    });
  } catch (error) {
    next(error);
  }
});

export { router as dashboardRouter };
