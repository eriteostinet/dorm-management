import { useState, useEffect } from 'react';
import { Card, NavBar, Button, Toast, Tabs, SpinLoading } from 'antd-mobile';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { RefreshCw, Users, Building2, BedDouble, Wrench } from 'lucide-react';
import { getAllCommunities, getAllDorms, getAllRooms, getAllEmployees, getAllRepairTickets, getPayments } from '../../services/dataService';
import './Analytics.css';

interface AnalyticsProps {
  onBack: () => void;
}

const COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272'];

export default function Analytics({ onBack }: AnalyticsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [rooms, employees, dorms, communities, tickets, payments] = await Promise.all([
        getAllRooms(),
        getAllEmployees(),
        getAllDorms(),
        getAllCommunities(),
        getAllRepairTickets(),
        getPayments(),
      ]);

      const totalRooms = rooms.length;
      const totalEmployees = employees.length;
      const occupiedRooms = rooms.filter((r: any) => r.status === 'OCCUPIED').length;
      const vacantRooms = rooms.filter((r: any) => r.status === 'VACANT').length;
      const maintenanceRooms = rooms.filter((r: any) => r.status === 'MAINTENANCE').length;
      const occupancyRate = totalRooms > 0 ? parseFloat(((occupiedRooms / totalRooms) * 100).toFixed(1)) : 0;

      const communityData = communities
        .filter((c: any) => c.status === 'ACTIVE')
        .map((c: any) => {
          const communityRooms = rooms.filter((r: any) => r.communityId === c.id);
          const occupied = communityRooms.filter((r: any) => r.status === 'OCCUPIED').length;
          return { name: c.name, occupied, vacant: communityRooms.length - occupied };
        });

      const layoutData = rooms.reduce((acc: any, room: any) => {
        const key = room.bedCount === 1 ? '单人间' : room.bedCount === 2 ? '双人间' : `${room.bedCount}人间`;
        if (!acc[key]) acc[key] = { name: key, total: 0, occupied: 0 };
        acc[key].total++;
        if (room.status === 'OCCUPIED') acc[key].occupied++;
        return acc;
      }, {});

      const deptData = employees.reduce((acc: any, emp: any) => {
        const dept = emp.department || '未分配';
        if (!acc[dept]) acc[dept] = 0;
        acc[dept]++;
        return acc;
      }, {});

      const ticketStats = {
        total: tickets.length,
        pending: tickets.filter((t: any) => t.status === 'PENDING').length,
        processing: tickets.filter((t: any) => t.status === 'PROCESSING').length,
        done: tickets.filter((t: any) => t.status === 'DONE' || t.status === 'CONFIRMED').length,
      };

      const paymentStats = payments.reduce((acc: any, p: any) => {
        const type = p.type === 'RENT' ? '房租' : p.type === 'WATER' ? '水费' : p.type === 'ELECTRICITY' ? '电费' : '其他';
        if (!acc[type]) acc[type] = { name: type, total: 0, paid: 0 };
        acc[type].total += p.amount || 0;
        if (p.status === 'PAID') acc[type].paid += p.amount || 0;
        return acc;
      }, {});

      setStats({
        totalRooms, totalEmployees, occupiedRooms, vacantRooms, maintenanceRooms, occupancyRate,
        communityData: Object.values(communityData),
        layoutData: Object.values(layoutData),
        deptData: Object.entries(deptData).map(([name, value]: [string, any]) => ({ name, value })),
        ticketStats,
        paymentStats: Object.values(paymentStats),
      });
    } catch (err) {
      console.error('加载统计失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="page-container">
        <NavBar onBack={onBack}>数据分析</NavBar>
        <div style={{ textAlign: 'center', padding: 60 }}><SpinLoading /></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <NavBar onBack={onBack} right={
        <Button size="small" onClick={loadStats}><RefreshCw size={14} /></Button>
      }>数据分析</NavBar>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.Tab title="总览" key="overview" />
        <Tabs.Tab title="分布" key="distribution" />
        <Tabs.Tab title="趋势" key="tickets" />
      </Tabs>

      {activeTab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12 }}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{stats.totalEmployees}</div>
                <div style={{ fontSize: 12, color: '#999' }}><Users size={14} /> 住宿员工</div>
              </div>
            </Card>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{stats.totalRooms}</div>
                <div style={{ fontSize: 12, color: '#999' }}><Building2 size={14} /> 总房间数</div>
              </div>
            </Card>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>{stats.occupancyRate}%</div>
                <div style={{ fontSize: 12, color: '#999' }}><BedDouble size={14} /> 入住率</div>
              </div>
            </Card>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{stats.ticketStats.pending}</div>
                <div style={{ fontSize: 12, color: '#999' }}><Wrench size={14} /> 待处理工单</div>
              </div>
            </Card>
          </div>
        </>
      )}

      {activeTab === 'distribution' && (
        <>
          <Card title="小区入住分布">
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.communityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="occupied" name="已入住" fill="#5470c6" />
                  <Bar dataKey="vacant" name="空置" fill="#91cc75" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="部门分布">
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.deptData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                    {stats.deptData.map((_entry: any, index: number) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      {activeTab === 'tickets' && (
        <>
          <Card title="工单状态">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[
                    { name: '待处理', value: stats.ticketStats.pending },
                    { name: '处理中', value: stats.ticketStats.processing },
                    { name: '已完成', value: stats.ticketStats.done },
                  ]} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                    <Cell fill="#faad14" />
                    <Cell fill="#1890ff" />
                    <Cell fill="#52c41a" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
