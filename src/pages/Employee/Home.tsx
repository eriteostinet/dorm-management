import { useEffect, useState } from 'react';
import { Card, NavBar } from 'antd-mobile';
import { getEmployeeById, getRooms, getRepairTickets } from '../../services/dataService';
import { auth } from '../../utils/auth';
import { calculateTenure, formatDate } from '../../utils';
import './Home.css';

interface EmployeeHomeProps {
  onNavigate: (page: string) => void;
}

export default function EmployeeHome({ onNavigate }: EmployeeHomeProps) {
  const [employee, setEmployee] = useState<any | null>(null);
  const [room, setRoom] = useState<any | null>(null);
  const [roommates, setRoommates] = useState<any[]>([]);
  const [pendingTickets, setPendingTickets] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      const userId = auth.getUserId();
      if (!userId) return;
      
      try {
        const emp = await getEmployeeById(userId);
        if (emp) {
          setEmployee(emp);
          
          if (emp.rooms && emp.rooms.length > 0) {
            const myRoom = emp.rooms[0];
            setRoom(myRoom || null);
          }
          
          const tickets = await getRepairTickets({ reporterId: userId });
          setPendingTickets(tickets.filter((t: any) => ['PENDING', 'APPROVED', 'PROCESSING', 'DONE'].includes(t.status)).length);
        }
      } catch (err) {
        console.error('加载失败:', err);
      }
    };
    loadData();
  }, []);

  if (!employee) return null;

  const name = employee.realName || employee.name || '未知';
  const entryDate = employee.createdAt || employee.entryDate;
  const communityName = room?.building?.community?.name || room?.communityId || '';

  return (
    <div className="page-container">
      <NavBar back={null} className="navbar">员工首页</NavBar>
      
      <Card className="info-card">
        <div className="welcome">
          <h3>欢迎，{name}</h3>
          <p className="dept">{employee.department || '未分配'} · 入职{entryDate ? calculateTenure(entryDate) : '未知'}</p>
        </div>
        
        {room ? (
          <div className="dorm-info">
            <div className="dorm-header">
              <span style={{ 
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#1890ff',
                color: 'white',
                marginRight: '8px'
              }}>
                {communityName || '未知小区'}
              </span>
              <span className="dorm-number">{room.building?.name || room.buildingId || ''} · {room.roomNumber || ''}房</span>
            </div>
            <div className="dorm-detail">
              <p>入住日期：{formatDate(room.checkInDate)}</p>
            </div>
            
            {roommates.length > 0 && (
              <div className="roommates">
                <p className="label">同宿舍室友：</p>
                <div className="roommate-list">
                  {roommates.map((mate: any) => (
                    <div key={mate.id} className="roommate-tag">
                      {mate.occupantName || mate.occupant?.realName || '未知'} ({mate.occupant?.department || ''})
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
          
          <div className="action-item" onClick={() => onNavigate('payments')}>
            <div className="action-icon">💰</div>
            <span>我的缴费</span>
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
