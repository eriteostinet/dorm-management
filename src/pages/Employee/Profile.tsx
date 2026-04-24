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
  const [employee, setEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    const loadEmployee = async () => {
      const userId = auth.getUserId();
      if (userId) {
        const result = await getEmployeeById(userId);
        setEmployee(result || null);
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

  return (
    <div className="page-container">
      <NavBar onBack={onBack}>个人信息</NavBar>
      
      <Card className="profile-card">
        <div className="profile-header">
          <div className="avatar">{employee.name.charAt(0)}</div>
          <div className="info">
            <h3>{employee.name}</h3>
            <p>{employee.department}</p>
            <span className="role-tag">
              {employee.role === 'superAdmin' ? '超级管理员' : employee.role === 'admin' ? '管理员' : '员工'}
            </span>
          </div>
        </div>
      </Card>

      <List className="profile-list">
        <List.Item>工号：{employee._id}</List.Item>
        <List.Item>手机号：{employee.phone}</List.Item>
        <List.Item>入职日期：{formatDate(employee.entryDate)}</List.Item>
        <List.Item>入职时长：{calculateTenure(employee.entryDate)}</List.Item>
        <List.Item>住宿历史：{employee.history.length} 次</List.Item>
      </List>

      <div className="logout-btn">
        <Button block color="danger" onClick={handleLogout}>退出登录</Button>
      </div>
    </div>
  );
}
