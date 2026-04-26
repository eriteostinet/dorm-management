import { useState, useEffect } from 'react';
import { NavBar, Card, Badge, Space, Tag, Button, Modal, List } from 'antd-mobile';
import { Building2 } from 'lucide-react';
import { getAllCommunities, getAllDorms, getAllRooms, getAllEmployees, getAllRepairTickets } from '../../services/dataService';
import './OccupancyMap.css';

interface OccupancyMapProps {
  onBack: () => void;
}

export default function OccupancyMap({ onBack }: OccupancyMapProps) {
  const [communities, setCommunities] = useState<any[]>([]);
  const [dorms, setDorms] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  
  const [activeCommunity, setActiveCommunity] = useState<string>('');
  const [activeBuilding, setActiveBuilding] = useState<string>('');
  const [activeFloor, setActiveFloor] = useState<number>(1);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [showRoomDetail, setShowRoomDetail] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [commData, dormData, roomData, empData, ticketData] = await Promise.all([
        getAllCommunities(),
        getAllDorms(),
        getAllRooms(),
        getAllEmployees(),
        getAllRepairTickets(),
      ]);
      
      const activeCommunities = commData.filter((c: any) => c.status === 'ACTIVE');
      setCommunities(activeCommunities);
      setDorms(dormData);
      setRooms(roomData);
      setEmployees(empData);
      setTickets(ticketData);
      
      if (activeCommunities.length > 0 && !activeCommunity) {
        setActiveCommunity(activeCommunities[0].id);
      }
    } catch (err) {
      console.error('加载失败:', err);
    }
  };

  const currentBuildings = [...new Set(
    dorms.filter((d: any) => d.communityId === activeCommunity).map((d: any) => d.name)
  )].sort();

  const currentFloors = [...new Set(
    dorms.filter((d: any) => d.communityId === activeCommunity && d.name === activeBuilding)
      .map((d: any) => d.floor || 1)
  )].sort((a, b) => a - b);

  const currentRooms = rooms.filter((r: any) => {
    const dorm = dorms.find((d: any) => d.id === r.buildingId);
    return dorm?.communityId === activeCommunity && 
           dorm?.name === activeBuilding && 
           (dorm?.floor || 1) === activeFloor;
  });

  const getRoomStatus = (room: any) => {
    if (room.status === 'OCCUPIED') return { color: '#52c41a', text: '已入住' };
    if (room.status === 'MAINTENANCE') return { color: '#ff4d4f', text: '维修中' };
    return { color: '#faad14', text: '空置' };
  };

  return (
    <div className="page-container">
      <NavBar onBack={onBack}>入住地图</NavBar>

      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {communities.map((c: any) => (
            <Tag key={c.id} color={activeCommunity === c.id ? 'primary' : 'default'}
              onClick={() => { setActiveCommunity(c.id); setActiveBuilding(''); }}>
              {c.name}
            </Tag>
          ))}
        </div>
      </Card>

      {currentBuildings.length > 0 && (
        <Card>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {currentBuildings.map((b: string) => (
              <Tag key={b} color={activeBuilding === b ? 'primary' : 'default'}
                onClick={() => { setActiveBuilding(b); setActiveFloor(1); }}>
                {b}栋
              </Tag>
            ))}
          </div>
        </Card>
      )}

      {currentFloors.length > 0 && (
        <Card>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {currentFloors.map((f: number) => (
              <Tag key={f} color={activeFloor === f ? 'primary' : 'default'}
                onClick={() => setActiveFloor(f)}>
                {f}层
              </Tag>
            ))}
          </div>
        </Card>
      )}

      <Card title={`${activeBuilding || ''} ${activeFloor}层`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
          {currentRooms.map((room: any) => {
            const status = getRoomStatus(room);
            const occupant = employees.find((e: any) => e.id === room.occupantId);
            const roomTickets = tickets.filter((t: any) => t.roomId === room.id && t.status !== 'CONFIRMED');
            
            return (
              <div key={room.id}
                style={{
                  border: `2px solid ${status.color}`,
                  borderRadius: 8,
                  padding: 8,
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: room.status === 'OCCUPIED' ? '#f6ffed' : '#fff',
                }}
                onClick={() => { setSelectedRoom(room); setShowRoomDetail(true); }}
              >
                <div style={{ fontWeight: 'bold' }}>{room.roomNumber}</div>
                {room.status === 'OCCUPIED' && (
                  <>
                    <div style={{ fontSize: 12 }}>{occupant?.realName || '未知'}</div>
                    <div style={{ fontSize: 10, color: '#999' }}>{occupant?.department || ''}</div>
                  </>
                )}
                {roomTickets.length > 0 && (
                  <Badge content={roomTickets.length} style={{ '--right': '-4px', '--top': '-4px' } as any} />
                )}
              </div>
            );
          })}
        </div>
        {currentRooms.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无房间数据</div>
        )}
      </Card>

      <Modal visible={showRoomDetail} title="房间详情" closeOnAction onClose={() => setShowRoomDetail(false)}
        actions={[{ key: 'close', text: '关闭' }]}
      >
        {selectedRoom && (
          <List>
            <List.Item title="房号" extra={selectedRoom.roomNumber} />
            <List.Item title="状态" extra={getRoomStatus(selectedRoom).text} />
            <List.Item title="房型" extra={`${selectedRoom.bedCount}人间`} />
            {selectedRoom.occupantName && (
              <>
                <List.Item title="入住人" extra={selectedRoom.occupantName} />
                <List.Item title="入住日期" extra={selectedRoom.checkInDate?.slice(0, 10) || ''} />
              </>
            )}
          </List>
        )}
      </Modal>
    </div>
  );
}
