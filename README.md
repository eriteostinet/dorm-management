# 宿舍管理系统 - Docker Compose 一键部署指南

## 项目简介

一套完整的宿舍管理 SaaS 平台，支持管理员端与员工端，覆盖入住、报修、缴费、资产等全流程管理。

## 快速启动

### 方式一：Docker Compose（推荐）

```bash
# 1. 克隆代码
git clone https://github.com/eriteostinet/dorm-management.git
cd dorm-management

# 2. 启动所有服务
docker-compose up -d

# 3. 等待服务启动（约30秒）
docker-compose logs -f backend

# 4. 访问系统
# 前端: http://localhost
# 后端 API: http://localhost/api
```

### 方式二：本地开发

**后端：**
```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev
```

**前端：**
```bash
# 在根目录
npm install
npm run dev
# 访问 http://localhost:5173
```

## 默认账号

| 角色 | 账号 | 密码 | 说明 |
|------|------|------|------|
| 管理员 | admin | admin123 | 首次登录强制修改密码 |
| 员工 | E001 | 123456 | |
| 员工 | E002 | 123456 | |
| 维修工 | M001 | 123456 | |

## 功能清单

### 管理员端
- 数据可视化看板（入住率、收缴率、工单统计）
- 小区与楼栋管理
- 房间管理（入住/退房/调房）
- 员工档案管理（支持 Excel 导入）
- 资产台账
- 维修工单全生命周期
- 缴费管理（账单生成、欠费追踪）
- 数据分析与导出
- 入住地图

### 员工端
- 在线报修
- 工单进度追踪
- 我的房间与缴费
- 个人中心

### 维修工端
- 工单处理
- 维修历史

## API 文档

| 模块 | 路径 | 权限 |
|------|------|------|
| 认证 | /api/auth/* | 公开 |
| 用户 | /api/users | ADMIN |
| 小区 | /api/communities | ADMIN/查询所有 |
| 楼栋 | /api/buildings | ADMIN/查询所有 |
| 房间 | /api/rooms | ADMIN/查询所有 |
| 工单 | /api/tickets | 按角色过滤 |
| 缴费 | /api/payments | 按角色过滤 |
| 资产 | /api/assets | ADMIN/查询所有 |
| 看板 | /api/dashboard | ADMIN |
| 导出 | /api/export/* | ADMIN |

## 技术栈

- **前端**: React 19 + TypeScript + Vite + Tailwind CSS + Recharts
- **后端**: Node.js + Express + TypeScript + Prisma + PostgreSQL
- **实时**: Socket.io
- **部署**: Docker Compose

## 环境变量

### 后端 (.env)
```
DATABASE_URL=postgresql://postgres:postgres@db:5432/dorm_management
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
PORT=3000
```

## 许可证

MIT