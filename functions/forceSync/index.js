const cloud = require('@cloudbase/node-sdk');

const app = cloud.init({
  env: cloud.SYMBOL_CURRENT_ENV,
});

const db = app.database();

// 强制写入测试数据
exports.main = async (event, context) => {
  try {
    // 写入 4 条测试数据
    const testData = [
      {
        _id: 'TKT_001',
        ticketType: 'repair',
        communityId: 'JW',
        dormId: 'JW-A101',
        roomId: '101',
        reporterId: 'emp001',
        reporterName: '张三',
        category: '水电',
        subCategory: '水管漏水',
        description: '卫生间水管漏水严重',
        urgency: 'urgent',
        status: 'reported',
        images: [],
        reportedAt: new Date('2026-03-17T10:00:00Z')
      },
      {
        _id: 'TKT_002', 
        ticketType: 'repair',
        communityId: 'TY',
        dormId: 'TY-B202',
        roomId: '202',
        reporterId: 'emp002',
        reporterName: '李四',
        category: '电器',
        subCategory: '空调不冷',
        description: '空调不制冷',
        urgency: 'normal',
        status: 'processing',
        images: [],
        reportedAt: new Date('2026-03-17T09:00:00Z'),
        startedAt: new Date('2026-03-17T09:30:00Z')
      },
      {
        _id: 'TKT_003',
        ticketType: 'complaint',
        communityId: 'HY',
        dormId: 'HY-C303',
        roomId: '303',
        reporterId: 'emp003',
        reporterName: '王五',
        category: '噪音',
        subCategory: '夜间噪音',
        description: '隔壁房间夜间太吵',
        urgency: 'normal',
        status: 'reported',
        images: [],
        reportedAt: new Date('2026-03-17T08:00:00Z')
      },
      {
        _id: 'TKT_004',
        ticketType: 'repair',
        communityId: 'JW',
        dormId: 'JW-D404',
        roomId: '404',
        reporterId: 'emp004',
        reporterName: '赵六',
        category: '家具',
        subCategory: '门锁损坏',
        description: '房间门锁坏了',
        urgency: 'urgent',
        status: 'done',
        images: [],
        reportedAt: new Date('2026-03-16T10:00:00Z'),
        startedAt: new Date('2026-03-16T11:00:00Z'),
        completedDate: new Date('2026-03-17T08:00:00Z'),
        solution: '已更换新锁'
      }
    ];

    const results = [];
    for (const item of testData) {
      try {
        await db.collection('repairTickets').add(item);
        results.push({ id: item._id, status: 'success' });
      } catch (e) {
        if (e.message.includes('duplicate')) {
          results.push({ id: item._id, status: 'exists' });
        } else {
          results.push({ id: item._id, status: 'error', error: e.message });
        }
      }
    }

    // 统计
    const count = await db.collection('repairTickets').count();
    
    return {
      success: true,
      message: '数据写入完成',
      inserted: results.filter(r => r.status === 'success').length,
      existing: results.filter(r => r.status === 'exists').length,
      errors: results.filter(r => r.status === 'error').length,
      total: count.total,
      results
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
