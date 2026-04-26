import { useState } from 'react';
import { Card, Button, NavBar, Toast, Space, Tag } from 'antd-mobile';
import { Download, FileSpreadsheet, Users, Building2, CreditCard } from 'lucide-react';
import './Exports.css';

interface ExportsProps {
  onBack: () => void;
}

const exportTypes = [
  { key: 'employees', name: '员工数据', desc: '所有员工的账号、姓名、部门信息', icon: Users },
  { key: 'rooms', name: '房间数据', desc: '所有房间的入住状态与入住人信息', icon: Building2 },
  { key: 'payments', name: '缴费数据', desc: '所有缴费账单记录', icon: CreditCard },
];

export default function Exports({ onBack }: ExportsProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleExport = async (type: string, name: string) => {
    setDownloading(type);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/export/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '导出失败');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      Toast.show({ icon: 'success', content: `${name}导出成功` });
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '导出失败' });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="page-container">
      <NavBar onBack={onBack}>数据导出</NavBar>

      <Card title="导出类型">
        <Space direction="vertical" style={{ width: '100%' }}>
          {exportTypes.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.key} className="export-type">
                <div className="export-info">
                  <div className="export-name">
                    <Icon size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                    {t.name}
                  </div>
                  <div className="export-desc">{t.desc}</div>
                </div>
                <Button
                  size="small"
                  color="primary"
                  loading={downloading === t.key}
                  onClick={() => handleExport(t.key, t.name)}
                >
                  <Download size={14} /> 导出
                </Button>
              </div>
            );
          })}
        </Space>
      </Card>
    </div>
  );
}
