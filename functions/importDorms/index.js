// 云函数：批量导入宿舍数据
const cloud = require('@cloudbase/node-sdk');

const app = cloud.init({
  env: cloud.SYMBOL_CURRENT_ENV,
});

const db = app.database();

exports.main = async (event, context) => {
  const { action, data } = event;
  
  try {
    // 批量导入宿舍数据
    if (action === 'importDorms' && Array.isArray(data)) {
      const results = [];
      let success = 0;
      let updated = 0;
      let failed = 0;
      
      for (const item of data) {
        try {
          // 生成唯一ID
          const docId = `DORM_${item.communityId}_${item.building}_${item.roomNumber}`.replace(/[^a-zA-Z0-9_-]/g, '_');
          
          const dormData = {
            _id: docId,
            communityId: item.communityId,
            building: item.building,
            floor: parseInt(item.floor) || 1,
            roomNumber: String(item.roomNumber),
            layout: parseInt(item.layout) || 4,
            status: 'normal',
            currentOccupants: 0,
            createdAt: new Date()
          };
          
          // 尝试添加
          await db.collection('dorms').add(dormData);
          success++;
          results.push({ id: docId, status: 'success' });
        } catch (err) {
          // 如果已存在，尝试更新
          if (err.message && (err.message.includes('duplicate') || err.message.includes('已存在'))) {
            try {
              const docId = `DORM_${item.communityId}_${item.building}_${item.roomNumber}`.replace(/[^a-zA-Z0-9_-]/g, '_');
              const { _id, ...updateData } = {
                communityId: item.communityId,
                building: item.building,
                floor: parseInt(item.floor) || 1,
                roomNumber: String(item.roomNumber),
                layout: parseInt(item.layout) || 4,
                updatedAt: new Date()
              };
              await db.collection('dorms').doc(docId).update(updateData);
              updated++;
              results.push({ id: docId, status: 'updated' });
            } catch (e) {
              failed++;
              results.push({ id: item.roomNumber, status: 'error', error: e.message });
            }
          } else {
            failed++;
            results.push({ id: item.roomNumber, status: 'error', error: err.message });
          }
        }
      }
      
      return {
        success: true,
        stats: { total: data.length, success, updated, failed },
        results
      };
    }
    
    // 获取导入统计
    if (action === 'getStats') {
      const count = await db.collection('dorms').count();
      return {
        success: true,
        count: count.total
      };
    }
    
    // 清空所有宿舍数据（危险操作）
    if (action === 'clearAll') {
      const result = await db.collection('dorms').get();
      for (const doc of result.data) {
        await db.collection('dorms').doc(doc._id).remove();
      }
      return {
        success: true,
        deleted: result.data.length
      };
    }
    
    return {
      success: false,
      error: '未知操作: ' + action
    };
    
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stack: err.stack
    };
  }
};
