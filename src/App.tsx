import { useState, useEffect } from 'react';
import { auth } from './utils/auth';
import { connectSocket, disconnectSocket } from './services/socket';
import Login from './pages/Login/Login';
import EmployeeHome from './pages/Employee/Home';
import MaintainerHome from './pages/Employee/MaintainerHome';
import Repair from './pages/Employee/Repair';
import Tickets from './pages/Employee/Tickets';
import Profile from './pages/Employee/Profile';
import EmployeePayments from './pages/Employee/EmployeePayments';
import Dashboard from './pages/Admin/Dashboard';
import Communities from './pages/Admin/Communities';
import Dorms from './pages/Admin/Dorms';
import Repairs from './pages/Admin/Repairs';
import Employees from './pages/Admin/Employees';
import Assets from './pages/Admin/Assets';
import Exports from './pages/Admin/Exports';
import DataManage from './pages/Admin/DataManage';
import OccupancyMap from './pages/Admin/OccupancyMap';
import Analytics from './pages/Admin/Analytics';
import ExcelImport from './pages/Admin/ExcelImport';
import Payments from './pages/Admin/Payments';
import './App.css';

type Page = 
  | 'login'
  | 'employee-home' | 'employee-repair' | 'employee-tickets' | 'employee-profile' | 'employee-payments'
  | 'maintainer-home'
  | 'admin-dashboard' | 'admin-communities' | 'admin-dorms' | 'admin-repairs'
  | 'admin-employees' | 'admin-assets' | 'admin-exports' | 'admin-data-manage'
  | 'admin-occupancy-map' | 'admin-analytics' | 'admin-excel-import' | 'admin-payments';

function App() {
  const getDefaultPage = (): Page => {
    if (!auth.isLoggedIn()) return 'login';
    const role = auth.getCurrentUser()?.role;
    if (role === 'ADMIN') return 'admin-dashboard';
    if (role === 'MAINTENANCE') return 'maintainer-home';
    return 'employee-home';
  };

  const [page, setPage] = useState<Page>(getDefaultPage);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 验证 token 有效性
    const init = async () => {
      if (auth.isLoggedIn()) {
        try {
          await auth.refreshUserInfo();
          // 连接 WebSocket
          connectSocket();
        } catch {
          auth.logout();
          setPage('login');
        }
      }
      setLoading(false);
    };
    init();

    // 清理 WebSocket
    return () => {
      disconnectSocket();
    };
  }, []);

  const handleLogin = (role: string) => {
    if (role === 'ADMIN') {
      setPage('admin-dashboard');
    } else if (role === 'MAINTENANCE') {
      setPage('maintainer-home');
    } else {
      setPage('employee-home');
    }
    // 登录成功后连接 WebSocket
    connectSocket();
  };

  const handleLogout = () => {
    auth.logout();
    setPage('login');
  };

  const handleEmployeeNavigate = (target: string) => {
    switch (target) {
      case 'repair': setPage('employee-repair'); break;
      case 'tickets': setPage('employee-tickets'); break;
      case 'payments': setPage('employee-payments'); break;
      case 'profile': setPage('employee-profile'); break;
      default: setPage('employee-home');
    }
  };

  const handleAdminNavigate = (target: string) => {
    switch (target) {
      case 'communities': setPage('admin-communities'); break;
      case 'dorms': setPage('admin-dorms'); break;
      case 'repairs': setPage('admin-repairs'); break;
      case 'employees': setPage('admin-employees'); break;
      case 'assets': setPage('admin-assets'); break;
      case 'exports': setPage('admin-exports'); break;
      case 'data-manage': setPage('admin-data-manage'); break;
      case 'occupancy-map': setPage('admin-occupancy-map'); break;
      case 'analytics': setPage('admin-analytics'); break;
      case 'excel-import': setPage('admin-excel-import'); break;
      case 'payments': setPage('admin-payments'); break;
      default: setPage('admin-dashboard');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f5f5f5'
      }}>
        <div style={{
          width: 48,
          height: 48,
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #1890ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ marginTop: 16, color: '#666' }}>正在加载...</p>
      </div>
    );
  }

  switch (page) {
    case 'login':
      return <Login onLogin={handleLogin} />;
    
    // 员工端
    case 'employee-home':
      return <EmployeeHome onNavigate={handleEmployeeNavigate} />;
    case 'employee-repair':
      return <Repair onBack={() => setPage('employee-home')} />;
    case 'employee-tickets':
      return <Tickets onBack={() => setPage('employee-home')} />;
    case 'maintainer-home':
      return <MaintainerHome />;
    case 'employee-payments':
      return <EmployeePayments onBack={() => setPage('employee-home')} />;
    case 'employee-profile':
      return <Profile onBack={() => setPage('employee-home')} onLogout={handleLogout} />;
    
    // 管理端
    case 'admin-dashboard':
      return <Dashboard onNavigate={handleAdminNavigate} />;
    case 'admin-communities':
      return <Communities onBack={() => setPage('admin-dashboard')} />;
    case 'admin-dorms':
      return <Dorms onBack={() => setPage('admin-dashboard')} />;
    case 'admin-repairs':
      return <Repairs onBack={() => setPage('admin-dashboard')} />;
    case 'admin-employees':
      return <Employees onBack={() => setPage('admin-dashboard')} />;
    case 'admin-assets':
      return <Assets onBack={() => setPage('admin-dashboard')} />;
    case 'admin-exports':
      return <Exports onBack={() => setPage('admin-dashboard')} />;
    case 'admin-data-manage':
      return <DataManage onBack={() => setPage('admin-dashboard')} />;
    case 'admin-occupancy-map':
      return <OccupancyMap onBack={() => setPage('admin-dashboard')} />;
    case 'admin-analytics':
      return <Analytics onBack={() => setPage('admin-dashboard')} />;
    case 'admin-excel-import':
      return <ExcelImport onBack={() => setPage('admin-dashboard')} />;
    case 'admin-payments':
      return <Payments onBack={() => setPage('admin-dashboard')} />;
    
    default:
      return <Login onLogin={handleLogin} />;
  }
}

export default App;
