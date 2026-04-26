# 宿舍管理系统 - 阿里云部署指南

## 快速开始（一键部署）

在阿里云 ECS 服务器上执行：

```bash
curl -fsSL https://raw.githubusercontent.com/eriteostinet/dorm-management/main/deploy.sh | sudo bash
```

或手动下载执行：

```bash
wget https://raw.githubusercontent.com/eriteostinet/dorm-management/main/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

部署完成后访问：`http://你的服务器IP`

---

## 手动部署步骤

### 1. 环境要求

- 阿里云 ECS（CentOS 7/8 或 Ubuntu 20.04+）
- 公网 IP
- 安全组开放 **80 端口**
- 内存建议 ≥ 2GB

### 2. 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $(whoami)
```

### 3. 克隆代码

```bash
git clone https://github.com/eriteostinet/dorm-management.git
cd dorm-management
```

### 4. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，修改以下关键配置：
# - POSTGRES_PASSWORD: 数据库强密码
# - JWT_SECRET: 至少32位随机字符串
# - FRONTEND_URL: 你的服务器IP或域名
```

### 5. 启动服务

```bash
docker-compose up -d
```

### 6. 查看日志

```bash
docker-compose logs -f
```

---

## 默认账号

| 角色 | 账号 | 密码 |
|------|------|------|
| 管理员 | admin | admin123 |
| 员工 | 见种子数据 | 123456 |

**⚠️ 首次登录后请立即修改默认密码！**

---

## 配置 HTTPS（可选）

1. 申请 SSL 证书（阿里云免费证书）
2. 将证书放入项目目录：
   ```
   ssl/
   ├── cert.pem
   └── key.pem
   ```
3. 取消 `nginx.conf` 和 `docker-compose.yml` 中 HTTPS 配置的注释
4. 重启：
   ```bash
   docker-compose restart frontend
   ```

---

## 常用命令

```bash
# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新代码并重新部署
git pull
docker-compose up -d --build

# 进入数据库
docker-compose exec db psql -U postgres -d dorm_management

# 备份数据库
docker-compose exec db pg_dump -U postgres dorm_management > backup.sql
```

---

## 更新代码

```bash
cd /opt/dorm-management  # 或你的安装目录
git pull
docker-compose up -d --build
```

---

## 问题排查

### 端口被占用

```bash
# 查看 80 端口占用
sudo lsof -i :80
# 或停止现有服务
sudo systemctl stop nginx
```

### 容器启动失败

```bash
# 查看详细日志
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db
```

### 数据库连接失败

```bash
# 检查数据库容器状态
docker-compose ps
# 手动运行迁移
docker-compose exec backend npx prisma db push
```

---

## 技术栈

- **前端**: React 19 + Vite + Tailwind CSS + Ant Design Mobile
- **后端**: Node.js + Express + Prisma + PostgreSQL
- **实时通信**: Socket.io
- **部署**: Docker + Docker Compose + Nginx

---

## 开源协议

MIT License
