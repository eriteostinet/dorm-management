import { useEffect, useState } from 'react';
import { Card, List, NavBar, Button, Dialog, Toast } from 'antd-mobile';
import { getEmployeeById } from '../../services/dataService';
import { auth } from '../../utils/auth';
import { calculateTenure, formatDate } from '../../utils';
import type { Employee } from '../../types';
import './Profile.css';

interface ProfileProps {
  onBack: () => void;
  onLogout: () => void;
}

export default function Profile({ onBack, onLogout }: ProfileProps) {
  const [employee, setEmployee] = useState<any | null>(null);

  useEffect(() => {
    const loadEmployee = async () => {
      const userId = auth.getUserId();
      if (userId) {
        try {
          const result = await getEmployeeById(userId);
          setEmployee(result || null);
        } catch {
          // 如果API失败，从本地获取
          const user = auth.getCurrentUser();
          if (user) setEmployee(user);
        }
      }
    };
    loadEmployee();
  }, []);

  const handleLogout = () => {
    Dialog.confirm({
      content: '确定要退出登录吗？',
      onConfirm: () => {
        auth.logout();
        Toast.show({ icon: 'success', content: '已退出' });
        onLogout();
      },
    });
  };

  if (!employee) return null;

  const name = employee.realName || employee.name || '未知';
  const roleText = employee.role === 'ADMIN' ? '管理员' : employee.role === 'MAINTENANCE' ? '维修工' : '员工';
  const roleColor = employee.role === 'ADMIN' ? '#ff4d4f' : employee.role === 'MAINTENANCE' ? '#faad14' : '#1890ff';
  const entryDate = employee.createdAt || employee.entryDate;

  return (
    <div className="page-container">
      <NavBar onBack={onBack}>个人信息</NavBar>
      
      <Card className="profile-card">
        <div className="profile-header">
          <div className="avatar">{name.charAt(0)}</div>
          <div className="info">
            <h3>{name}</h3>
            <p>{employee.department || '未分配部门'}</p>
            <span className="role-tag" style={{ backgroundColor: roleColor, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
              {roleText}
            </span>
          </div>
        </div>
      </Card>

      <List className="profile-list">
        <List.Item>工号：{employee.username || employee.id}</List.Item>
        <List.Item>手机号：{employee.phone || '未设置'}</List.Item>
        {entryDate && <>
          <List.Item>入职日期：{formatDate(entryDate)}</List.Item>
          <List.Item>入职时长：{calculateTenure(entryDate)}</List.Item>
        </>}
      </List>

      <div className="logout-btn">
        <Button block color="danger" onClick={handleLogout}>退出登录</Button>
      </div>
    </div>
  );
}
