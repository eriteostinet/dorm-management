import { useState, useEffect } from 'react';
import { List, Button, Dialog, Form, Input, NavBar, Tag, Toast } from 'antd-mobile';
import { getAllCommunities, createCommunity, updateCommunity } from '../../services/dataService';
import type { Community } from '../../types';
import './Communities.css';

interface CommunitiesProps {
  onBack: () => void;
}

export default function Communities({ onBack }: CommunitiesProps) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const loadCommunities = async () => {
      const result = await getAllCommunities();
      setCommunities(result);
    };
    loadCommunities();
  }, []);

  const handleAdd = async (values: any) => {
    await createCommunity({
      _id: values.code.toUpperCase(),
      name: values.name,
      address: values.address,
      manager: values.manager,
      managerPhone: values.managerPhone,
    });
    const result = await getAllCommunities();
    setCommunities(result);
    setShowAdd(false);
    Toast.show({ icon: 'success', content: '添加成功' });
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await updateCommunity(id, { status: newStatus as any });
    const result = await getAllCommunities();
    setCommunities(result);
    Toast.show({ icon: 'success', content: currentStatus === 'active' ? '已停用' : '已启用' });
  };

  return (
    <div className="page-container">
      <NavBar onBack={onBack} right={<Button size="small" color="primary" onClick={() => setShowAdd(true)}>新增</Button>}>
        小区管理
      </NavBar>

      <List>
        {communities.map(c => (
          <List.Item
            key={c._id}
            title={c.name}
            description={`${c.address} | 负责人：${c.manager}`}
            extra={
              <Tag color={c.status === 'active' ? 'success' : 'default'}>
                {c.status === 'active' ? '启用' : '停用'}
              </Tag>
            }
            onClick={() => handleToggleStatus(c._id, c.status)}
          >
            {c._id}
          </List.Item>
        ))}
      </List>

      <Dialog
        visible={showAdd}
        title="新增小区"
        content={
          <Form
            onFinish={handleAdd}
            layout="horizontal"
          >
            <Form.Item name="code" label="编码" rules={[{ required: true }]} help="2位大写字母，如：JW">
              <Input placeholder="JW" />
            </Form.Item>
            <Form.Item name="name" label="名称" rules={[{ required: true }]} >
              <Input placeholder="小区名称" />
            </Form.Item>
            <Form.Item name="address" label="地址" rules={[{ required: true }]} >
              <Input placeholder="详细地址" />
            </Form.Item>
            <Form.Item name="manager" label="负责人" rules={[{ required: true }]} >
              <Input placeholder="负责人姓名" />
            </Form.Item>
            <Form.Item name="managerPhone" label="电话" rules={[{ required: true }]} >
              <Input placeholder="联系电话" />
            </Form.Item>
            <Button block type="submit" color="primary">提交</Button>
          </Form>
        }
        onClose={() => setShowAdd(false)}
        closeOnAction
        closeOnMaskClick
      />
    </div>
  );
}
