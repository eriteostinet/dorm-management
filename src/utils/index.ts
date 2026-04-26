// 计算入职时长
export const calculateTenure = (entryDate: Date): string => {
  const diff = new Date().getTime() - new Date(entryDate).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);
  
  if (days < 30) return `${days}天`;
  if (months < 12) return `${months}个月`;
  return `${years}年${months % 12}个月`;
};

// 计算资产剩余保修月数
export const calculateWarrantyRemaining = (purchaseDate: Date, warrantyYears: number): number => {
  const usedMonths = Math.floor((new Date().getTime() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
  return warrantyYears * 12 - usedMonths;
};

// 获取资产状态
export const getAssetStatus = (purchaseDate: Date, warrantyYears: number): { status: string; color: string } => {
  const remaining = calculateWarrantyRemaining(purchaseDate, warrantyYears);
  if (remaining <= 0) return { status: 'expired', color: '#ff4d4f' };
  if (remaining <= 6) return { status: 'warning', color: '#faad14' };
  return { status: 'normal', color: '#52c41a' };
};

// 格式化日期
export const formatDate = (date: Date | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('zh-CN');
};

// 格式化日期时间
export const formatDateTime = (date: Date | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

// 获取工单状态文本和颜色
export const getTicketStatusInfo = (status: string): { text: string; color: string } => {
  const map: Record<string, { text: string; color: string }> = {
    PENDING: { text: '待同意', color: '#faad14' },
    APPROVED: { text: '已同意', color: '#1890ff' },
    PROCESSING: { text: '处理中', color: '#722ed1' },
    DONE: { text: '待验收', color: '#13c2c2' },
    CONFIRMED: { text: '已完成', color: '#52c41a' },
    CANCELLED: { text: '已取消', color: '#999' },
  };
  return map[status] || { text: status, color: '#999' };
};

// 获取紧急度文本和颜色
export const getUrgencyInfo = (urgency: string): { text: string; color: string } => {
  const map: Record<string, { text: string; color: string }> = {
    HIGH: { text: '紧急', color: '#ff4d4f' },
    NORMAL: { text: '一般', color: '#faad14' },
    LOW: { text: '低', color: '#52c41a' },
  };
  return map[urgency] || { text: urgency, color: '#999' };
};

// 获取小区标签颜色
export const getCommunityColor = (communityId: string): string => {
  const map: Record<string, string> = {
    JW: '#1890ff',
    TY: '#52c41a',
    HY: '#fa8c16',
  };
  return map[communityId] || '#999';
};
