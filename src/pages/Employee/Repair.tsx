import { useState, useEffect } from 'react';
import { Form, Button, Selector, ImageUploader, Toast, NavBar, TextArea } from 'antd-mobile';
import { getCommunities, getDorms, createRepairTicket, getEmployeeById } from '../../services/dataService';
import { auth } from '../../utils/auth';
import './Repair.css';

interface RepairProps {
  onBack: () => void;
}

const categories = [
  { label: '床', value: '床' },
  { label: '桌', value: '桌' },
  { label: '椅', value: '椅' },
  { label: '热水器', value: '热水器' },
  { label: '空调', value: '空调' },
  { label: '水电', value: '水电' },
  { label: '门窗', value: '门窗' },
  { label: '墙面', value: '墙面' },
];

const subCategories: Record<string, string[]> = {
  '床': ['床板断裂', '床脚松动', '床垫损坏'],
  '桌': ['桌面破损', '抽屉卡住', '桌腿松动'],
  '椅': ['椅面破损', '椅脚松动', '气压杆故障'],
  '热水器': ['不出热水', '漏水', '指示灯不亮'],
  '空调': ['不制冷', '不制热', '漏水', '异响'],
  '水电': ['灯不亮', '插座没电', '水龙头漏水', '下水道堵塞'],
  '门窗': ['门锁损坏', '门把手松动', '窗户关不上'],
  '墙面': ['墙面渗水', '墙皮脱落', '墙纸破损'],
};

const urgencyOptions = [
  { label: '紧急', value: 'urgent' },
  { label: '一般', value: 'normal' },
  { label: '低', value: 'low' },
];

export default function Repair({ onBack }: RepairProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [communities, setCommunities] = useState<any[]>([]);
  const [dorms, setDorms] = useState<any[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const [commList, dormList] = await Promise.all([
      getCommunities(),
      getDorms(),
    ]);
    setCommunities(commList);
    setDorms(dormList);
  };

  const handleCommunityChange = async (val: string[]) => {
    const communityId = val[0];
    const dormList = await getDorms(communityId);
    setDorms(dormList);
    form.setFieldsValue({ dormId: [], roomId: [] });
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    const userId = auth.getUserId();
    
    if (!userId) {
      Toast.show({ icon: 'fail', content: '请先登录' });
      setLoading(false);
      return;
    }
    
    try {
      // 获取当前员工信息
      const employee = await getEmployeeById(userId);
      if (!employee) {
        Toast.show({ icon: 'fail', content: '获取员工信息失败' });
        setLoading(false);
        return;
      }
      
      const ticketData: any = {
        ticketType: values.ticketType[0],
        communityId: values.communityId[0],
        dormId: values.dormId[0],
        roomId: values.roomId?.[0] || null,
        reporterId: userId,
        reporterName: employee.name,
        category: values.category[0],
        subCategory: values.subCategory[0],
        description: values.description,
        images: values.images?.map((img: any) => img.url) || [],
        urgency: values.urgency[0],
      };
      const ticket = await createRepairTicket(ticketData);
      
      Toast.show({ icon: 'success', content: `提交成功，工单号：${ticket._id}` });
      onBack();
    } catch (error) {
      Toast.show({ icon: 'fail', content: '提交失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <NavBar onBack={onBack}>提交报修</NavBar>
      
      <Form
        form={form}
        onFinish={handleSubmit}
        layout="horizontal"
        className="repair-form"
        footer={
          <Button block type="submit" color="primary" loading={loading} size="large">
            提交报修
          </Button>
        }
      >
        <Form.Item name="ticketType" label="报修类型" rules={[{ required: true }]}>
          <Selector
            options={[{ label: '资产维修', value: 'asset' }, { label: '设施保修', value: 'facility' }]}
          />
        </Form.Item>
        
        <Form.Item name="communityId" label="选择小区" rules={[{ required: true }]}>
          <Selector
            options={communities.map(c => ({ label: c.name, value: c._id }))}
            onChange={handleCommunityChange}
          />
        </Form.Item>
        
        <Form.Item name="dormId" label="选择宿舍" rules={[{ required: true }]}>
          <Selector
            options={dorms.map(d => ({ label: d._id, value: d._id }))}
          />
        </Form.Item>
        
        <Form.Item name="category" label="故障类别" rules={[{ required: true }]}>
          <Selector
            options={categories}
            onChange={(val) => setCategory(val[0])}
          />
        </Form.Item>
        
        {category && (
          <Form.Item name="subCategory" label="具体故障" rules={[{ required: true }]}>
            <Selector
              options={subCategories[category]?.map(s => ({ label: s, value: s })) || []}
            />
          </Form.Item>
        )}
        
        <Form.Item name="description" label="详细描述" rules={[{ required: true }]}>
          <TextArea
            placeholder="请详细描述故障情况（至少10字）"
            rows={4}
            showCount
            maxLength={200}
          />
        </Form.Item>
        
        <Form.Item name="urgency" label="紧急程度" rules={[{ required: true }]}>
          <Selector options={urgencyOptions} />
        </Form.Item>
        
        <Form.Item name="images" label="上传照片">
          <ImageUploader
            upload={(file) => {
              return Promise.resolve({ url: URL.createObjectURL(file) });
            }}
            multiple
            maxCount={3}
          />
        </Form.Item>
      </Form>
    </div>
  );
}
