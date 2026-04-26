import { useState, useEffect } from 'react';
import { Card, NavBar, Grid, Tabs, Collapse, Tag, Badge, Modal, Selector, Toast } from 'antd-mobile';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { getRooms, getEmployees, getDorms, getCommunities, getRepairTickets, getPayments } from '../../services/dataService';
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
  const [selectedBeds, setSelectedBeds] = useState<Record<string, number>>({});

  useEffect(() => {
    loadStats();
    loadHierarchyData();
    loadEmployees();
  }, []);
  
  const loadEmployees = async () => {
    try {
      const empData = await getEmployees();
      setEmployees(empData);
    } catch (err) {
      console.error('加载员工失败:', err);
    }
  };

  const loadStats = async () => {
    try {
      const [rooms, empData, dorms, communities, tickets, payments] = await Promise.all([
        getRooms(),
        getEmployees(),
        getDorms(),
        getCommunities(),
        getRepairTickets(),
        getPayments(),
      ]);

      const totalRooms = rooms.length;
      const totalEmployees = empData.length;
      const occupiedRooms = rooms.filter((r: any) => r.status === 'OCCUPIED').length;
      const vacantRooms = rooms.filter((r: any) => r.status === 'VACANT').length;
      const maintenanceRooms = rooms.filter((r: any) => r.status === 'MAINTENANCE').length;
      const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : '0';

      // 户型统计
      const layoutStats = rooms.reduce((acc: any, room: any) => {
        const layout = room.bedCount === 1 ? '单人间' : room.bedCount === 2 ? '双人间' : `${room.bedCount}人间`;
        if (!acc[layout]) acc[layout] = { name: layout, total: 0, occupied: 0, vacant: 0 };
        acc[layout].total += 1;
        if (room.status === 'OCCUPIED') acc[layout].occupied += 1;
        else if (room.status === 'VACANT') acc[layout].vacant += 1;
        return acc;
      }, {});

      // 小区分布
      const communityData = communities
        .filter((c: any) => c.status === 'ACTIVE')
        .map((c: any) => {
          const communityRooms = rooms.filter((r: any) => r.communityId === c.id);
          const occupied = communityRooms.filter((r: any) => r.status === 'OCCUPIED').length;
          return {
            name: c.name,
            value: occupied,
            total: communityRooms.length,
            vacant: communityRooms.length - occupied,
          };
        });

      // 部门分布
      const deptStats = empData.reduce((acc: any, emp: any) => {
        const dept = emp.department || '未知部门';
        if (!acc[dept]) acc[dept] = 0;
        acc[dept]++;
        return acc;
      }, {});
      
      const deptData = Object.entries(deptStats)
        .map(([name, value]: [string, any]) => ({ name, value }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 8);

      // 入住年份
      const yearStats = empData.reduce((acc: any, emp: any) => {
        let year = '未知';
        if (emp.createdAt) {
          year = new Date(emp.createdAt).getFullYear().toString();
        }
        if (!acc[year]) acc[year] = 0;
        acc[year]++;
        return acc;
      }, {});
      
      const yearData = Object.entries(yearStats)
        .map(([year, count]: [string, any]) => ({ year, count }))
        .sort((a: any, b: any) => a.year.localeCompare(b.year));

      // 维修统计
      const repairStats = {
        total: tickets.length,
        pending: tickets.filter((t: any) => t.status === 'PENDING').length,
        processing: tickets.filter((t: any) => t.status === 'PROCESSING').length,
        completed: tickets.filter((t: any) => t.status === 'DONE' || t.status === 'CONFIRMED').length,
      };

      // 费用估算
      const monthlyFee = occupiedRooms * 500;
      const annualFee = monthlyFee * 12;

      // 楼层统计
      const floorMap = new Map();
      dorms.forEach((dorm: any) => {
        const key = `${dorm.community?.name || '未知'}-${dorm.name || '未知'}`;
        const dormRooms = rooms.filter((r: any) => r.buildingId === dorm.id);
        const occupied = dormRooms.filter((r: any) => r.status === 'OCCUPIED').length;
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
    } catch (err) {
      console.error('加载统计数据失败:', err);
      Toast.show({ content: '加载数据失败', icon: 'fail' });
    }
  };

  const loadHierarchyData = async () => {
    try {
      const [rooms, empData, dorms, communities] = await Promise.all([
        getRooms(),
        getEmployees(),
        getDorms(),
        getCommunities(),
      ]);

      const hierarchy = communities
        .filter((c: any) => c.status === 'ACTIVE')
        .map((community: any) => {
          const communityDorms = dorms.filter((d: any) => d.communityId === community.id);

          const dormsWithRooms = communityDorms.map((dorm: any) => {
            const dormRooms = rooms
              .filter((r: any) => r.buildingId === dorm.id)
              .sort((a: any, b: any) => a.roomNumber.localeCompare(b.roomNumber));

            const roomsWithOccupants = dormRooms.map((room: any) => {
              const occupants = empData.filter((e: any) => e.id === room.occupantId);
              return { ...room, occupants };
            });

            return {
              ...dorm,
              rooms: roomsWithOccupants,
              totalRooms: dormRooms.length,
              occupiedRooms: dormRooms.filter((r: any) => r.status === 'OCCUPIED').length,
            };
          });

          return {
            ...community,
            dorms: dormsWithRooms,
            totalDorms: communityDorms.length,
            totalRooms: rooms.filter((r: any) => r.communityId === community.id).length,
            occupiedRooms: rooms.filter((r: any) => r.communityId === community.id && r.status === 'OCCUPIED').length,
          };
        });

      setHierarchyData(hierarchy);
    } catch (err) {
      console.error('加载层级数据失败:', err);
    }
  };

  if (!stats) return null;

  const renderOverview = () => (
    <>
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
                label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
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
      <Card title="员工入职年份分布">
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
            key={community.id}
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
                  key={dorm.id}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building2 size={16} color="#52c41a" />
                      <span>{dorm.name}</span>
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
                      const capacity = room.bedCount || 2;
                      const isFull = room.occupants.length >= capacity;
                      
                      return (
                      <div
                        key={room.id}
                        style={{
                          border: '1px solid #e8e8e8',
                          borderRadius: 8,
                          padding: 12,
                          backgroundColor: room.status === 'OCCUPIED' ? (isFull ? '#fff1f0' : '#e6f7ff') : '#f6ffed',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
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
                            setSelectedEmployees(room.occupants.map((o: any) => o.id));
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
                          {room.roomNumber}
                          <span style={{ fontSize: 11, color: '#999', fontWeight: 'normal' }}>
                            ({room.occupants.length}/{capacity}人)
                          </span>
                          {room.status === 'OCCUPIED' && <Badge color="#52c41a" />}
                          {room.status === 'VACANT' && <Badge color="#faad14" />}
                          {room.status === 'MAINTENANCE' && <Badge color="#ff4d4f" />}
                        </div>
                        {room.occupants.length > 0 ? (
                          <div style={{ fontSize: 12, color: '#666' }}>
                            {room.occupants.map((emp: any) => (
                              <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                <span>{emp.realName || emp.name}</span>
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
                            {room.status === 'VACANT' ? '点击分配人员' : '无人入住'}
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

      <Modal
        visible={editModalVisible}
        title={editingRoom ? `编辑房间 ${editingRoom.roomNumber}` : '编辑房间'}
        content={
          editingRoom && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                  房型: {editingRoom.bedCount}人间 | 当前: {selectedEmployees.length}人
                </div>
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <Selector
                  options={employees
                    .filter((e: any) => e.status === 'ACTIVE')
                    .map((e: any) => ({
                      label: `${e.realName || e.name} (${e.department || '无部门'})`,
                      value: e.id,
                    }))}
                  value={selectedEmployees}
                  onChange={(val) => {
                    const roomCapacity = editingRoom?.bedCount || 2;
                    if (val.length <= roomCapacity) {
                      setSelectedEmployees(val);
                    } else {
                      Toast.show({ content: `该房型最多${roomCapacity}人`, icon: 'fail' });
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
          { key: 'cancel', text: '取消' },
          {
            key: 'save',
            text: '保存',
            primary: true,
            onClick: async () => {
              if (!editingRoom) return;
              try {
                Toast.show({ content: '保存成功', icon: 'success' });
                loadHierarchyData();
              } catch (err) {
                console.error('保存失败:', err);
                Toast.show({ content: '保存失败', icon: 'fail' });
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
