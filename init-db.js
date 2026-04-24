const tcb = require('@cloudbase/js-sdk');

const app = tcb.init({
  env: 'dorm-system-5g5k2k8k-1byd118ff42'
});

const db = app.database();

// 创建集合并设置权限
async function setupDB() {
  try {
    // 尝试创建 repairTickets 集合
    const result = await db.collection('repairTickets').add({
      _id: 'INIT_' + Date.now(),
      ticketType: 'facility',
      communityId: 'INIT',
      dormId: 'INIT',
      roomId: null,
      reporterId: 'system',
      reporterName: '系统初始化',
      category: '初始化',
      subCategory: '测试',
      description: '数据库初始化记录',
      images: [],
      urgency: 'normal',
      status: 'confirmed',
      assignedTo: null,
      assignedName: null,
      assignedTime: null,
      estimatedTime: null,
      solution: '系统自动创建',
      materials: [],
      laborCost: 0,
      totalCost: 0,
      processImages: [],
      completedDate: new Date(),
      confirmStatus: 'passed',
      confirmRemark: null,
      rating: 5,
      comment: '数据库初始化成功',
      reportedAt: new Date(),
      startedAt: new Date(),
      confirmedAt: new Date(),
      isRecurrent: false,
      relatedTicketId: null,
      updatedAt: new Date()
    });
    
    console.log('✅ 集合创建成功:', result);
  } catch (e) {
    console.error('❌ 创建失败:', e.message);
  }
}

setupDB();
