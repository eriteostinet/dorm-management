import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, NavBar, Button, Toast, Tabs, Badge, ProgressBar, SpinLoading, Grid } from 'antd-mobile';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  RefreshCw, Upload, Download, Wifi, WifiOff, 
  Users, Building2, BedDouble, Wrench, Clock
} from 'lucide-react';
import { db, syncAllToCloud, initCloudBase } from '../../db/db';
import './Analytics.css';

interface AnalyticsProps {
  onBack: () => void;
}

// 同步状态类型
interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  pendingChanges: number;
}

// 统计数据类型
interface StatsData {
  totalEmployees: number;
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  maintenanceRooms: number;
  occupancyRate: number;
  totalTickets: number;
  pendingTickets: number;
  communityData: any[];
  layoutData: any[];
  deptData: any[];
  trendData: any[];
  repairData: any[];
}

const COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'];

export default function Analytics({ onBack }: AnalyticsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: false,
    isSyncing: false,
    lastSync: null,
    pendingChanges: 0
  });
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const [rooms, employees, _dorms, communities, tickets] = await Promise.all([
        db.rooms.toArray(),
        db.employees.toArray(),
        db.dorms.toArray(),
        db.communities.toArray(),
        db.repairTickets.toArray(),
      ]);

      const totalRooms = rooms.length;
      const totalEmployees = employees.length;
      const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
      const vacantRooms = rooms.filter(r => r.status === 'vacant').length;
      const maintenanceRooms = rooms.filter(r => r.status === 'maintenance').length;
      const occupancyRate = totalRooms > 0 ? parseFloat(((occupiedRooms / totalRooms) * 100).toFixed(1)) : 0;

      // 小区分布
      const communityData = communities
        .filter(c => c.status === 'active')
        .map(c => {
          const communityRooms = rooms.filter(r => r.communityId === c._id);
          const occupied = communityRooms.filter(r => r.status === 'occupied').length;
          return {
            name: c.name,
            已入住: occupied,
            空置: communityRooms.length - occupied,
            total: communityRooms.length,
          };
        });

      // 户型分析
      const layoutMap = new Map();
      rooms.forEach(room => {
        const layout = room.layout === 0 ? '家庭房' : `${room.layout ?? 3}人间`;
        if (!layoutMap.has(layout)) {
          layoutMap.set(layout, { name: layout, 已入住: 0, 空置: 0 });
        }
        if (room.status === 'occupied') {
          layoutMap.get(layout).已入住 += 1;
        } else if (room.status === 'vacant') {
          layoutMap.get(layout).空置 += 1;
        }
      });
      const layoutData = Array.from(layoutMap.values());

      // 部门分布
      const deptStats = employees.reduce((acc, emp) => {
        const dept = emp.department || '未知部门';
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const deptData = Object.entries(deptStats)
        .map(([name, value]) => ({ name, value }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 8);

      // 趋势数据（按入住日期）
      const monthMap = new Map();
      employees.forEach(emp => {
        if (emp.entryDate) {
          const date = new Date(emp.entryDate);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthMap.set(key, (monthMap.get(key) || 0) + 1);
        }
      });
      const trendData = Array.from(monthMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);

      // 维修统计
      const repairStats = {
        pending: tickets.filter(t => t.status === 'reported' || t.status === 'assigned').length,
        processing: tickets.filter(t => t.status === 'processing').length,
        completed: tickets.filter(t => t.status === 'done' || t.status === 'confirmed').length,
      };

      setStats({
        totalEmployees,
        totalRooms,
        occupiedRooms,
        vacantRooms,
        maintenanceRooms,
        occupancyRate,
        totalTickets: tickets.length,
        pendingTickets: repairStats.pending,
        communityData,
        layoutData,
        deptData,
        trendData,
        repairData: [
          { name: '待处理', value: repairStats.pending, fill: '#fac858' },
          { name: '处理中', value: repairStats.processing, fill: '#73c0de' },
          { name: '已完成', value: repairStats.completed, fill: '#91cc75' },
        ],
      });
    } catch (err) {
      console.error('加载统计数据失败:', err);
      Toast.show({ icon: 'fail', content: '加载数据失败' });
    }
  }, []);

  // 检查同步状态
  const checkSyncStatus = useCallback(async () => {
    const online = navigator.onLine;
    setSyncState(prev => ({ ...prev, isOnline: online }));
    
    if (online) {
      initCloudBase();
    }
  }, []);

  // 手动同步到云端
  const handleSync = async () => {
    setSyncState(prev => ({ ...prev, isSyncing: true }));
    try {
      await syncAllToCloud();
      setSyncState(prev => ({ 
        ...prev, 
        isSyncing: false, 
        lastSync: new Date(),
        pendingChanges: 0 
      }));
      Toast.show({ icon: 'success', content: '同步成功' });
    } catch (err) {
      setSyncState(prev => ({ ...prev, isSyncing: false }));
      Toast.show({ icon: 'fail', content: '同步失败' });
    }
  };

  // 导入 JSON 数据（支持批量导入）
  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      let total = 0;
      let current = 0;
      
      // 计算总数
      if (data.communities) total += data.communities.length;
      if (data.dorms) total += data.dorms.length;
      if (data.rooms) total += data.rooms.length;
      if (data.employees) total += data.employees.length;
      if (data.repairTickets) total += data.repairTickets.length;

      // 批量导入
      if (data.communities?.length) {
        await db.communities.clear();
        for (const item of data.communities) {
          await db.communities.add({ ...item, _synced: false });
          current++;
          setImportProgress(Math.round((current / total) * 100));
        }
      }
      
      if (data.dorms?.length) {
        await db.dorms.clear();
        for (const item of data.dorms) {
          await db.dorms.add({ ...item, _synced: false });
          current++;
          setImportProgress(Math.round((current / total) * 100));
        }
      }
      
      if (data.rooms?.length) {
        await db.rooms.clear();
        for (const item of data.rooms) {
          await db.rooms.add({ ...item, _synced: false });
          current++;
          setImportProgress(Math.round((current / total) * 100));
        }
      }
      
      if (data.employees?.length) {
        await db.employees.clear();
        for (const item of data.employees) {
          await db.employees.add({ ...item, _synced: false });
          current++;
          setImportProgress(Math.round((current / total) * 100));
        }
      }

      // 刷新统计数据
      await loadStats();
      
      // 触发全局数据更新事件
      window.dispatchEvent(new CustomEvent('dorm-data-updated', { 
        detail: { type: 'import', count: total } 
      }));
      
      // 自动同步到云端
      setSyncState(prev => ({ ...prev, pendingChanges: total }));
      
      Toast.show({ icon: 'success', content: `导入成功！共 ${total} 条数据` });
      
      // 延迟自动同步
      setTimeout(() => {
        if (syncState.isOnline) {
          handleSync();
        }
      }, 1000);
      
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: '导入失败: ' + err.message });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 导出数据
  const handleExport = async () => {
    try {
      const [communities, dorms, rooms, employees, tickets] = await Promise.all([
        db.communities.toArray(),
        db.dorms.toArray(),
        db.rooms.toArray(),
        db.employees.toArray(),
        db.repairTickets.toArray(),
      ]);

      const data = {
        communities,
        dorms,
        rooms,
        employees,
        repairTickets: tickets,
        exportTime: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dorm-analytics-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      Toast.show({ icon: 'success', content: '导出成功' });
    } catch (err) {
      Toast.show({ icon: 'fail', content: '导出失败' });
    }
  };

  // 监听数据更新事件
  useEffect(() => {
    loadStats();
    checkSyncStatus();

    const handleDataUpdate = () => {
      loadStats();
      setSyncState(prev => ({ ...prev, pendingChanges: prev.pendingChanges + 1 }));
    };

    window.addEventListener('dorm-data-updated', handleDataUpdate);
    window.addEventListener('online', checkSyncStatus);
    window.addEventListener('offline', checkSyncStatus);

    // 定期自动刷新（每30秒）
    syncIntervalRef.current = setInterval(() => {
      loadStats();
      checkSyncStatus();
    }, 30000);

    return () => {
      window.removeEventListener('dorm-data-updated', handleDataUpdate);
      window.removeEventListener('online', checkSyncStatus);
      window.removeEventListener('offline', checkSyncStatus);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [loadStats, checkSyncStatus]);

  if (!stats) {
    return (
      <div className="page-container analytics-page">
        <NavBar onBack={onBack}>数据分析中心</NavBar>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <SpinLoading />
          <p style={{ marginTop: 16, color: '#999' }}>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container analytics-page">
      <NavBar onBack={onBack}>数据分析中心</NavBar>

      {/* 同步状态栏 */}
      <div className="sync-status-bar">
        <div className="sync-left">
          {syncState.isOnline ? (
            <Badge content="在线" color="green">
              <Wifi size={18} color="#52c41a" />
            </Badge>
          ) : (
            <Badge content="离线" color="gray">
              <WifiOff size={18} color="#999" />
            </Badge>
          )}
          <span className="sync-text">
            {syncState.lastSync 
              ? `上次同步: ${new Date(syncState.lastSync).toLocaleTimeString()}`
              : '尚未同步'}
          </span>
        </div>
        <div className="sync-right">
          {syncState.pendingChanges > 0 && (
            <Badge content={syncState.pendingChanges} color="orange">
              <span style={{ marginRight: 8 }}>待同步</span>
            </Badge>
          )}
          <Button
            size="small"
            color="primary"
            loading={syncState.isSyncing}
            disabled={!syncState.isOnline}
            onClick={handleSync}
          >
            <RefreshCw size={14} style={{ marginRight: 4 }} />
            同步
          </Button>
        </div>
      </div>

      {/* 导入进度条 */}
      {isImporting && (
        <div className="import-progress">
          <div className="progress-header">
            <span>正在导入数据...</span>
            <span>{importProgress}%</span>
          </div>
          <ProgressBar percent={importProgress} />
        </div>
      )}

      {/* 快捷操作 */}
      <div className="quick-actions">
        <Grid columns={2} gap={12}>
          <Grid.Item>
            <Card className="action-card" onClick={() => fileInputRef.current?.click()}>
              <Upload size={24} color="#1677ff" />
              <div className="action-text">导入数据</div>
              <div className="action-desc">JSON格式</div>
            </Card>
          </Grid.Item>
          <Grid.Item>
            <Card className="action-card" onClick={handleExport}>
              <Download size={24} color="#52c41a" />
              <div className="action-text">导出数据</div>
              <div className="action-desc">备份文件</div>
            </Card>
          </Grid.Item>
        </Grid>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportJSON}
        />
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} className="analytics-tabs">
        <Tabs.Tab title="总览" key="overview">
          {/* 核心指标 */}
          <div className="stats-grid">
            <Card className="stat-card primary">
              <div className="stat-icon-wrapper">
                <Users size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalEmployees}</div>
                <div className="stat-label">住宿员工</div>
              </div>
            </Card>
            <Card className="stat-card success">
              <div className="stat-icon-wrapper">
                <BedDouble size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.occupiedRooms}</div>
                <div className="stat-label">已入住房间</div>
              </div>
            </Card>
            <Card className="stat-card warning">
              <div className="stat-icon-wrapper">
                <Building2 size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalRooms}</div>
                <div className="stat-label">总房间数</div>
              </div>
            </Card>
            <Card className="stat-card danger">
              <div className="stat-icon-wrapper">
                <Wrench size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.pendingTickets}</div>
                <div className="stat-label">待处理工单</div>
              </div>
            </Card>
          </div>

          {/* 入住率仪表盘 */}
          <Card title="入住率" className="gauge-card">
            <div className="gauge-wrapper">
              <div 
                className="gauge-circle"
                style={{
                  background: `conic-gradient(
                    #1677ff 0deg ${stats.occupancyRate * 3.6}deg, 
                    #f0f0f0 ${stats.occupancyRate * 3.6}deg 360deg
                  )`
                }}
              >
                <div className="gauge-inner">
                  <div className="gauge-value">{stats.occupancyRate}%</div>
                  <div className="gauge-label">{stats.occupiedRooms}/{stats.totalRooms}</div>
                </div>
              </div>
            </div>
            <div className="gauge-legend">
              <div className="legend-item">
                <span className="dot" style={{ background: '#52c41a' }}></span>
                <span>已入住: {stats.occupiedRooms}</span>
              </div>
              <div className="legend-item">
                <span className="dot" style={{ background: '#faad14' }}></span>
                <span>空置: {stats.vacantRooms}</span>
              </div>
              <div className="legend-item">
                <span className="dot" style={{ background: '#ff4d4f' }}></span>
                <span>维修中: {stats.maintenanceRooms}</span>
              </div>
            </div>
          </Card>

          {/* 小区分布 */}
          <Card title="小区分布" className="chart-card">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.communityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="已入住" stackId="a" fill="#5470c6" />
                  <Bar dataKey="空置" stackId="a" fill="#91cc75" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Tabs.Tab>

        <Tabs.Tab title="趋势分析" key="trends">
          {/* 入住趋势 */}
          <Card title="入住趋势（近12个月）" className="chart-card">
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    name="新增入住"
                    stroke="#1677ff" 
                    fill="#1677ff" 
                    fillOpacity={0.3} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 户型分析 */}
          <Card title="户型分布" className="chart-card">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.layoutData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={60} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="已入住" stackId="a" fill="#5470c6" />
                  <Bar dataKey="空置" stackId="a" fill="#91cc75" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 部门分布 */}
          <Card title="部门分布 Top 8" className="chart-card">
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.deptData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => 
                      `${name} ${((percent || 0) * 100).toFixed(0)}%`
                    }
                  >
                    {stats.deptData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Tabs.Tab>

        <Tabs.Tab title="维修统计" key="repairs">
          {/* 维修工单状态 */}
          <Card title="工单状态分布" className="chart-card">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.repairData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {stats.repairData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 维修统计卡片 */}
          <div className="repair-stats-grid">
            {stats.repairData.map((item, idx) => (
              <Card key={idx} className="repair-stat-card">
                <div className="repair-stat-value" style={{ color: item.fill }}>
                  {item.value}
                </div>
                <div className="repair-stat-label">{item.name}</div>
              </Card>
            ))}
          </div>
        </Tabs.Tab>
      </Tabs>

      {/* 底部提示 */}
      <div className="analytics-footer">
        <Clock size={14} />
        <span>数据实时同步，最后更新: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
