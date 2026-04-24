import { useState, useEffect } from 'react';
import { NavBar, Card, Badge, Space, Tag, Button, Modal, List } from 'antd-mobile';
import { Building2, ArrowLeft, ArrowRight } from 'lucide-react';
import { db } from '../../db/db';
import type { Community, Dorm, Room, Employee, RepairTicket } from '../../types';
import './OccupancyMap.css';

interface OccupancyMapProps {
  onBack: () => void;
}

export default function OccupancyMap({ onBack }: OccupancyMapProps) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  
  const [activeCommunity, setActiveCommunity] = useState<string>('');
  const [activeBuilding, setActiveBuilding] = useState<string>('');
  const [activeFloor, setActiveFloor] = useState<number>(1);
  const [filterDept, setFilterDept] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showRoomDetail, setShowRoomDetail] = useState(false);

  useEffect(() => {
    loadData();
    
    // 监听数据更新事件（从数据管理页面导入后会触发）
    const handleDataUpdate = () => {
      loadData();
    };
    window.addEventListener('dorm-data-updated', handleDataUpdate);
    
    return () => {
      window.removeEventListener('dorm-data-updated', handleDataUpdate);
    };
  }, []);

  const loadData = async () => {
    const [commData, dormData, roomData, empData, ticketData] = await Promise.all([
      db.communities.toArray(),
      db.dorms.toArray(),
      db.rooms.toArray(),
      db.employees.toArray(),
      db.repairTickets.toArray(),
    ]);
    
    setCommunities(commData.filter(c => c.status === 'active'));
    setDorms(dormData);
    setRooms(roomData);
    setEmployees(empData);
    setTickets(ticketData);
    
    // 默认选中第一个小区
    if (commData.length > 0 && !activeCommunity) {
      setActiveCommunity(commData[0]._id);
    }
  };

  // 获取当前小区的所有楼栋
  const currentBuildings = dorms
    .filter(d => d.communityId === activeCommunity)
    .map(d => d.building)
    .filter((v, i, a) => a.indexOf(v) === i);

  // 获取当前楼栋的所有楼层
  const currentFloors = dorms
    .filter(d => d.communityId === activeCommunity && d.building === activeBuilding)
    .map(d => d.floor)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b);

  // 获取当前视图的所有房间
  const currentRooms = rooms.filter(r => {
    const dorm = dorms.find(d => d._id === r.dormId);
    return dorm?.communityId === activeCommunity && 
           dorm?.building === activeBuilding && 
           dorm?.floor === activeFloor;
  });

  // 按宿舍分组房间
  const roomsByDorm = currentRooms.reduce((acc, room) => {
    const dorm = dorms.find(d => d._id === room.dormId);
    if (!dorm) return acc;
    
    if (!acc[dorm._id]) {
      acc[dorm._id] = {
        dorm,
        rooms: [],
      };
    }
    acc[dorm._id].rooms.push(room);
    return acc;
  }, {} as Record<string, { dorm: Dorm; rooms: Room[] }>);

  // 获取房间所有入住员工（支持多人间）
  const getRoomOccupants = (room: Room): Employee[] => {
    // 只查找当前房间的员工
    return employees.filter(e => 
      e.currentRoomId === room._id && e.status === 'active'
    );
  };

  // 获取入住员工信息（兼容旧数据）
  const getOccupantInfo = (room: Room) => {
    if (!room.occupantId) return null;
    return employees.find(e => e._id === room.occupantId);
  };

  // 获取房间维修工单
  const getRoomTickets = (room: Room) => {
    return tickets.filter(t => t.roomId === room._id && t.status !== 'confirmed' && t.status !== 'cancelled');
  };

  // 统计当前视图
  const stats = {
    total: currentRooms.length,
    occupied: currentRooms.filter(r => r.status === 'occupied').length,
    vacant: currentRooms.filter(r => r.status === 'vacant').length,
    maintenance: currentRooms.filter(r => r.status === 'maintenance').length,
  };

  const occupancyRate = stats.total > 0 ? ((stats.occupied / stats.total) * 100).toFixed(1) : '0';

  // 获取所有部门
  const departments = employees
    .map(e => e.department)
    .filter((v, i, a) => v && a.indexOf(v) === i);

  // 处理房间点击
  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
    setShowRoomDetail(true);
  };

  // 办理入住
  const handleCheckIn = async (_room: Room) => {
    // 这里应该打开一个选择员工的弹窗
    // 简化版：先关闭详情，实际项目中需要实现员工选择
    setShowRoomDetail(false);
    Modal.alert({
      title: '办理入住',
      content: '请前往「员工管理」页面选择员工并分配房间',
      confirmText: '知道了',
    });
  };

  // 获取房间样式（根据房型：家庭房绿色，住满红色，没住满蓝色）
  const getRoomStyle = (room: Room, layout: number, occupantCount: number) => {
    const occupant = getOccupantInfo(room);
    const isFamily = layout === 0;
    
    // 如果按部门筛选，高亮匹配的房间
    if (filterDept && occupant?.department === filterDept) {
      return {
        backgroundColor: '#e6f7ff',
        borderColor: '#1890ff',
        boxShadow: '0 0 8px rgba(24, 144, 255, 0.5)',
      };
    }
    
    // 家庭房显示绿色
    if (isFamily) {
      return {
        backgroundColor: '#f6ffed',
        borderColor: '#52c41a',
      };
    }
    
    // 住满显示红色，没住满显示蓝色
    const isFull = occupantCount >= layout && layout > 0;
    if (isFull) {
      return {
        backgroundColor: '#ffccc7',
        borderColor: '#ff4d4f',
      };
    } else {
      return {
        backgroundColor: '#d6e4ff',
        borderColor: '#1677ff',
      };
    }
  };

  return (
    <div className="page-container occupancy-map-page">
      <NavBar onBack={onBack}>房间可视化</NavBar>

      {/* 小区选择 */}
      <div className="community-tabs">
        {communities.map(comm => (
          <button
            key={comm._id}
            className={`community-tab ${activeCommunity === comm._id ? 'active' : ''}`}
            onClick={() => {
              setActiveCommunity(comm._id);
              setActiveBuilding('');
              setActiveFloor(1);
            }}
          >
            {comm.name}
          </button>
        ))}
      </div>

      {/* 楼栋选择 */}
      {currentBuildings.length > 0 && (
        <div className="building-tabs">
          <span className="tab-label">楼栋:</span>
          {currentBuildings.map(building => (
            <button
              key={building}
              className={`building-tab ${activeBuilding === building ? 'active' : ''}`}
              onClick={() => {
                setActiveBuilding(building);
                setActiveFloor(1);
              }}
            >
              {building}
            </button>
          ))}
        </div>
      )}

      {/* 楼层选择 */}
      {currentFloors.length > 0 && (
        <div className="floor-nav">
          <Button 
            size="small" 
            disabled={activeFloor <= Math.min(...currentFloors)}
            onClick={() => setActiveFloor(f => f - 1)}
          >
            <ArrowLeft size={16} />
          </Button>
          <span className="floor-indicator">{activeFloor}层</span>
          <Button 
            size="small"
            disabled={activeFloor >= Math.max(...currentFloors)}
            onClick={() => setActiveFloor(f => f + 1)}
          >
            <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {/* 部门筛选 */}
      <div className="dept-filter">
        <span className="filter-label">部门筛选:</span>
        <Space wrap>
          <Tag 
            color={filterDept === '' ? 'primary' : 'default'}
            onClick={() => setFilterDept('')}
          >
            全部
          </Tag>
          {departments.map(dept => (
            <Tag 
              key={dept}
              color={filterDept === dept ? 'primary' : 'default'}
              onClick={() => setFilterDept(dept)}
            >
              {dept}
            </Tag>
          ))}
        </Space>
      </div>

      {/* 统计面板 */}
      <Card className="stats-card">
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">总房间</span>
          </div>
          <div className="stat-item occupied">
            <span className="stat-value">{stats.occupied}</span>
            <span className="stat-label">已入住</span>
          </div>
          <div className="stat-item vacant">
            <span className="stat-value">{stats.vacant}</span>
            <span className="stat-label">空置</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{occupancyRate}%</span>
            <span className="stat-label">入住率</span>
          </div>
        </div>
        
        {/* 图例 */}
        <div className="legend-bar">
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#ff4d4f' }} />
            <span>住满</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#1677ff' }} />
            <span>未住满</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#faad14' }} />
            <span>维修中</span>
          </div>
        </div>
      </Card>

      {/* 房间平面图 */}
      <div className="floor-map">
        {Object.entries(roomsByDorm).length === 0 ? (
          <div className="empty-floor">
            <Building2 size={48} color="#d9d9d9" />
            <p>该楼层暂无房间数据</p>
          </div>
        ) : (
          Object.entries(roomsByDorm).map(([dormId, { dorm, rooms: dormRooms }]) => (
            <div key={dormId} className="dorm-section">
              <div className="dorm-title">
                <Building2 size={16} />
                {dorm.building}
              </div>
              <div className="rooms-grid">
                {dormRooms.map(room => {
                  const occupants = getRoomOccupants(room);
                  const tickets = getRoomTickets(room);
                  const roomLayout = (room.layout ?? 3) as number;
                  const isFamily = roomLayout === 0;
                  const capacity = isFamily ? 1 : roomLayout;
                  
                  // 调试：直接显示颜色测试
                  const isFull = occupants.length >= capacity;
                  const debugStyle = {
                    backgroundColor: isFamily ? '#52c41a' : (isFull ? '#ff4d4f' : '#1677ff'),
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    marginLeft: '4px'
                  };
                  
                  // 生成床位列表（1号床、2号床...）
                  const beds = Array.from({ length: capacity }, (_, i) => {
                    const bedNo = i + 1;
                    const occupant = occupants.find(e => e.bedNo === bedNo);
                    return { bedNo, occupant };
                  });
                  
                  return (
                    <div
                      key={room._id}
                      className="room-card"
                      style={getRoomStyle(room, roomLayout, occupants.length)}
                      onClick={() => handleRoomClick(room)}
                    >
                      <div className="room-header">
                        <span className="room-no">{room.roomNo}</span>
                        <span className="room-capacity">
                          {occupants.length}/{capacity}人
                          <span style={debugStyle}>{isFamily ? '家庭' : (isFull ? '满' : '空')}</span>
                        </span>
                        {tickets.length > 0 && (
                          <Badge content={tickets.length} color="warning" />
                        )}
                      </div>
                      
                      <div className="room-content">
                        {beds.map(({ bedNo, occupant }) => (
                          <div key={bedNo} className="bed-row">
                            <span className="bed-no">{bedNo}号</span>
                            {occupant ? (
                              <span className="bed-occupant">
                                {occupant.name}
                                <span className="bed-dept">{occupant.department}</span>
                              </span>
                            ) : (
                              <span className="bed-empty">空</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 房间详情弹窗 */}
      <Modal
        visible={showRoomDetail}
        title={selectedRoom ? `房间 ${selectedRoom.roomNo}` : '房间详情'}
        content={selectedRoom && (
          <div className="room-detail">
            <div className="detail-section">
              <h4>基本信息</h4>
              <List>
                <List.Item>房间号: {selectedRoom.roomNo}</List.Item>
                <List.Item>状态: 
                  <Tag color={
                    selectedRoom.status === 'occupied' ? 'success' :
                    selectedRoom.status === 'vacant' ? 'default' :
                    selectedRoom.status === 'maintenance' ? 'warning' : 'danger'
                  }>
                    {selectedRoom.status === 'occupied' ? '已入住' :
                     selectedRoom.status === 'vacant' ? '空置' :
                     selectedRoom.status === 'maintenance' ? '维修中' : '停用'}
                  </Tag>
                </List.Item>
                <List.Item>户型: {(() => {
                  const roomLayout = (selectedRoom.layout ?? 3) as number;
                  return roomLayout === 0 ? '家庭房' : `${roomLayout}人间`;
                })()}</List.Item>
              </List>
            </div>

            {selectedRoom && (
              <div className="detail-section">
                <h4>床位详情</h4>
                {(() => {
                  const layout = (selectedRoom.layout ?? 3) as number;
                  const isFamily = layout === 0;
                  const capacity = isFamily ? 1 : layout;
                  const occupants = getRoomOccupants(selectedRoom);
                  return Array.from({ length: capacity }, (_, i) => {
                    const bedNo = i + 1;
                    const occupant = occupants.find(e => e.bedNo === bedNo);
                    return (
                      <Card key={bedNo} style={{ marginBottom: 8, background: occupant ? '#f6ffed' : '#fafafa' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 'bold', color: occupant ? '#52c41a' : '#999' }}>
                            {bedNo}号床
                          </div>
                          {occupant ? (
                            <Tag color="success">已入住</Tag>
                          ) : (
                            <Tag color="default">空闲</Tag>
                          )}
                        </div>
                        {occupant && (
                          <div style={{ marginTop: 8, fontSize: 13 }}>
                            <div><strong>{occupant.name}</strong> <span style={{ color: '#666' }}>({occupant.department})</span></div>
                            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                              工号: {occupant._id} | 电话: {occupant.phone || '-'}
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  });
                })()}
              </div>
            )}

            {selectedRoom.roomAssets?.length > 0 && (
              <div className="detail-section">
                <h4>房间资产</h4>
                <List>
                  {selectedRoom.roomAssets.map(asset => (
                    <List.Item 
                      key={asset.assetId}
                      extra={<Tag color={asset.status === 'normal' ? 'success' : 'warning'}>
                        {asset.status === 'normal' ? '正常' : '维修中'}
                      </Tag>}
                    >
                      {asset.name} - {asset.model}
                    </List.Item>
                  ))}
                </List>
              </div>
            )}

            {getRoomTickets(selectedRoom).length > 0 && (
              <div className="detail-section">
                <h4>维修记录</h4>
                <List>
                  {getRoomTickets(selectedRoom).map(ticket => (
                    <List.Item 
                      key={ticket._id}
                      extra={<Tag color={
                        ticket.status === 'reported' ? 'default' :
                        ticket.status === 'assigned' ? 'primary' :
                        ticket.status === 'processing' ? 'warning' : 'success'
                      }>
                        {ticket.status === 'reported' ? '待分配' :
                         ticket.status === 'assigned' ? '已分配' :
                         ticket.status === 'processing' ? '处理中' : '已完成'}
                      </Tag>}
                    >
                      {ticket.category} - {ticket.description.slice(0, 20)}...
                    </List.Item>
                  ))}
                </List>
              </div>
            )}

            {selectedRoom.status === 'vacant' && (
              <Button 
                block 
                color="primary"
                onClick={() => handleCheckIn(selectedRoom)}
              >
                办理入住
              </Button>
            )}
          </div>
        )}
        closeOnAction
        onClose={() => { setShowRoomDetail(false); setSelectedRoom(null); }}
      />
    </div>
  );
}
