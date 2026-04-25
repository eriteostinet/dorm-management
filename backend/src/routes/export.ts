import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import * as XLSX from 'xlsx';

const router = Router();

// 导出员工数据
router.get('/employees', authenticate, requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: {
        username: true,
        realName: true,
        role: true,
        phone: true,
        department: true,
        createdAt: true,
      },
    });

    const data = users.map(u => ({
      '账号': u.username,
      '姓名': u.realName,
      '角色': u.role === 'ADMIN' ? '管理员' : u.role === 'STAFF' ? '员工' : '维修工',
      '电话': u.phone || '',
      '部门': u.department || '',
      '创建时间': u.createdAt.toISOString().split('T')[0],
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '员工列表');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=employees.xlsx');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// 导出房间数据
router.get('/rooms', authenticate, requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        building: { include: { community: true } },
        occupant: { select: { realName: true, phone: true, department: true } },
      },
    });

    const data = rooms.map(r => ({
      '小区': r.building.community.name,
      '楼栋': r.building.name,
      '房号': r.roomNumber,
      '楼层': r.floor,
      '面积': r.area || '',
      '床位': r.bedCount,
      '月租': r.pricePerMonth || '',
      '状态': r.status === 'OCCUPIED' ? '已入住' : r.status === 'VACANT' ? '空置' : '维修中',
      '入住人': r.occupant?.realName || '',
      '电话': r.occupant?.phone || '',
      '部门': r.occupant?.department || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '房间列表');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=rooms.xlsx');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// 导出缴费数据
router.get('/payments', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { period } = req.query;

    const where: any = {};
    if (period) where.period = period as string;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        room: {
          include: {
            building: { include: { community: true } },
          },
        },
        employee: { select: { realName: true } },
      },
    });

    const data = payments.map(p => ({
      '小区': p.room.building.community.name,
      '楼栋': p.room.building.name,
      '房号': p.room.roomNumber,
      '入住人': p.employee.realName,
      '类型': p.type === 'RENT' ? '房租' : p.type === 'WATER' ? '水费' : p.type === 'ELECTRICITY' ? '电费' : '其他',
      '金额': p.amount,
      '周期': p.period,
      '截止日期': p.dueDate.toISOString().split('T')[0],
      '状态': p.status === 'PAID' ? '已缴' : p.status === 'UNPAID' ? '未缴' : '逾期',
      '缴费时间': p.paidAt ? p.paidAt.toISOString().split('T')[0] : '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '缴费记录');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=payments.xlsx');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export { router as exportRouter };
