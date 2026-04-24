import { useState, useRef, useEffect } from 'react';
import { Card, NavBar, Button, Toast, Dialog, Space, List, Tag, Badge, Tabs, Modal, Input, Selector, Checkbox, SearchBar } from 'antd-mobile';
import { Cloud, CloudUpload, CloudDownload, FileSpreadsheet, Edit3, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { 
  db, exportAllData, importAllData, clearAllData, initDefaultData,
  syncAllToCloud, restoreFromCloud, getSyncStatus, initCloudBase
} from '../../db/db';
import * as XLSX from 'xlsx';
import './DataManage.css';

interface DataManageProps {
  onBack: () => void;
}

// 导入错误类型
interface ImportError {
  row: number;
  field: string;
  value: any;
  reason: string;
}

// 预览数据类型
interface PreviewData {
  employees: any[];
  rooms: any[];
  errors: ImportError[];
  warnings: ImportError[];
}

export default function DataManage({ onBack }: DataManageProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<{ lastSync: Date | null; isOnline: boolean }>({ lastSync: null, isOnline: false });
  const [activeTab, setActiveTab] = useState('manage');
  
  // Excel导入相关状态
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'preview' | 'result'>('upload');
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<PreviewData>({ employees: [], rooms: [], errors: [], warnings: [] });
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: ImportError[] } | null>(null);
  
  // 数据编辑相关状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editType, setEditType] = useState<'employees' | 'rooms'>('employees');
  const [editData, setEditData] = useState<any[]>([]);
  const [editSearch, setEditSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [batchEditField, setBatchEditField] = useState('');
  const [batchEditValue, setBatchEditValue] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStats();
    loadSyncStatus();
    initCloudBase();
  }, []);

  // 加载统计数据
  const loadStats = async () => {
    const [communities, dorms, rooms, employees, tickets] = await Promise.all([
      db.communities.count(),
      db.dorms.count(),
      db.rooms.count(),
      db.employees.count(),
      db.repairTickets.count(),
    ]);
    setStats({ communities, dorms, rooms, employees, tickets });
  };

  // 加载同步状态
  const loadSyncStatus = async () => {
    const status = await getSyncStatus();
    setSyncStatus(status);
  };

  // ========== Excel高级导入功能 ==========
  
  // 1. 上传Excel文件
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length < 2) {
          Toast.show({ icon: 'fail', content: 'Excel文件数据不足' });
          setLoading(false);
          return;
        }

        const headers = (jsonData[0] as string[]).map(h => String(h).trim());
        const rows = jsonData.slice(1).map((row: any) => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => {
            obj[h] = row[i];
          });
          return obj;
        });

        setExcelHeaders(headers);
        setExcelData(rows);
        
        // 智能识别字段映射
        const autoMapping: Record<string, string> = {};
        headers.forEach(h => {
          if (/工号|员工号|编号|id|工號/i.test(h)) autoMapping[h] = '_id';
          else if (/姓名|名字|name|员工姓名/i.test(h)) autoMapping[h] = 'name';
          else if (/部门|dept|department|單位/i.test(h)) autoMapping[h] = 'department';
          else if (/电话|手机|phone|tel|電話/i.test(h)) autoMapping[h] = 'phone';
          else if (/房号|房间|room|房號/i.test(h)) autoMapping[h] = 'roomNo';
          else if (/楼栋|楼|building|樓/i.test(h)) autoMapping[h] = 'building';
          else if (/小区|社区|community|社區/i.test(h)) autoMapping[h] = 'community';
          else if (/性别|gender|性別/i.test(h)) autoMapping[h] = 'gender';
          else if (/入职|入职日期|entry|join/i.test(h)) autoMapping[h] = 'entryDate';
        });
        setFieldMapping(autoMapping);
        setImportStep('mapping');
        setImportModalVisible(true);
        Toast.show({ icon: 'success', content: `读取到 ${rows.length} 行数据` });
      } catch (err) {
        Toast.show({ icon: 'fail', content: '解析Excel失败' });
      }
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
    if (excelInputRef.current) excelInputRef.current.value = '';
  };

  // 2. 字段映射选项
  const fieldOptions = [
    { label: '工号', value: '_id' },
    { label: '姓名', value: 'name' },
    { label: '部门', value: 'department' },
    { label: '电话', value: 'phone' },
    { label: '性别', value: 'gender' },
    { label: '入职日期', value: 'entryDate' },
    { label: '房号', value: 'roomNo' },
    { label: '楼栋', value: 'building' },
    { label: '小区', value: 'community' },
    { label: '忽略此列', value: 'ignore' },
  ];

  // 3. 预览和校验数据
  const handlePreview = async () => {
    setLoading(true);
    const errors: ImportError[] = [];
    const warnings: ImportError[] = [];
    const employees: any[] = [];
    const rooms: any[] = [];
    
    // 获取现有数据用于校验
    const existingEmployees = await db.employees.toArray();
    const existingRooms = await db.rooms.toArray();
    const existingEmployeeIds = new Set(existingEmployees.map(e => e._id));
    
    excelData.forEach((row, index) => {
      const rowNum = index + 2;
      const employee: any = { _id: '', name: '', department: '', phone: '', role: 'employee' };
      let hasEmployeeData = false;
      
      // 映射字段
      Object.entries(fieldMapping).forEach(([excelCol, field]) => {
        if (field === 'ignore') return;
        const value = row[excelCol];
        if (value !== undefined && value !== null && value !== '') {
          employee[field] = String(value).trim();
          if (['_id', 'name'].includes(field)) hasEmployeeData = true;
        }
      });
      
      if (!hasEmployeeData) return;
      
      // 校验
      if (!employee._id) {
        errors.push({ row: rowNum, field: '工号', value: employee._id, reason: '工号不能为空' });
      } else if (existingEmployeeIds.has(employee._id)) {
        warnings.push({ row: rowNum, field: '工号', value: employee._id, reason: '工号已存在，将更新数据' });
      }
      
      if (!employee.name) {
        errors.push({ row: rowNum, field: '姓名', value: employee.name, reason: '姓名不能为空' });
      }
      
      if (employee.phone && !/^1[3-9]\d{9}$/.test(employee.phone)) {
        warnings.push({ row: rowNum, field: '电话', value: employee.phone, reason: '手机号格式不正确' });
      }
      
      // 房间信息处理
      if (employee.roomNo) {
        const room = existingRooms.find(r => r.roomNo === employee.roomNo);
        if (room) {
          employee.currentRoomId = room._id;
        } else {
          warnings.push({ row: rowNum, field: '房号', value: employee.roomNo, reason: '房间不存在，将自动创建' });
        }
      }
      
      employees.push(employee);
    });
    
    setPreviewData({ employees, rooms, errors, warnings });
    setImportStep('preview');
    setLoading(false);
  };

  // 4. 执行导入
  const handleExecuteImport = async () => {
    setLoading(true);
    let success = 0;
    let failed = 0;
    const errors: ImportError[] = [];
    
    try {
      for (const employee of previewData.employees) {
        try {
          const existing = await db.employees.get(employee._id);
          if (existing) {
            // 合并数据：保留原有字段，只更新导入的字段
            const updatedEmployee = {
              ...existing,
              ...employee,
              // 保留原有密码和创建时间
              password: existing.password,
              createdAt: existing.createdAt,
              updatedAt: new Date(),
            };
            await db.employees.update(employee._id, updatedEmployee);
          } else {
            // 新员工：设置默认值
            const newEmployee = {
              ...employee,
              role: employee.role || 'employee',
              status: employee.status || 'active',
              password: btoa('123456'),
              avatar: null,
              currentCommunityId: employee.currentCommunityId || null,
              currentDormId: employee.currentDormId || null,
              currentRoomId: employee.currentRoomId || null,
              isMaintainer: false,
              maintainerType: [],
              maintainerCommunities: [],
              history: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            await db.employees.add(newEmployee);
          }
          success++;
        } catch (err: any) {
          failed++;
          errors.push({ row: 0, field: '导入', value: employee._id, reason: err.message });
        }
      }
      
      // 同步到云端
      await syncAllToCloud();
      await loadStats();
      
      // 触发数据更新事件，通知其他页面刷新
      window.dispatchEvent(new CustomEvent('dorm-data-updated', { detail: { type: 'employees' } }));
      
      setImportResult({ success, failed, errors });
      setImportStep('result');
      Toast.show({ icon: 'success', content: `导入完成：成功 ${success} 条，失败 ${failed} 条` });
    } catch (err) {
      Toast.show({ icon: 'fail', content: '导入过程出错' });
    }
    setLoading(false);
  };

  // ========== 数据批量编辑功能 ==========
  
  // 打开编辑界面
  const openEditModal = async (type: 'employees' | 'rooms') => {
    setEditType(type);
    setEditSearch('');
    setSelectedItems([]);
    setLoading(true);
    
    try {
      let data: any[] = [];
      if (type === 'employees') {
        data = await db.employees.toArray();
      } else {
        data = await db.rooms.toArray();
      }
      setEditData(data);
      setEditModalVisible(true);
    } catch (err) {
      Toast.show({ icon: 'fail', content: '加载数据失败' });
    }
    setLoading(false);
  };

  // 过滤数据
  const filteredEditData = editData.filter(item => {
    const search = editSearch.toLowerCase();
    if (editType === 'employees') {
      return item._id?.toLowerCase().includes(search) || 
             item.name?.toLowerCase().includes(search) ||
             item.department?.toLowerCase().includes(search);
    } else {
      return item.roomNo?.toLowerCase().includes(search) ||
             item._id?.toLowerCase().includes(search);
    }
  });

  // 单条编辑
  const handleSingleEdit = (item: any) => {
    const fields = editType === 'employees' 
      ? ['_id:工号', 'name:姓名', 'department:部门', 'phone:电话']
      : ['roomNo:房号', 'status:状态'];
    
    Dialog.confirm({
      title: `编辑${editType === 'employees' ? '员工' : '房间'}`,
      content: (
        <div style={{ padding: '10px 0' }}>
          {fields.map(f => {
            const [key, label] = f.split(':');
            return (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{label}</div>
                <Input 
                  defaultValue={item[key]} 
                  onChange={val => item[key] = val}
                />
              </div>
            );
          })}
        </div>
      ),
      confirmText: '保存',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          if (editType === 'employees') {
            await db.employees.update(item._id, item);
          } else {
            await db.rooms.update(item._id, item);
          }
          await syncAllToCloud();
          Toast.show({ icon: 'success', content: '保存成功' });
          openEditModal(editType);
        } catch (err) {
          Toast.show({ icon: 'fail', content: '保存失败' });
        }
      }
    });
  };

  // 批量修改
  const handleBatchEdit = () => {
    if (selectedItems.length === 0) {
      Toast.show({ icon: 'fail', content: '请先选择要修改的数据' });
      return;
    }
    
    const fields = editType === 'employees'
      ? [
          { label: '部门', value: 'department' },
          { label: '角色', value: 'role' },
          { label: '维修工', value: 'isMaintainer' },
        ]
      : [
          { label: '状态', value: 'status' },
        ];
    
    Dialog.confirm({
      title: '批量修改',
      content: (
        <div style={{ padding: '10px 0' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#666' }}>选择字段</div>
            <Selector
              options={fields}
              value={[batchEditField]}
              onChange={val => setBatchEditField(val[0])}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>新值</div>
            <Input 
              value={batchEditValue}
              onChange={setBatchEditValue}
              placeholder="输入新值"
            />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#999' }}>
            将修改 {selectedItems.length} 条数据
          </div>
        </div>
      ),
      confirmText: '确认修改',
      cancelText: '取消',
      onConfirm: async () => {
        if (!batchEditField) {
          Toast.show({ icon: 'fail', content: '请选择要修改的字段' });
          return;
        }
        setLoading(true);
        try {
          for (const id of selectedItems) {
            const update: any = {};
            if (batchEditField === 'isMaintainer') {
              update[batchEditField] = batchEditValue === '是' || batchEditValue === 'true';
            } else {
              update[batchEditField] = batchEditValue;
            }
            
            if (editType === 'employees') {
              await db.employees.update(id, update);
            } else {
              await db.rooms.update(id, update);
            }
          }
          await syncAllToCloud();
          Toast.show({ icon: 'success', content: `已修改 ${selectedItems.length} 条数据` });
          setSelectedItems([]);
          openEditModal(editType);
        } catch (err) {
          Toast.show({ icon: 'fail', content: '批量修改失败' });
        }
        setLoading(false);
      }
    });
  };

  // 删除选中
  const handleBatchDelete = () => {
    if (selectedItems.length === 0) {
      Toast.show({ icon: 'fail', content: '请先选择要删除的数据' });
      return;
    }
    
    Dialog.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedItems.length} 条数据吗？`,
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: async () => {
        setLoading(true);
        try {
          if (editType === 'employees') {
            await db.employees.bulkDelete(selectedItems);
          } else {
            await db.rooms.bulkDelete(selectedItems);
          }
          await syncAllToCloud();
          await loadStats();
          Toast.show({ icon: 'success', content: '删除成功' });
          setSelectedItems([]);
          openEditModal(editType);
        } catch (err) {
          Toast.show({ icon: 'fail', content: '删除失败' });
        }
        setLoading(false);
      }
    });
  };

  // ========== 原有功能保留 ==========

  // 备份到云端
  const handleBackupToCloud = async () => {
    setLoading(true);
    try {
      const success = await syncAllToCloud();
      if (success) {
        await loadSyncStatus();
        Toast.show({ icon: 'success', content: '云端备份成功' });
      } else {
        Toast.show({ icon: 'fail', content: '备份失败，请检查网络' });
      }
    } catch (err) {
      Toast.show({ icon: 'fail', content: '备份失败' });
    }
    setLoading(false);
  };

  // 从云端恢复
  const handleRestoreFromCloud = async () => {
    Dialog.confirm({
      title: '从云端恢复',
      content: '这将覆盖本地所有数据，确定继续吗？',
      confirmText: '恢复',
      cancelText: '取消',
      onConfirm: async () => {
        setLoading(true);
        try {
          const success = await restoreFromCloud();
          if (success) {
            await loadStats();
            await loadSyncStatus();
            Toast.show({ icon: 'success', content: '云端恢复成功' });
          } else {
            Toast.show({ icon: 'fail', content: '恢复失败，请检查网络' });
          }
        } catch (err) {
          Toast.show({ icon: 'fail', content: '恢复失败' });
        }
        setLoading(false);
      },
    });
  };

  // 导出 JSON
  const handleExportJSON = async () => {
    setLoading(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dorm-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.show({ icon: 'success', content: 'JSON 导出成功' });
    } catch (err) {
      Toast.show({ icon: 'fail', content: '导出失败' });
    }
    setLoading(false);
  };

  // 导出 Excel
  const handleExportExcel = async () => {
    setLoading(true);
    try {
      const data = await exportAllData();
      const wb = XLSX.utils.book_new();

      if (data.communities?.length) {
        const ws1 = XLSX.utils.json_to_sheet(data.communities.map((c: any) => ({
          ID: c._id,
          名称: c.name,
          地址: c.address,
          负责人: c.manager,
          电话: c.managerPhone,
          状态: c.status,
        })));
        XLSX.utils.book_append_sheet(wb, ws1, '小区');
      }

      if (data.dorms?.length) {
        const ws2 = XLSX.utils.json_to_sheet(data.dorms.map((d: any) => ({
          ID: d._id,
          小区: d.communityId,
          楼栋: d.building,
          楼层: d.floor,
          户型: d.layout + '人间',
          状态: d.status,
        })));
        XLSX.utils.book_append_sheet(wb, ws2, '宿舍');
      }

      if (data.rooms?.length) {
        const ws3 = XLSX.utils.json_to_sheet(data.rooms.map((r: any) => ({
          ID: r._id,
          宿舍: r.dormId,
          房号: r.roomNo,
          状态: r.status === 'occupied' ? '已入住' : r.status === 'vacant' ? '空置' : '维修中',
          入住人: r.occupantName || '-',
          部门: r.occupantDept || '-',
        })));
        XLSX.utils.book_append_sheet(wb, ws3, '房间');
      }

      if (data.employees?.length) {
        const ws4 = XLSX.utils.json_to_sheet(data.employees.map((e: any) => ({
          工号: e._id,
          姓名: e.name,
          部门: e.department,
          电话: e.phone,
          角色: e.role === 'superAdmin' ? '超级管理员' : e.role === 'admin' ? '管理员' : '员工',
          维修工: e.isMaintainer ? '是' : '否',
        })));
        XLSX.utils.book_append_sheet(wb, ws4, '员工');
      }

      XLSX.writeFile(wb, `dorm-data-${new Date().toISOString().slice(0, 10)}.xlsx`);
      Toast.show({ icon: 'success', content: 'Excel 导出成功' });
    } catch (err) {
      Toast.show({ icon: 'fail', content: '导出失败' });
    }
    setLoading(false);
  };

  // 导入 JSON
  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllData(data);
      await loadStats();
      Toast.show({ icon: 'success', content: '数据导入成功，已同步到云端' });
    } catch (err) {
      Toast.show({ icon: 'fail', content: '导入失败，请检查文件格式' });
    }
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 一键导入Excel数据
  const handleImportExcelData = () => {
    Dialog.confirm({
      title: '导入宿舍名录数据',
      content: '将从Excel文件导入267名员工、173间房间的数据，现有数据将被覆盖！',
      confirmText: '确定导入',
      cancelText: '取消',
      onConfirm: async () => {
        setLoading(true);
        try {
          const response = await fetch('/import-data.json');
          const data = await response.json();
          
          await clearAllData();
          
          if (data.communities) await db.communities.bulkAdd(data.communities);
          if (data.dorms) await db.dorms.bulkAdd(data.dorms);
          if (data.rooms) await db.rooms.bulkAdd(data.rooms);
          if (data.employees) await db.employees.bulkAdd(data.employees);
          
          await syncAllToCloud();
          
          await loadStats();
          await loadSyncStatus();
          Toast.show({ icon: 'success', content: `导入成功！共导入 ${data.employees.length} 名员工，已同步云端` });
        } catch (err) {
          Toast.show({ icon: 'fail', content: '导入失败，请重试' });
        }
        setLoading(false);
      },
    });
  };

  // 下载导入模板
  const downloadTemplate = (type: 'employees' | 'dorms' | 'assets' | 'allocations') => {
    const templates = {
      employees: {
        headers: ['工号', '姓名', '部门', '手机号', '入职日期', '角色', '性别'],
        example: [
          ['E001', '张三', '技术部', '13800138001', '2024-01-15', 'employee', '男'],
          ['E002', '李四', '销售部', '13800138002', '2024-02-01', 'employee', '女'],
        ],
        filename: '员工导入模板.xlsx',
      },
      dorms: {
        headers: ['小区ID', '楼栋', '楼层', '房间号', '户型(人间数)'],
        example: [
          ['C001', 'A栋', '1', '101', '4'],
          ['C001', 'A栋', '1', '102', '4'],
        ],
        filename: '宿舍导入模板.xlsx',
      },
      assets: {
        headers: ['资产类型', '品牌', '型号', '序列号', '购买日期', '保修年限', '所在宿舍ID'],
        example: [
          ['空调', '格力', 'KFR-35GW', 'SN001', '2023-06-01', '3', 'D001'],
          ['热水器', '美的', 'F60-15WB5', 'SN002', '2023-06-01', '3', 'D001'],
        ],
        filename: '资产导入模板.xlsx',
      },
      allocations: {
        headers: ['工号', '宿舍ID', '房间号', '入住日期'],
        example: [
          ['E001', 'D001', 'A', '2024-01-15'],
          ['E002', 'D001', 'B', '2024-02-01'],
        ],
        filename: '入住分配模板.xlsx',
      },
    };

    const template = templates[type];
    const ws = XLSX.utils.aoa_to_sheet([template.headers, ...template.example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '模板');
    XLSX.writeFile(wb, template.filename);
    Toast.show({ icon: 'success', content: '模板下载成功' });
  };
  const handleClear = () => {
    Dialog.confirm({
      title: '危险操作',
      content: '确定要清空所有数据吗？此操作不可恢复！',
      confirmText: '确定清空',
      cancelText: '取消',
      onConfirm: async () => {
        setLoading(true);
        await clearAllData();
        await loadStats();
        setLoading(false);
        Toast.show({ icon: 'success', content: '数据已清空' });
      },
    });
  };

  // 重置默认数据
  const handleReset = () => {
    Dialog.confirm({
      title: '重置数据',
      content: '确定要重置为默认数据吗？现有数据将被覆盖！',
      confirmText: '确定重置',
      cancelText: '取消',
      onConfirm: async () => {
        setLoading(true);
        await clearAllData();
        await initDefaultData();
        await loadStats();
        setLoading(false);
        Toast.show({ icon: 'success', content: '已重置为默认数据' });
      },
    });
  };

  return (
    <div className="page-container data-manage-page">
      <NavBar onBack={onBack}>数据管理</NavBar>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.Tab title="数据概览" key="manage">
          {/* 云端同步状态 */}
          <Card className="sync-status-card">
            <div className="sync-status">
              <div className="sync-icon">
                {syncStatus.isOnline ? (
                  <Badge content="在线" color="green">
                    <Cloud size={32} color="#52c41a" />
                  </Badge>
                ) : (
                  <Cloud size={32} color="#999" />
                )}
              </div>
              <div className="sync-info">
                <div className="sync-title">
                  {syncStatus.isOnline ? '云端备份已启用' : '离线模式'}
                </div>
                <div className="sync-time">
                  {syncStatus.lastSync 
                    ? `上次同步: ${new Date(syncStatus.lastSync).toLocaleString()}`
                    : '尚未同步到云端'}
                </div>
              </div>
              <div className="sync-actions">
                <Button 
                  size="small" 
                  color="primary" 
                  loading={loading}
                  disabled={!syncStatus.isOnline}
                  onClick={handleBackupToCloud}
                >
                  <CloudUpload size={14} /> 备份
                </Button>
                <Button 
                  size="small" 
                  color="default"
                  loading={loading}
                  disabled={!syncStatus.isOnline}
                  onClick={handleRestoreFromCloud}
                >
                  <CloudDownload size={14} /> 恢复
                </Button>
              </div>
            </div>
          </Card>

          <Card title="数据概览">
            {stats ? (
              <Space wrap style={{ padding: '12px 0' }}>
                <Tag color="primary">小区: {stats.communities}</Tag>
                <Tag color="success">宿舍: {stats.dorms}</Tag>
                <Tag color="warning">房间: {stats.rooms}</Tag>
                <Tag color="danger">员工: {stats.employees}</Tag>
                <Tag>工单: {stats.tickets}</Tag>
              </Space>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>加载中...</div>
            )}
          </Card>

          <Card title="数据导出">
            <List>
              <List.Item
                description="导出为 JSON 格式，包含所有数据，适合备份"
                extra={
                  <Button size="small" color="primary" loading={loading} onClick={handleExportJSON}>
                    导出 JSON
                  </Button>
                }
              >
                备份数据 (JSON)
              </List.Item>
              <List.Item
                description="导出为 Excel 多 sheet 文件，适合查看和编辑"
                extra={
                  <Button size="small" color="primary" loading={loading} onClick={handleExportExcel}>
                    导出 Excel
                  </Button>
                }
              >
                导出数据 (Excel)
              </List.Item>
            </List>
          </Card>

          <Card title="数据导入">
            <List>
              <List.Item
                description="从宿舍名录Excel导入267名员工、173间房间数据"
                extra={
                  <Button
                    size="small"
                    color="primary"
                    loading={loading}
                    onClick={handleImportExcelData}
                  >
                    一键导入
                  </Button>
                }
              >
                导入宿舍名录
              </List.Item>
              
              <List.Item
                description="上传任意Excel文件，智能识别字段并校验"
                extra={
                  <Button
                    size="small"
                    color="primary"
                    loading={loading}
                    onClick={() => excelInputRef.current?.click()}
                  >
                    <FileSpreadsheet size={14} /> Excel导入
                  </Button>
                }
              >
                高级Excel导入
              </List.Item>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleExcelUpload}
              />

              <List.Item
                description="从 JSON 备份文件恢复数据"
                extra={
                  <Button
                    size="small"
                    color="warning"
                    loading={loading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    导入 JSON
                  </Button>
                }
              >
                恢复备份
              </List.Item>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportJSON}
              />
            </List>
          </Card>

          <Card title="模板下载">
            <List>
              <List.Item
                description="下载员工导入模板（工号、姓名、部门、手机号等）"
                extra={
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => downloadTemplate('employees')}
                  >
                    <FileSpreadsheet size={14} /> 下载
                  </Button>
                }
              >
                员工导入模板
              </List.Item>
              <List.Item
                description="下载宿舍导入模板（小区、楼栋、楼层、房间号等）"
                extra={
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => downloadTemplate('dorms')}
                  >
                    <FileSpreadsheet size={14} /> 下载
                  </Button>
                }
              >
                宿舍导入模板
              </List.Item>
              <List.Item
                description="下载资产导入模板（类型、品牌、购买日期等）"
                extra={
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => downloadTemplate('assets')}
                  >
                    <FileSpreadsheet size={14} /> 下载
                  </Button>
                }
              >
                资产导入模板
              </List.Item>
              <List.Item
                description="下载入住分配模板（工号、宿舍ID、房间号等）"
                extra={
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => downloadTemplate('allocations')}
                  >
                    <FileSpreadsheet size={14} /> 下载
                  </Button>
                }
              >
                入住分配模板
              </List.Item>
            </List>
          </Card>

          <Card title="数据编辑">
            <List>
              <List.Item
                description="批量编辑员工信息、部门、角色等"
                extra={
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => openEditModal('employees')}
                  >
                    <Edit3 size={14} /> 编辑
                  </Button>
                }
              >
                员工数据编辑
              </List.Item>
              <List.Item
                description="批量编辑房间状态、入住信息等"
                extra={
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => openEditModal('rooms')}
                  >
                    <Edit3 size={14} /> 编辑
                  </Button>
                }
              >
                房间数据编辑
              </List.Item>
            </List>
          </Card>

          <Card title="数据重置">
            <List>
              <List.Item
                description="清空所有数据，谨慎操作"
                extra={
                  <Button size="small" color="danger" loading={loading} onClick={handleClear}>
                    清空数据
                  </Button>
                }
              >
                清空所有数据
              </List.Item>
              <List.Item
                description="重置为系统默认数据"
                extra={
                  <Button size="small" color="danger" loading={loading} onClick={handleReset}>
                    重置默认
                  </Button>
                }
              >
                重置默认数据
              </List.Item>
            </List>
          </Card>

          <div style={{ padding: 20, color: '#999', fontSize: 12 }}>
            <p>💡 数据安全提示：</p>
            <ul style={{ paddingLeft: 16, marginTop: 8 }}>
              <li>本地数据存储在浏览器中，建议定期备份到云端</li>
              <li>点击「备份」可将数据同步到腾讯云数据库</li>
              <li>更换设备或浏览器时，点击「恢复」可下载云端数据</li>
              <li>Excel导入支持智能字段识别和数据校验</li>
              <li>批量编辑功能支持单条修改和批量操作</li>
            </ul>
          </div>
        </Tabs.Tab>
      </Tabs>

      {/* Excel导入模态框 */}
      <Modal
        visible={importModalVisible}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Excel数据导入</span>
            <Button
              size="small"
              fill="none"
              onClick={() => {
                setImportModalVisible(false);
                setImportStep('upload');
                setExcelData([]);
                setExcelHeaders([]);
                setFieldMapping({});
              }}
            >
              ✕
            </Button>
          </div>
        }
        content={
          <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            {importStep === 'upload' && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <FileSpreadsheet size={48} color="#1677ff" />
                <p>正在读取文件...</p>
              </div>
            )}
            
            {importStep === 'mapping' && (
              <div>
                <p style={{ marginBottom: 16, color: '#666' }}>请确认Excel列与系统字段的对应关系：</p>
                {excelHeaders.map((header, idx) => (
                  <div key={idx} style={{ marginBottom: 12, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                      Excel列: {header}
                    </div>
                    <Selector
                      options={fieldOptions}
                      value={[fieldMapping[header] || 'ignore']}
                      onChange={val => setFieldMapping({ ...fieldMapping, [header]: val[0] })}
                    />
                  </div>
                ))}
                <Space style={{ marginTop: 16 }}>
                  <Button 
                    style={{ flex: 1 }}
                    onClick={() => {
                      setImportModalVisible(false);
                      setImportStep('upload');
                      setExcelData([]);
                      setExcelHeaders([]);
                      setFieldMapping({});
                    }}
                  >
                    取消
                  </Button>
                  <Button 
                    color="primary"
                    style={{ flex: 1 }}
                    onClick={handlePreview}
                    loading={loading}
                  >
                    下一步：预览数据
                  </Button>
                </Space>
              </div>
            )}
            
            {importStep === 'preview' && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Tag color="primary">共 {previewData.employees.length} 条</Tag>
                    {previewData.errors.length > 0 && (
                      <Tag color="danger">错误 {previewData.errors.length} 条</Tag>
                    )}
                    {previewData.warnings.length > 0 && (
                      <Tag color="warning">警告 {previewData.warnings.length} 条</Tag>
                    )}
                  </Space>
                </div>
                
                {previewData.errors.length > 0 && (
                  <div style={{ marginBottom: 16, padding: 12, background: '#fff2f0', borderRadius: 8 }}>
                    <div style={{ color: '#cf1322', fontWeight: 'bold', marginBottom: 8 }}>
                      <XCircle size={16} style={{ marginRight: 4 }} />
                      错误（必须修复）
                    </div>
                    {previewData.errors.slice(0, 5).map((err, idx) => (
                      <div key={idx} style={{ fontSize: 12, marginBottom: 4 }}>
                        第{err.row}行: {err.field} - {err.reason}
                      </div>
                    ))}
                    {previewData.errors.length > 5 && (
                      <div style={{ fontSize: 12, color: '#999' }}>
                        还有 {previewData.errors.length - 5} 条错误...
                      </div>
                    )}
                  </div>
                )}
                
                {previewData.warnings.length > 0 && (
                  <div style={{ marginBottom: 16, padding: 12, background: '#fffbe6', borderRadius: 8 }}>
                    <div style={{ color: '#d48806', fontWeight: 'bold', marginBottom: 8 }}>
                      <AlertTriangle size={16} style={{ marginRight: 4 }} />
                      警告（可继续导入）
                    </div>
                    {previewData.warnings.slice(0, 5).map((warn, idx) => (
                      <div key={idx} style={{ fontSize: 12, marginBottom: 4 }}>
                        第{warn.row}行: {warn.field} - {warn.reason}
                      </div>
                    ))}
                    {previewData.warnings.length > 5 && (
                      <div style={{ fontSize: 12, color: '#999' }}>
                        还有 {previewData.warnings.length - 5} 条警告...
                      </div>
                    )}
                  </div>
                )}
                
                <div style={{ marginBottom: 16, maxHeight: 200, overflow: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: 8, border: '1px solid #ddd' }}>工号</th>
                        <th style={{ padding: 8, border: '1px solid #ddd' }}>姓名</th>
                        <th style={{ padding: 8, border: '1px solid #ddd' }}>部门</th>
                        <th style={{ padding: 8, border: '1px solid #ddd' }}>电话</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.employees.slice(0, 5).map((emp, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: 8, border: '1px solid #ddd' }}>{emp._id}</td>
                          <td style={{ padding: 8, border: '1px solid #ddd' }}>{emp.name}</td>
                          <td style={{ padding: 8, border: '1px solid #ddd' }}>{emp.department}</td>
                          <td style={{ padding: 8, border: '1px solid #ddd' }}>{emp.phone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.employees.length > 5 && (
                    <div style={{ textAlign: 'center', padding: 8, color: '#999' }}>
                      还有 {previewData.employees.length - 5} 条数据...
                    </div>
                  )}
                </div>
                
                <Space style={{ width: '100%' }}>
                  <Button 
                    onClick={() => {
                      setImportModalVisible(false);
                      setImportStep('upload');
                      setExcelData([]);
                      setExcelHeaders([]);
                      setFieldMapping({});
                    }}
                    style={{ flex: 1 }}
                  >
                    取消
                  </Button>
                  <Button 
                    onClick={() => setImportStep('mapping')}
                    style={{ flex: 1 }}
                  >
                    上一步
                  </Button>
                  <Button 
                    color="primary"
                    onClick={handleExecuteImport}
                    loading={loading}
                    disabled={previewData.errors.length > 0}
                    style={{ flex: 1 }}
                  >
                    {previewData.errors.length > 0 ? '有错误无法导入' : '确认导入'}
                  </Button>
                </Space>
              </div>
            )}
            
            {importStep === 'result' && importResult && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                {importResult.failed === 0 ? (
                  <>
                    <CheckCircle size={64} color="#52c41a" />
                    <h3 style={{ color: '#52c41a', marginTop: 16 }}>导入成功！</h3>
                    <p>成功导入 {importResult.success} 条数据</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={64} color="#faad14" />
                    <h3 style={{ color: '#faad14', marginTop: 16 }}>导入完成（部分失败）</h3>
                    <p>成功: {importResult.success} 条，失败: {importResult.failed} 条</p>
                    {importResult.errors.length > 0 && (
                      <div style={{ textAlign: 'left', marginTop: 16, padding: 12, background: '#fff2f0', borderRadius: 8 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>错误详情：</div>
                        {importResult.errors.map((err, idx) => (
                          <div key={idx} style={{ fontSize: 12, marginBottom: 4 }}>
                            {err.field}: {err.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <Button 
                  block 
                  color="primary" 
                  onClick={() => {
                    setImportModalVisible(false);
                    setImportStep('upload');
                  }}
                  style={{ marginTop: 20 }}
                >
                  完成
                </Button>
              </div>
            )}
          </div>
        }
        closeOnAction
        onClose={() => {
          setImportModalVisible(false);
          setImportStep('upload');
        }}
      />

      {/* 数据编辑模态框 */}
      <Modal
        visible={editModalVisible}
        closeOnMaskClick
        onClose={() => {
          setEditModalVisible(false);
          setSelectedItems([]);
        }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{editType === 'employees' ? '员工数据编辑' : '房间数据编辑'}</span>
            <Button
              size="small"
              fill="none"
              onClick={() => {
                setEditModalVisible(false);
                setSelectedItems([]);
              }}
            >
              ✕
            </Button>
          </div>
        }
        content={
          <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <SearchBar
              placeholder={editType === 'employees' ? '搜索工号/姓名/部门' : '搜索房号'}
              value={editSearch}
              onChange={setEditSearch}
              style={{ marginBottom: 12 }}
            />
            
            <Space style={{ marginBottom: 12 }}>
              <Button size="small" onClick={() => setSelectedItems(filteredEditData.map(i => i._id))}>
                全选
              </Button>
              <Button size="small" onClick={() => setSelectedItems([])}>
                取消全选
              </Button>
              <Tag>已选 {selectedItems.length} 项</Tag>
            </Space>
            
            <Space style={{ marginBottom: 12 }}>
              <Button size="small" color="primary" onClick={handleBatchEdit}>
                批量修改
              </Button>
              <Button size="small" color="danger" onClick={handleBatchDelete}>
                批量删除
              </Button>
            </Space>
            
            <List>
              {filteredEditData.map(item => (
                <List.Item
                  key={item._id}
                  prefix={
                    <Checkbox
                      checked={selectedItems.includes(item._id)}
                      onChange={checked => {
                        if (checked) {
                          setSelectedItems([...selectedItems, item._id]);
                        } else {
                          setSelectedItems(selectedItems.filter(id => id !== item._id));
                        }
                      }}
                    />
                  }
                  extra={
                    <Button size="small" onClick={() => handleSingleEdit(item)}>
                      编辑
                    </Button>
                  }
                >
                  {editType === 'employees' ? (
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{item.name} ({item._id})</div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {item.department} | {item.phone || '无电话'}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{item.roomNo}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {item.status === 'occupied' ? '已入住' : item.status === 'vacant' ? '空置' : '维修中'}
                      </div>
                    </div>
                  )}
                </List.Item>
              ))}
            </List>
          </div>
        }
        closeOnAction
      />
    </div>
  );
}
