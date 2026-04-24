// 前端认证工具 - JWT Token 版本
// 替代原来的 mock 登录，对接后端真实认证

interface UserInfo {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  department?: string;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export const auth = {
  // 获取 token
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  // 保存登录信息
  setAuth(token: string, user: UserInfo): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
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

  // 获取员工ID
  getEmployeeId(): string | null {
    return this.getCurrentUser()?.employeeId || null;
  },

  // 获取角色
  getRole(): string | null {
    return this.getCurrentUser()?.role || null;
  },
};
