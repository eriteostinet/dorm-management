// 前端认证工具 - JWT Token 版本
// 替代原来的 mock 登录，对接后端真实认证

import { api } from '../api/client';

interface UserInfo {
  id: string;
  username: string;
  realName?: string;
  name?: string; // 兼容旧代码
  role: string;
  department?: string;
  isFirstLogin?: boolean;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export const auth = {
  // 获取 token
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  // 保存登录信息
  setAuth(token: string, user: any): void {
    // 兼容后端返回的字段名
    const normalizedUser: UserInfo = {
      id: user.id || user._id,
      username: user.username || user.employeeId,
      realName: user.realName || user.name,
      name: user.realName || user.name,
      role: user.role,
      department: user.department,
      isFirstLogin: user.isFirstLogin,
    };
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
  },

  // 获取当前用户
  getCurrentUser(): UserInfo | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  // 登出
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/login';
  },

  // 是否已登录
  isLoggedIn(): boolean {
    return !!this.getToken();
  },

  // 是否是管理员
  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'ADMIN';
  },

  // 是否是超级管理员（兼容旧代码）
  isSuperAdmin(): boolean {
    return this.isAdmin();
  },

  // 获取当前用户ID
  getUserId(): string | null {
    return this.getCurrentUser()?.id || null;
  },

  // 获取员工ID（username 即工号）
  getEmployeeId(): string | null {
    const user = this.getCurrentUser();
    return user?.username || user?.id || null;
  },

  // 获取角色
  getRole(): string | null {
    return this.getCurrentUser()?.role || null;
  },

  // 刷新用户信息
  async refreshUserInfo(): Promise<boolean> {
    try {
      const user = await api.getMe();
      const token = this.getToken();
      if (token && user) {
        this.setAuth(token, user);
      }
      return true;
    } catch {
      return false;
    }
  },
};