# 宿舍管理系统 - 部署指南

## 当前状态

### ✅ 已完成
- **后端** (Node.js + Express + TypeScript + Prisma + PostgreSQL)
  - 完整 REST API（认证、小区、楼栋、房间、员工、工单、缴费、资产、看板、导出）
  - JWT 认证（access + refresh token）
  - 角色权限控制（ADMIN/STAFF/MAINTENANCE）
  - WebSocket 实时通知
  - Docker Compose 一键部署配置
  - 种子数据（默认账号）

- **前端适配页面**
  - Login.tsx ✅
  - Dashboard.tsx ✅
  - Communities.tsx ✅
  - Dorms.tsx ✅（入住/退房/批量操作）
  - Employees.tsx ✅（列表/新增）
  - Repairs.tsx ✅（管理员端工单处理）
  - Assets.tsx ✅（简化版台账）
  - Employee/Home.tsx ✅
  - Employee/Repair.tsx ✅
  - Employee/Tickets.tsx ✅（验收）
  - Employee/Profile.tsx ✅

### ⚠️ 待完善
- Payments.tsx（已用 services，可能有字段映射问题）
- Exports.tsx
- DataManage.tsx
- OccupancyMap.tsx
- Analytics.tsx
- ExcelImport.tsx

## 部署方式

### 方式一：阿里云 Workbench 手动部署（最快）

在阿里云 Workbench 中连接服务器 `8.163.105.42`，然后执行：

```bash
# 1. 安装 Docker（如未安装）
curl -fsSL https://get.docker.com | sh

# 2. 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. 克隆代码
cd /opt
git clone https://github.com/eriteostinet/dorm-management.git
cd dorm-management

# 4. 启动所有服务
docker-compose up -d

# 5. 查看日志
docker-compose logs -f backend
```

等待约 30 秒后，访问 `http://8.163.105.42` 即可使用。

**默认账号：**
- 管理员：admin / admin123（首次登录需改密码）
- 员工：E001 / 123456
- 维修工：M001 / 123456

### 方式二：GitHub Actions 自动部署

1. 在 GitHub 仓库 Settings > Secrets > Actions 中添加：
   - `SERVER_IP` = `8.163.105.42`
   - `SERVER_USER` = `root`
   - `SSH_PRIVATE_KEY` = 服务器私钥（执行 `cat ~/.ssh/id_rsa` 获取）

2. 每次 push 到 main 分支会自动部署

### 方式三：前端单独部署

如果只需要更新前端：

```bash
cd /root/.openclaw/workspace/dorm-management
npm run build
# 将 dist/ 目录上传到服务器的 /usr/share/nginx/html/
```

## 前端构建

```bash
cd /root/.openclaw/workspace/dorm-management
npm install
npm run build
```

## 后端本地开发

```bash
cd /root/.openclaw/workspace/dorm-management/backend
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev
```

## 环境变量

### 后端 (.env)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dorm_management
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
PORT=3000
```

### 前端 (.env)
```
VITE_API_URL=/api
```

## API 地址

- 前端: http://localhost:80
- 后端 API: http://localhost:3000
- API 路径前缀: /api

## 已知问题

1. 部分页面（缴费、导出、数据管理、地图、分析、Excel导入）可能有字段映射问题
2. 前端状态值已全部改为大写（VACANT/OCCUPIED/PENDING/PROCESSING/DONE/CONFIRMED）
3. `_id` 已统一改为 `id`

## 下一步

1. 部署并测试核心功能
2. 修复剩余页面的字段映射
3. 添加 HTTPS / 域名绑定
4. 设置定时数据库备份
