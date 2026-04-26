import { useState, useEffect } from 'react';
import { Card, Selector, NavBar, Button, Dialog, Toast, Tabs, Space } from 'antd-mobile';
import { getAllCommunities, getAllDorms, getAllRooms, getAllEmployees, checkIn, checkOut } from '../../services/dataService';
import './Dorms.css';

interface DormsProps {
  onBack: () => void;
}

export default function Dorms({ onBack }: DormsProps) {
  const [communities, setCommunities] = useState<any[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<string>('');
  const [dorms, setDorms] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedCommunity) {
      loadCommunityData();
    }
  }, [selectedCommunity]);

  const loadInitialData = async () => {
    try {
      const list = await getAllCommunities();
      const activeCommunities = list.filter((c: any) => c.status === 'ACTIVE');
      setCommunities(activeCommunities);
      if (activeCommunities.length > 0) {
        setSelectedCommunity(activeCommunities[0].id);
      }
    } catch (err) {
      console.error('加载小区失败:', err);
    }
  };

  const loadCommunityData = async () => {
    try {
      const [dormList, roomList, empList] = await Promise.all([
        getAllDorms(),
        getAllRooms(),
        getAllEmployees(),
      ]);
      const communityDorms = dormList.filter((d: any) => d.communityId === selectedCommunity);
      const communityRooms = roomList.filter((r: any) => r.communityId === selectedCommunity);
      setDorms(communityDorms);
      setRooms(communityRooms);
      setEmployees(empList);

      const buildings = [...new Set(communityDorms.map((d: any) => d.name))].sort();
      if (buildings.length > 0 && !selectedBuilding) {
        setSelectedBuilding(buildings[0]);
      }
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  };

  const getFloorMap = () => {
    const buildingDorms = dorms.filter((d: any) => d.name === selectedBuilding);
    const floors = [...new Set(buildingDorms.map((d: any) => d.floor || 1))].sort((a, b) => b - a);
    
    return floors.map((floor: any) => {
      const floorDorms = buildingDorms.filter((d: any) => (d.floor || 1) === floor);
      return {
        floor,
        dorms: floorDorms.map((dorm: any) => ({
          ...dorm,
          rooms: rooms.filter((r: any) => r.buildingId === dorm.id).sort((a: any, b: any) => a.roomNumber.localeCompare(b.roomNumber)),
        })),
      };
    });
  };

  const handleCheckIn = async (room: any) => {
    const availableEmployees = employees.filter((e: any) => !e._count?.rooms && e.role === 'STAFF');
    
    Dialog.confirm({
      title: '选择入住员工',
      content: (
        <select id="emp-select" style={{ width: '100%', padding: '10px', fontSize: '14px' }}>
          {availableEmployees.map((e: any) => (
            <option key={e.id} value={e.id}>{e.realName || e.name} ({e.department})</option>
          ))}
        </select>
      ),
      onConfirm: async () => {
        const select = document.getElementById('emp-select') as HTMLSelectElement;
        const empId = select?.value;
        if (empId) {
          try {
            await checkIn(room.id, empId);
            Toast.show({ icon: 'success', content: '入住成功' });
            loadCommunityData();
          } catch (err: any) {
            Toast.show({ icon: 'fail', content: err.message || '入住失败' });
          }
        }
      },
    });
  };

  const handleCheckOut = async (room: any) => {
    Dialog.confirm({
      title: '确认退宿',
      content: `员工：${room.occupantName}，房间：${room.roomNumber}`,
      onConfirm: async () => {
        try {
          await checkOut(room.id);
          Toast.show({ icon: 'success', content: '退宿成功' });
          loadCommunityData();
        } catch (err: any) {
          Toast.show({ icon: 'fail', content: err.message || '退宿失败' });
        }
      },
    });
  };

  const toggleRoomSelection = (roomId: string) => {
    const newSet = new Set(selectedRooms);
    if (newSet.has(roomId)) {
      newSet.delete(roomId);
    } else {
      newSet.add(roomId);
    }
    setSelectedRooms(newSet);
  };

  const handleBatchCheckIn = async () => {
    const availableEmployees = employees.filter((e: any) => !e._count?.rooms && e.role === 'STAFF');
    if (selectedRooms.size > availableEmployees.length) {
      Toast.show({ icon: 'fail', content: '可用员工不足' });
      return;
    }

    Dialog.confirm({
      title: `批量入住 ${selectedRooms.size} 个房间`,
      content: '将按顺序分配员工入住',
      onConfirm: async () => {
        let idx = 0;
        for (const roomId of selectedRooms) {
          const room = rooms.find((r: any) => r.id === roomId);
          const employee = availableEmployees[idx];
          if (room && employee && room.status === 'VACANT') {
            try {
              await checkIn(room.id, employee.id);
              idx++;
            } catch {
              // continue
            }
          }
        }
        Toast.show({ icon: 'success', content: `成功入住 ${idx} 人` });
        setSelectedRooms(new Set());
        setBatchMode(false);
        loadCommunityData();
      },
    });
  };

  const handleBatchCheckOut = async () => {
    Dialog.confirm({
      title: `批量退宿 ${selectedRooms.size} 个房间`,
      content: '确定要退宿这些房间吗？',
      onConfirm: async () => {
        let count = 0;
        for (const roomId of selectedRooms) {
          const room = rooms.find((r: any) => r.id === roomId);
          if (room?.occupantId) {
            try {
              await checkOut(room.id);
              count++;
            } catch {
              // continue
            }
          }
        }
        Toast.show({ icon: 'success', content: `成功退宿 ${count} 人` });
        setSelectedRooms(new Set());
        setBatchMode(false);
        loadCommunityData();
      },
    });
  };

  const floorMap = getFloorMap();
  const buildings = [...new Set(dorms.map((d: any) => d.name))].sort();

  return (
    <div className="page-container">
      <NavBar onBack={onBack}>宿舍管理</NavBar>

      <Card>
        <Selector
          options={communities.map((c: any) => ({ label: c.name, value: c.id }))}
          value={[selectedCommunity]}
          onChange={(val) => {
            setSelectedCommunity(val[0]);
            setSelectedBuilding('');
            setSelectedRooms(new Set());
          }}
        />
      </Card>

      {batchMode && (
        <Card style={{ background: '#fffbe6' }}>
          <Space>
            <span>已选 {selectedRooms.size} 个房间</span>
            <Button size="small" color="primary" onClick={handleBatchCheckIn}>批量入住</Button>
            <Button size="small" color="danger" onClick={handleBatchCheckOut}>批量退宿</Button>
            <Button size="small" onClick={() => { setBatchMode(false); setSelectedRooms(new Set()); }}>取消</Button>
          </Space>
        </Card>
      )}

      {buildings.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tabs activeKey={selectedBuilding} onChange={setSelectedBuilding} style={{ flex: 1 }}>
              {buildings.map(b => (
                <Tabs.Tab title={`${b}栋`} key={b} />
              ))}
            </Tabs>
            {!batchMode && (
              <Button size="small" onClick={() => setBatchMode(true)}>批量操作</Button>
            )}
          </div>
        </Card>
      )}

      <div className="floor-plans">
        {floorMap.map(({ floor, dorms: floorDorms }) => (
          <Card key={floor} title={`${floor}层`} className="floor-card">
            <div className="dorms-row">
              {floorDorms.map((dorm: any) => (
                <div key={dorm.id} className="dorm-unit">
                  <div className="dorm-title">{dorm.name}</div>
                  <div className="rooms-grid">
                    {dorm.rooms.map((room: any) => {
                      const isSelected = selectedRooms.has(room.id);
                      return (
                        <div
                          key={room.id}
                          className={`room-cell ${(room.status || '').toLowerCase()} ${isSelected ? 'selected' : ''} ${batchMode ? 'selectable' : ''}`}
                          onClick={() => {
                            if (batchMode) {
                              toggleRoomSelection(room.id);
                            } else if (room.status === 'VACANT') {
                              handleCheckIn(room);
                            } else if (room.status === 'OCCUPIED') {
                              handleCheckOut(room);
                            }
                          }}
                        >
                          {batchMode && isSelected && <div className="select-badge">✓</div>}
                          <div className="room-no">{room.roomNumber}</div>
                          {room.status === 'OCCUPIED' ? (
                            <>
                              <div className="room-name">{room.occupantName}</div>
                              <div className="room-dept">{room.occupant?.department || ''}</div>
                            </>
                          ) : (
                            <div className="room-status">
                              {room.status === 'VACANT' ? '空置' : '维修'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="legend">
          <div className="legend-item"><span className="dot vacant"></span> 空置</div>
          <div className="legend-item"><span className="dot occupied"></span> 已入住</div>
          <div className="legend-item"><span className="dot maintenance"></span> 维修中</div>
          <div className="legend-item"><span className="dot selected"></span> 已选择</div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
          点击空置房间入住，点击已住房间退宿，批量模式下可多选
        </div>
      </Card>
    </div>
  );
}
