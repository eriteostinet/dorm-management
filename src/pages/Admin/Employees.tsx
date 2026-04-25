import { useState, useEffect } from 'react';
import { List, SearchBar, NavBar, Button, Form, Input, Toast, SwipeAction, Modal, Space, Tag, Tabs } from 'antd-mobile';
import { Plus, Trash2, Lock } from 'lucide-react';
import { getAllEmployees, getAllRooms, createEmployee } from '../../services/dataService';
import { auth } from '../../utils/auth';
import './Employees.css';

interface EmployeesProps {
  onBack: () => void;
}

export default function Employees({ onBack }: EmployeesProps) {
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    realName: '',
    department: '',
    phone: '',
    role: 'STAFF',
    password: '123456',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [empData, roomData] = await Promise.all([
        getAllEmployees(),
        getAllRooms(),
      ]);
      setEmployees(empData);
      setRooms(roomData);
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  };

  const handleAdd = async () => {
    try {
      await createEmployee({
        username: formData.username,
        password: formData.password,
        realName: formData.realName,
        department: formData.department,
        phone: formData.phone,
        role: formData.role,
      });
      Toast.show({ icon: 'success', content: '添加成功' });
      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '添加失败' });
    }
  };

  const filteredEmployees = employees.filter((e: any) => {
    const matchesSearch = !search || 
      (e.realName || e.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.department || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.username || '').toLowerCase().includes(search.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'admin') return matchesSearch && e.role === 'ADMIN';
    if (activeTab === 'staff') return matchesSearch && e.role === 'STAFF';
    if (activeTab === 'maintenance') return matchesSearch && e.role === 'MAINTENANCE';
    if (activeTab === 'in') return matchesSearch && e.currentRoomId;
    if (activeTab === 'out') return matchesSearch && !e.currentRoomId;
    return matchesSearch;
  });

  const getRoleText = (role: string) => {
    switch (role) {
      case 'ADMIN': return '管理员';
      case 'STAFF': return '员工';
      case 'MAINTENANCE': return '维修工';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'danger';
      case 'STAFF': return 'primary';
      case 'MAINTENANCE': return 'warning';
      default: return 'default';
    }
  };

  return (
    <div className="page-container">
      <NavBar onBack={onBack} right={
        <Button size="small" color="primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> 新增
        </Button>
      }>
        员工管理
      </NavBar>

      <SearchBar
        placeholder="搜索姓名/部门/工号"
        value={search}
        onChange={setSearch}
        style={{ margin: '8px 12px' }}
      />

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.Tab title="全部" key="all" />
        <Tabs.Tab title="管理员" key="admin" />
        <Tabs.Tab title="员工" key="staff" />
        <Tabs.Tab title="维修工" key="maintenance" />
        <Tabs.Tab title="已入住" key="in" />
        <Tabs.Tab title="未入住" key="out" />
      </Tabs>

      <List>
        {filteredEmployees.map((emp: any) => {
          const currentRoom = rooms.find((r: any) => r.id === emp.currentRoomId);
          return (
            <SwipeAction
              key={emp.id}
              rightActions={[
                {
                  key: 'delete',
                  text: <Trash2 size={16} />,
                  color: 'danger',
                  onClick: async () => {
                    // 删除功能需要后端 API 支持
                    Toast.show({ content: '删除功能暂未实现', icon: 'fail' });
                  },
                },
              ]}
            >
              <List.Item
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{emp.realName || emp.name}</span>
                    <Tag color={getRoleColor(emp.role)} size="small">{getRoleText(emp.role)}</Tag>
                  </div>
                }
                description={
                  <div>
                    <div>工号: {emp.username} | 部门: {emp.department || '无'}</div>
                    {currentRoom && <div>房间: {currentRoom.roomNumber}</div>}
                  </div>
                }
              />
            </SwipeAction>
          );
        })}
      </List>

      <Modal
        visible={showAddModal}
        title="新增员工"
        content={
          <Form layout="vertical">
            <Form.Item label="工号" required>
              <Input value={formData.username} onChange={v => setFormData({...formData, username: v})} placeholder="如 E001" />
            </Form.Item>
            <Form.Item label="姓名" required>
              <Input value={formData.realName} onChange={v => setFormData({...formData, realName: v})} placeholder="真实姓名" />
            </Form.Item>
            <Form.Item label="部门">
              <Input value={formData.department} onChange={v => setFormData({...formData, department: v})} placeholder="所属部门" />
            </Form.Item>
            <Form.Item label="电话">
              <Input value={formData.phone} onChange={v => setFormData({...formData, phone: v})} placeholder="手机号" />
            </Form.Item>
            <Form.Item label="角色">
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="STAFF">员工</option>
                <option value="MAINTENANCE">维修工</option>
              </select>
            </Form.Item>
            <Form.Item label="初始密码">
              <Input value={formData.password} onChange={v => setFormData({...formData, password: v})} />
            </Form.Item>
          </Form>
        }
        closeOnAction
        onClose={() => setShowAddModal(false)}
        actions={[
          { key: 'cancel', text: '取消' },
          { key: 'save', text: '保存', primary: true, onClick: handleAdd },
        ]}
      />
    </div>
  );
}
