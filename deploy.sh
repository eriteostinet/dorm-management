#!/bin/bash
set -e

# ============================================================
# 宿舍管理系统 - 阿里云一键部署脚本
# 用法: curl -fsSL https://raw.githubusercontent.com/eriteostinet/dorm-management/main/deploy.sh | bash
# 或下载后: chmod +x deploy.sh && ./deploy.sh
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

APP_NAME="宿舍管理系统"
REPO_URL="https://github.com/eriteostinet/dorm-management.git"
INSTALL_DIR="/opt/dorm-management"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  ${APP_NAME} - 一键部署脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# --------------------------------------------------------
# 1. 检查是否为 root
# --------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}⚠️  建议使用 root 权限运行，或确保当前用户有 docker 权限${NC}"
fi

# --------------------------------------------------------
# 2. 检查并安装 Docker
# --------------------------------------------------------
echo -e "${BLUE}[1/7] 检查 Docker 环境...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker 未安装，正在安装...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}✓ Docker 安装完成${NC}"
else
    echo -e "${GREEN}✓ Docker 已安装 ($(docker --version | cut -d' ' -f3 | cut -d',' -f1))${NC}"
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
    echo -e "${YELLOW}Docker Compose 未安装，正在安装...${NC}"
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓ Docker Compose 安装完成${NC}"
else
    if command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}✓ Docker Compose 已安装 ($(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1))${NC}"
    else
        echo -e "${GREEN}✓ Docker Compose (plugin) 已安装${NC}"
    fi
fi

# --------------------------------------------------------
# 3. 克隆/更新代码
# --------------------------------------------------------
echo ""
echo -e "${BLUE}[2/7] 获取代码...${NC}"

if [ -d "$INSTALL_DIR/.git" ]; then
    echo "检测到已有安装，正在更新..."
    cd "$INSTALL_DIR"
    git fetch origin
    git reset --hard origin/main
    echo -e "${GREEN}✓ 代码已更新${NC}"
else
    echo "首次安装，正在克隆代码..."
    rm -rf "$INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    echo -e "${GREEN}✓ 代码已克隆到 $INSTALL_DIR${NC}"
fi

# --------------------------------------------------------
# 4. 配置环境变量
# --------------------------------------------------------
echo ""
echo -e "${BLUE}[3/7] 配置环境变量...${NC}"

if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env 已存在，跳过配置（如需重新配置请删除 .env 后重运行）${NC}"
else
    # 生成随机密钥
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | tr -d '\n')
    JWT_REFRESH_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | tr -d '\n')
    DB_PASSWORD=$(openssl rand -base64 24 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '=+/')
    
    # 获取服务器公网 IP
    PUBLIC_IP=$(curl -s -4 http://icanhazip.com 2>/dev/null || curl -s -4 http://ifconfig.me 2>/dev/null || echo "localhost")
    
    cat > .env << EOF
# ============================================
# 宿舍管理系统 - 生产环境配置
# 自动生成于 $(date '+%Y-%m-%d %H:%M:%S')
# ============================================

# 数据库（PostgreSQL）
DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@db:5432/dorm_management?schema=public"
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=dorm_management

# JWT 密钥（自动生成，请勿泄露）
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# 服务器配置
PORT=3000
NODE_ENV=production

# 前端地址（自动检测为你的公网IP，如有域名请修改）
FRONTEND_URL=http://${PUBLIC_IP}

# 文件上传配置
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# 阿里云 OSS（可选）
OSS_REGION=
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET=
OSS_ENDPOINT=
EOF

    echo -e "${GREEN}✓ 环境变量已生成${NC}"
    echo -e "  数据库密码: ${YELLOW}${DB_PASSWORD}${NC}"
    echo -e "  公网IP地址: ${YELLOW}${PUBLIC_IP}${NC}"
fi

# --------------------------------------------------------
# 5. 启动服务
# --------------------------------------------------------
echo ""
echo -e "${BLUE}[4/7] 启动服务...${NC}"

# 停止旧容器（如果存在）
docker-compose down 2>/dev/null || true

# 构建并启动
docker-compose up -d --build

echo -e "${GREEN}✓ 容器已启动${NC}"

# --------------------------------------------------------
# 6. 等待服务就绪
# --------------------------------------------------------
echo ""
echo -e "${BLUE}[5/7] 等待服务就绪（约 30 秒）...${NC}"

for i in {1..30}; do
    if curl -s http://localhost:3000/api/health | grep -q '"status":"ok"'; then
        echo ""
        echo -e "${GREEN}✓ 后端服务就绪${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# 最终健康检查
if ! curl -s http://localhost:3000/api/health | grep -q '"status":"ok"'; then
    echo ""
    echo -e "${RED}✗ 后端服务未能正常启动，请检查日志:${NC}"
    echo -e "  docker-compose logs backend"
    exit 1
fi

# --------------------------------------------------------
# 7. 显示部署结果
# --------------------------------------------------------
echo ""
echo -e "${BLUE}[6/7] 部署完成！${NC}"
echo ""

PUBLIC_IP=$(grep FRONTEND_URL .env | cut -d'=' -f2 | sed 's/http:\/\///')

cat << EOF
${GREEN}========================================${NC}
${GREEN}  🎉 ${APP_NAME} 部署成功！${NC}
${GREEN}========================================${NC}

📍 访问地址:
   管理员后台: ${YELLOW}http://${PUBLIC_IP}${NC}
   健康检查:   ${YELLOW}http://${PUBLIC_IP}/api/health${NC}

🔑 默认账号:
   管理员:  admin / admin123
   员工:    查看数据库种子数据

📁 安装目录: ${YELLOW}${INSTALL_DIR}${NC}

🛠️  常用命令:
   查看日志:     cd ${INSTALL_DIR} && docker-compose logs -f
   重启服务:     cd ${INSTALL_DIR} && docker-compose restart
   停止服务:     cd ${INSTALL_DIR} && docker-compose down
   更新代码:     cd ${INSTALL_DIR} && git pull && docker-compose up -d --build

⚠️  安全提示:
   1. 请尽快修改默认管理员密码
   2. 生产环境建议配置 HTTPS（将证书放入 ssl/ 目录并修改 nginx.conf）
   3. 数据库密码和 JWT 密钥保存在 ${YELLOW}${INSTALL_DIR}/.env${NC}

EOF

# --------------------------------------------------------
# 8. 可选：配置防火墙
# --------------------------------------------------------
echo -e "${BLUE}[7/7] 检查防火墙配置...${NC}"

if command -v firewall-cmd &> /dev/null; then
    # CentOS/Firewalld
    if ! firewall-cmd --list-ports | grep -q "80/tcp"; then
        echo "开放 80 端口..."
        firewall-cmd --permanent --add-port=80/tcp
        firewall-cmd --reload
        echo -e "${GREEN}✓ Firewalld 已开放 80 端口${NC}"
    fi
elif command -v ufw &> /dev/null; then
    # Ubuntu/UFW
    if ! ufw status | grep -q "80/tcp"; then
        echo "开放 80 端口..."
        ufw allow 80/tcp
        echo -e "${GREEN}✓ UFW 已开放 80 端口${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  未检测到防火墙，请手动确认 80 端口已开放${NC}"
fi

echo ""
echo -e "${GREEN}🚀 部署完成！请访问 http://${PUBLIC_IP} 开始使用${NC}"
