// dataService.ts - 后端 API 版本
// 所有数据操作通过 API 调用，数据存储在服务器 PostgreSQL 中
// 替换原来的 Dexie 本地存储方案

import { api } from '../api/client';

// ========== 类型导出（保持兼容）==========
export type { PaymentType, PaymentStatus } from '../types';

// ========== 小区 ==========
export async function getAllCommunities() {
  return api.getCommunities();
}

export async function getCommunities() {
  return api.getCommunities();
}

export async function getCommunityById(id: string) {
  const communities = await api.getCommunities();
  return communities.find((c: any) => c.id === id);
}

export async function createCommunity(data: any) {
  return api.createCommunity(data);
}

export async function updateCommunity(id: string, data: any) {
  return api.updateCommunity(id, data);
}

// ========== 楼栋 ==========
export async function getAllDorms() {
  return api.getDorms();
}

export async function getDorms(communityId?: string) {
  return api.getDorms(communityId);
}

export async function getDormById(id: string) {
  const dorms = await api.getDorms();
  return dorms.find((d: any) => d.id === id);
}

export async function createDorm(data: any) {
  return api.createDorm(data);
}

// ========== 房间 ==========
export async function getAllRooms() {
  return api.getRooms();
}

export async function getRooms(params?: { communityId?: string; dormId?: string; status?: string }) {
  return api.getRooms(params);
}

export async function getRoomById(id: string) {
  return api.getRoom(id);
}

export async function createRoom(data: any) {
  return api.createRoom(data);
}

export async function checkIn(roomId: string, occupantId: string) {
  return api.checkIn(roomId, occupantId);
}

export async function checkOut(roomId: string) {
  return api.checkOut(roomId);
}

export async function transfer(oldRoomId: string, newRoomId: string, occupantId: string) {
  return api.transferRoom(oldRoomId, newRoomId, occupantId);
}

// ========== 员工/用户 ==========
export async function getAllEmployees() {
  return api.getUsers();
}

export async function getEmployees() {
  return api.getUsers();
}

export async function getEmployeeById(id: string) {
  return api.getUser(id);
}

export async function createEmployee(data: any) {
  return api.register(data);
}

// ========== 报修 ==========
export async function getAllRepairTickets() {
  return api.getTickets();
}

export async function getRepairTickets(params?: { status?: string; reporterId?: string }) {
  return api.getTickets(params);
}

export async function getTicketById(id: string) {
  return api.getTicket(id);
}

export async function createRepairTicket(data: any) {
  return api.createTicket(data);
}

// 同意报修（调用后端审批接口，直接进入处理中）
export async function approveTicket(id: string, assignedTo?: string) {
  return api.rawRequest(`/tickets/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(assignedTo ? { assignedTo } : {}),
  });
}

// 开始维修
export async function startRepair(id: string) {
  return api.rawRequest(`/tickets/${id}/start`, { method: 'POST' });
}

// 完成维修（调用后端完成接口）
export async function completeRepair(id: string, solution: string, processImages?: string[], laborCost?: number, materialCost?: number) {
  return api.rawRequest(`/tickets/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ solution, processImages, laborCost, materialCost }),
  });
}

// 用户验收（兼容旧名）
export async function confirmTicket(id: string, data?: { rating?: number; comment?: string; confirmStatus?: string }) {
  return api.confirmTicket(id, data);
}

export { confirmTicket as confirmRepair };

// ========== 缴费 ==========
export const PAYMENT_TYPE_CONFIG: Record<string, { name: string; unit: string | null; hasReading: boolean }> = {
  water: { name: '水费', unit: '吨', hasReading: true },
  electricity: { name: '电费', unit: '度', hasReading: true },
  rent: { name: '房租', unit: null, hasReading: false },
  other: { name: '其他', unit: null, hasReading: false },
};

export async function getPayments(filters?: {
  communityId?: string;
  roomId?: string;
  type?: string;
  status?: string;
  period?: string;
}) {
  return api.getPayments(filters);
}

export async function getPaymentById(id: string) {
  const payments = await api.getPayments();
  return payments.find((p: any) => p.id === id);
}

export async function createPayment(data: any) {
  return api.createPayment(data);
}

export async function batchCreatePayments(communityId: string, type: string, period: string, configs: any) {
  // 获取小区下所有已入住房间
  const rooms = await api.getRooms({ communityId, status: 'OCCUPIED' });
  
  let created = 0;
  let failed = 0;

  for (const room of rooms) {
    try {
      await api.createPayment({
        communityId,
        roomId: room.id,
        occupantId: room.occupantId,
        type,
        period,
        amount: configs.defaultAmount || 0,
        unitPrice: configs.unitPrice,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      });
      created++;
    } catch {
      failed++;
    }
  }

  return {
    success: true,
    created,
    failed,
    message: `成功创建 ${created} 条账单，失败 ${failed} 条`,
  };
}

export async function payPayment(id: string, data: { paidBy: string; paymentMethod: string }) {
  return api.payPayment(id, data);
}

export async function updatePayment(id: string, data: any) {
  return api.updatePayment(id, data);
}

export async function cancelPayment(id: string, reason: string) {
  return api.updatePayment(id, { status: 'CANCELLED', remark: reason });
}

export async function deletePayment(id: string) {
  return api.deletePayment(id);
}

export async function batchPayPayments(ids: string[], data: { paidBy: string; paymentMethod: string }) {
  let paid = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      await api.payPayment(id, data);
      paid++;
    } catch {
      failed++;
    }
  }

  return {
    success: true,
    paid,
    failed,
    message: `成功缴费 ${paid} 条，失败 ${failed} 条`,
  };
}

export async function getPaymentStats(params?: { communityId?: string; period?: string }) {
  return api.getPaymentStats(params);
}

export async function getOverduePayments() {
  const payments = await api.getPayments({ status: 'OVERDUE' });
  const now = new Date();
  return payments
    .filter((p: any) => new Date(p.dueDate) < now)
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

export async function getRoomPaymentHistory(roomId: string) {
  return api.getPayments({ roomId });
}

// ========== 导出任务（简化版）==========
export async function getAllExportTasks() {
  return [];
}

export async function getExportTasks() {
  return [];
}

export async function createExportTask(data: any) {
  return { ...data, id: `EXP${Date.now()}`, status: 'done' };
}

// ========== 数据初始化（已废弃，数据在服务器端管理）==========
export async function initDefaultData() {
  console.log('数据初始化已在服务器端完成');
  return true;
}

export async function syncAllToCloud() {
  console.log('数据已在服务器端，无需同步');
  return true;
}

export async function syncFromCloud() {
  console.log('数据已在服务器端，无需同步');
  return true;
}

export async function clearAllData() {
  console.warn('clearAllData 已被禁用，数据在服务器端管理');
  return false;
}
