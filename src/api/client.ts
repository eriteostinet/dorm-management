const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        ...headers,
        ...(options?.headers as Record<string, string> || {}),
      },
    });

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('登录已过期，请重新登录');
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `请求失败: ${res.status}`);
    }

    return data;
  }

  // Public raw request method for non-standard API calls
  public async rawRequest<T>(url: string, options?: RequestInit): Promise<T> {
    return this.request<T>(url, options);
  }

  // ========== 认证 ==========
  login = (username: string, password: string) =>
    this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

  register = (data: any) =>
    this.request<{ success: boolean; userId: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  getMe = () =>
    this.request<any>('/auth/me');

  changePassword = (oldPassword: string, newPassword: string) =>
    this.request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });

  // ========== 用户 ==========
  getUsers = () =>
    this.request<any[]>('/users');

  getUser = (id: string) =>
    this.request<any>(`/users/${id}`);

  updateUser = (id: string, data: any) =>
    this.request<any>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

  deleteUser = (id: string) =>
    this.request<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' });

  // ========== 小区 ==========
  getCommunities = () =>
    this.request<any[]>('/communities');

  createCommunity = (data: any) =>
    this.request<any>('/communities', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  updateCommunity = (id: string, data: any) =>
    this.request<any>(`/communities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

  deleteCommunity = (id: string) =>
    this.request<{ success: boolean }>(`/communities/${id}`, { method: 'DELETE' });

  // ========== 楼栋（buildings）=========
  getDorms = (communityId?: string) => {
    const query = communityId ? `?communityId=${communityId}` : '';
    return this.request<any[]>(`/buildings${query}`);
  };

  createDorm = (data: any) =>
    this.request<any>('/buildings', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  deleteDorm = (id: string) =>
    this.request<{ success: boolean }>(`/buildings/${id}`, { method: 'DELETE' });

  // ========== 房间 ==========
  getRooms = (params?: { communityId?: string; dormId?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.communityId) search.append('communityId', params.communityId);
    if (params?.dormId) search.append('dormId', params.dormId);
    if (params?.status) search.append('status', params.status);
    const query = search.toString() ? `?${search.toString()}` : '';
    return this.request<any[]>(`/rooms${query}`);
  };

  getRoom = (id: string) =>
    this.request<any>(`/rooms/${id}`);

  createRoom = (data: any) =>
    this.request<any>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  checkIn = (roomId: string, occupantId: string) =>
    this.request<any>(`/rooms/${roomId}/checkin`, {
      method: 'POST',
      body: JSON.stringify({ occupantId }),
    });

  checkOut = (roomId: string) =>
    this.request<any>(`/rooms/${roomId}/checkout`, { method: 'POST' });

  transferRoom = (roomId: string, newRoomId: string, occupantId: string) =>
    this.request<any>(`/rooms/${roomId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ newRoomId, occupantId }),
    });

  deleteRoom = (id: string) =>
    this.request<{ success: boolean }>(`/rooms/${id}`, { method: 'DELETE' });

  // ========== 报修 ==========
  getTickets = (params?: { status?: string; reporterId?: string }) => {
    const search = new URLSearchParams();
    if (params?.status) search.append('status', params.status);
    if (params?.reporterId) search.append('reporterId', params.reporterId);
    const query = search.toString() ? `?${search.toString()}` : '';
    return this.request<any[]>(`/tickets${query}`);
  };

  getTicket = (id: string) =>
    this.request<any>(`/tickets/${id}`);

  createTicket = (data: any) =>
    this.request<any>('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  updateTicket = (id: string, data: any) =>
    this.request<any>(`/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

  confirmTicket = (id: string, data?: { rating?: number; comment?: string; confirmStatus?: string }) =>
    this.request<any>(`/tickets/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });

  deleteTicket = (id: string) =>
    this.request<{ success: boolean }>(`/tickets/${id}`, { method: 'DELETE' });

  // ========== 缴费 ==========
  getPayments = (params?: { communityId?: string; roomId?: string; type?: string; status?: string; period?: string }) => {
    const search = new URLSearchParams();
    if (params?.communityId) search.append('communityId', params.communityId);
    if (params?.roomId) search.append('roomId', params.roomId);
    if (params?.type) search.append('type', params.type);
    if (params?.status) search.append('status', params.status);
    if (params?.period) search.append('period', params.period);
    const query = search.toString() ? `?${search.toString()}` : '';
    return this.request<any[]>(`/payments${query}`);
  };

  createPayment = (data: any) =>
    this.request<any>('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  payPayment = (id: string, data: { paymentMethod: string; paidBy?: string }) =>
    this.request<any>(`/payments/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

  updatePayment = (id: string, data: any) =>
    this.request<any>(`/payments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

  deletePayment = (id: string) =>
    this.request<{ success: boolean }>(`/payments/${id}`, { method: 'DELETE' });

  getPaymentStats = (params?: { communityId?: string; period?: string }) => {
    const search = new URLSearchParams();
    if (params?.communityId) search.append('communityId', params.communityId);
    if (params?.period) search.append('period', params.period);
    const query = search.toString() ? `?${search.toString()}` : '';
    return this.request<any>(`/payments/stats/overview${query}`);
  };
}

export const api = new ApiClient();
