#!/bin/bash

# ============================================
# 宿舍管理系统 - 一键部署脚本
# 支持: Ubuntu / CentOS / Debian
# 作者: 贾维斯
# ============================================

set -e

echo "========================================"
echo "  宿舍管理系统 - 一键部署"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否root
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}请使用 root 权限运行此脚本${NC}"
   echo "命令: sudo bash deploy.sh"
   exit 1
fi

# 安装Node.js
install_node() {
    echo -e "${YELLOW}[1/5] 正在安装 Node.js...${NC}"
    
    if command -v node &> /dev/null; then
        echo "Node.js 已安装: $(node -v)"
        return
    fi
    
    # 检测系统类型
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    fi
    
    if [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        # CentOS/RHEL
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    else
        # Ubuntu/Debian
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
    
    echo -e "${GREEN}Node.js 安装完成: $(node -v)${NC}"
}

# 创建项目目录
setup_project() {
    echo -e "${YELLOW}[2/5] 正在设置项目...${NC}"
    
    INSTALL_DIR="/opt/dorm-management"
    mkdir -p $INSTALL_DIR
    cd $INSTALL_DIR
    
    echo "项目目录: $INSTALL_DIR"
}

# 安装serve
install_serve() {
    echo -e "${YELLOW}[3/5] 正在安装 Web 服务器...${NC}"
    
    npm install -g serve
    
    echo -e "${GREEN}Web 服务器安装完成${NC}"
}

# 创建启动脚本
create_startup() {
    echo -e "${YELLOW}[4/5] 正在创建启动脚本...${NC}"
    
    INSTALL_DIR="/opt/dorm-management"
    
    # 创建systemd服务
    cat > /etc/systemd/system/dorm-management.service << 'EOF'
[Unit]
Description=Dormitory Management System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dorm-management/dist
ExecStart=/usr/bin/serve -s . -l 80
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable dorm-management
    
    echo -e "${GREEN}启动脚本创建完成${NC}"
}

# 提示用户上传文件
upload_files() {
    echo ""
    echo -e "${YELLOW}[5/5] 等待上传项目文件...${NC}"
    echo ""
    echo "请按以下步骤操作:"
    echo ""
    echo "1. 在本地电脑执行以下命令上传文件:"
    echo -e "   ${GREEN}scp dorm-management-dist.tar.gz root@YOUR_SERVER_IP:/opt/dorm-management/${NC}"
    echo ""
    echo "2. 上传完成后，在此窗口按回车键继续..."
    read -r
    
    # 检查文件是否存在
    if [ ! -f "/opt/dorm-management/dorm-management-dist.tar.gz" ]; then
        echo -e "${RED}未找到 dorm-management-dist.tar.gz 文件${NC}"
        echo "请确认文件已上传到 /opt/dorm-management/"
        echo ""
        echo "临时方案: 我将创建一个简单的演示页面..."
        create_demo
    else
        # 解压文件
        cd /opt/dorm-management
        tar -xzf dorm-management-dist.tar.gz
        echo -e "${GREEN}文件解压完成${NC}"
    fi
}

# 创建演示页面（如果没有上传文件）
create_demo() {
    mkdir -p /opt/dorm-management/dist
    cat > /opt/dorm-management/dist/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>宿舍管理系统</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #1890ff; }
        .btn { padding: 10px 20px; background: #1890ff; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>🏠 宿舍管理系统</h1>
    <p>部署成功！请上传完整的项目文件。</p>
    <p>默认账号: admin / admin</p>
    <br>
    <a href="/" class="btn">刷新页面</a>
</body>
</html>
EOF
}

# 启动服务
start_service() {
    echo ""
    echo -e "${YELLOW}[启动服务]${NC}"
    
    systemctl start dorm-management
    sleep 2
    
    # 检查状态
    if systemctl is-active --quiet dorm-management; then
        echo -e "${GREEN}✓ 服务启动成功${NC}"
    else
        echo -e "${RED}✗ 服务启动失败，请检查日志${NC}"
        echo "日志: journalctl -u dorm-management -n 50"
    fi
}

# 显示信息
show_info() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}  部署完成!${NC}"
    echo "========================================"
    echo ""
    
    # 获取IP
    IP=$(curl -s ifconfig.me || echo "YOUR_SERVER_IP")
    
    echo " 访问地址: http://$IP"
    echo ""
    echo " 默认账号:"
    echo "   - 管理员: admin / admin"
    echo "   - 员工: E001 / 123456"
    echo ""
    echo " 常用命令:"
    echo "   查看状态: systemctl status dorm-management"
    echo "   重启服务: systemctl restart dorm-management"
    echo "   查看日志: journalctl -u dorm-management -f"
    echo "   停止服务: systemctl stop dorm-management"
    echo ""
    echo " 项目目录: /opt/dorm-management/"
    echo "========================================"
}

# 主流程
main() {
    install_node
    setup_project
    install_serve
    create_startup
    upload_files
    start_service
    show_info
}

# 运行
main
