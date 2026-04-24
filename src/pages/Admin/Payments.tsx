import { useState, useEffect, useMemo } from 'react';
import './Payments.css';
import { 
  getPayments, 
  createPayment, 
  payPayment, 
  cancelPayment, 
  deletePayment,
  batchCreatePayments,
  getPaymentStats,
  getOverduePayments,
  PAYMENT_TYPE_CONFIG,
  getCommunities,
  getRooms,
} from '../../services/dataService';
import type { Payment, PaymentType, PaymentStatus, Community, Room } from '../../types';

interface PaymentsProps {
  onBack: () => void;
}

export default function Payments({ onBack }: PaymentsProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState<{
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    collectionRate: number;
    byType?: Record<string, { total: number; paid: number; pending: number }>;
  }>({
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    collectionRate: 0,
  });
  const [overdueList, setOverdueList] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'overdue'>('list');
  
  // 筛选状态
  const [filters, setFilters] = useState({
    communityId: '',
    type: '' as PaymentType | '',
    status: '' as PaymentStatus | '',
    period: new Date().toISOString().slice(0, 7),
  });
  
  // 弹窗状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  
  // 表单状态
  const [createForm, setCreateForm] = useState({
    roomId: '',
    type: 'water' as PaymentType,
    period: new Date().toISOString().slice(0, 7),
    amount: 0,
    unitPrice: 0,
    quantity: 0,
    previousReading: 0,
    currentReading: 0,
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    remark: '',
  });
  
  const [batchForm, setBatchForm] = useState({
    communityId: '',
    type: 'water' as PaymentType,
    period: new Date().toISOString().slice(0, 7),
    unitPrice: 0,
    defaultAmount: 0,
  });
  
  const [payForm, setPayForm] = useState({
    paidBy: '',
    paymentMethod: 'wechat' as 'cash' | 'wechat' | 'alipay' | 'bank',
  });

  // 初始化加载
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
      
      // 加载统计
      const statsData = await getPaymentStats({
        communityId: filters.communityId || undefined,
        period: filters.period,
      });
      setStats(statsData);
    } catch (error) {
      console.error('加载缴费数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommunities = async () => {
    const data = await getCommunities();
    setCommunities(data);
  };

  const loadRooms = async (communityId: string) => {
    const data = await getRooms({ communityId, status: 'occupied' });
    setRooms(data);
  };

  const loadOverdue = async () => {
    const data = await getOverduePayments();
    setOverdueList(data);
  };

  // 创建单个账单
  const handleCreate = async () => {
    const room = rooms.find(r => r._id === createForm.roomId);
    if (!room) {
      alert('请选择房间');
      return;
    }

    const typeConfig = PAYMENT_TYPE_CONFIG[createForm.type];
    let amount = createForm.amount;
    
    // 如果是水电费，自动计算金额
    if (typeConfig.hasReading && createForm.quantity) {
      amount = createForm.quantity * createForm.unitPrice;
    }

    const result = await createPayment({
      ...createForm,
      amount,
      dueDate: new Date(createForm.dueDate),
      communityId: room.communityId,
      communityName: communities.find(c => c._id === room.communityId)?.name || '',
      building: room.dormId,
    });

    if (result.success) {
      alert('账单创建成功');
      setShowCreateModal(false);
      loadData();
    } else {
      alert(result.message || '创建失败');
    }
  };

  // 批量创建
  const handleBatchCreate = async () => {
    if (!batchForm.communityId) {
      alert('请选择小区');
      return;
    }

    const result = await batchCreatePayments(
      batchForm.communityId,
      batchForm.type,
      batchForm.period,
      {
        unitPrice: batchForm.unitPrice,
        defaultAmount: batchForm.defaultAmount,
      }
    );

    alert(result.message);
    if (result.success) {
      setShowBatchModal(false);
      loadData();
    }
  };

  // 缴费
  const handlePay = async () => {
    if (!selectedPayment) return;
    
    const result = await payPayment(selectedPayment._id, payForm);
    if (result.success) {
      alert('缴费成功');
      setShowPayModal(false);
      setSelectedPayment(null);
      loadData();
      loadOverdue();
    } else {
      alert(result.message || '缴费失败');
    }
  };

  // 取消账单
  const handleCancel = async (payment: Payment) => {
    const reason = prompt('请输入取消原因:');
    if (!reason) return;
    
    const result = await cancelPayment(payment._id, reason);
    if (result.success) {
      alert('账单已取消');
      loadData();
    } else {
      alert(result.message || '取消失败');
    }
  };

  // 删除账单
  const handleDelete = async (payment: Payment) => {
    if (!confirm('确定删除该账单吗？')) return;
    
    const result = await deletePayment(payment._id);
    if (result.success) {
      alert('账单已删除');
      loadData();
    } else {
      alert('删除失败');
    }
  };

  // 获取状态显示
  const getStatusDisplay = (status: PaymentStatus) => {
    const map: Record<PaymentStatus, { text: string; class: string }> = {
      pending: { text: '待缴费', class: 'status-pending' },
      paid: { text: '已缴费', class: 'status-paid' },
      overdue: { text: '已逾期', class: 'status-overdue' },
      cancelled: { text: '已取消', class: 'status-cancelled' },
    };
    return map[status];
  };

  // 判断是否逾期
  const isOverdue = (payment: Payment) => {
    return payment.status === 'pending' && new Date(payment.dueDate) < new Date();
  };

  // 过滤后的数据
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (filters.status && p.status !== filters.status) return false;
      if (filters.type && p.type !== filters.type) return false;
      return true;
    });
  }, [payments, filters]);

  return (
    <div className="payments-page">
      <div className="payments-header">
        <div className="header-left">
          <button className="btn-back" onClick={onBack}>← 返回</button>
          <h1>缴费管理</h1>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            + 创建账单
          </button>
          <button className="btn-secondary" onClick={() => setShowBatchModal(true)}>
            批量生成
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">应收总额</div>
          <div className="stat-value">¥{stats.totalAmount.toFixed(2)}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-title">已收金额</div>
          <div className="stat-value">¥{stats.paidAmount.toFixed(2)}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-title">待收金额</div>
          <div className="stat-value">¥{stats.pendingAmount.toFixed(2)}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-title">逾期金额</div>
          <div className="stat-value">¥{stats.overdueAmount.toFixed(2)}</div>
        </div>
        <div className="stat-card info">
          <div className="stat-title">收缴率</div>
          <div className="stat-value">{stats.collectionRate}%</div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="payments-tabs">
        <button
          className={activeTab === 'list' ? 'active' : ''}
          onClick={() => setActiveTab('list')}
        >
          账单列表
        </button>
        <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
        >
          缴费统计
        </button>
        <button
          className={activeTab === 'overdue' ? 'active' : ''}
          onClick={() => setActiveTab('overdue')}
        >
          欠费管理
          {overdueList.length > 0 && <span className="badge">{overdueList.length}</span>}
        </button>
      </div>

      {/* 筛选栏 */}
      {activeTab === 'list' && (
        <div className="filter-bar">
          <select 
            value={filters.communityId} 
            onChange={e => setFilters({ ...filters, communityId: e.target.value })}
          >
            <option value="">全部小区</option>
            {communities.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
          
          <select 
            value={filters.type} 
            onChange={e => setFilters({ ...filters, type: e.target.value as PaymentType })}
          >
            <option value="">全部类型</option>
            <option value="water">水费</option>
            <option value="electricity">电费</option>
            <option value="rent">房租</option>
            <option value="other">其他</option>
          </select>

          <select
            value={filters.status}
            onChange={e => setFilters({ ...filters, status: e.target.value as PaymentStatus })}
          >
            <option value="">全部状态</option>
            <option value="pending">待缴费</option>
            <option value="paid">已缴费</option>
            <option value="overdue">已逾期</option>
            <option value="cancelled">已取消</option>
          </select>
          
          <input 
            type="month" 
            value={filters.period}
            onChange={e => setFilters({ ...filters, period: e.target.value })}
          />
          
          <button className="btn" onClick={loadData}>刷新</button>
        </div>
      )}

      {/* 账单列表 */}
      {activeTab === 'list' && (
        <div className="payments-table-container">
          <table className="payments-table">
            <thead>
              <tr>
                <th>账单号</th>
                <th>小区</th>
                <th>房间</th>
                <th>住户</th>
                <th>类型</th>
                <th>周期</th>
                <th>金额</th>
                <th>状态</th>
                <th>截止日期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="loading">加载中...</td></tr>
              ) : filteredPayments.length === 0 ? (
                <tr><td colSpan={10} className="empty">暂无数据</td></tr>
              ) : (
                filteredPayments.map(payment => (
                  <tr key={payment._id} className={isOverdue(payment) ? 'overdue-row' : ''}>
                    <td>{payment._id.slice(-8)}</td>
                    <td>{payment.communityName}</td>
                    <td>{payment.roomNo}</td>
                    <td>{payment.occupantName || '-'}</td>
                    <td>{payment.typeName}</td>
                    <td>{payment.period}</td>
                    <td className="amount">¥{payment.amount.toFixed(2)}</td>
                    <td>
                      <span className={`status-tag ${getStatusDisplay(payment.status).class}`}>
                        {isOverdue(payment) ? '已逾期' : getStatusDisplay(payment.status).text}
                      </span>
                    </td>
                    <td>{new Date(payment.dueDate).toLocaleDateString()}</td>
                    <td className="actions">
                      {payment.status === 'pending' && (
                        <>
                          <button 
                            className="btn-pay"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowPayModal(true);
                            }}
                          >
                            缴费
                          </button>
                          <button 
                            className="btn-cancel"
                            onClick={() => handleCancel(payment)}
                          >
                            取消
                          </button>
                          <button 
                            className="btn-delete"
                            onClick={() => handleDelete(payment)}
                          >
                            删除
                          </button>
                        </>
                      )}
                      {payment.status === 'paid' && (
                        <span className="paid-info">
                          {payment.paymentMethod === 'wechat' && '微信'}
                          {payment.paymentMethod === 'alipay' && '支付宝'}
                          {payment.paymentMethod === 'cash' && '现金'}
                          {payment.paymentMethod === 'bank' && '银行'}
                          {' · '}
                          {new Date(payment.paidAt!).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 缴费统计 */}
      {activeTab === 'stats' && (
        <div className="stats-panel">
          <h3>费用类型统计</h3>
          <div className="stats-by-type">
            {Object.entries(stats.byType || {}).map(([type, data]: [string, any]) => (
              <div key={type} className="type-stat-card">
                <div className="type-name">
                  {type === 'water' && '水费'}
                  {type === 'electricity' && '电费'}
                  {type === 'rent' && '房租'}
                  {type === 'other' && '其他'}
                </div>
                <div className="type-amounts">
                  <div>应收: ¥{data.total.toFixed(2)}</div>
                  <div>已收: ¥{data.paid.toFixed(2)}</div>
                  <div>待收: ¥{data.pending.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 欠费管理 */}
      {activeTab === 'overdue' && (
        <div className="overdue-panel">
          <h3>逾期账单列表</h3>
          {overdueList.length === 0 ? (
            <div className="empty">暂无逾期账单</div>
          ) : (
            <table className="payments-table">
              <thead>
                <tr>
                  <th>账单号</th>
                  <th>小区</th>
                  <th>房间</th>
                  <th>住户</th>
                  <th>类型</th>
                  <th>金额</th>
                  <th>逾期天数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {overdueList.map(payment => {
                  const overdueDays = Math.floor((Date.now() - new Date(payment.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={payment._id} className="overdue-row">
                      <td>{payment._id.slice(-8)}</td>
                      <td>{payment.communityName}</td>
                      <td>{payment.roomNo}</td>
                      <td>{payment.occupantName || '-'}</td>
                      <td>{payment.typeName}</td>
                      <td className="amount">¥{payment.amount.toFixed(2)}</td>
                      <td className="overdue-days">{overdueDays}天</td>
                      <td>
                        <button 
                          className="btn-pay"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowPayModal(true);
                          }}
                        >
                          立即缴费
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 创建账单弹窗 */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>创建账单</h3>
            <div className="form-group">
              <label>小区</label>
              <select 
                value={communities.find(c => rooms.find(r => r._id === createForm.roomId)?.communityId === c._id)?._id || ''}
                onChange={e => loadRooms(e.target.value)}
              >
                <option value="">请选择</option>
                {communities.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>房间</label>
              <select 
                value={createForm.roomId}
                onChange={e => setCreateForm({ ...createForm, roomId: e.target.value })}
              >
                <option value="">请选择</option>
                {rooms.map(r => (
                  <option key={r._id} value={r._id}>{r.roomNo} - {r.occupantName || '空房'}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>费用类型</label>
              <select 
                value={createForm.type}
                onChange={e => setCreateForm({ ...createForm, type: e.target.value as PaymentType })}
              >
                <option value="water">水费</option>
                <option value="electricity">电费</option>
                <option value="rent">房租</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="form-group">
              <label>计费周期</label>
              <input 
                type="month"
                value={createForm.period}
                onChange={e => setCreateForm({ ...createForm, period: e.target.value })}
              />
            </div>
            
            {PAYMENT_TYPE_CONFIG[createForm.type].hasReading && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>上期读数</label>
                    <input 
                      type="number"
                      value={createForm.previousReading}
                      onChange={e => setCreateForm({ ...createForm, previousReading: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label>本期读数</label>
                    <input 
                      type="number"
                      value={createForm.currentReading}
                      onChange={e => {
                        const current = Number(e.target.value);
                        const quantity = current - createForm.previousReading;
                        setCreateForm({ 
                          ...createForm, 
                          currentReading: current,
                          quantity,
                          amount: quantity * createForm.unitPrice
                        });
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>用量 ({PAYMENT_TYPE_CONFIG[createForm.type].unit})</label>
                    <input type="number" value={createForm.quantity} readOnly />
                  </div>
                  <div className="form-group">
                    <label>单价</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={createForm.unitPrice}
                      onChange={e => {
                        const price = Number(e.target.value);
                        setCreateForm({ 
                          ...createForm, 
                          unitPrice: price,
                          amount: createForm.quantity * price
                        });
                      }}
                    />
                  </div>
                </div>
              </>
            )}
            
            <div className="form-group">
              <label>金额 (元)</label>
              <input 
                type="number"
                step="0.01"
                value={createForm.amount}
                onChange={e => setCreateForm({ ...createForm, amount: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>截止日期</label>
              <input 
                type="date"
                value={createForm.dueDate}
                onChange={e => setCreateForm({ ...createForm, dueDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>备注</label>
              <textarea 
                value={createForm.remark}
                onChange={e => setCreateForm({ ...createForm, remark: e.target.value })}
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCreateModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleCreate}>创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 批量创建弹窗 */}
      {showBatchModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>批量生成账单</h3>
            <p className="tip">为小区所有已入住房间创建账单</p>
            <div className="form-group">
              <label>小区</label>
              <select 
                value={batchForm.communityId}
                onChange={e => setBatchForm({ ...batchForm, communityId: e.target.value })}
              >
                <option value="">请选择</option>
                {communities.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>费用类型</label>
              <select 
                value={batchForm.type}
                onChange={e => setBatchForm({ ...batchForm, type: e.target.value as PaymentType })}
              >
                <option value="water">水费</option>
                <option value="electricity">电费</option>
                <option value="rent">房租</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="form-group">
              <label>计费周期</label>
              <input 
                type="month"
                value={batchForm.period}
                onChange={e => setBatchForm({ ...batchForm, period: e.target.value })}
              />
            </div>
            {PAYMENT_TYPE_CONFIG[batchForm.type].hasReading && (
              <div className="form-group">
                <label>单价</label>
                <input 
                  type="number"
                  step="0.01"
                  value={batchForm.unitPrice}
                  onChange={e => setBatchForm({ ...batchForm, unitPrice: Number(e.target.value) })}
                />
              </div>
            )}
            <div className="form-group">
              <label>默认金额 (元)</label>
              <input 
                type="number"
                step="0.01"
                value={batchForm.defaultAmount}
                onChange={e => setBatchForm({ ...batchForm, defaultAmount: Number(e.target.value) })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowBatchModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleBatchCreate}>开始生成</button>
            </div>
          </div>
        </div>
      )}

      {/* 缴费弹窗 */}
      {showPayModal && selectedPayment && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>确认缴费</h3>
            <div className="payment-info">
              <p><strong>账单号:</strong> {selectedPayment._id.slice(-8)}</p>
              <p><strong>房间:</strong> {selectedPayment.roomNo}</p>
              <p><strong>住户:</strong> {selectedPayment.occupantName || '-'}</p>
              <p><strong>类型:</strong> {selectedPayment.typeName}</p>
              <p><strong>金额:</strong> <span className="amount-large">¥{selectedPayment.amount.toFixed(2)}</span></p>
            </div>
            <div className="form-group">
              <label>缴费方式</label>
              <select 
                value={payForm.paymentMethod}
                onChange={e => setPayForm({ ...payForm, paymentMethod: e.target.value as any })}
              >
                <option value="wechat">微信支付</option>
                <option value="alipay">支付宝</option>
                <option value="cash">现金</option>
                <option value="bank">银行转账</option>
              </select>
            </div>
            <div className="form-group">
              <label>缴费人</label>
              <input 
                type="text"
                value={payForm.paidBy}
                onChange={e => setPayForm({ ...payForm, paidBy: e.target.value })}
                placeholder="请输入缴费人姓名"
              />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowPayModal(false)}>取消</button>
              <button className="btn-primary" onClick={handlePay}>确认缴费</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
