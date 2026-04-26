# 宿舍管理系统 - 阿里云部署手册

## 环境要求

- 阿里云 ECS（CentOS 7/8 或 Ubuntu 20.04+）
- Docker >= 20.10
- Docker Compose >= v2.0
- 浏览器：Chrome / Edge 最新版（员工端需移动端适配）
- 服务器安全组开放端口：**80、443、22（SSH，建议更换默认端口）**

---

## 一、服务器准备

### 1.1 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $(whoami)
newgrp docker
```

### 1.2 安装 Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 1.3 安装 Git（如未安装）

```bash
sudo yum install -y git   # CentOS
# 或
sudo apt-get install -y git  # Ubuntu
```

---

## 二、部署步骤

### 2.1 下载项目

```bash
cd /opt
rm -rf dorm-management  # 清除旧版本（首次部署可跳过）
git clone https://github.com/eriteostinet/dorm-management.git
cd dorm-management
```

### 2.2 配置环境变量

```bash
cp .env.example .env
nano .env
```

**必须修改的值：**

| 变量 | 说明 | 示例 |
|------|------|------|
| `POSTGRES_PASSWORD` | 数据库密码 | `YourStrongPassword123` |
| `JWT_SECRET` | JWT签名密钥（≥32位随机字符串） | `abcd1234...` |
| `JWT_REFRESH_SECRET` | JWT刷新密钥（≥32位随机字符串） | `efgh5678...` |
| `FRONTEND_URL` | 前端访问地址 | `http://8.163.105.42` 或你的域名 |

**如果使用阿里云 RDS PostgreSQL：**
将 `DATABASE_URL` 改为 RDS 连接串：
```
DATABASE_URL="postgresql://user:password@your-rds-endpoint.rds.aliyuncs.com:5432/dorm_management?schema=public"
```
同时注释掉 docker-compose.yml 中的 `db` 服务。

### 2.3 启动服务

```bash
docker-compose up -d --build
```

等待 3-5 分钟，首次启动会自动执行：
1. 数据库迁移（`prisma migrate deploy`）
2. 种子数据插入（`prisma db seed`）
3. 后端服务启动
4. Nginx 前端服务启动

### 2.4 验证部署

```bash
# 查看所有容器状态
docker-compose ps

# 查看后端日志
docker-compose logs -f backend

# 测试健康检查端点
curl http://localhost:3000/api/health
```

**访问系统：**
- 前端：`http://your-server-ip`
- 后端 API：`http://your-server-ip/api`

---

## 三、默认账号

| 角色 | 账号 | 密码 | 说明 |
|------|------|------|------|
| 管理员 | `admin` | `admin123` | 首次登录需修改密码 |
| 员工 | `E001` | `123456` | |
| 维修工 | `M001` | `123456` | |

---

## 四、HTTPS 配置（可选）

### 方式一：使用 acme.sh 自动证书

```bash
# 安装 acme.sh
curl https://get.acme.sh | sh
~/.acme.sh/acme.sh --install-cronjob

# 申请证书（替换为你的域名）
~/.acme.sh/acme.sh --issue -d your-domain.com --nginx

# 复制证书到项目目录
mkdir -p /opt/dorm-management/ssl
~/.acme.sh/acme.sh --install-cert -d your-domain.com \
  --key-file /opt/dorm-management/ssl/key.pem \
  --fullchain-file /opt/dorm-management/ssl/cert.pem

# 重启 Nginx
docker-compose restart frontend
```

### 方式二：手动上传证书

将 `cert.pem` 和 `key.pem` 放到 `/opt/dorm-management/ssl/` 目录，然后重启：

```bash
docker-compose restart frontend
```

---

## 九、数据备份

### 9.1 自动备份脚本

创建备份脚本 `/opt/dorm-management/backup.sh`：

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/dorm-management"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 备份数据库
docker exec dorm-db pg_dump -U postgres dorm_management > $BACKUP_DIR/db_$DATE.sql

# 备份上传文件
tar czf $BACKUP_DIR/uploads_$DATE.tar.gz -C /opt/dorm-management backend/uploads/

# 保留最近 7 天的备份
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "备份完成: $DATE"
```

添加执行权限并配置定时任务：

```bash
chmod +x /opt/dorm-management/backup.sh
# 每天凌晨 2 点自动备份
echo "0 2 * * * /opt/dorm-management/backup.sh >> /var/log/dorm-backup.log 2>&1" | sudo crontab -
```

### 9.2 手动备份

```bash
# 数据库
docker exec dorm-db pg_dump -U postgres dorm_management > backup_$(date +%Y%m%d).sql

# 上传文件
tar czvf uploads_backup_$(date +%Y%m%d).tar.gz -C /opt/dorm-management backend/uploads/
```

### 9.3 数据恢复

```bash
# 停止服务
cd /opt/dorm-management && docker-compose down

# 恢复数据库
docker exec -i dorm-db psql -U postgres -d dorm_management < backup_20260426.sql

# 恢复上传文件
tar xzvf uploads_backup_20260426.tar.gz -C /opt/dorm-management

# 重启服务
docker-compose up -d
```

---

## 十、系统升级

### 10.1 升级步骤

```bash
cd /opt/dorm-management

# 1. 备份数据
./backup.sh

# 2. 拉取最新代码
git pull origin main

# 3. 重新构建并启动
docker-compose down
docker-compose up -d --build

# 4. 查看日志确认正常
docker-compose logs -f backend
```

### 10.2 重置管理员密码

如果忘记 admin 密码，进入后端容器执行：

```bash
# 进入后端容器
docker exec -it dorm-backend sh

# 执行密码重置脚本
npx tsx -e "
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
const hash = await bcrypt.hash('admin123', 12);
await prisma.user.update({ where: { username: 'admin' }, data: { passwordHash: hash, isFirstLogin: true } });
console.log('密码已重置为 admin123');
await prisma.\$disconnect();
"
```

---

### 5.1 数据库备份（容器内 PostgreSQL）

```bash
# 进入数据库容器
docker exec -it dorm-db pg_dump -U postgres dorm_management > backup_$(date +%Y%m%d).sql
```

### 5.2 上传文件备份

```bash
# 备份上传目录
tar czvf uploads_backup_$(date +%Y%m%d).tar.gz -C /opt/dorm-management backend/uploads/
```

---

## 六、常见问题

### Q1: `docker-compose: command not found`

**解决：** 按 1.2 步骤安装 Docker Compose，或尝试 `docker compose`（新版 Docker 内置）。

### Q2: 端口冲突（80/443 被占用）

**解决：** 修改 `docker-compose.yml` 中的端口映射，例如 `8080:80`，然后访问 `http://your-ip:8080`。

### Q3: 数据库连接失败

**检查：**
```bash
docker-compose logs db
```
确保 `.env` 中的 `POSTGRES_PASSWORD` 和 `DATABASE_URL` 一致。

### Q4: 前端访问白屏

**检查：**
```bash
docker-compose logs frontend
```
确认 Nginx 配置正确，且 `dist` 目录存在。

### Q5: 文件上传失败

**检查：**
```bash
docker-compose exec backend ls -la uploads/
```
确保 `backend_uploads` volume 已正确挂载。

### Q6: 首次登录后要求改密码

**正常行为：** 管理员账号 `admin` 首次登录会提示修改密码，请按提示操作。

---

## 七、服务架构

```
┌─────────────┐
│   用户浏览器   │
└──────┬──────┘
       │ 80/443
       ▼
┌─────────────┐     ┌─────────────┐
│   Nginx     │────▶│  前端静态文件  │
│  (frontend) │     │  (React SPA)  │
└──────┬──────┘     └─────────────┘
       │ /api
       ▼
┌─────────────┐     ┌─────────────┐
│   Express   │────▶│  PostgreSQL  │
│  (backend)  │     │    (db)     │
└─────────────┘     └─────────────┘
```

---

## 八、更新部署

```bash
cd /opt/dorm-management
git pull origin main
docker-compose up -d --build
```

---

## 九、安全建议

1. **立即修改默认密码**：首次登录后修改 `admin` 密码
2. **更换 JWT 密钥**：修改 `.env` 中的 `JWT_SECRET` 和 `JWT_REFRESH_SECRET`（至少 32 位随机字符串）
3. **数据库密码**：使用强密码，避免使用 `postgres` 等默认值
4. **关闭 3000 端口**：生产环境只开放 80/443/22，通过 Nginx 反向代理访问 API
5. **更换 SSH 默认端口**：建议将 SSH 端口从 22 改为其他端口（如 2222），并在安全组中配置
6. **定期备份**：已配置 crontab 自动备份，备份文件保存在 `/opt/backups/dorm-management/`
7. **启用防火墙**：使用阿里云安全组限制访问来源，仅允许必要 IP 访问 SSH
8. ** fail2ban**：建议安装 fail2ban 防止暴力破解 SSH

---

**部署完成！** 如有问题请联系开发团队。
