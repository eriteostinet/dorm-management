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
  reported: '待同意', processing: '处理中', done: '待验收', confirmed: '已完成'
};
const statusColor: Record<string, string> = {
  reported: 'warning', processing: 'primary', done: 'success', confirmed: 'default'
};
const urgencyText: Record<string, string> = {
  urgent: '紧急', normal: '一般', low: '低'
};
const urgencyColor: Record<string, string> = {
  urgent: 'danger', normal: 'primary', low: 'success'
};

function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.getFullYear() + '-' + (date.getMonth()+1) + '-' + date.getDate();
}

export default function Repairs({ onBack }: RepairsProps) {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [activeKey, setActiveKey] = useState('reported');
  const [loading, setLoading] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);

  useEffect(function() {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // 使用云函数 API 获取工单（多端互通）
      const list = await getRepairTickets();
      setTickets(list);
      setCloudReady(true);
      setLoading(false);
    } catch (err) {
      console.error('加载失败:', err);
      setCloudReady(true);
      setLoading(false);
      Toast.show({ icon: 'fail', content: '云数据库连接失败' });
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
      const result = await approveTicket(ticket._id);
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

  async function doComplete(id: string) {
    const solution = window.prompt('请输入解决方案：');
    if (!solution) return;
    
    setLoading(true);
    try {
      // 使用云函数 API（多端互通）
      const result = await completeRepair(id);
      if (result.success) {
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

  const filtered = tickets.filter(function(t) {
    return activeKey === 'reported' ? t.status === 'reported' :
           activeKey === 'processing' ? t.status === 'processing' :
           activeKey === 'done' ? t.status === 'done' :
           activeKey === 'confirmed' ? t.status === 'confirmed' : true;
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
        <Tabs.Tab title="待同意" key="reported" />
        <Tabs.Tab title="处理中" key="processing" />
        <Tabs.Tab title="待验收" key="done" />
        <Tabs.Tab title="已完成" key="confirmed" />
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
            filtered.map(function(t) {
              return (
                <Card key={t._id} className="repair-card">
                  <div className="repair-header">
                    <span className="repair-id">{t._id}</span>
                    <div>
                      <Tag color={urgencyColor[t.urgency] || 'default'}>{urgencyText[t.urgency] || t.urgency}</Tag>
                      <Tag color={statusColor[t.status] || 'default'}>{statusText[t.status] || t.status}</Tag>
                    </div>
                  </div>
                  <div className="repair-info">
                    <p><strong>位置：</strong>{t.dormId}</p>
                    <p><strong>问题：</strong>{t.category} - {t.subCategory}</p>
                    <p><strong>报修人：</strong>{t.reporterName}</p>
                    <p><strong>时间：</strong>{fmtDate(t.reportedAt)}</p>
                  </div>
                  <div className="repair-actions">
                    {t.status === 'reported' && (
                      <Button 
                        size="small" 
                        color="primary" 
                        onClick={function() { doApprove(t); }}
                      >
                        同意
                      </Button>
                    )}
                    {t.status === 'processing' && (
                      <Button 
                        size="small" 
                        color="success" 
                        onClick={function() { doComplete(t._id); }}
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
