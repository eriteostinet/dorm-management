import { useEffect, useState } from 'react';
import { Card, Tabs, Tag, NavBar, Button, Dialog, Toast, Rate, TextArea, PullToRefresh, SpinLoading } from 'antd-mobile';
import { RedoOutline } from 'antd-mobile-icons';
import { getRepairTickets, confirmRepair } from '../../services/dataService';
import { auth } from '../../utils/auth';
import { formatDateTime, getTicketStatusInfo, getUrgencyInfo } from '../../utils';
import type { RepairTicket } from '../../types';
import './Tickets.css';

interface TicketsProps {
  onBack: () => void;
}

export default function Tickets({ onBack }: TicketsProps) {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [activeKey, setActiveKey] = useState('processing');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const userId = auth.getUserId();
      if (userId) {
        const result = await getRepairTickets({ reporterId: userId });
        setTickets(result);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadTickets();
    Toast.show({ icon: 'success', content: '刷新成功' });
  };

  const handleConfirm = (ticket: RepairTicket) => {
    Dialog.confirm({
      title: '验收确认',
      content: '维修是否已完成？',
      confirmText: '通过',
      cancelText: '不通过',
      onConfirm: () => showRatingDialog(ticket._id, 'passed'),
      onCancel: () => showRatingDialog(ticket._id, 'failed'),
    });
  };

  const showRatingDialog = (ticketId: string, confirmStatus: 'passed' | 'failed') => {
    let rating = 5;
    let comment = '';

    Dialog.alert({
      title: confirmStatus === 'passed' ? '评价服务' : '问题反馈',
      content: (
        <div style={{ padding: '10px 0' }}>
          {confirmStatus === 'passed' && (
            <div style={{ marginBottom: 15 }}>
              <div style={{ marginBottom: 5, fontSize: 14 }}>满意度评分</div>
              <Rate
                defaultValue={5}
                onChange={(val) => { rating = val; }}
              />
            </div>
          )}
          <TextArea
            placeholder={confirmStatus === 'passed' ? '请输入评价（可选）' : '请输入未解决的问题'}
            rows={3}
            onChange={(val) => { comment = val; }}
          />
        </div>
      ),
      onConfirm: async () => {
        const result = await confirmRepair(ticketId, {
          confirmStatus,
          rating: confirmStatus === 'passed' ? rating : undefined,
          comment: comment || undefined
        });

        if (result.success) {
          Toast.show({
            icon: 'success',
            content: confirmStatus === 'passed' ? '验收通过' : '已退回维修'
          });
          loadTickets();
        } else {
          Toast.show({ icon: 'fail', content: result.message || '操作失败' });
        }
      },
    });
  };

  const filterTickets = (status: string) => {
    if (status === 'processing') {
      return tickets.filter(t => ['reported', 'assigned', 'processing'].includes(t.status));
    }
    if (status === 'pending') {
      return tickets.filter(t => t.status === 'done');
    }
    return tickets.filter(t => t.status === 'confirmed');
  };

  const renderTicketCard = (ticket: RepairTicket) => {
    const statusInfo = getTicketStatusInfo(ticket.status);
    const urgencyInfo = getUrgencyInfo(ticket.urgency);

    return (
      <Card key={ticket._id} className="ticket-card">
        <div className="ticket-header">
          <span className="ticket-id">{ticket._id}</span>
          <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
        </div>

        <div className="ticket-info">
          <p><strong>位置：</strong>{ticket.dormId} {ticket.roomId ? `· ${ticket.roomId.slice(-1)}房` : ''}</p>
          <p><strong>类别：</strong>{ticket.category} · {ticket.subCategory}</p>
          <p><strong>紧急度：</strong>
            <span style={{ color: urgencyInfo.color }}>{urgencyInfo.text}</span>
          </p>
          <p><strong>提交时间：</strong>{formatDateTime(ticket.reportedAt)}</p>
          {ticket.assignedName && (
            <p><strong>维修工：</strong>{ticket.assignedName}</p>
          )}
          {ticket.solution && (
            <p><strong>解决方案：</strong>{ticket.solution}</p>
          )}
        </div>

        {ticket.status === 'done' && (
          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <Button size="small" color="primary" onClick={() => handleConfirm(ticket)}>
              验收
            </Button>
          </div>
        )}
      </Card>
    );
  };

  const renderContent = (status: string) => {
    const filtered = filterTickets(status);
    
    if (loading && filtered.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading />
        </div>
      );
    }
    
    if (filtered.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          暂无数据，下拉刷新
        </div>
      );
    }
    
    return filtered.map(renderTicketCard);
  };

  return (
    <div className="page-container">
      <NavBar 
        onBack={onBack}
        right={
          <Button 
            fill='none' 
            onClick={handleRefresh}
            loading={loading}
          >
            <RedoOutline />
          </Button>
        }
      >
        我的工单
      </NavBar>

      <PullToRefresh onRefresh={handleRefresh}>
        <div style={{ minHeight: '50vh' }}>
          <Tabs activeKey={activeKey} onChange={setActiveKey}>
            <Tabs.Tab title="处理中" key="processing">
              {renderContent('processing')}
            </Tabs.Tab>

            <Tabs.Tab title="待验收" key="pending">
              {renderContent('pending')}
            </Tabs.Tab>

            <Tabs.Tab title="已完成" key="completed">
              {renderContent('completed')}
            </Tabs.Tab>
          </Tabs>
        </div>
      </PullToRefresh>
    </div>
  );
}
