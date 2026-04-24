import { useState, useEffect } from 'react';
import { Card, Selector, NavBar, Button, Dialog, Toast, Tabs, Space } from 'antd-mobile';
import { db, initDefaultData } from '../../db/db';
import type { Room, Community, Dorm } from '../../types';
import './Dorms.css';

interface DormsProps {
  onBack: () => void;
}

export default function Dorms({ onBack }: DormsProps) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<string>('');
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  useEffect(() => {
    loadInitialData();
    
    // 监听数据更新事件（从数据管理页面导入后会触发）
    const handleDataUpdate = () => {
      loadInitialData();
      if (selectedCommunity) {
        loadCommunityData();
      }
    };
    window.addEventListener('dorm-data-updated', handleDataUpdate);
    
    return () => {
      window.removeEventListener('dorm-data-updated', handleDataUpdate);
    };
  }, []);

  useEffect(() => {
    if (selectedCommunity) {
      loadCommunityData();
    }
  }, [selectedCommunity]);

  const loadInitialData = async () => {
    await initDefaultData();
    const list = await db.communities.where('status').equals('active').sortBy('sortOrder').toArray();
    setCommunities(list);
    if (list.length > 0) {
      setSelectedCommunity(list[0]._id);
    }
  };

  const loadCommunityData = async () => {
    const [dormList, roomList, empList] = await Promise.all([
      db.dorms.where('communityId').equals(selectedCommunity).toArray(),
      db.rooms.where('communityId').equals(selectedCommunity).toArray(),
      db.employees.toArray(),
    ]);
    setDorms(dormList);
    setRooms(roomList);
    setEmployees(empList);

    // 默认选中第一个楼栋
    const buildings = [...new Set(dormList.map(d => d.building))].sort();
    if (buildings.length > 0 && !selectedBuilding) {
      setSelectedBuilding(buildings[0]);
    }
  };

  // 按楼栋和楼层组织房间
  const getFloorMap = () => {
    const buildingDorms = dorms.filter(d => d.building === selectedBuilding);
    const floors = [...new Set(buildingDorms.map(d => d.floor))].sort((a, b) => b - a);
    
    return floors.map(floor => {
      const floorDorms = buildingDorms.filter(d => d.floor === floor);
      return {
        floor,
        dorms: floorDorms.map(dorm => ({
          ...dorm,
          rooms: rooms.filter(r => r.dormId === dorm._id).sort((a, b) => a.roomNo.localeCompare(b.roomNo)),
        })),
      };
    });
  };

  const handleCheckIn = async (room: Room) => {
    const availableEmployees = employees.filter(e => !e.currentRoomId && e.role === 'employee');
    
    Dialog.confirm({
      title: '选择入住员工',
      content: (
        <select id="emp-select" style={{ width: '100%', padding: '10px', fontSize: '14px' }}>
          {availableEmployees.map(e => (
            <option key={e._id} value={e._id}>{e.name} ({e.department})</option>
          ))}
        </select>
      ),
      onConfirm: async () => {
        const select = document.getElementById('emp-select') as HTMLSelectElement;
        const empId = select?.value;
        if (empId) {
          const employee = employees.find(e => e._id === empId);
          if (employee) {
            await db.rooms.update(room._id, {
              occupantId: empId,
              occupantName: employee.name,
              occupantDept: employee.department,
              checkInDate: new Date(),
              status: 'occupied',
            });
            await db.employees.update(empId, {
              currentCommunityId: room.communityId,
              currentDormId: room.dormId,
              currentRoomId: room._id,
            });
            Toast.show({ icon: 'success', content: '入住成功' });
            loadCommunityData();
          }
        }
      },
    });
  };

  const handleCheckOut = async (room: Room) => {
    Dialog.confirm({
      title: '确认退宿',
      content: `员工：${room.occupantName}，房间：${room._id}`,
      onConfirm: async () => {
        if (room.occupantId) {
          const employee = employees.find(e => e._id === room.occupantId);
          if (employee) {
            // 添加到历史
            const history = employee.history || [];
            history.push({
              communityId: room.communityId,
              dormId: room.dormId,
              roomId: room._id,
              checkIn: room.checkInDate,
              checkOut: new Date(),
              reason: '正常退宿',
            });
            await db.employees.update(room.occupantId, {
              currentCommunityId: null,
              currentDormId: null,
              currentRoomId: null,
              history,
            });
          }
          // 清空房间
          await db.rooms.update(room._id, {
            occupantId: null,
            occupantName: null,
            occupantDept: null,
            checkInDate: null,
            status: 'vacant',
          });
          Toast.show({ icon: 'success', content: '退宿成功' });
          loadCommunityData();
        }
      },
    });
  };

  // 批量选择
  const toggleRoomSelection = (roomId: string) => {
    const newSet = new Set(selectedRooms);
    if (newSet.has(roomId)) {
      newSet.delete(roomId);
    } else {
      newSet.add(roomId);
    }
    setSelectedRooms(newSet);
  };

  // 批量入住
  const handleBatchCheckIn = async () => {
    const availableEmployees = employees.filter(e => !e.currentRoomId && e.role === 'employee');
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
          const room = rooms.find(r => r._id === roomId);
          const employee = availableEmployees[idx];
          if (room && employee && room.status === 'vacant') {
            await db.rooms.update(room._id, {
              occupantId: employee._id,
              occupantName: employee.name,
              occupantDept: employee.department,
              checkInDate: new Date(),
              status: 'occupied',
            });
            await db.employees.update(employee._id, {
              currentCommunityId: room.communityId,
              currentDormId: room.dormId,
              currentRoomId: room._id,
            });
            idx++;
          }
        }
        Toast.show({ icon: 'success', content: `成功入住 ${idx} 人` });
        setSelectedRooms(new Set());
        setBatchMode(false);
        loadCommunityData();
      },
    });
  };

  // 批量退宿
  const handleBatchCheckOut = async () => {
    Dialog.confirm({
      title: `批量退宿 ${selectedRooms.size} 个房间`,
      content: '确定要退宿这些房间吗？',
      onConfirm: async () => {
        let count = 0;
        for (const roomId of selectedRooms) {
          const room = rooms.find(r => r._id === roomId);
          if (room?.occupantId) {
            const employee = employees.find(e => e._id === room.occupantId);
            if (employee) {
              const history = employee.history || [];
              history.push({
                communityId: room.communityId,
                dormId: room.dormId,
                roomId: room._id,
                checkIn: room.checkInDate,
                checkOut: new Date(),
                reason: '批量退宿',
              });
              await db.employees.update(room.occupantId, {
                currentCommunityId: null,
                currentDormId: null,
                currentRoomId: null,
                history,
              });
            }
            await db.rooms.update(room._id, {
              occupantId: null,
              occupantName: null,
              occupantDept: null,
              checkInDate: null,
              status: 'vacant',
            });
            count++;
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
  const buildings = [...new Set(dorms.map(d => d.building))].sort();

  return (
    <div className="page-container">
      <NavBar onBack={onBack}>宿舍管理</NavBar>

      {/* 小区选择 */}
      <Card>
        <Selector
          options={communities.map(c => ({ label: c.name, value: c._id }))}
          value={[selectedCommunity]}
          onChange={(val) => {
            setSelectedCommunity(val[0]);
            setSelectedBuilding('');
            setSelectedRooms(new Set());
          }}
        />
      </Card>

      {/* 批量操作栏 */}
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

      {/* 楼栋切换 */}
      {buildings.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tabs
              activeKey={selectedBuilding}
              onChange={setSelectedBuilding}
              style={{ flex: 1 }}
            >
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

      {/* 楼层平面图 */}
      <div className="floor-plans">
        {floorMap.map(({ floor, dorms: floorDorms }) => (
          <Card key={floor} title={`${floor}层`} className="floor-card">
            <div className="dorms-row">
              {floorDorms.map(dorm => (
                <div key={dorm._id} className="dorm-unit">
                  <div className="dorm-title">{dorm._id.split('-').pop()}</div>
                  <div className="rooms-grid">
                    {dorm.rooms.map((room: Room) => {
                      const isSelected = selectedRooms.has(room._id);
                      return (
                        <div
                          key={room._id}
                          className={`room-cell ${room.status} ${isSelected ? 'selected' : ''} ${batchMode ? 'selectable' : ''}`}
                          onClick={() => {
                            if (batchMode) {
                              toggleRoomSelection(room._id);
                            } else if (room.status === 'vacant') {
                              handleCheckIn(room);
                            } else if (room.status === 'occupied') {
                              handleCheckOut(room);
                            }
                          }}
                        >
                          {batchMode && isSelected && <div className="select-badge">✓</div>}
                          <div className="room-no">{room.roomNo}</div>
                          {room.status === 'occupied' ? (
                            <>
                              <div className="room-name">{room.occupantName}</div>
                              <div className="room-dept">{room.occupantDept}</div>
                            </>
                          ) : (
                            <div className="room-status">
                              {room.status === 'vacant' ? '空置' : '维修'}
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

      {/* 图例 */}
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
