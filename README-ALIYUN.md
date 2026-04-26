# 宿舍管理系统 - 阿里云部署手册

## 环境要求

- 阿里云 ECS（CentOS 7/8 或 Ubuntu 20.04+）
- 已安装 Docker 和 Docker Compose（若未安装见下方步骤）
- 服务器安全组开放端口：**80、443、3000（可选，Nginx已代理）**

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

## 五、数据备份

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
2. **更换 JWT 密钥**：修改 `.env` 中的 `JWT_SECRET` 和 `JWT_REFRESH_SECRET`
3. **关闭 3000 端口**：生产环境只开放 80/443，通过 Nginx 反向代理访问 API
4. **定期备份**：设置定时任务备份数据库和上传文件
5. **启用防火墙**：使用阿里云安全组限制访问来源

---

**部署完成！** 如有问题请联系开发团队。
