#!/bin/bash
# 宿舍管理系统 - 服务器部署脚本
# 使用方法：在阿里云 Workbench 执行 bash deploy.sh

set -e

echo "=== 开始部署宿舍管理系统 ==="

# 1. 进入网站目录
cd /usr/share/nginx/html

# 2. 备份旧文件
echo "备份旧文件..."
cp -r assets assets-backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# 3. 清理旧文件
echo "清理旧文件..."
rm -rf assets index.html

# 4. 从 GitHub 下载最新代码并构建
echo "下载最新代码..."
cd /tmp
rm -rf dorm-management-latest

git clone --depth 1 https://github.com/eriteostinet/dorm-management.git dorm-management-latest

cd dorm-management-latest

echo "安装依赖..."
npm install

echo "构建项目..."
npm run build

echo "部署到网站目录..."
cp -r dist/* /usr/share/nginx/html/

# 5. 修复 index.html
cd /usr/share/nginx/html
if [ -L index.html ]; then
    rm -f index.html
fi

if [ ! -f index.html ] && [ -f dist/index.html ]; then
    cp dist/index.html index.html
fi

# 6. 检查结果
echo ""
echo "=== 部署完成 ==="
echo "文件列表："
ls -la | head -10

echo ""
echo "访问地址: http://8.163.105.42"
echo ""
echo "测试账号："
echo "  管理员: admin / admin123"
echo "  员工: E001 / 123456"
echo "  维修工: M001 / 123456"
