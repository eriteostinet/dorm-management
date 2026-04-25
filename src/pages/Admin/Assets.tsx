import { useEffect, useState } from 'react';
import { Card, NavBar, Tag, Button, Modal, Form, Input, Selector, List, Toast } from 'antd-mobile';
import { Plus, Package } from 'lucide-react';
import { getAllCommunities, getAllDorms, getAllRooms, getAllEmployees } from '../../services/dataService';
import './Assets.css';

interface AssetsProps {
  onBack: () => void;
}

const ASSET_CATEGORIES = [
  { label: '热水器', value: '热水器' },
  { label: '空调', value: '空调' },
  { label: '洗衣机', value: '洗衣机' },
  { label: '路由器', value: '路由器' },
  { label: '电视', value: '电视' },
  { label: '冰箱', value: '冰箱' },
  { label: '床', value: '床' },
  { label: '桌椅', value: '桌椅' },
  { label: '衣柜', value: '衣柜' },
  { label: '其他', value: '其他' },
];

export default function Assets({ onBack }: AssetsProps) {
  const [communities, setCommunities] = useState<any[]>([]);
  const [dorms, setDorms] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({
    roomId: '',
    name: '',
    category: '',
    price: '',
    status: 'GOOD',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [c, d, r, e] = await Promise.all([
        getAllCommunities(),
        getAllDorms(),
        getAllRooms(),
        getAllEmployees(),
      ]);
      setCommunities(c.filter((x: any) => x.status === 'ACTIVE'));
      setDorms(d);
      setRooms(r);
      setEmployees(e);
    } catch (err) {
      console.error('加载失败:', err);
    }
  };

  const occupiedRooms = rooms.filter((r: any) => r.status === 'OCCUPIED');

  return (
    <div className="page-container">
      <NavBar onBack={onBack} right={
        <Button size="small" color="primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> 新增
        </Button>
      }>
        资产台账
      </NavBar>

      <List>
        {occupiedRooms.map((room: any) => {
          const occupant = employees.find((e: any) => e.id === room.occupantId);
          return (
            <List.Item
              key={room.id}
              title={`${room.roomNumber} - ${occupant?.realName || '未知'}`}
              description={room.building?.name || ''}
            />
          );
        })}
      </List>

      <Modal
        visible={showAdd}
        title="新增资产"
        content={
          <Form layout="vertical">
            <Form.Item label="房间">
              <Selector
                options={occupiedRooms.map((r: any) => ({ label: r.roomNumber, value: r.id }))}
                value={[formData.roomId]}
                onChange={v => setFormData({...formData, roomId: v[0]})}
              />
            </Form.Item>
            <Form.Item label="名称">
              <Input value={formData.name} onChange={v => setFormData({...formData, name: v})} placeholder="资产名称" />
            </Form.Item>
            <Form.Item label="类别">
              <Selector
                options={ASSET_CATEGORIES}
                value={[formData.category]}
                onChange={v => setFormData({...formData, category: v[0]})}
              />
            </Form.Item>
            <Form.Item label="价格">
              <Input value={formData.price} onChange={v => setFormData({...formData, price: v})} placeholder="元" type="number" />
            </Form.Item>
          </Form>
        }
        closeOnAction
        onClose={() => setShowAdd(false)}
        actions={[
          { key: 'cancel', text: '取消' },
          { key: 'save', text: '保存', primary: true, onClick: () => {
            Toast.show({ content: '保存功能需后端API支持', icon: 'fail' });
            setShowAdd(false);
          }},
        ]}
      />
    </div>
  );
}
