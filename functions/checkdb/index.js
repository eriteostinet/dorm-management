const cloud = require('@cloudbase/node-sdk');

const app = cloud.init({
  env: cloud.SYMBOL_CURRENT_ENV,
});

const db = app.database();

exports.main = async (event, context) => {
  try {
    // 检查 repairTickets 集合
    let repairTicketsCount = 0;
    let repairTicketsError = null;
    
    try {
      const countResult = await db.collection('repairTickets').count();
      repairTicketsCount = countResult.total || 0;
    } catch (e) {
      repairTicketsError = e.message;
    }

    // 获取所有集合列表
    let collections = [];
    try {
      // 尝试读取数据来验证连接
      const testQuery = await db.collection('repairTickets').limit(1).get();
      collections.push({
        name: 'repairTickets',
        exists: true,
        sampleData: testQuery.data || []
      });
    } catch (e) {
      collections.push({
        name: 'repairTickets',
        exists: false,
        error: e.message
      });
    }

    return {
      success: true,
      env: process.env.ENV_ID,
      repairTicketsCount,
      repairTicketsError,
      collections,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stack: err.stack
    };
  }
};
