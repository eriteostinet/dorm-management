import { useState } from 'react';
import { Form, Button, Toast } from 'antd-mobile';
import { UserOutline, LockOutline } from 'antd-mobile-icons';
import { api } from '../../api/client';
import { auth } from '../../utils/auth';
import './Login.css';

interface LoginProps {
  onLogin: (role: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { employeeId: string; password: string }) => {
    setLoading(true);
    try {
      const result = await api.login(values.employeeId, values.password);
      auth.setAuth(result.token, result.user);
      Toast.show({ icon: 'success', content: '登录成功' });
      onLogin(result.user.role);
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '登录失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-header">
        <h1>企业员工宿舍管理系统</h1>
        <p>Dormitory Management System</p>
      </div>
      
      <div className="login-form">
        <Form
          form={form}
          onFinish={handleSubmit}
          footer={
            <Button
              block
              type="submit"
              color="primary"
              size="large"
              loading={loading}
            >
              登录
            </Button>
          }
        >
          <Form.Item
            name="employeeId"
            rules={[{ required: true, message: '请输入工号' }]}
          >
            <div className="input-wrapper">
              <UserOutline className="input-icon" />
              <input
                className="custom-input"
                placeholder="工号 (试: admin/E001)"
              />
            </div>
          </Form.Item>
          
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <div className="input-wrapper">
              <LockOutline className="input-icon" />
              <input
                className="custom-input"
                type="password"
                placeholder="密码 (试: admin123/123456)"
              />
            </div>
          </Form.Item>
        </Form>
        
        <div className="login-tips">
          <p>测试账号：</p>
          <p>管理员：admin / admin123</p>
          <p>员工：E001 / 123456</p>
          <p>维修工：M001 / 123456</p>
        </div>
      </div>
    </div>
  );
}
