import cloudbase from '@cloudbase/js-sdk';
import type { RepairTicket } from '../types';

const ENV_ID = 'dorm-system-5g5k2k8k-1byd118ff42';
let app: any = null;

function getApp() {
  if (!app) {
    app = cloudbase.init({ env: ENV_ID });
  }
  return app;
}

// 调用云函数
async function callFunction(name: string, data: any) {
  const result = await getApp().callFunction({
    name,
    data
  });
  return result.result;
}

// ==================== 维修工单 API ====================

// 获取所有工单
export async function apiGetRepairTickets(filters?: { 
  communityId?: string; 
  status?: string; 
  reporterId?: string; 
  assignedTo?: string;
  urgency?: string;
}): Promise<RepairTicket[]> {
  const result = await callFunction('repairdb', { 
    action: 'getAll',
    filters 
  });
  
  if (result.success) {
    return result.data || [];
  }
  throw new Error(result.error || '获取工单失败');
}

// 获取单个工单
export async function apiGetRepairTicketById(id: string): Promise<RepairTicket | undefined> {
  const result = await callFunction('repairdb', { 
    action: 'getById',
    ticketId: id 
  });
  
  if (result.success) {
    return result.data;
  }
  return undefined;
}

// 创建工单
export async function apiCreateRepairTicket(data: Partial<RepairTicket>): Promise<RepairTicket> {
  const result = await callFunction('repairdb', { 
    action: 'create',
    data 
  });
  
  if (result.success) {
    return result.data;
  }
  throw new Error(result.error || '创建工单失败');
}

// 更新工单
export async function apiUpdateRepairTicket(ticketId: string, data: Partial<RepairTicket>): Promise<void> {
  const result = await callFunction('repairdb', { 
    action: 'update',
    ticketId,
    data: { ...data, _id: ticketId }
  });
  
  if (!result.success) {
    throw new Error(result.error || '更新工单失败');
  }
}

// 同意报修
export async function apiApproveTicket(ticketId: string): Promise<{ success: boolean; message?: string }> {
  const result = await callFunction('repairdb', { 
    action: 'approve',
    ticketId 
  });
  
  if (result.success) {
    return { success: true, message: result.message };
  }
  return { success: false, message: result.error };
}

// 完成维修
export async function apiCompleteRepair(
  ticketId: string, 
  data: { solution: string; materials: any[]; laborCost: number; totalCost: number }
): Promise<{ success: boolean; message?: string }> {
  const result = await callFunction('repairdb', { 
    action: 'complete',
    ticketId,
    data 
  });
  
  if (result.success) {
    return { success: true, message: result.message };
  }
  return { success: false, message: result.error };
}

// 确认维修
export async function apiConfirmRepair(
  ticketId: string, 
  data: { confirmStatus: 'passed' | 'failed'; rating?: number; comment?: string }
): Promise<{ success: boolean; message?: string }> {
  const result = await callFunction('repairdb', { 
    action: 'confirm',
    ticketId,
    data 
  });
  
  if (result.success) {
    return { success: true, message: result.message };
  }
  return { success: false, message: result.error };
}

// 删除工单
export async function apiDeleteRepairTicket(ticketId: string): Promise<void> {
  const result = await callFunction('repairdb', { 
    action: 'delete',
    ticketId 
  });
  
  if (!result.success) {
    throw new Error(result.error || '删除工单失败');
  }
}

// 获取统计
export async function apiGetTicketStats(): Promise<{
  total: number;
  urgent: number;
  processing: number;
  reported: number;
  done: number;
}> {
  const result = await callFunction('repairdb', { action: 'count' });
  
  if (result.success) {
    return result.stats;
  }
  return { total: 0, urgent: 0, processing: 0, reported: 0, done: 0 };
}
