import { useState, useEffect } from 'react';
import { Card, Tabs, Button, Tag, NavBar, Toast, PullToRefresh, SpinLoading } from 'antd-mobile';
import { RedoOutline } from 'antd-mobile-icons';
import { getRepairTickets, approveTicket, completeRepair } from '../../services/dataService';
import type { RepairTicket } from '../../types';
import './Repairs.css';

interface RepairsProps {
  onBack: () => void;
}

// 状态文本
const statusText: Record<string, string> = {
  PENDING: '待同意', APPROVED: '已同意', PROCESSING: '处理中', DONE: '待验收', CONFIRMED: '已完成'
};
const statusColor: Record<string, string> = {
  PENDING: 'warning', APPROVED: 'primary', PROCESSING: 'primary', DONE: 'success', CONFIRMED: 'default'
};
const urgencyText: Record<string, string> = {
  HIGH: '紧急', NORMAL: '一般', LOW: '低'
};
const urgencyColor: Record<string, string> = {
  HIGH: 'danger', NORMAL: 'primary', LOW: 'success'
};

function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.getFullYear() + '-' + (date.getMonth()+1) + '-' + date.getDate();
}

export default function Repairs({ onBack }: RepairsProps) {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [activeKey, setActiveKey] = useState('PENDING');
  const [loading, setLoading] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);

  useEffect(function() {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const list = await getRepairTickets();
      setTickets(list);
      setCloudReady(true);
    } catch (err) {
      console.error('加载失败:', err);
      Toast.show({ icon: 'fail', content: '加载工单失败' });
    } finally {
      setLoading(false);
    }
  }

  function doRefresh() {
    loadData();
    Toast.show({ icon: 'success', content: '刷新成功' });
    return Promise.resolve();
  }

  async function doApprove(ticket: RepairTicket) {
    if (!window.confirm('同意后将直接进入处理中状态，是否确认？')) {
      return;
    }
    
    setLoading(true);
    try {
      // 使用云函数 API（多端互通）
      const result = await approveTicket(ticket.id);
      if (result.success) {
        Toast.show({ icon: 'success', content: '已同意，进入处理中' });
        loadData();
      } else {
        Toast.show({ icon: 'fail', content: result.message || '更新失败' });
      }
    } catch (err) {
      console.error('同意操作失败:', err);
      Toast.show({ icon: 'fail', content: '操作失败' });
    } finally {
      setLoading(false);
    }
  }

  async function doComplete(ticket: RepairTicket) {
    const solution = window.prompt('请输入解决方案：');
    if (!solution) return;
    
    setLoading(true);
    try {
      const result = await completeRepair(ticket.id, solution);
      if (result.success !== false) {
        Toast.show({ icon: 'success', content: '已完成' });
        loadData();
      } else {
        Toast.show({ icon: 'fail', content: result.message || '更新失败' });
      }
    } catch (err) {
      console.error('完成操作失败:', err);
      Toast.show({ icon: 'fail', content: '操作失败' });
    } finally {
      setLoading(false);
    }
  }

  const filtered = tickets.filter(function(t: any) {
    return activeKey === 'PENDING' ? (t.status === 'PENDING' || t.status === 'APPROVED') :
           activeKey === 'PROCESSING' ? t.status === 'PROCESSING' :
           activeKey === 'DONE' ? t.status === 'DONE' :
           activeKey === 'CONFIRMED' ? t.status === 'CONFIRMED' : true;
  });

  return (
    <div className="page-container">
      <NavBar onBack={onBack} right={
        <Button fill='none' onClick={doRefresh} loading={loading}><RedoOutline /></Button>
      }>维修中心</NavBar>
      
      {!cloudReady && (
        <div style={{ padding: '10px 16px', background: '#fff7e6', color: '#d46b08', fontSize: 14 }}>
          ⚠️ 正在连接云数据库...
        </div>
      )}

      <Tabs activeKey={activeKey} onChange={setActiveKey}>
        <Tabs.Tab title="待同意" key="PENDING" />
        <Tabs.Tab title="处理中" key="PROCESSING" />
        <Tabs.Tab title="待验收" key="DONE" />
        <Tabs.Tab title="已完成" key="CONFIRMED" />
      </Tabs>

      <PullToRefresh onRefresh={doRefresh}>
        <div style={{ minHeight: '50vh', padding: '0 12px' }}>
          {loading && filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}><SpinLoading /></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              {cloudReady ? '暂无数据' : '正在连接云数据库...'}
            </div>
          ) : (
            filtered.map(function(t: any) {
              return (
                <Card key={t.id} className="repair-card">
                  <div className="repair-header">
                    <span className="repair-id">{t.id}</span>
                    <div>
                      <Tag color={urgencyColor[t.urgency] || 'default'}>{urgencyText[t.urgency] || t.urgency}</Tag>
                      <Tag color={statusColor[t.status] || 'default'}>{statusText[t.status] || t.status}</Tag>
                    </div>
                  </div>
                  <div className="repair-info">
                    <p><strong>位置：</strong>{t.room?.roomNumber || t.roomId}</p>
                    <p><strong>问题：</strong>{t.category} - {t.description}</p>
                    <p><strong>报修人：</strong>{t.reporter?.realName || t.reporterName}</p>
                    <p><strong>时间：</strong>{fmtDate(t.createdAt)}</p>
                  </div>
                  <div className="repair-actions">
                    {(t.status === 'PENDING' || t.status === 'APPROVED') && (
                      <Button 
                        size="small" 
                        color="primary" 
                        onClick={function() { doApprove(t); }}
                      >
                        同意
                      </Button>
                    )}
                    {t.status === 'PROCESSING' && (
                      <Button 
                        size="small" 
                        color="success" 
                        onClick={function() { doComplete(t); }}
                      >
                        完成
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}
