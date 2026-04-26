import { io, Socket } from 'socket.io-client';
import { auth } from '../utils/auth';

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export function connectSocket() {
  if (socket?.connected) return socket;

  const token = auth.getToken();
  if (!token) return null;

  socket = io(window.location.origin, {
    path: '/socket.io',
    auth: { token },
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('WebSocket 已连接');
    reconnectAttempts = 0;
    
    // 加入用户专属房间
    const userId = auth.getUserId();
    if (userId) {
      socket?.emit('join', userId);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('WebSocket 断开:', reason);
    if (reason === 'io server disconnect') {
      // 服务器主动断开，需要手动重连
      setTimeout(() => socket?.connect(), 1000);
    }
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket 连接错误:', error);
    reconnectAttempts++;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('WebSocket 重连次数过多，停止重连');
      socket?.disconnect();
    }
  });

  // 监听各类通知
  socket.on('ticket:processing', (data) => {
    console.log('工单处理中:', data);
    // 可以在这里触发全局通知或刷新数据
  });

  socket.on('ticket:done', (data) => {
    console.log('工单已完成:', data);
  });

  socket.on('room:assigned', (data) => {
    console.log('房间分配:', data);
  });

  socket.on('room:released', (data) => {
    console.log('房间释放:', data);
  });

  socket.on('room:transferred', (data) => {
    console.log('房间调房:', data);
  });

  socket.on('payment:paid', (data) => {
    console.log('缴费成功:', data);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

export function isConnected() {
  return socket?.connected || false;
}
