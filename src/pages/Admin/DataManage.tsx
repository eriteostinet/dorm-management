import { useState, useEffect } from 'react';
import { Card, NavBar, Button, Toast, Dialog, List, Tag, Space } from 'antd-mobile';
import { Download, Upload, Trash2, AlertTriangle, Database, RefreshCw } from 'lucide-react';
import {
  getAllCommunities, getAllDorms, getAllRooms, getAllEmployees,
  getAllRepairTickets, getPayments
} from '../../services/dataService';
import './DataManage.css';

interface DataManageProps {
  onBack: () => void;
}

export default function DataManage({ onBack }: DataManageProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [communities, dorms, rooms, employees, tickets, payments] = await Promise.all([
        getAllCommunities(),
        getAllDorms(),
        getAllRooms(),
        getAllEmployees(),
        getAllRepairTickets(),
        getPayments(),
      ]);
      setStats({
        communities: communities.length,
        dorms: dorms.length,
        rooms: rooms.length,
        employees: employees.length,
        tickets: tickets.length,
        payments: payments.length,
      });
    } catch (err) {
      console.error('加载统计失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: string) => {
    try {
      const res = await fetch(`/api/export/${type}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (!res.ok) throw new Error('导出失败');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      Toast.show({ icon: 'success', content: '导出成功' });
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '导出失败' });
    }
  };

  return (
    <div className="page-container">
      <NavBar onBack={onBack}>数据管理</NavBar>

      <Card title="数据统计">
        {stats ? (
          <List>
            <List.Item title="小区数量" extra={stats.communities} />
            <List.Item title="楼栋数量" extra={stats.dorms} />
            <List.Item title="房间数量" extra={stats.rooms} />
            <List.Item title="员工数量" extra={stats.employees} />
            <List.Item title="工单数量" extra={stats.tickets} />
            <List.Item title="账单数量" extra={stats.payments} />
          </List>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div>
        )}
      </Card>

      <Card title="数据导出">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button block color="primary" onClick={() => handleExport('employees')}>
            <Download size={16} /> 导出员工数据
          </Button>
          <Button block color="primary" onClick={() => handleExport('rooms')}>
            <Download size={16} /> 导出房间数据
          </Button>
          <Button block color="primary" onClick={() => handleExport('payments')}>
            <Download size={16} /> 导出缴费数据
          </Button>
        </Space>
      </Card>

      <Card title="数据刷新">
        <Button block onClick={loadStats} loading={loading}>
          <RefreshCw size={16} /> 刷新统计
        </Button>
      </Card>

      <Card title="危险操作">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button block color="danger" onClick={() => {
            Dialog.confirm({
              title: '清理本地缓存',
              content: '将清除本地登录状态，重新登录后可恢复',
              onConfirm: () => {
                localStorage.clear();
                Toast.show({ icon: 'success', content: '已清理' });
                window.location.href = '/login';
              },
            });
          }}>
            <Trash2 size={16} /> 清理本地缓存
          </Button>
        </Space>
      </Card>
    </div>
  );
}
