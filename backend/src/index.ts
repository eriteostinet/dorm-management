import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import { errorHandler } from './middleware/error';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/users';
import { communityRouter } from './routes/communities';
import { buildingRouter } from './routes/buildings';
import { roomRouter } from './routes/rooms';
import { ticketRouter } from './routes/tickets';
import { paymentRouter } from './routes/payments';
import { assetRouter } from './routes/assets';
import { dashboardRouter } from './routes/dashboard';
import { exportRouter } from './routes/export';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/communities', communityRouter);
app.use('/api/buildings', buildingRouter);
app.use('/api/rooms', roomRouter);
app.use('/api/tickets', ticketRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/assets', assetRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/export', exportRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// WebSocket
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join', (userId: string) => {
    socket.join(`user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Export io for use in controllers
export { io };

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API文档: http://localhost:${PORT}/api/health`);
});
