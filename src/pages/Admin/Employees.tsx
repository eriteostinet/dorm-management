import { useState, useEffect } from 'react';
import { 
  List, SearchBar, NavBar, Button, Form, Input, Toast, SwipeAction, 
  Modal, Selector, Space, Tag, Tabs
} from 'antd-mobile';
import { 
  Plus, Trash2, Lock, UserX, UserCheck, LogOut
} from 'lucide-react';
import { db } from '../../db/db';
import { calculateTenure } from '../../utils';
import type { Employee, Room } from '../../types';
import './Employees.css';

interface EmployeesProps {
  onBack: () => void;
}

// 密码加密（简单版，实际应用应使用bcrypt）
const hashPassword = (pwd: string) => {
  // 实际项目中应该使用 bcrypt 或类似的加密库
  return btoa(pwd); // 简单的base64编码，仅作演示
};

// 获取当前登录用户
const getCurrentUser = (): Employee | null => {
  const userStr = localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
};

export default function Employees({ onBack }: EmployeesProps) {
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // 弹窗状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // 表单数据
  const [formData, setFormData] = useState({
    _id: '',
    name: '',
    department: '',
    phone: '',
    entryDate: '',
    password: '123456', // 默认密码
    role: ['employee'] as ('employee' | 'manager' | 'admin' | 'superAdmin')[],
    managedCommunities: [] as string[],
  });

  const [checkOutReason, setCheckOutReason] = useState('');

  useEffect(() => {
    loadData();
    setCurrentUser(getCurrentUser());
    
    // 监听数据更新事件（从数据管理页面导入后会触发）
    const handleDataUpdate = () => {
      loadData();
    };
    window.addEventListener('dorm-data-updated', handleDataUpdate);
    
    return () => {
      window.removeEventListener('dorm-data-updated', handleDataUpdate);
    };
  }, []);

  const loadData = async () => {
    const [empData, roomData] = await Promise.all([
      db.employees.toArray(),
      db.rooms.toArray(),
    ]);
    setEmployees(empData.sort((a, b) => a._id.localeCompare(b._id)));
    setRooms(roomData);
  };

  // 权限检查
  const canManageEmployee = (targetEmp: Employee) => {
    if (!currentUser) return false;
    if (currentUser.role === 'superAdmin') return true;
    if (currentUser.role === 'admin') return targetEmp.role !== 'superAdmin';
    if (currentUser.role === 'manager') {
      // 宿管只能管理本小区员工
      if (targetEmp.currentCommunityId) {
        return currentUser.maintainerCommunities?.includes(targetEmp.currentCommunityId);
      }
      return true;
    }
    return false;
  };

  const canCreateAdmin = () => {
    return currentUser?.role === 'superAdmin' || currentUser?.role === 'admin';
  };

  // 筛选员工
  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.name.includes(search) || e._id.includes(search) || e.department?.includes(search);
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'active') return matchesSearch && e.status === 'active';
    if (activeTab === 'disabled') return matchesSearch && e.status === 'disabled';
    if (activeTab === 'inDorm') return matchesSearch && e.currentRoomId;
    if (activeTab === 'notInDorm') return matchesSearch && !e.currentRoomId;
    return matchesSearch;
  });

  // 添加员工
  const handleAddEmployee = async () => {
    if (!formData._id || !formData.name) {
      Toast.show({ icon: 'fail', content: '工号和姓名必填' });
      return;
    }

    const existing = await db.employees.get(formData._id);
    if (existing) {
      Toast.show({ icon: 'fail', content: '该工号已存在' });
      return;
    }

    const newEmployee: Employee = {
      _id: formData._id,
      name: formData.name,
      department: formData.department || '未分配',
      entryDate: formData.entryDate ? new Date(formData.entryDate) : new Date(),
      phone: formData.phone || '',
      avatar: null,
      currentCommunityId: null,
      currentDormId: null,
      currentRoomId: null,
      role: formData.role[0] || 'employee',
      status: 'active',
      password: hashPassword(formData.password),
      isMaintainer: false,
      maintainerType: [],
      maintainerCommunities: formData.managedCommunities || [],
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.employees.add(newEmployee);
    Toast.show({ icon: 'success', content: '添加成功，初始密码: ' + formData.password });
    setShowAddModal(false);
    resetForm();
    loadData();
  };

  // 编辑员工
  const handleEditEmployee = async () => {
    if (!selectedEmployee) return;

    const update: Partial<Employee> = {
      name: formData.name,
      department: formData.department,
      phone: formData.phone,
      role: formData.role[0] || 'employee',
      maintainerCommunities: formData.managedCommunities || [],
      updatedAt: new Date(),
    };

    if (formData.entryDate) {
      update.entryDate = new Date(formData.entryDate);
    }

    await db.employees.update(selectedEmployee._id, update);
    Toast.show({ icon: 'success', content: '修改成功' });
    setShowEditModal(false);
    setSelectedEmployee(null);
    loadData();
  };

  // 禁用/启用账号
  const handleToggleStatus = async (employee: Employee) => {
    if (!canManageEmployee(employee)) {
      Toast.show({ icon: 'fail', content: '权限不足' });
      return;
    }

    const newStatus = employee.status === 'active' ? 'disabled' : 'active';
    const actionText = newStatus === 'active' ? '启用' : '禁用';

    Modal.confirm({
      title: `确认${actionText}账号`,
      content: `确定要${actionText}「${employee.name}(${employee._id})」的账号吗？`,
      confirmText: '确认',
      cancelText: '取消',
      onConfirm: async () => {
        await db.employees.update(employee._id, {
          status: newStatus,
          updatedAt: new Date(),
        });
        Toast.show({ icon: 'success', content: `${actionText}成功` });
        loadData();
      },
    });
  };

  // 重置密码
  const handleResetPassword = async (employee: Employee) => {
    if (!canManageEmployee(employee)) {
      Toast.show({ icon: 'fail', content: '权限不足' });
      return;
    }

    Modal.confirm({
      title: '重置密码',
      content: `确定要重置「${employee.name}」的密码吗？将重置为初始密码: 123456`,
      confirmText: '重置',
      cancelText: '取消',
      onConfirm: async () => {
        await db.employees.update(employee._id, {
          password: hashPassword('123456'),
          updatedAt: new Date(),
        });
        Toast.show({ icon: 'success', content: '密码已重置为: 123456' });
      },
    });
  };

  // 办理退宿
  const handleCheckOut = async () => {
    if (!selectedEmployee || !selectedEmployee.currentRoomId) return;
    if (!checkOutReason.trim()) {
      Toast.show({ icon: 'fail', content: '请输入退宿原因' });
      return;
    }

    const room = rooms.find(r => r._id === selectedEmployee.currentRoomId);
    if (!room) return;

    // 更新员工历史记录
    const historyEntry = {
      communityId: selectedEmployee.currentCommunityId!,
      dormId: selectedEmployee.currentDormId!,
      roomId: selectedEmployee.currentRoomId,
      checkIn: room.checkInDate || selectedEmployee.entryDate,
      checkOut: new Date(),
      reason: checkOutReason,
    };

    await db.employees.update(selectedEmployee._id, {
      currentCommunityId: null,
      currentDormId: null,
      currentRoomId: null,
      history: [...(selectedEmployee.history || []), historyEntry],
      updatedAt: new Date(),
    });

    // 更新房间状态
    await db.rooms.update(room._id, {
      occupantId: null,
      occupantName: null,
      occupantDept: null,
      checkInDate: null,
      status: 'vacant',
    });

    Toast.show({ icon: 'success', content: '退宿办理成功' });
    setShowCheckOutModal(false);
    setSelectedEmployee(null);
    setCheckOutReason('');
    loadData();
  };

  // 删除员工
  const handleDeleteEmployee = async (employee: Employee) => {
    if (!canManageEmployee(employee)) {
      Toast.show({ icon: 'fail', content: '权限不足' });
      return;
    }

    if (employee.currentRoomId) {
      Toast.show({ icon: 'fail', content: '该员工正在住宿，请先办理退宿' });
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除员工「${employee.name}(${employee._id})」吗？此操作不可恢复！`,
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: async () => {
        await db.employees.delete(employee._id);
        Toast.show({ icon: 'success', content: '删除成功' });
        loadData();
      },
    });
  };

  // 打开编辑弹窗
  const openEditModal = (employee: Employee) => {
    if (!canManageEmployee(employee)) {
      Toast.show({ icon: 'fail', content: '权限不足' });
      return;
    }
    setSelectedEmployee(employee);
    setFormData({
      _id: employee._id,
      name: employee.name,
      department: employee.department,
      phone: employee.phone,
      entryDate: employee.entryDate ? new Date(employee.entryDate).toISOString().split('T')[0] : '',
      password: '',
      role: [employee.role],
      managedCommunities: employee.maintainerCommunities || [],
    });
    setShowEditModal(true);
  };

  // 打开退宿弹窗
  const openCheckOutModal = (employee: Employee) => {
    if (!employee.currentRoomId) {
      Toast.show({ icon: 'fail', content: '该员工未入住' });
      return;
    }
    setSelectedEmployee(employee);
    setCheckOutReason('');
    setShowCheckOutModal(true);
  };

  const resetForm = () => {
    setFormData({
      _id: '',
      name: '',
      department: '',
      phone: '',
      entryDate: '',
      password: '123456',
      role: ['employee'],
      managedCommunities: [],
    });
  };

  // 获取角色标签
  const getRoleTag = (role: string) => {
    const roleMap: Record<string, { text: string; color: string }> = {
      employee: { text: '员工', color: 'default' },
      manager: { text: '宿管', color: 'primary' },
      admin: { text: '管理员', color: 'warning' },
      superAdmin: { text: '超管', color: 'danger' },
    };
    return roleMap[role] || { text: role, color: 'default' };
  };

  return (
    <div className="page-container employees-page">
      <NavBar
        onBack={onBack}
        right={canCreateAdmin() && (
          <Button size="small" color="primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> 添加
          </Button>
        )}
      >
        员工账号管理
      </NavBar>

      {/* 统计卡片 */}
      <div className="employees-stats">
        <div className="stat-item">
          <span className="stat-number">{employees.length}</span>
          <span className="stat-label">总人数</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{employees.filter(e => e.status === 'active').length}</span>
          <span className="stat-label">启用中</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{employees.filter(e => e.currentRoomId).length}</span>
          <span className="stat-label">在住</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{employees.filter(e => e.status === 'disabled').length}</span>
          <span className="stat-label">已禁用</span>
        </div>
      </div>

      {/* 筛选标签 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} className="employee-tabs">
        <Tabs.Tab title="全部" key="all" />
        <Tabs.Tab title="启用中" key="active" />
        <Tabs.Tab title="已禁用" key="disabled" />
        <Tabs.Tab title="在住" key="inDorm" />
        <Tabs.Tab title="未入住" key="notInDorm" />
      </Tabs>

      <SearchBar
        placeholder="搜索姓名、工号或部门"
        value={search}
        onChange={setSearch}
        className="search-bar"
      />

      <List className="employees-list">
        {filteredEmployees.map(emp => {
          const roleTag = getRoleTag(emp.role);
          const canManage = canManageEmployee(emp);

          return (
            <SwipeAction
              key={emp._id}
              rightActions={canManage ? [
                {
                  key: 'checkout',
                  text: <><LogOut size={14} /> 退宿</>,
                  color: 'warning',
                  onClick: () => openCheckOutModal(emp),
                },
                {
                  key: 'delete',
                  text: <><Trash2 size={14} /> 删除</>,
                  color: 'danger',
                  onClick: () => handleDeleteEmployee(emp),
                },
              ] : []}
            >
              <List.Item
                title={
                  <div className="employee-title">
                    <span className="employee-name">{emp.name}</span>
                    <span className="employee-id">{emp._id}</span>
                    <Tag color={roleTag.color as any}>{roleTag.text}</Tag>
                    {emp.status === 'disabled' && (
                      <Tag color="default" fill="outline">已禁用</Tag>
                    )}
                  </div>
                }
                description={
                  <div className="employee-desc">
                    <span className="dept-tag">{emp.department}</span>
                    <span>入职{calculateTenure(emp.entryDate)}</span>
                    {emp.phone && <span>· {emp.phone}</span>}
                  </div>
                }
                extra={
                  <Space direction="vertical" align="end">
                    {emp.currentRoomId ? (
                      <span className="status-badge occupied">已入住</span>
                    ) : (
                      <span className="status-badge vacant">未入住</span>
                    )}
                    {canManage && (
                      <Space>
                        <Button
                          size="mini"
                          fill="none"
                          onClick={(e) => { e.stopPropagation(); handleResetPassword(emp); }}
                        >
                          <Lock size={14} />
                        </Button>
                        <Button
                          size="mini"
                          fill="none"
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(emp); }}
                        >
                          {emp.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                        </Button>
                      </Space>
                    )}
                  </Space>
                }
                onClick={() => canManage && openEditModal(emp)}
              />
            </SwipeAction>
          );
        })}
      </List>

      {filteredEmployees.length === 0 && (
        <div className="empty-state">
          <p>暂无员工数据</p>
          {canCreateAdmin() && (
            <Button color="primary" onClick={() => setShowAddModal(true)}>添加员工</Button>
          )}
        </div>
      )}

      {/* 添加员工弹窗 */}
      <Modal
        visible={showAddModal}
        title="创建员工账号"
        content={
          <Form layout="vertical">
            <Form.Item label="工号" required>
              <Input
                placeholder="请输入工号"
                value={formData._id}
                onChange={(val) => setFormData({ ...formData, _id: val })}
              />
            </Form.Item>
            <Form.Item label="姓名" required>
              <Input
                placeholder="请输入姓名"
                value={formData.name}
                onChange={(val) => setFormData({ ...formData, name: val })}
              />
            </Form.Item>
            <Form.Item label="部门">
              <Input
                placeholder="请输入部门"
                value={formData.department}
                onChange={(val) => setFormData({ ...formData, department: val })}
              />
            </Form.Item>
            <Form.Item label="电话">
              <Input
                placeholder="请输入电话"
                value={formData.phone}
                onChange={(val) => setFormData({ ...formData, phone: val })}
              />
            </Form.Item>
            <Form.Item label="入职日期">
              <Input
                type="date"
                value={formData.entryDate}
                onChange={(val) => setFormData({ ...formData, entryDate: val })}
              />
            </Form.Item>
            <Form.Item label="初始密码">
              <Input
                placeholder="默认密码: 123456"
                value={formData.password}
                onChange={(val) => setFormData({ ...formData, password: val })}
              />
            </Form.Item>
            {canCreateAdmin() && (
              <>
                <Form.Item label="账号角色">
                  <Selector
                    options={[
                      { label: '员工', value: 'employee' },
                      { label: '宿管', value: 'manager' },
                      ...(currentUser?.role === 'superAdmin' ? [
                        { label: '管理员', value: 'admin' },
                        { label: '超管', value: 'superAdmin' },
                      ] : []),
                    ]}
                    value={formData.role}
                    onChange={(val) => setFormData({ ...formData, role: val as any })}
                  />
                </Form.Item>
                {formData.role[0] === 'manager' && (
                  <Form.Item label="管理小区">
                    <Selector
                      options={rooms.map(r => ({ label: r.roomNo, value: r.communityId })).filter((v, i, a) => a.findIndex(t => t.value === v.value) === i)}
                      value={formData.managedCommunities}
                      onChange={(val) => setFormData({ ...formData, managedCommunities: val })}
                      multiple
                    />
                  </Form.Item>
                )}
              </>
            )}
          </Form>
        }
        closeOnAction
        onClose={() => { setShowAddModal(false); resetForm(); }}
        actions={[
          { key: 'cancel', text: '取消' },
          { key: 'confirm', text: '创建', primary: true, onClick: handleAddEmployee },
        ]}
      />

      {/* 编辑员工弹窗 */}
      <Modal
        visible={showEditModal}
        title="编辑员工信息"
        content={
          <Form layout="vertical">
            <Form.Item label="工号">
              <Input value={formData._id} disabled />
            </Form.Item>
            <Form.Item label="姓名">
              <Input
                value={formData.name}
                onChange={(val) => setFormData({ ...formData, name: val })}
              />
            </Form.Item>
            <Form.Item label="部门">
              <Input
                value={formData.department}
                onChange={(val) => setFormData({ ...formData, department: val })}
              />
            </Form.Item>
            <Form.Item label="电话">
              <Input
                value={formData.phone}
                onChange={(val) => setFormData({ ...formData, phone: val })}
              />
            </Form.Item>
            <Form.Item label="入职日期">
              <Input
                type="date"
                value={formData.entryDate}
                onChange={(val) => setFormData({ ...formData, entryDate: val })}
              />
            </Form.Item>
            {canCreateAdmin() && (
              <Form.Item label="账号角色">
                <Selector
                  options={[
                    { label: '员工', value: 'employee' },
                    { label: '宿管', value: 'manager' },
                    ...(currentUser?.role === 'superAdmin' ? [
                      { label: '管理员', value: 'admin' },
                      { label: '超管', value: 'superAdmin' },
                    ] : []),
                  ]}
                  value={formData.role}
                  onChange={(val) => setFormData({ ...formData, role: val as any })}
                />
              </Form.Item>
            )}
          </Form>
        }
        closeOnAction
        onClose={() => { setShowEditModal(false); setSelectedEmployee(null); }}
        actions={[
          { key: 'cancel', text: '取消' },
          { key: 'confirm', text: '保存', primary: true, onClick: handleEditEmployee },
        ]}
      />

      {/* 退宿弹窗 */}
      <Modal
        visible={showCheckOutModal}
        title="办理员工退宿"
        content={
          <Form layout="vertical">
            <Form.Item>
              <div style={{ padding: '10px 0', color: '#666' }}>
                <p>员工: {selectedEmployee?.name} ({selectedEmployee?._id})</p>
                <p>当前房间: {selectedEmployee?.currentRoomId}</p>
              </div>
            </Form.Item>
            <Form.Item label="退宿原因" required>
              <Input
                placeholder="请输入退宿原因（如：离职、调岗等）"
                value={checkOutReason}
                onChange={setCheckOutReason}
              />
            </Form.Item>
          </Form>
        }
        closeOnAction
        onClose={() => { setShowCheckOutModal(false); setSelectedEmployee(null); setCheckOutReason(''); }}
        actions={[
          { key: 'cancel', text: '取消' },
          { key: 'confirm', text: '确认退宿', primary: true, onClick: handleCheckOut },
        ]}
      />
    </div>
  );
}
