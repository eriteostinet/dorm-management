// 小区
export interface Community {
  _id: string;
  name: string;
  address: string;
  manager: string;
  managerPhone: string;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

// 宿舍
export interface Dorm {
  _id: string;
  communityId: string;
  building: string;
  floor: number;
  status: 'normal' | 'maintenance' | 'disabled';
  repairCount: number;
  lastRepairDate: Date | null;
  createdAt: Date;
}

// 房间资产
export interface RoomAsset {
  assetId: string;
  name: '床' | '桌' | '椅';
  model: string;
  purchaseDate: Date;
  warrantyYears: number;
  status: 'normal' | 'repairing' | 'damaged';
  lastMaintenance: Date | null;
}

// 房间
export interface Room {
  _id: string;
  dormId: string;
  communityId: string;
  roomNo: string;
  layout: 0 | 1 | 3; // 0=家庭房(单人), 1=单人间, 3=3人间
  occupantId: string | null;
  occupantName: string | null;
  occupantDept: string | null;
  checkInDate: Date | null;
  status: 'vacant' | 'occupied' | 'maintenance';
  roomAssets: RoomAsset[];
}

// 员工
export interface Employee {
  _id: string;
  name: string;
  department: string;
  entryDate: Date;
  phone: string;
  avatar: string | null;
  currentCommunityId: string | null;
  currentDormId: string | null;
  currentRoomId: string | null;
  bedNo?: number | null; // 床位号（1号床、2号床、3号床）
  role: 'employee' | 'manager' | 'admin' | 'superAdmin';
  status: 'active' | 'disabled'; // 账号状态：启用/禁用
  password: string; // bcrypt加密后的密码
  isMaintainer: boolean;
  maintainerType: ('水电' | '木工' | '综合')[];
  maintainerCommunities: string[];
  history: {
    communityId: string;
    dormId: string;
    roomId: string;
    checkIn: Date;
    checkOut: Date;
    reason: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// 宿舍级资产
export interface DormAsset {
  _id: string;
  communityId: string;
  dormId: string;
  category: '热水器' | '空调' | '洗衣机' | '路由器';
  brand: string;
  model: string;
  serialNo: string;
  purchaseDate: Date;
  warrantyYears: number;
  location: string;
  status: 'normal' | 'warning' | 'repairing' | 'expired';
  nextMaintenance?: Date;
  maintenanceCount: number;
}

// 维修工单
export interface RepairTicket {
  _id: string;
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
  urgency: 'urgent' | 'normal' | 'low';
  status: 'reported' | 'assigned' | 'processing' | 'done' | 'confirmed' | 'cancelled';
  assignedTo: string | null;
  assignedName: string | null;
  assignedTime: Date | null;
  estimatedTime: Date | null;
  solution: string | null;
  materials: { name: string; qty: number; price: number }[];
  laborCost: number | null;
  totalCost: number | null;
  processImages: string[];
  completedDate: Date | null;
  confirmStatus: 'pending' | 'passed' | 'failed';
  confirmRemark: string | null;
  rating: number | null;
  comment: string | null;
  reportedAt: Date;
  startedAt: Date | null;
  confirmedAt: Date | null;
  isRecurrent: boolean;
  relatedTicketId: string | null;
  updatedAt?: Date;
}

// 缴费类型
export type PaymentType = 'water' | 'electricity' | 'rent' | 'other';

// 缴费状态
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

// 缴费账单
export interface Payment {
  _id: string;
  // 关联信息
  communityId: string;
  communityName: string;
  dormId: string;
  building: string;
  roomId: string;
  roomNo: string;
  occupantId: string | null;
  occupantName: string | null;
  
  // 费用信息
  type: PaymentType;
  typeName: string; // 水费、电费、房租、其他
  period: string; // 计费周期，如 "2026-03" 或 "2026-03-01 ~ 2026-03-31"
  amount: number; // 金额（元）
  unitPrice: number | null; // 单价（水电费需要）
  quantity: number | null; // 用量（水电费需要，度/吨）
  
  // 费用明细
  previousReading: number | null; // 上期读数
  currentReading: number | null; // 本期读数
  
  // 缴费状态
  status: PaymentStatus;
  dueDate: Date; // 缴费截止日期
  paidAt: Date | null; // 实际缴费时间
  paidBy: string | null; // 缴费人
  paymentMethod: 'cash' | 'wechat' | 'alipay' | 'bank' | null; // 缴费方式
  
  // 备注
  remark: string;
  
  // 操作记录
  createdBy: string; // 创建人
  createdAt: Date;
  updatedAt: Date;
}

// 缴费统计（按月/小区）
export interface PaymentStats {
  period: string; // 2026-03
  communityId: string;
  communityName: string;
  
  // 各类型费用统计
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
  
  // 汇总
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  collectionRate: number; // 收缴率
}

// 导出任务
export interface ExportTask {
  _id: string;
  fileName: string;
  fileUrl: string | null;
  status: 'pending' | 'processing' | 'done' | 'failed';
  type: 'allocation' | 'assets' | 'repair' | 'repairStats' | 'payment' | 'paymentStats';
  params: object;
  creatorId: string;
  createdAt: Date;
  completedAt: Date | null;
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
