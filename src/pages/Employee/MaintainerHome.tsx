import { useState, useEffect } from 'react';
import { Card, Tabs, Button, Tag, NavBar, Toast, PullToRefresh, SpinLoading } from 'antd-mobile';
import { RedoOutline } from 'antd-mobile-icons';
import { getRepairTickets, startRepair, completeRepair } from '../../services/dataService';
import { auth } from '../../utils/auth';
import { formatDateTime, getTicketStatusInfo, getUrgencyInfo } from '../../utils';
import type { RepairTicket } from '../../types';
import './MaintainerHome.css';

export default function MaintainerHome() {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [activeKey, setActiveKey] = useState('assigned');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, processing: 0, done: 0 });

  const userId = auth.getUserId();

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const result = await getRepairTickets({ assignedTo: userId || '' });
      setTickets(result);
      setStats({
        total: result.length,
        processing: result.filter((t: any) => t.status === 'PROCESSING').length,
        done: result.filter((t: any) => t.status === 'DONE').length,
      });
    } catch (err) {
      console.error('加载工单失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadTickets();
    Toast.show({ icon: 'success', content: '刷新成功' });
  };

  const handleStart = async (ticket: RepairTicket) => {
    try {
      const result = await startRepair(ticket.id);
      if (result && result.id) {
        Toast.show({ icon: 'success', content: '已开始维修' });
        loadTickets();
      } else {
        Toast.show({ icon: 'fail', content: '操作失败' });
      }
    } catch (err) {
      console.error('开始维修失败:', err);
      Toast.show({ icon: 'fail', content: '操作失败' });
    }
  };

  const handleComplete = async (ticket: RepairTicket) => {
    const solution = window.prompt('请输入解决方案：');
    if (!solution) return;

    try {
      const result = await completeRepair(ticket.id, solution);
      if (result && result.id) {
        Toast.show({ icon: 'success', content: '已完成维修' });
        loadTickets();
      } else {
        Toast.show({ icon: 'fail', content: '操作失败' });
      }
    } catch (err) {
      console.error('完成维修失败:', err);
      Toast.show({ icon: 'fail', content: '操作失败' });
    }
  };

  const filterTickets = (status: string) => {
    if (status === 'assigned') {
      return tickets.filter((t: any) => ['APPROVED', 'PROCESSING'].includes(t.status));
    }
    if (status === 'done') {
      return tickets.filter((t: any) => t.status === 'DONE');
    }
    return tickets.filter((t: any) => t.status === 'CONFIRMED');
  };

  const renderTicketCard = (ticket: RepairTicket) => {
    const statusInfo = getTicketStatusInfo(ticket.status);
    const urgencyInfo = getUrgencyInfo(ticket.urgency);

    return (
      <Card key={ticket.id} className="ticket-card">
        <div className="ticket-header">
          <span className="ticket-id">{ticket.id}</span>
          <div>
            <Tag color={urgencyInfo.color}>{urgencyInfo.text}</Tag>
            <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
          </div>
        </div>

        <div className="ticket-info">
          <p><strong>位置：</strong>{ticket.room?.roomNumber || ticket.roomId}</p>
          <p><strong>类别：</strong>{ticket.category} · {ticket.description || ''}</p>
          <p><strong>紧急度：</strong><span style={{ color: urgencyInfo.color }}>{urgencyInfo.text}</span></p>
          <p><strong>报修人：</strong>{ticket.reporter?.realName || ticket.reporterName}</p>
          <p><strong>提交时间：</strong>{formatDateTime(ticket.createdAt)}</p>
          {ticket.solution && <p><strong>解决方案：</strong>{ticket.solution}</p>}
        </div>

        <div className="ticket-actions">
          {ticket.status === 'APPROVED' && (
            <Button size="small" color="primary" onClick={() => handleStart(ticket)}>
              开始维修
            </Button>
          )}
          {ticket.status === 'PROCESSING' && (
            <Button size="small" color="success" onClick={() => handleComplete(ticket)}>
              完成维修
            </Button>
          )}
        </div>
      </Card>
    );
  };

  const renderContent = (status: string) => {
    const filtered = filterTickets(status);
    if (loading && filtered.length === 0) {
      return <div style={{ textAlign: 'center', padding: 40 }}><SpinLoading /></div>;
    }
    if (filtered.length === 0) {
      return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无工单</div>;
    }
    return filtered.map(renderTicketCard);
  };

  const name = auth.getCurrentUser()?.realName || '维修工';

  return (
    <div className="page-container">
      <NavBar back={null} right={
        <Button fill="none" onClick={handleRefresh} loading={loading}><RedoOutline /></Button>
      }>
        维修工工作台
      </NavBar>

      <Card className="maintainer-stats">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{stats.total}</div>
            <div style={{ fontSize: 12, color: '#999' }}>总工单</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>{stats.processing}</div>
            <div style={{ fontSize: 12, color: '#999' }}>处理中</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{stats.done}</div>
            <div style={{ fontSize: 12, color: '#999' }}>已完成</div>
          </div>
        </div>
      </Card>

      <PullToRefresh onRefresh={handleRefresh}>
        <div style={{ minHeight: '50vh' }}>
          <Tabs activeKey={activeKey} onChange={setActiveKey}>
            <Tabs.Tab title={`待处理 (${stats.processing})`} key="assigned">
              {renderContent('assigned')}
            </Tabs.Tab>
            <Tabs.Tab title="待验收" key="done">
              {renderContent('done')}
            </Tabs.Tab>
            <Tabs.Tab title="已完成" key="completed">
              {renderContent('completed')}
            </Tabs.Tab>
          </Tabs>
        </div>
      </PullToRefresh>

      <div style={{ padding: '12px 16px', textAlign: 'center', color: '#999', fontSize: 12 }}>
        欢迎，{name}
      </div>
    </div>
  );
}
