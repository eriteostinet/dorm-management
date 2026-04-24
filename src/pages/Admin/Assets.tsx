import { useEffect, useState } from 'react';
import { Card, NavBar, Tag, Button, Modal, Form, Input, Selector, List, Toast } from 'antd-mobile';
import { Plus, Package, MapPin, Building2, AlertCircle, Wrench, Users } from 'lucide-react';
import { db } from '../../db/db';
import type { Community, Dorm, DormAsset, Employee } from '../../types';
import './Assets.css';

interface AssetsProps {
  onBack: () => void;
}

// 资材类别
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
  const [communities, setCommunities] = useState<Community[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [assets, setAssets] = useState<DormAsset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // 添加资材弹窗
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [communitiesData, dormsData, assetsData, employeesData] = await Promise.all([
        db.communities.filter((c: any) => c.status === 'active').toArray(),
        db.dorms.toArray(),
        db.dormAssets.toArray(),
        db.employees.filter((e: any) => e.status === 'active').toArray(),
      ]);
      setCommunities(communitiesData);
      setDorms(dormsData);
      setAssets(assetsData);
      setEmployees(employeesData);
    } catch (err) {
      console.error('加载数据失败:', err);
      Toast.show({ content: '加载数据失败', icon: 'fail' });
    }
  };

  // 获取资材状态信息
  const getAssetStatusInfo = (asset: DormAsset) => {
    const now = new Date();
    const purchaseDate = new Date(asset.purchaseDate);
    const warrantyEnd = new Date(purchaseDate);
    warrantyEnd.setFullYear(warrantyEnd.getFullYear() + asset.warrantyYears);
    
    const daysUntilExpiry = Math.floor((warrantyEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (asset.status === 'repairing') {
      return { label: '维修中', color: '#1890ff', icon: Wrench };
    }
    if (asset.status === 'expired' || daysUntilExpiry < 0) {
      return { label: '已过保', color: '#ff4d4f', icon: AlertCircle };
    }
    if (daysUntilExpiry < 90) {
      return { label: '即将过保', color: '#faad14', icon: AlertCircle };
    }
    return { label: '正常', color: '#52c41a', icon: Package };
  };

  // 按宿舍分组资产
  const getAssetsByDorm = () => {
    const grouped: Record<string, { dorm: Dorm; community: Community | undefined; assets: DormAsset[]; occupants: Employee[] }> = {};

    assets.forEach(asset => {
      const dorm = dorms.find(d => d._id === asset.dormId);
      if (!dorm) return;

      if (!grouped[asset.dormId]) {
        const community = communities.find(c => c._id === asset.communityId);
        // 获取该宿舍的住宿人员
        const occupants = employees.filter(e => e.currentDormId === asset.dormId);
        grouped[asset.dormId] = { dorm, community, assets: [], occupants };
      }
      grouped[asset.dormId].assets.push(asset);
    });

    // 按小区和楼栋排序
    return Object.values(grouped).sort((a, b) => {
      const communityCompare = (a.community?.name || '').localeCompare(b.community?.name || '');
      if (communityCompare !== 0) return communityCompare;
      return (a.dorm.building || '').localeCompare(b.dorm.building || '');
    });
  };

  // 处理添加资材
  const handleAddAsset = async (values: any) => {
    try {
      const dorm = dorms.find(d => d._id === values.dormId);
      if (!dorm) {
        Toast.show({ content: '请选择宿舍', icon: 'fail' });
        return;
      }

      const newAsset: DormAsset = {
        _id: `DA${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
        communityId: dorm.communityId,
        dormId: values.dormId,
        category: values.category,
        brand: values.brand || '',
        model: values.model || '',
        serialNo: values.serialNo || '',
        purchaseDate: values.purchaseDate || new Date(),
        warrantyYears: parseInt(values.warrantyYears) || 1,
        location: values.location || '',
        status: 'normal',
        maintenanceCount: 0,
      };

      await db.dormAssets.add(newAsset);
      Toast.show({ content: '添加成功', icon: 'success' });
      setAddModalVisible(false);
      form.resetFields();
      loadData();
    } catch (err) {
      console.error('添加资材失败:', err);
      Toast.show({ content: '添加失败', icon: 'fail' });
    }
  };

  // 处理删除资材
  const handleDeleteAsset = async (assetId: string) => {
    Modal.confirm({
      content: '确定要删除这个资材吗？',
      onConfirm: async () => {
        try {
          await db.dormAssets.delete(assetId);
          Toast.show({ content: '删除成功', icon: 'success' });
          loadData();
        } catch (err) {
          console.error('删除失败:', err);
          Toast.show({ content: '删除失败', icon: 'fail' });
        }
      },
    });
  };

  const groupedAssets = getAssetsByDorm();

  return (
    <div className="assets-page">
      <NavBar 
        onBack={onBack}
        right={
          <Button size='small' color='primary' onClick={() => setAddModalVisible(true)}>
            <Plus size={16} />
          </Button>
        }
      >
        资材管理
      </NavBar>

      {/* 统计概览 */}
      <div className="assets-stats">
        <div className="stat-item">
          <span className="stat-value">{assets.length}</span>
          <span className="stat-label">总资材</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{assets.filter(a => a.status === 'normal').length}</span>
          <span className="stat-label">正常</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{assets.filter(a => a.status === 'repairing').length}</span>
          <span className="stat-label">维修中</span>
        </div>
        <div className="stat-item warning">
          <span className="stat-value">{groupedAssets.length}</span>
          <span className="stat-label">宿舍数</span>
        </div>
      </div>

      {/* 宿舍资材卡片列表 */}
      <div className="dorm-assets-list">
        {groupedAssets.length === 0 ? (
          <div className="empty-state">
            <Package size={48} color="#d9d9d9" />
            <p>暂无资材数据</p>
            <Button color="primary" onClick={() => setAddModalVisible(true)}>
              添加资材
            </Button>
          </div>
        ) : (
          groupedAssets.map(({ dorm, community, assets: dormAssets, occupants }) => (
            <Card key={dorm._id} className="dorm-asset-card">
              <div className="dorm-asset-header">
                <div className="dorm-info">
                  <div className="dorm-location">
                    <MapPin size={14} />
                    <span>{community?.name || '未知小区'}</span>
                  </div>
                  <div className="dorm-building">
                    <Building2 size={14} />
                    <span>{dorm.building}栋 {dorm.floor}层</span>
                  </div>
                </div>
                <div className="dorm-stats">
                  <Tag color="primary" fill="outline">
                    {dormAssets.length}件资材
                  </Tag>
                  <Tag color="success" fill="outline">
                    {occupants.length}人住宿
                  </Tag>
                </div>
              </div>

              {/* 住宿人员信息 */}
              {occupants.length > 0 && (
                <div className="dorm-occupants">
                  <div className="occupants-header">
                    <Users size={14} />
                    <span>住宿人员</span>
                  </div>
                  <div className="occupants-list">
                    {occupants.map(emp => (
                      <div key={emp._id} className="occupant-tag">
                        <span className="occupant-name">{emp.name}</span>
                        <span className="occupant-dept">{emp.department}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <List className="asset-list">
                {dormAssets.map(asset => {
                  const statusInfo = getAssetStatusInfo(asset);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <List.Item
                      key={asset._id}
                      className="asset-item"
                      extra={
                        <Button
                          size="small"
                          fill="none"
                          color="danger"
                          onClick={() => handleDeleteAsset(asset._id)}
                        >
                          删除
                        </Button>
                      }
                    >
                      <div className="asset-content">
                        <div className="asset-main">
                          <span className="asset-category">{asset.category}</span>
                          <span 
                            className="asset-status"
                            style={{ color: statusInfo.color }}
                          >
                            <StatusIcon size={12} />
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="asset-detail">
                          {asset.brand && <span>{asset.brand}</span>}
                          {asset.model && <span>{asset.model}</span>}
                        </div>
                        <div className="asset-meta">
                          <span>保修{asset.warrantyYears}年</span>
                          <span>维保{asset.maintenanceCount}次</span>
                        </div>
                      </div>
                    </List.Item>
                  );
                })}
              </List>
            </Card>
          ))
        )}
      </div>

      {/* 添加资材弹窗 */}
      <Modal
        visible={addModalVisible}
        title="添加资材"
        content={
          <Form
            form={form}
            layout="vertical"
            onFinish={handleAddAsset}
          >
            <Form.Item
              name="dormId"
              label="选择宿舍"
              rules={[{ required: true, message: '请选择宿舍' }]}
            >
              <Selector
                options={dorms.map(d => {
                  const community = communities.find(c => c._id === d.communityId);
                  return {
                    label: `${community?.name || '未知'} - ${d.building}栋`,
                    value: d._id,
                  };
                })}
              />
            </Form.Item>

            <Form.Item
              name="category"
              label="资材类别"
              rules={[{ required: true, message: '请选择类别' }]}
            >
              <Selector options={ASSET_CATEGORIES} />
            </Form.Item>

            <Form.Item
              name="brand"
              label="品牌"
            >
              <Input placeholder="请输入品牌" />
            </Form.Item>

            <Form.Item
              name="model"
              label="型号"
            >
              <Input placeholder="请输入型号" />
            </Form.Item>

            <Form.Item
              name="serialNo"
              label="序列号"
            >
              <Input placeholder="请输入序列号" />
            </Form.Item>

            <Form.Item
              name="warrantyYears"
              label="保修年限"
              rules={[{ required: true, message: '请输入保修年限' }]}
            >
              <Input type="number" placeholder="请输入保修年限" defaultValue="1" />
            </Form.Item>

            <Form.Item
              name="location"
              label="具体位置"
            >
              <Input placeholder="如：客厅、主卧等" />
            </Form.Item>
          </Form>
        }
        closeOnAction
        onClose={() => {
          setAddModalVisible(false);
          form.resetFields();
        }}
        actions={[
          {
            key: 'cancel',
            text: '取消',
          },
          {
            key: 'submit',
            text: '添加',
            primary: true,
            onClick: () => form.submit(),
          },
        ]}
      />
    </div>
  );
}
