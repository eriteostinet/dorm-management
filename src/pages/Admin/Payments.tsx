import { useState, useEffect } from 'react';
import { Card, NavBar, Button, Toast, Tabs, Tag, Space, List, Modal, Form, Input, Selector } from 'antd-mobile';
import { Plus, CreditCard, AlertTriangle } from 'lucide-react';
import {
  getPayments, createPayment, payPayment, getPaymentStats, getOverduePayments,
  getCommunities, getRooms
} from '../../services/dataService';
import './Payments.css';

interface PaymentsProps {
  onBack: () => void;
}

const typeOptions = [
  { label: '房租', value: 'RENT' },
  { label: '水费', value: 'WATER' },
  { label: '电费', value: 'ELECTRICITY' },
  { label: '其他', value: 'OTHER' },
];

const statusOptions = [
  { label: '全部', value: '' },
  { label: '未缴', value: 'UNPAID' },
  { label: '已缴', value: 'PAID' },
  { label: '逾期', value: 'OVERDUE' },
];

const methodOptions = [
  { label: '现金', value: 'cash' },
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '银行转账', value: 'bank' },
];

export default function Payments({ onBack }: PaymentsProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [filters, setFilters] = useState({ communityId: '', type: '', status: '', period: new Date().toISOString().slice(0, 7) });

  const [showCreate, setShowCreate] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [createForm, setCreateForm] = useState({ roomId: '', type: 'RENT', period: filters.period, amount: 0, dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
  const [payForm, setPayForm] = useState({ paymentMethod: 'wechat' });

  useEffect(() => {
    loadData();
    loadCommunities();
    loadOverdue();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getPayments({
        communityId: filters.communityId || undefined,
        type: filters.type || undefined,
        status: filters.status || undefined,
        period: filters.period,
      });
      setPayments(data);
      const s = await getPaymentStats({ communityId: filters.communityId || undefined, period: filters.period });
      setStats(s);
    } catch (err) {
      console.error('加载缴费失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCommunities = async () => {
    const list = await getCommunities();
    setCommunities(list.filter((c: any) => c.status === 'ACTIVE'));
  };

  const loadOverdue = async () => {
    try {
      const list = await getOverduePayments();
      setOverdue(list);
    } catch (err) {
      console.error('加载逾期失败:', err);
    }
  };

  const loadRooms = async (communityId: string) => {
    const list = await getRooms({ communityId, status: 'OCCUPIED' });
    setRooms(list);
  };

  const handleCreate = async () => {
    try {
      // 获取选中房间对应的入住员工作为 employeeId
      const room = rooms.find((r: any) => r.id === createForm.roomId);
      if (!room?.occupantId) {
        Toast.show({ icon: 'fail', content: '该房间无入住员工，无法创建账单' });
        return;
      }
      
      await createPayment({
        roomId: createForm.roomId,
        employeeId: room.occupantId,
        type: createForm.type,
        amount: Number(createForm.amount),
        period: createForm.period,
        dueDate: new Date(createForm.dueDate),
      });
      Toast.show({ icon: 'success', content: '创建成功' });
      setShowCreate(false);
      loadData();
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '创建失败' });
    }
  };

  const handlePay = async () => {
    if (!selectedPayment) return;
    try {
      await payPayment(selectedPayment.id, { paidBy: '', paymentMethod: payForm.paymentMethod });
      Toast.show({ icon: 'success', content: '缴费成功' });
      setShowPay(false);
      loadData();
      loadOverdue();
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '缴费失败' });
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

  return (
    <div className="page-container">
      <NavBar onBack={onBack} right={
        <Button size="small" color="primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
        </Button>
      }>缴费管理</NavBar>

      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Selector
            options={[{ label: '全部小区', value: '' }, ...communities.map((c: any) => ({ label: c.name, value: c.id }))]}
            value={[filters.communityId]}
            onChange={v => setFilters({ ...filters, communityId: v[0] })}
          />
          <Selector
            options={[{ label: '全部类型', value: '' }, ...typeOptions]}
            value={[filters.type]}
            onChange={v => setFilters({ ...filters, type: v[0] })}
          />
          <Selector
            options={statusOptions}
            value={[filters.status]}
            onChange={v => setFilters({ ...filters, status: v[0] })}
          />
        </div>
      </Card>

      {stats && (
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>¥{stats.totalAmount?.toFixed(2) || 0}</div>
              <div style={{ fontSize: 12, color: '#999' }}>总额</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>¥{stats.paidAmount?.toFixed(2) || 0}</div>
              <div style={{ fontSize: 12, color: '#999' }}>已收</div>
            </div>
          </div>
        </Card>
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.Tab title="账单列表" key="list" />
        <Tabs.Tab title={`逾期 (${overdue.length})`} key="overdue" />
      </Tabs>

      {activeTab === 'list' && (
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
                  {p.room?.roomNumber} · {p.period} · 截止{p.dueDate?.slice(0, 10)}
                </div>
              }
              extra={
                p.status !== 'PAID' && (
                  <Button size="small" color="primary" onClick={() => { setSelectedPayment(p); setShowPay(true); }}>缴费</Button>
                )
              }
            />
          ))}
          {payments.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无账单</div>}
        </List>
      )}

      {activeTab === 'overdue' && (
        <List>
          {overdue.map((p: any) => (
            <List.Item
              key={p.id}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{getTypeName(p.type)} ¥{p.amount}</span>
                  <Tag color="danger">逾期</Tag>
                </div>
              }
              description={
                <div>
                  {p.room?.roomNumber} · {p.period} · 截止{p.dueDate?.slice(0, 10)}
                </div>
              }
              extra={
                <Button size="small" color="primary" onClick={() => { setSelectedPayment(p); setShowPay(true); }}>缴费</Button>
              }
            />
          ))}
          {overdue.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无逾期账单</div>}
        </List>
      )}

      <Modal
        visible={showCreate}
        title="创建账单"
        content={
          <Form layout="vertical">
            <Form.Item label="小区">
              <Selector
                options={communities.map((c: any) => ({ label: c.name, value: c.id }))}
                value={[createForm.roomId ? communities.find((c: any) => rooms.some((r: any) => r.id === createForm.roomId && r.communityId === c.id))?.id || '' : '']}
                onChange={v => { loadRooms(v[0]); setCreateForm({ ...createForm, roomId: '' }); }}
              />
            </Form.Item>
            <Form.Item label="房间">
              <Selector
                options={rooms.map((r: any) => ({ label: r.roomNumber, value: r.id }))}
                value={[createForm.roomId]}
                onChange={v => setCreateForm({ ...createForm, roomId: v[0] })}
              />
            </Form.Item>
            <Form.Item label="类型">
              <Selector
                options={typeOptions}
                value={[createForm.type]}
                onChange={v => setCreateForm({ ...createForm, type: v[0] })}
              />
            </Form.Item>
            <Form.Item label="金额">
              <Input type="number" value={String(createForm.amount)} onChange={v => setCreateForm({ ...createForm, amount: Number(v) })} />
            </Form.Item>
            <Form.Item label="周期">
              <Input value={createForm.period} onChange={v => setCreateForm({ ...createForm, period: v })} />
            </Form.Item>
            <Form.Item label="截止日期">
              <Input type="date" value={createForm.dueDate} onChange={v => setCreateForm({ ...createForm, dueDate: v })} />
            </Form.Item>
          </Form>
        }
        closeOnAction
        onClose={() => setShowCreate(false)}
        actions={[
          { key: 'cancel', text: '取消' },
          { key: 'save', text: '保存', primary: true, onClick: handleCreate },
        ]}
      />

      <Modal
        visible={showPay}
        title="缴费确认"
        content={
          selectedPayment && (
            <div>
              <p>{getTypeName(selectedPayment.type)} ¥{selectedPayment.amount}</p>
              <p>房间: {selectedPayment.room?.roomNumber}</p>
              <Selector
                options={methodOptions}
                value={[payForm.paymentMethod]}
                onChange={v => setPayForm({ paymentMethod: v[0] })}
              />
            </div>
          )
        }
        closeOnAction
        onClose={() => setShowPay(false)}
        actions={[
          { key: 'cancel', text: '取消' },
          { key: 'pay', text: '确认缴费', primary: true, onClick: handlePay },
        ]}
      />
    </div>
  );
}
