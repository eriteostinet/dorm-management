import { useState, useEffect } from 'react';
import { Card, NavBar, List, Tag, Toast, SpinLoading } from 'antd-mobile';
import { getPayments } from '../../services/dataService';
import { auth } from '../../utils/auth';
import './EmployeePayments.css';

interface EmployeePaymentsProps {
  onBack: () => void;
}

export default function EmployeePayments({ onBack }: EmployeePaymentsProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const userId = auth.getUserId();
      if (userId) {
        const result = await getPayments({ employeeId: userId });
        setPayments(result);
      }
    } catch (err) {
      console.error('加载缴费记录失败:', err);
      Toast.show({ icon: 'fail', content: '加载失败' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'PAID': return <Tag color="success">已缴</Tag>;
      case 'UNPAID': return <Tag color="warning">未缴</Tag>;
      case 'OVERDUE': return <Tag color="danger">逾期</Tag>;
      default: return <Tag>{status}</Tag>;
    }
  };

  const getTypeName = (type: string) => {
    const map: Record<string, string> = { RENT: '房租', WATER: '水费', ELECTRICITY: '电费', OTHER: '其他' };
    return map[type] || type;
  };

  const totalUnpaid = payments
    .filter((p: any) => p.status === 'UNPAID' || p.status === 'OVERDUE')
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  return (
    <div className="page-container">
      <NavBar onBack={onBack}>我的缴费</NavBar>

      <Card style={{ margin: '12px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#999' }}>待缴金额</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff4d4f' }}>
            ¥{totalUnpaid.toFixed(2)}
          </div>
        </div>
      </Card>

      {loading && payments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}><SpinLoading /></div>
      ) : payments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无缴费记录</div>
      ) : (
        <List>
          {payments.map((p: any) => (
            <List.Item
              key={p.id}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{getTypeName(p.type)} ¥{p.amount}</span>
                  {getStatusTag(p.status)}
                </div>
              }
              description={
                <div>
                  {p.room?.roomNumber || ''} · {p.period} · 截止{p.dueDate?.slice(0, 10)}
                </div>
              }
            />
          ))}
        </List>
      )}
    </div>
  );
}
