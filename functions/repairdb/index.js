const cloud = require('@cloudbase/node-sdk');

const app = cloud.init({
  env: cloud.SYMBOL_CURRENT_ENV,
});

const db = app.database();

// 生成工单号
function generateTicketId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `R${dateStr}${random}`;
}

exports.main = async (event, context) => {
  const { action, data, ticketId, filters } = event;
  
  try {
    // ===== 查询类操作 =====
    
    // 获取所有工单（支持筛选）
    if (action === 'getAll' || action === 'query') {
      let query = db.collection('repairTickets');
      
      // 应用筛选条件
      if (filters) {
        if (filters.status) query = query.where({ status: filters.status });
        if (filters.communityId) query = query.where({ communityId: filters.communityId });
        if (filters.reporterId) query = query.where({ reporterId: filters.reporterId });
        if (filters.assignedTo) query = query.where({ assignedTo: filters.assignedTo });
        if (filters.urgency) query = query.where({ urgency: filters.urgency });
      }
      
      const result = await query.orderBy('reportedAt', 'desc').get();
      return { 
        success: true, 
        action: 'getAll', 
        count: result.data.length,
        data: result.data 
      };
    }
    
    // 获取单个工单
    if (action === 'getById') {
      const result = await db.collection('repairTickets').doc(ticketId).get();
      if (result.data && result.data.length > 0) {
        return { success: true, data: result.data[0] };
      } else {
        return { success: false, error: '工单不存在' };
      }
    }
    
    // 统计工单数量
    if (action === 'count') {
      const total = await db.collection('repairTickets').count();
      const urgent = await db.collection('repairTickets').where({ urgency: 'urgent' }).count();
      const processing = await db.collection('repairTickets').where({ status: 'processing' }).count();
      const reported = await db.collection('repairTickets').where({ status: 'reported' }).count();
      const done = await db.collection('repairTickets').where({ status: 'done' }).count();
      
      return {
        success: true,
        stats: {
          total: total.total,
          urgent: urgent.total,
          processing: processing.total,
          reported: reported.total,
          done: done.total
        }
      };
    }
    
    // ===== 创建类操作 =====
    
    // 创建新工单
    if (action === 'create') {
      const newTicket = {
        _id: generateTicketId(),
        ticketType: data.ticketType || 'facility',
        communityId: data.communityId,
        dormId: data.dormId,
        roomId: data.roomId || null,
        reporterId: data.reporterId,
        reporterName: data.reporterName,
        category: data.category,
        subCategory: data.subCategory,
        description: data.description,
        images: data.images || [],
        urgency: data.urgency || 'normal',
        status: 'reported',
        assignedTo: null,
        assignedName: null,
        assignedTime: null,
        estimatedTime: null,
        solution: null,
        materials: [],
        laborCost: null,
        totalCost: null,
        processImages: [],
        completedDate: null,
        confirmStatus: 'pending',
        confirmRemark: null,
        rating: null,
        comment: null,
        reportedAt: new Date(),
        startedAt: null,
        confirmedAt: null,
        isRecurrent: false,
        relatedTicketId: null,
        updatedAt: new Date()
      };
      
      await db.collection('repairTickets').add(newTicket);
      return { success: true, ticketId: newTicket._id, data: newTicket };
    }
    
    // 批量创建（用于导入）
    if (action === 'batchCreate' && Array.isArray(data)) {
      const results = [];
      for (const item of data) {
        try {
          // 判断数据类型：如果是宿舍数据（有building字段），导入到dorms集合
          if (item.building !== undefined) {
            await db.collection('dorms').add(item);
          } else {
            // 否则导入到维修工单
            await db.collection('repairTickets').add(item);
          }
          results.push({ id: item._id, status: 'success' });
        } catch (e) {
          // 如果是重复键错误，尝试更新
          if (e.message && e.message.includes('duplicate')) {
            try {
              const { _id, ...updateData } = item;
              if (item.building !== undefined) {
                await db.collection('dorms').doc(_id).update(updateData);
              } else {
                await db.collection('repairTickets').doc(_id).update(updateData);
              }
              results.push({ id: item._id, status: 'updated' });
            } catch (e2) {
              results.push({ id: item._id, status: 'error', error: e2.message });
            }
          } else {
            results.push({ id: item._id, status: 'error', error: e.message });
          }
        }
      }
      return { success: true, results };
    }
    
    // ===== 更新类操作 =====
    
    // 同意报修（变为处理中）
    if (action === 'approve') {
      await db.collection('repairTickets').doc(ticketId).update({
        status: 'processing',
        startedAt: new Date(),
        updatedAt: new Date()
      });
      return { success: true, message: '工单已同意，进入处理中' };
    }
    
    // 完成维修
    if (action === 'complete') {
      const updateData = {
        status: 'done',
        solution: data.solution,
        materials: data.materials || [],
        laborCost: data.laborCost,
        totalCost: data.totalCost,
        completedDate: new Date(),
        updatedAt: new Date()
      };
      
      await db.collection('repairTickets').doc(ticketId).update(updateData);
      return { success: true, message: '工单已完成' };
    }
    
    // 确认验收
    if (action === 'confirm') {
      const newStatus = data.confirmStatus === 'passed' ? 'confirmed' : 'assigned';
      
      await db.collection('repairTickets').doc(ticketId).update({
        status: newStatus,
        confirmStatus: data.confirmStatus,
        rating: data.rating || null,
        comment: data.comment || null,
        confirmedAt: new Date(),
        updatedAt: new Date()
      });
      
      return { 
        success: true, 
        message: data.confirmStatus === 'passed' ? '验收通过' : '验收不通过，已退回' 
      };
    }
    
    // 通用更新
    if (action === 'update') {
      const { _id, ...updateData } = data;
      updateData.updatedAt = new Date();
      await db.collection('repairTickets').doc(_id || ticketId).update(updateData);
      return { success: true, message: '更新成功' };
    }
    
    // ===== 删除类操作 =====
    
    // 删除单个工单
    if (action === 'delete') {
      await db.collection('repairTickets').doc(ticketId).remove();
      return { success: true, message: '工单已删除' };
    }
    
    // 清空所有数据（危险）
    if (action === 'clear') {
      const result = await db.collection('repairTickets').get();
      for (const doc of result.data) {
        await db.collection('repairTickets').doc(doc._id).remove();
      }
      return { success: true, deleted: result.data.length };
    }
    
    // ===== 默认：返回状态 =====
    const count = await db.collection('repairTickets').count();
    return { 
      success: true, 
      action: 'status',
      count: count.total,
      message: '云数据库连接正常' 
    };
    
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stack: err.stack
    };
  }
};
