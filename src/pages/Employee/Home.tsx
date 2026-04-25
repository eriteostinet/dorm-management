import { useEffect, useState } from 'react';
import { Card, NavBar } from 'antd-mobile';
import { getEmployeeById, getRooms, getRepairTickets } from '../../services/dataService';
import { auth } from '../../utils/auth';
import { calculateTenure, formatDate, getCommunityColor } from '../../utils';
import type { Employee, Room } from '../../types';
import './Home.css';

interface EmployeeHomeProps {
  onNavigate: (page: string) => void;
}

export default function EmployeeHome({ onNavigate }: EmployeeHomeProps) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [roommates, setRoommates] = useState<Room[]>([]);
  const [pendingTickets, setPendingTickets] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      const userId = auth.getUserId();
      if (!userId) return;
      
      const emp = await getEmployeeById(userId);
      if (emp) {
        setEmployee(emp);
        
        if (emp.currentRoomId) {
          const rooms = await getRooms({ dormId: emp.currentDormId || '' });
          const myRoom = rooms.find((r: any) => r.id === emp.currentRoomId);
          setRoom(myRoom || null);
          setRoommates(rooms.filter((r: Room) => r._id !== emp.currentRoomId && r.occupantId));
        }
        
        const tickets = await getRepairTickets({ reporterId: userId });
        setPendingTickets(tickets.filter((t: any) => ['reported', 'assigned', 'done'].includes(t.status)).length);
      }
    };
    loadData();
  }, []);

  if (!employee) return null;

  return (
    <div className="page-container">
      <NavBar back={null} className="navbar">员工首页</NavBar>
      
      <Card className="info-card">
        <div className="welcome">
          <h3>欢迎，{employee.name}</h3>
          <p className="dept">{employee.department} · 入职{calculateTenure(employee.entryDate)}</p>
        </div>
        
        {room ? (
          <div className="dorm-info">
            <div className="dorm-header">
              <span style={{ 
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                background: getCommunityColor(room.communityId),
                color: 'white',
                marginRight: '8px'
              }}>
                {room.communityId === 'JW' ? '金湾' : room.communityId === 'TY' ? '天悦' : '黄鱼涌'}
              </span>
              <span className="dorm-number">{room.dormId} · {room.roomNo}房</span>
            </div>
            <div className="dorm-detail">
              <p>入住日期：{formatDate(room.checkInDate)}</p>
            </div>
            
            {roommates.length > 0 && (
              <div className="roommates">
                <p className="label">同宿舍室友：</p>
                <div className="roommate-list">
                  {roommates.map(mate => (
                    <div key={mate._id} className="roommate-tag">
                      {mate.occupantName} ({mate.occupantDept})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="no-dorm">
            <p>您当前未入住宿舍</p>
          </div>
        )}
      </Card>
      
      <div className="quick-actions">
        <div className="action-grid">
          <div className="action-item urgent" onClick={() => onNavigate('repair')}>
            <div className="action-icon">🔧</div>
            <span>我要报修</span>
          </div>
          
          <div className="action-item" onClick={() => onNavigate('tickets')}>
            <div className="action-icon">
              📋
              {pendingTickets > 0 && <span className="badge">{pendingTickets}</span>}
            </div>
            <span>我的工单</span>
          </div>
          
          <div className="action-item" onClick={() => onNavigate('profile')}>
            <div className="action-icon">👤</div>
            <span>个人信息</span>
          </div>
        </div>
      </div>
    </div>
  );
}
