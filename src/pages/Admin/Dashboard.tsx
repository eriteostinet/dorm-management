import { useState, useEffect } from 'react';
import { Card, NavBar, Grid, Tabs, Collapse, Tag, Badge, Modal, Selector, Toast } from 'antd-mobile';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { db } from '../../db/db';
import { Users, Building2, BedDouble, Wallet, TrendingUp, Database, Grid3X3, BarChart3, FileSpreadsheet, MapPin, Home, Edit3, CreditCard } from 'lucide-react';
import './Dashboard.css';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

const COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272'];

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<any>(null);
  const [hierarchyData, setHierarchyData] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // 房间编辑状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [editingDorm, setEditingDorm] = useState<any>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  
  // 床位调整状态
  const [bedModalVisible, setBedModalVisible] = useState(false);
  const [adjustingRoom, setAdjustingRoom] = useState<any>(null);
  const [adjustingDorm, setAdjustingDorm] = useState<any>(null);
  const [adjustingOccupants, setAdjustingOccupants] = useState<any[]>([]);
  // 每个人选择的床号 { employeeId: bedNumber }
  const [selectedBeds, setSelectedBeds] = useState<Record<string, number>>({});

  useEffect(() => {
    loadStats();
    loadHierarchyData();
    loadEmployees();
    
    // 监听数据更新事件
    const handleDataUpdate = () => {
      loadStats();
      loadHierarchyData();
    };
    window.addEventListener('dorm-data-updated', handleDataUpdate);
    
    return () => {
      window.removeEventListener('dorm-data-updated', handleDataUpdate);
    };
  }, []);
  
  // 加载所有员工
  const loadEmployees = async () => {
    const empData = await db.employees.toArray();
    setEmployees(empData);
  };

  const loadStats = async () => {
    const [rooms, employees, dorms, communities, tickets] = await Promise.all([
      db.rooms.toArray(),
      db.employees.toArray(),
      db.dorms.toArray(),
      db.communities.toArray(),
      db.repairTickets.toArray(),
    ]);

    // 基础统计
    const totalRooms = rooms.length;
    const totalEmployees = employees.length;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const vacantRooms = rooms.filter(r => r.status === 'vacant').length;
    const maintenanceRooms = rooms.filter(r => r.status === 'maintenance').length;
    const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : '0';

    // 床位分析 - 按户型统计
    const layoutStats = rooms.reduce((acc, room) => {
      const layout = room.layout === 0 ? '家庭房' : `${room.layout ?? 3}人间`;
      if (!acc[layout]) acc[layout] = { name: layout, total: 0, occupied: 0, vacant: 0 };
      acc[layout].total += 1;
      if (room.status === 'occupied') {
        acc[layout].occupied += 1;
      } else if (room.status === 'vacant') {
        acc[layout].vacant += 1;
      }
      return acc;
    }, {} as Record<string, any>);

    // 小区分布
    const communityData = communities.filter(c => c.status === 'active').map(c => {
      const communityRooms = rooms.filter(r => r.communityId === c._id);
      const occupied = communityRooms.filter(r => r.status === 'occupied').length;
      return {
        name: c.name,
        value: occupied,
        total: communityRooms.length,
        vacant: communityRooms.length - occupied,
      };
    });

    // 部门分布
    const deptStats = employees.reduce((acc, emp) => {
      const dept = emp.department || '未知部门';
      if (!acc[dept]) acc[dept] = 0;
      acc[dept]++;
      return acc;
    }, {} as Record<string, number>);
    
    const deptData = Object.entries(deptStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 8);

    // 入住年份分析
    const yearStats = employees.reduce((acc, emp) => {
      let year = '未知';
      if (emp.entryDate) {
        const dateStr = typeof emp.entryDate === 'string' ? emp.entryDate : new Date(emp.entryDate).toISOString();
        year = dateStr.slice(0, 4);
      }
      if (!acc[year]) acc[year] = 0;
      acc[year]++;
      return acc;
    }, {} as Record<string, number>);
    
    const yearData = Object.entries(yearStats)
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year));

    // 维修统计
    const repairStats = {
      total: tickets.length,
      pending: tickets.filter(t => t.status === 'reported' || t.status === 'assigned').length,
      processing: tickets.filter(t => t.status === 'processing').length,
      completed: tickets.filter(t => t.status === 'done' || t.status === 'confirmed').length,
    };

    // 费用估算 (模拟数据)
    const monthlyFee = occupiedRooms * 500; // 假设每间500元/月
    const annualFee = monthlyFee * 12;

    // 楼层热力图
    const floorMap = new Map();
    dorms.forEach(dorm => {
      const key = `${dorm.communityId || '未知'}-${dorm.building || '未知'}-${dorm.floor || 1}层`;
      const dormRooms = rooms.filter(r => r.dormId === dorm._id);
      const occupied = dormRooms.filter(r => r.status === 'occupied').length;
      if (!floorMap.has(key)) {
        floorMap.set(key, { name: key, occupied, total: 0 });
      }
      floorMap.get(key).total += dormRooms.length;
    });
    const floorData = Array.from(floorMap.values())
      .sort((a: any, b: any) => b.occupied - a.occupied)
      .slice(0, 10);

    setStats({
      totalRooms,
      totalEmployees,
      occupiedRooms,
      vacantRooms,
      maintenanceRooms,
      occupancyRate,
      layoutData: Object.values(layoutStats),
      communityData,
      deptData,
      yearData,
      repairStats,
      monthlyFee,
      annualFee,
      floorData,
    });
  };

  // 加载层级数据：小区 -> 楼栋 -> 房间 -> 居住人
  const loadHierarchyData = async () => {
    const [rooms, employees, dorms, communities] = await Promise.all([
      db.rooms.toArray(),
      db.employees.toArray(),
      db.dorms.toArray(),
      db.communities.toArray(),
    ]);

    // 构建层级结构
    const hierarchy = communities
      .filter((c) => c.status === 'active')
      .map((community) => {
        // 获取该小区下的所有楼栋
        const communityDorms = dorms.filter(
          (d) => d.communityId === community._id
        );

        const dormsWithRooms = communityDorms.map((dorm) => {
          // 获取该楼栋下的所有房间
          const dormRooms = rooms
            .filter((r) => r.dormId === dorm._id)
            .sort((a, b) => a.roomNo.localeCompare(b.roomNo));

          const roomsWithOccupants = dormRooms.map((room) => {
            // 获取该房间的居住人
            const occupants = employees.filter(
              (e) => e.currentRoomId === room._id
            );

            return {
              ...room,
              occupants,
            };
          });

          return {
            ...dorm,
            rooms: roomsWithOccupants,
            totalRooms: dormRooms.length,
            occupiedRooms: dormRooms.filter((r) => r.status === 'occupied')
              .length,
          };
        });

        return {
          ...community,
          dorms: dormsWithRooms,
          totalDorms: communityDorms.length,
          totalRooms: rooms.filter((r) => r.communityId === community._id)
            .length,
          occupiedRooms: rooms.filter(
            (r) => r.communityId === community._id && r.status === 'occupied'
          ).length,
        };
      });

    setHierarchyData(hierarchy);
  };

  if (!stats) return null;

  const renderOverview = () => (
    <>
      {/* 核心指标卡 */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon"><Users size={24} /></div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalEmployees}</div>
            <div className="stat-label">住宿员工</div>
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon"><Building2 size={24} /></div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalRooms}</div>
            <div className="stat-label">总房间数</div>
          </div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon"><BedDouble size={24} /></div>
          <div className="stat-info">
            <div className="stat-value">{stats.occupancyRate}%</div>
            <div className="stat-label">入住率</div>
          </div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon"><Wallet size={24} /></div>
          <div className="stat-info">
            <div className="stat-value">¥{(stats.monthlyFee / 10000).toFixed(1)}万</div>
            <div className="stat-label">月费用估算</div>
          </div>
        </div>
      </div>

      {/* 房间状态分布 */}
      <Card title="房间状态分布">
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: '已入住', value: stats.occupiedRooms },
                  { name: '空置', value: stats.vacantRooms },
                  { name: '维修中', value: stats.maintenanceRooms },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
              >
                {[{ fill: '#52c41a' }, { fill: '#faad14' }, { fill: '#ff4d4f' }].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 小区入住分布 */}
      <Card title="小区入住分布">
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.communityData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="已入住" fill="#5470c6" />
              <Bar dataKey="vacant" name="空置" fill="#91cc75" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );

  const renderAnalysis = () => (
    <>
      {/* 床位分析 */}
      <Card title="户型床位分析">
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.layoutData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="occupied" name="已入住" stackId="a" fill="#5470c6" />
              <Bar dataKey="vacant" name="空置" stackId="a" fill="#91cc75" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 部门分布 */}
      <Card title="员工部门分布 (Top 8)">
        <div style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.deptData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              >
                {stats.deptData.map((_entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 楼层入住排行 */}
      <Card title="楼层入住排行 (Top 10)">
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.floorData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip />
              <Bar dataKey="occupied" name="入住人数" fill="#5470c6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );

  const renderHistory = () => (
    <>
      {/* 入住年份趋势 */}
      <Card title="员工入住年份分布">
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.yearData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="count" name="人数" stroke="#5470c6" fill="#5470c6" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 维修工单统计 */}
      <Card title="维修工单统计">
        <div className="repair-stats">
          <div className="repair-item">
            <span className="repair-label">总工单</span>
            <span className="repair-value">{stats.repairStats.total}</span>
          </div>
          <div className="repair-item">
            <span className="repair-label">待处理</span>
            <span className="repair-value warning">{stats.repairStats.pending}</span>
          </div>
          <div className="repair-item">
            <span className="repair-label">处理中</span>
            <span className="repair-value info">{stats.repairStats.processing}</span>
          </div>
          <div className="repair-item">
            <span className="repair-label">已完成</span>
            <span className="repair-value success">{stats.repairStats.completed}</span>
          </div>
        </div>
        <div style={{ height: 180, marginTop: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: '待处理', value: stats.repairStats.pending },
                  { name: '处理中', value: stats.repairStats.processing },
                  { name: '已完成', value: stats.repairStats.completed },
                ]}
                cx="50%"
                cy="50%"
                outerRadius={60}
                dataKey="value"
              >
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

      {/* 费用估算 */}
      <Card title="费用估算">
        <div className="fee-stats">
          <div className="fee-item">
            <div className="fee-label">月度费用估算</div>
            <div className="fee-value">¥{stats.monthlyFee.toLocaleString()}</div>
            <div className="fee-desc">按 {stats.occupiedRooms} 间 × ¥500/月</div>
          </div>
          <div className="fee-item">
            <div className="fee-label">年度费用估算</div>
            <div className="fee-value">¥{(stats.annualFee / 10000).toFixed(2)}万</div>
            <div className="fee-desc">按 {stats.occupiedRooms} 间 × ¥6000/年</div>
          </div>
        </div>
      </Card>
    </>
  );

  // 层级视图：小区 -> 楼栋 -> 房间 -> 居住人
  const renderHierarchy = () => (
    <>
      {hierarchyData.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <Building2 size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
            <p>暂无宿舍数据</p>
          </div>
        </Card>
      ) : (
        hierarchyData.map((community) => (
          <Card
            key={community._id}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={18} color="#1890ff" />
                <span>{community.name}</span>
                <Tag color="primary" fill="outline">
                  {community.totalDorms}栋楼
                </Tag>
                <Tag color="success" fill="outline">
                  {community.occupiedRooms}/{community.totalRooms}间
                </Tag>
              </div>
            }
            style={{ marginBottom: 12 }}
          >
            <Collapse accordion>
              {community.dorms.map((dorm: any) => (
                <Collapse.Panel
                  key={dorm._id}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building2 size={16} color="#52c41a" />
                      <span>{dorm.building}</span>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        ({dorm.occupiedRooms}/{dorm.totalRooms}间)
                      </span>
                    </div>
                  }
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: 8,
                      padding: '8px 0',
                    }}
                  >
                    {dorm.rooms.map((room: any) => {
                      // 使用房间级别的房型
                      const roomLayout = room.layout ?? 3;
                      const isFamily = roomLayout === 0;
                      const capacity = isFamily ? 1 : roomLayout;
                      const isFull = room.occupants.length >= capacity;
                      
                      return (
                      <div
                        key={room._id}
                        style={{
                          border: '1px solid #e8e8e8',
                          borderRadius: 8,
                          padding: 12,
                          backgroundColor: isFamily ? '#f6ffed' : (isFull ? '#fff1f0' : '#e6f7ff'),
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        {/* 编辑按钮 - 分配人员 */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            padding: 4,
                            borderRadius: 4,
                            backgroundColor: 'rgba(0,0,0,0.05)',
                          }}
                          onClick={() => {
                            setEditingRoom(room);
                            setEditingDorm(dorm);
                            setSelectedEmployees(room.occupants.map((o: any) => o._id));
                            setEditModalVisible(true);
                          }}
                        >
                          <Edit3 size={12} color="#666" />
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginBottom: 8,
                            fontWeight: 'bold',
                            color: '#333',
                          }}
                        >
                          <Home size={14} />
                          {room.roomNo}
                          <span style={{ fontSize: 11, color: '#999', fontWeight: 'normal' }}>
                            ({room.occupants.length}/{capacity}人)
                          </span>
                          {room.status === 'occupied' && (
                            <Badge color="#52c41a" />
                          )}
                          {room.status === 'vacant' && (
                            <Badge color="#faad14" />
                          )}
                          {room.status === 'maintenance' && (
                            <Badge color="#ff4d4f" />
                          )}
                          {/* 房型切换下拉框 - 只修改当前房间 */}
                          <select
                            value={roomLayout}
                            onChange={async (e) => {
                              e.stopPropagation();
                              const newLayout = parseInt(e.target.value) as 0 | 1 | 3;
                              try {
                                await db.rooms.update(room._id, { layout: newLayout });
                                Toast.show({ content: '房型切换成功', icon: 'success' });
                                loadHierarchyData();
                                window.dispatchEvent(new CustomEvent('dorm-data-updated'));
                              } catch (err) {
                                console.error('切换房型失败:', err);
                                Toast.show({ content: '切换失败', icon: 'fail' });
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              marginLeft: 'auto',
                              padding: '2px 4px',
                              fontSize: 10,
                              border: '1px solid #d9d9d9',
                              borderRadius: 4,
                              backgroundColor: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            <option value={0}>家庭</option>
                            <option value={1}>1人</option>
                            <option value={3}>3人</option>
                          </select>
                        </div>
                        {room.occupants.length > 0 ? (
                          <div style={{ fontSize: 12, color: '#666' }}>
                            {room.occupants.map((emp: any) => (
                              <div
                                key={emp._id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  marginBottom: 4,
                                }}
                              >
                                <span style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  backgroundColor: '#1890ff',
                                  color: '#fff',
                                  fontSize: 10,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  cursor: 'pointer',
                                }} onClick={(e) => {
                                  e.stopPropagation();
                                  setAdjustingRoom(room);
                                  setAdjustingDorm(dorm);
                                  setAdjustingOccupants([...room.occupants]);
                                  // 初始化床号（默认按当前顺序 1,2,3...）
                                  const initialBeds: Record<string, number> = {};
                                  room.occupants.forEach((emp: any, idx: number) => {
                                    initialBeds[emp._id] = emp.bedNo || (idx + 1);
                                  });
                                  setSelectedBeds(initialBeds);
                                  setBedModalVisible(true);
                                }}
                                >
                                  {emp.bedNo || '-'}
                                </span>
                                <span>{emp.name}</span>
                                {emp.department && (
                                  <Tag color="default" style={{ fontSize: 10, padding: '0 4px' }}>
                                    {emp.department}
                                  </Tag>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: '#999' }}>
                            {room.status === 'vacant' ? '点击分配人员' : '无人入住'}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </Collapse.Panel>
              ))}
            </Collapse>
          </Card>
        ))
      )}

      {/* 房间编辑弹窗 */}
      <Modal
        visible={editModalVisible}
        title={editingRoom ? `编辑房间 ${editingRoom.roomNo}` : '编辑房间'}
        content={
          editingRoom && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                  房型: {editingDorm?.layout}人间 | 当前: {selectedEmployees.length}人
                </div>
                <div
                  style={{
                    padding: 8,
                    backgroundColor: '#f5f5f5',
                    borderRadius: 4,
                    fontSize: 12,
                    color: '#999',
                  }}
                >
                  点击选择要分配到此房间的员工（可多选）
                </div>
              </div>
              
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <Selector
                  options={employees
                    .filter((e) => e.status === 'active')
                    .map((e) => ({
                      label: `${e.name} (${e.department || '无部门'})`,
                      value: e._id,
                      description: e.currentRoomId
                        ? `当前在 ${
                            hierarchyData
                              .flatMap((c) => c.dorms)
                              .flatMap((d: any) => d.rooms)
                              .find((r: any) => r._id === e.currentRoomId)?.roomNo || '其他房间'
                          }`
                        : '未分配',
                    }))}
                  value={selectedEmployees}
                  onChange={(val) => {
                    // 限制人数不超过房型容量
                    const roomCapacity = editingRoom?.layout === 0 ? 1 : (editingRoom?.layout ?? 3);
                    if (val.length <= roomCapacity) {
                      setSelectedEmployees(val);
                    } else {
                      Toast.show({
                        content: `该房型最多${roomCapacity}人`,
                        icon: 'fail',
                      });
                    }
                  }}
                  multiple
                />
              </div>
            </div>
          )
        }
        closeOnAction
        onClose={() => setEditModalVisible(false)}
        actions={[
          {
            key: 'cancel',
            text: '取消',
          },
          {
            key: 'save',
            text: '保存',
            primary: true,
            onClick: async () => {
              if (!editingRoom) return;
              
              try {
                // 更新房间状态
                const newStatus =
                  selectedEmployees.length > 0 ? 'occupied' : 'vacant';
                await db.rooms.update(editingRoom._id, {
                  status: newStatus,
                  occupantId:
                    selectedEmployees.length > 0
                      ? selectedEmployees[0]
                      : null,
                  occupantName:
                    selectedEmployees.length > 0
                      ? employees.find((e) => e._id === selectedEmployees[0])?.name || null
                      : null,
                });

                // 更新员工信息
                for (const emp of employees) {
                  if (selectedEmployees.includes(emp._id)) {
                    // 分配到这个房间
                    await db.employees.update(emp._id, {
                      currentRoomId: editingRoom._id,
                      currentDormId: editingDorm?._id,
                      currentCommunityId: editingDorm?.communityId,
                    });
                  } else if (emp.currentRoomId === editingRoom._id) {
                    // 原来在这个房间，现在不在了
                    await db.employees.update(emp._id, {
                      currentRoomId: null,
                      currentDormId: null,
                      currentCommunityId: null,
                    });
                  }
                }

                Toast.show({ content: '保存成功', icon: 'success' });
                loadHierarchyData();
                window.dispatchEvent(new CustomEvent('dorm-data-updated'));
              } catch (err) {
                console.error('保存失败:', err);
                Toast.show({ content: '保存失败', icon: 'fail' });
              }
            },
          },
        ]}
      />

      {/* 床位调整弹窗 */}
      <Modal
        visible={bedModalVisible}
        title={adjustingRoom ? `调整床位 - ${adjustingRoom.roomNo}` : '调整床位'}
        content={
          adjustingRoom && adjustingDorm && (
            <div>
              <div style={{ marginBottom: 16, fontSize: 14, color: '#666' }}>
                房型: {adjustingRoom.layout === 0 ? '家庭房' : `${adjustingRoom.layout ?? 3}人间`} | 当前入住: {adjustingOccupants.length}人
              </div>
              <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>
                为每个人选择床位号（可以留空床位）
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {adjustingOccupants.map((emp: any) => {
                  const currentBed = selectedBeds[emp._id] || 1;
                  // 检查该床位是否被其他人选了
                  const isConflict = Object.entries(selectedBeds).some(
                    ([id, bed]) => id !== emp._id && bed === currentBed
                  );
                  
                  return (
                    <div
                      key={emp._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        backgroundColor: isConflict ? '#fff1f0' : '#f5f5f5',
                        borderRadius: 8,
                        border: isConflict ? '1px solid #ff4d4f' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          backgroundColor: isConflict ? '#ff4d4f' : '#1890ff',
                          color: '#fff',
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {currentBed}
                        </span>
                        <span style={{ fontSize: 14 }}>{emp.name}</span>
                        {emp.department && (
                          <Tag color="default" style={{ fontSize: 10 }}>
                            {emp.department}
                          </Tag>
                        )}
                        {isConflict && (
                          <span style={{ color: '#ff4d4f', fontSize: 11 }}>床位冲突</span>
                        )}
                      </div>
                      
                      <select
                        value={currentBed}
                        onChange={(e) => {
                          const newBed = parseInt(e.target.value);
                          setSelectedBeds(prev => ({
                            ...prev,
                            [emp._id]: newBed
                          }));
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          border: '1px solid #d9d9d9',
                          fontSize: 12,
                        }}
                      >
                        {Array.from({ length: adjustingRoom.layout ?? 3 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}号床
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              
              {/* 床位使用情况预览 */}
              <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>床位使用情况：</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Array.from({ length: adjustingRoom.layout ?? 3 }, (_, i) => {
                    const bedNum = i + 1;
                    const occupantId = Object.entries(selectedBeds).find(([, bed]) => bed === bedNum)?.[0];
                    const occupant = adjustingOccupants.find((o: any) => o._id === occupantId);
                    
                    return (
                      <div
                        key={bedNum}
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: occupant ? '#52c41a' : '#d9d9d9',
                          color: '#fff',
                          fontSize: 12,
                        }}
                      >
                        <span>{bedNum}号</span>
                        {occupant && <span style={{ fontSize: 10 }}>{occupant.name.slice(0, 2)}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        }
        closeOnAction
        onClose={() => setBedModalVisible(false)}
        actions={[
          {
            key: 'cancel',
            text: '取消',
          },
          {
            key: 'save',
            text: '保存',
            primary: true,
            onClick: async () => {
              if (!adjustingRoom || !adjustingDorm) return;
              
              // 检查是否有床位冲突
              const bedValues = Object.values(selectedBeds);
              const hasConflict = bedValues.length !== new Set(bedValues).size;
              if (hasConflict) {
                Toast.show({ content: '存在床位冲突，请调整', icon: 'fail' });
                return;
              }
              
              try {
                // 更新每个员工的床号
                for (const emp of adjustingOccupants) {
                  await db.employees.update(emp._id, {
                    bedNo: selectedBeds[emp._id] || 1,
                  });
                }
                
                // 更新房间的第一个入住人（用于房间状态显示）
                const firstBed = Math.min(...bedValues);
                const firstEmployee = adjustingOccupants.find(
                  (o: any) => selectedBeds[o._id] === firstBed
                );
                await db.rooms.update(adjustingRoom._id, {
                  occupantId: firstEmployee?._id || null,
                  occupantName: firstEmployee?.name || null,
                });

                Toast.show({ content: '床位调整成功', icon: 'success' });
                loadHierarchyData();
                window.dispatchEvent(new CustomEvent('dorm-data-updated'));
              } catch (err) {
                console.error('调整床位失败:', err);
                Toast.show({ content: '调整失败', icon: 'fail' });
              }
            },
          },
        ]}
      />
    </>
  );

  return (
    <div className="page-container dashboard-page">
      <NavBar back={null}>数据可视化看板</NavBar>

      <Tabs activeKey={activeTab} onChange={setActiveTab} className="dashboard-tabs">
        <Tabs.Tab title="总览" key="overview">
          {renderOverview()}
        </Tabs.Tab>
        <Tabs.Tab title="分析" key="analysis">
          {renderAnalysis()}
        </Tabs.Tab>
        <Tabs.Tab title="层级视图" key="hierarchy">
          {renderHierarchy()}
        </Tabs.Tab>
        <Tabs.Tab title="历史/费用" key="history">
          {renderHistory()}
        </Tabs.Tab>
      </Tabs>

      {/* 快捷导航 */}
      <Card title="快捷功能">
        <Grid columns={4} gap={8}>
          <Grid.Item onClick={() => onNavigate('communities')}>
            <div className="quick-nav-item">
              <Building2 size={20} />
              <span>小区</span>
            </div>
          </Grid.Item>
          <Grid.Item onClick={() => onNavigate('dorms')}>
            <div className="quick-nav-item">
              <BedDouble size={20} />
              <span>宿舍</span>
            </div>
          </Grid.Item>
          <Grid.Item onClick={() => onNavigate('employees')}>
            <div className="quick-nav-item">
              <Users size={20} />
              <span>员工</span>
            </div>
          </Grid.Item>
          <Grid.Item onClick={() => onNavigate('repairs')}>
            <div className="quick-nav-item">
              <TrendingUp size={20} />
              <span>维修</span>
            </div>
          </Grid.Item>
          <Grid.Item onClick={() => onNavigate('assets')}>
            <div className="quick-nav-item">
              <Wallet size={20} />
              <span>资产</span>
            </div>
          </Grid.Item>
          <Grid.Item onClick={() => onNavigate('exports')}>
            <div className="quick-nav-item">
              <TrendingUp size={20} />
              <span>导出</span>
            </div>
          </Grid.Item>
          <Grid.Item onClick={() => onNavigate('occupancy-map')}>
            <div className="quick-nav-item">
              <Grid3X3 size={20} />
              <span>房间可视化</span>
            </div>
          </Grid.Item>
          <Grid.Item onClick={() => onNavigate('analytics')}>
            <div className="quick-nav-item">
              <BarChart3 size={20} />
              <span>数据分析</span>
            </div>
          </Grid.Item>
          <Grid.Item onClick={() => onNavigate('data-manage')}>
            <div className="quick-nav-item">
              <Database size={20} />
              <span>数据管理</span>
            </div>
          </Grid.Item>
          <Grid.Item onClick={() => onNavigate('excel-import')}>
            <div className="quick-nav-item">
              <FileSpreadsheet size={20} />
              <span>Excel导入</span>
            </div>
          </Grid.Item>
          <Grid.Item onClick={() => onNavigate('payments')}>
            <div className="quick-nav-item">
              <CreditCard size={20} />
              <span>缴费管理</span>
            </div>
          </Grid.Item>
        </Grid>
      </Card>
    </div>
  );
}
