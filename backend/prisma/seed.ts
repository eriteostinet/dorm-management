import { PrismaClient, Role, RoomStatus, PaymentType, PaymentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始创建种子数据...');

  // 1. 创建管理员
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      realName: '系统管理员',
      phone: '13800138000',
      department: '管理部',
      isFirstLogin: true,
    },
  });
  console.log('✓ 创建管理员: admin / admin123');

  // 2. 创建员工
  const staffPassword = await bcrypt.hash('123456', 12);
  const staff1 = await prisma.user.create({
    data: {
      username: 'E001',
      passwordHash: staffPassword,
      role: Role.STAFF,
      realName: '张三',
      phone: '13800138001',
      department: '技术部',
    },
  });

  const staff2 = await prisma.user.create({
    data: {
      username: 'E002',
      passwordHash: staffPassword,
      role: Role.STAFF,
      realName: '李四',
      phone: '13800138002',
      department: '市场部',
    },
  });
  console.log('✓ 创建员工: E001, E002 / 123456');

  // 3. 创建维修工
  const maintPassword = await bcrypt.hash('123456', 12);
  const maint1 = await prisma.user.create({
    data: {
      username: 'M001',
      passwordHash: maintPassword,
      role: Role.MAINTENANCE,
      realName: '王师傅',
      phone: '13800138003',
      department: '维修部',
    },
  });
  console.log('✓ 创建维修工: M001 / 123456');

  // 4. 创建小区
  const community = await prisma.community.create({
    data: {
      name: '阳光花园',
      address: '北京市朝阳区阳光大街1号',
      adminId: admin.id,
    },
  });
  console.log('✓ 创建小区: 阳光花园');

  // 5. 创建楼栋
  const buildingA = await prisma.building.create({
    data: {
      communityId: community.id,
      name: 'A栋',
      floors: 6,
      units: 2,
    },
  });

  const buildingB = await prisma.building.create({
    data: {
      communityId: community.id,
      name: 'B栋',
      floors: 6,
      units: 2,
    },
  });
  console.log('✓ 创建楼栋: A栋, B栋');

  // 6. 创建房间
  const rooms = [];
  for (let floor = 1; floor <= 3; floor++) {
    for (let unit = 1; unit <= 2; unit++) {
      for (let room = 1; room <= 3; room++) {
        const roomNumber = `${floor}0${unit}${room}`;
        rooms.push({
          buildingId: buildingA.id,
          communityId: community.id,
          roomNumber,
          floor,
          area: 20 + Math.floor(Math.random() * 10),
          bedCount: 2 + Math.floor(Math.random() * 2),
          pricePerMonth: 500 + Math.floor(Math.random() * 500),
          status: RoomStatus.VACANT,
        });
      }
    }
  }

  for (let floor = 1; floor <= 2; floor++) {
    for (let unit = 1; unit <= 2; unit++) {
      for (let room = 1; room <= 3; room++) {
        const roomNumber = `${floor}0${unit}${room}`;
        rooms.push({
          buildingId: buildingB.id,
          communityId: community.id,
          roomNumber,
          floor,
          area: 20 + Math.floor(Math.random() * 10),
          bedCount: 2 + Math.floor(Math.random() * 2),
          pricePerMonth: 500 + Math.floor(Math.random() * 500),
          status: RoomStatus.VACANT,
        });
      }
    }
  }

  await prisma.room.createMany({ data: rooms });
  console.log(`✓ 创建 ${rooms.length} 个房间`);

  // 7. 入住登记
  const allRooms = await prisma.room.findMany();
  
  await prisma.room.update({
    where: { id: allRooms[0].id },
    data: {
      status: RoomStatus.OCCUPIED,
      occupantId: staff1.id,
      occupantName: staff1.realName,
      checkInDate: new Date('2026-01-15'),
    },
  });

  await prisma.room.update({
    where: { id: allRooms[1].id },
    data: {
      status: RoomStatus.OCCUPIED,
      occupantId: staff2.id,
      occupantName: staff2.realName,
      checkInDate: new Date('2026-02-01'),
    },
  });
  console.log('✓ 入住登记完成');

  // 8. 创建资产
  await prisma.asset.createMany({
    data: [
      { roomId: allRooms[0].id, name: '空调', category: '电器', status: 'GOOD', price: 2500 },
      { roomId: allRooms[0].id, name: '床', category: '家具', status: 'GOOD', price: 800 },
      { roomId: allRooms[0].id, name: '衣柜', category: '家具', status: 'GOOD', price: 600 },
      { roomId: allRooms[1].id, name: '空调', category: '电器', status: 'GOOD', price: 2500 },
      { roomId: allRooms[1].id, name: '床', category: '家具', status: 'FAIR', price: 800 },
    ],
  });
  console.log('✓ 创建资产台账');

  // 9. 创建维修工单
  await prisma.repairTicket.create({
    data: {
      roomId: allRooms[0].id,
      reporterId: staff1.id,
      category: '水电',
      description: '卫生间水龙头漏水',
      urgency: 'NORMAL',
      status: 'PENDING',
    },
  });

  await prisma.repairTicket.create({
    data: {
      roomId: allRooms[1].id,
      reporterId: staff2.id,
      category: '电器',
      description: '空调不制冷',
      urgency: 'HIGH',
      status: 'APPROVED',
      assignedTo: maint1.id,
      approvedBy: admin.id,
      approvedAt: new Date(),
    },
  });
  console.log('✓ 创建维修工单');

  // 10. 创建缴费账单
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  await prisma.payment.createMany({
    data: [
      {
        roomId: allRooms[0].id,
        employeeId: staff1.id,
        type: PaymentType.RENT,
        amount: 800,
        period: currentMonth,
        dueDate: new Date(now.getFullYear(), now.getMonth(), 15),
        status: PaymentStatus.UNPAID,
      },
      {
        roomId: allRooms[0].id,
        employeeId: staff1.id,
        type: PaymentType.WATER,
        amount: 50,
        period: currentMonth,
        dueDate: new Date(now.getFullYear(), now.getMonth(), 15),
        status: PaymentStatus.UNPAID,
      },
      {
        roomId: allRooms[1].id,
        employeeId: staff2.id,
        type: PaymentType.RENT,
        amount: 750,
        period: currentMonth,
        dueDate: new Date(now.getFullYear(), now.getMonth(), 15),
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        paidBy: staff2.id,
        paymentMethod: '微信',
      },
    ],
  });
  console.log('✓ 创建缴费账单');

  console.log('\n=== 种子数据创建完成 ===');
  console.log('默认账号:');
  console.log('  管理员: admin / admin123 (首次登录需修改密码)');
  console.log('  员工: E001 / 123456');
  console.log('  员工: E002 / 123456');
  console.log('  维修工: M001 / 123456');
}

main()
  .catch((e) => {
    console.error('种子数据创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
