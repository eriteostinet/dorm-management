# 宿舍管理系统 - 部署检查清单

## 已完成的重构工作

### ✅ 后端基础设施
- [x] Express + TypeScript 服务器
- [x] Prisma ORM + PostgreSQL 数据库
- [x] JWT 认证（access + refresh token）
- [x] bcrypt 密码哈希
- [x] 角色权限中间件（ADMIN/STAFF/MAINTENANCE）
- [x] 错误处理中间件
- [x] CORS + Helmet 安全
- [x] WebSocket (Socket.io) 实时通知
- [x] 文件上传支持

### ✅ 后端 API 路由
- [x] POST /api/auth/login - 登录
- [x] POST /api/auth/register - 注册（管理员）
- [x] GET /api/auth/me - 当前用户
- [x] POST /api/auth/change-password - 修改密码
- [x] POST /api/auth/refresh - 刷新令牌
- [x] GET /api/users - 用户列表
- [x] GET/POST/PATCH/DELETE /api/users/:id - CRUD
- [x] GET /api/communities - 小区列表
- [x] GET/POST/PATCH/DELETE /api/communities/:id - CRUD
- [x] GET /api/buildings - 楼栋列表
- [x] GET/POST/PATCH/DELETE /api/buildings/:id - CRUD
- [x] GET /api/rooms - 房间列表
- [x] POST /api/rooms/:id/checkin - 入住
- [x] POST /api/rooms/:id/checkout - 退房
- [x] POST /api/rooms/:id/transfer - 调房
- [x] GET /api/tickets - 工单列表
- [x] POST /api/tickets/:id/approve - 审批
- [x] POST /api/tickets/:id/start - 开始处理
- [x] POST /api/tickets/:id/complete - 完成
- [x] POST /api/tickets/:id/confirm - 验收
- [x] GET /api/payments - 账单列表
- [x] POST /api/payments/batch - 批量创建
- [x] POST /api/payments/:id/pay - 标记缴费
- [x] GET /api/assets - 资产列表
- [x] GET /api/dashboard - 看板数据
- [x] GET /api/export/* - Excel 导出

### ✅ 数据库模型
- [x] User（用户）
- [x] Community（小区）
- [x] Building（楼栋）
- [x] Room（房间）
- [x] Asset（资产）
- [x] RepairTicket（维修工单）
- [x] Payment（缴费账单）

### ✅ Docker 配置
- [x] docker-compose.yml（PostgreSQL + 后端 + 前端 + Nginx）
- [x] backend/Dockerfile
- [x] Dockerfile.frontend
- [x] nginx.conf

### ✅ 种子数据
- [x] 默认管理员 admin/admin123
- [x] 员工 E001, E002 / 123456
- [x] 维修工 M001 / 123456
- [x] 示例小区、楼栋、房间
- [x] 入住记录
- [x] 资产台账
- [x] 维修工单
- [x] 缴费账单

### ✅ 前端适配
- [x] API Client 已配置
- [x] Vite 代理配置
- [x] 生产环境 .env

## 待测试项
- [ ] npm install 后端依赖
- [ ] npm run build 后端
- [ ] npm run build 前端
- [ ] Docker Compose 启动
- [ ] 数据库迁移
- [ ] 种子数据导入
- [ ] 登录测试
- [ ] 各功能模块测试
- [ ] 部署到阿里云

## 部署步骤
1. 提交代码到 GitHub
2. 在服务器上克隆代码
3. 安装 Docker 和 Docker Compose
4. 运行 docker-compose up -d
5. 等待服务启动
6. 访问 http://服务器IP

## 已知问题
1. OpenClaw 审批限制导致无法直接执行构建/部署命令
2. 需要用户手动在服务器上执行 Docker 命令或在 GitHub Actions 中配置

## 建议
1. 使用 GitHub Actions 自动部署（配置 Secrets 后）
2. 或手动在阿里云 Workbench 执行 docker-compose up -d
