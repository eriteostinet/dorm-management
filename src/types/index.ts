// ============================================================
// 类型定义 - 兼容前后端
// 后端 Prisma 使用: id, 大写枚举
// 前端保留 _id 兼容旧代码，同时支持新字段
// ============================================================

// 小区
export interface Community {
  id: string;
  _id?: string; // 兼容旧代码
  name: string;
  address: string;
  manager: string;
  managerPhone: string;
  sortOrder: number;
  status: 'active' | 'inactive' | 'ACTIVE' | 'INACTIVE';
  createdAt: Date | string;
  updatedAt: Date | string;
}

// 楼栋
export interface Dorm {
  id: string;
  _id?: string;
  communityId: string;
  building: string;
  name?: string;
  floor: number;
  floors?: number;
  status: 'normal' | 'maintenance' | 'disabled';
  repairCount: number;
  lastRepairDate: Date | string | null;
  createdAt: Date | string;
}

// 房间资产
export interface RoomAsset {
  assetId: string;
  name: '床' | '桌' | '椅';
  model: string;
  purchaseDate: Date | string;
  warrantyYears: number;
  status: 'normal' | 'repairing' | 'damaged';
  lastMaintenance: Date | string | null;
}

// 房间
export interface Room {
  id: string;
  _id?: string;
  dormId: string;
  buildingId?: string;
  communityId: string;
  roomNo: string;
  roomNumber?: string;
  layout: 0 | 1 | 3;
  occupantId: string | null;
  occupantName: string | null;
  occupantDept: string | null;
  checkInDate: Date | string | null;
  status: 'vacant' | 'occupied' | 'maintenance' | 'VACANT' | 'OCCUPIED' | 'MAINTENANCE';
  roomAssets: RoomAsset[];
  bedCount?: number;
  area?: number;
  pricePerMonth?: number;
}

// 员工
export interface Employee {
  id: string;
  _id?: string;
  name: string;
  realName?: string;
  username?: string;
  department: string;
  entryDate: Date | string;
  phone: string;
  avatar: string | null;
  currentCommunityId: string | null;
  currentDormId: string | null;
  currentRoomId: string | null;
  bedNo?: number | null;
  role: 'employee' | 'manager' | 'admin' | 'superAdmin' | 'ADMIN' | 'STAFF' | 'MAINTENANCE';
  status: 'active' | 'disabled' | 'ACTIVE' | 'INACTIVE' | 'DELETED';
  password: string;
  isMaintainer: boolean;
  maintainerType: ('水电' | '木工' | '综合')[];
  maintainerCommunities: string[];
  history: {
    communityId: string;
    dormId: string;
    roomId: string;
    checkIn: Date | string;
    checkOut: Date | string;
    reason: string;
  }[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

// 宿舍级资产
export interface DormAsset {
  id: string;
  _id?: string;
  communityId: string;
  dormId: string;
  category: '热水器' | '空调' | '洗衣机' | '路由器';
  brand: string;
  model: string;
  serialNo: string;
  purchaseDate: Date | string;
  warrantyYears: number;
  location: string;
  status: 'normal' | 'warning' | 'repairing' | 'expired';
  nextMaintenance?: Date | string;
  maintenanceCount: number;
}

// 维修工单 - 兼容后端 Prisma 大写枚举
export interface RepairTicket {
  id: string;
  _id?: string;
  ticketType: 'asset' | 'facility';
  communityId: string;
  dormId: string;
  roomId: string | null;
  reporterId: string;
  reporterName: string;
  category: string;
  subCategory: string;
  description: string;
  images: string[];
  urgency: 'urgent' | 'normal' | 'low' | 'HIGH' | 'NORMAL' | 'LOW' | 'URGENT';
  status: 'reported' | 'assigned' | 'processing' | 'done' | 'confirmed' | 'cancelled' | 'PENDING' | 'APPROVED' | 'PROCESSING' | 'DONE' | 'CONFIRMED' | 'CANCELLED';
  assignedTo: string | null;
  assignedName: string | null;
  assignedTime: Date | string | null;
  estimatedTime: Date | string | null;
  solution: string | null;
  materials: { name: string; qty: number; price: number }[];
  laborCost: number | null;
  materialCost: number | null;
  totalCost: number | null;
  processImages: string[];
  completedDate: Date | string | null;
  confirmStatus: 'pending' | 'passed' | 'failed';
  confirmRemark: string | null;
  rating: number | null;
  comment: string | null;
  reportedAt: Date | string;
  startedAt: Date | string | null;
  confirmedAt: Date | string | null;
  isRecurrent: boolean;
  relatedTicketId: string | null;
  updatedAt?: Date | string;
}

// 缴费类型 - 兼容后端大写枚举
export type PaymentType = 'water' | 'electricity' | 'rent' | 'other' | 'RENT' | 'WATER' | 'ELECTRICITY' | 'OTHER';

// 缴费状态 - 兼容后端大写枚举
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'UNPAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

// 缴费账单
export interface Payment {
  id: string;
  _id?: string;
  communityId: string;
  communityName: string;
  dormId: string;
  building: string;
  roomId: string;
  roomNo: string;
  roomNumber?: string;
  occupantId: string | null;
  occupantName: string | null;
  type: PaymentType;
  typeName: string;
  period: string;
  amount: number;
  unitPrice: number | null;
  quantity: number | null;
  previousReading: number | null;
  currentReading: number | null;
  status: PaymentStatus;
  dueDate: Date | string;
  paidAt: Date | string | null;
  paidBy: string | null;
  paymentMethod: 'cash' | 'wechat' | 'alipay' | 'bank' | null;
  remark: string;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// 缴费统计
export interface PaymentStats {
  period: string;
  communityId: string;
  communityName: string;
  water: {
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    roomCount: number;
  };
  electricity: {
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    roomCount: number;
  };
  rent: {
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    roomCount: number;
  };
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  collectionRate: number;
}

// 导出任务
export interface ExportTask {
  id: string;
  _id?: string;
  fileName: string;
  fileUrl: string | null;
  status: 'pending' | 'processing' | 'done' | 'failed';
  type: 'allocation' | 'assets' | 'repair' | 'repairStats' | 'payment' | 'paymentStats';
  params: object;
  creatorId: string;
  createdAt: Date | string;
  completedAt: Date | string | null;
}

// 导入错误
export interface ImportError {
  row: number;
  field: string;
  value: any;
  reason: string;
}

// 导入结果
export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: ImportError[];
}

// 用户上下文
export interface UserContext {
  employee: Employee | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}
