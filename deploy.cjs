const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// 腾讯云 COS 配置 (S3 兼容)
// 请在环境变量中设置密钥:
// export TENCENT_SECRET_ID=your_secret_id
// export TENCENT_SECRET_KEY=your_secret_key
const cos = new AWS.S3({
  endpoint: 'https://cos.ap-beijing.myqcloud.com',
  accessKeyId: process.env.TENCENT_SECRET_ID || '',
  secretAccessKey: process.env.TENCENT_SECRET_KEY || '',
  region: 'ap-beijing',
  apiVersion: '2006-03-01'
});

const bucketName = 'dorm-website-' + Date.now();
const distPath = '/root/.openclaw/workspace/dorm-management/dist';

// 创建存储桶
async function createBucket() {
  try {
    await cos.createBucket({
      Bucket: bucketName,
      ACL: 'public-read'
    }).promise();
    console.log('✓ 存储桶创建成功:', bucketName);
    return true;
  } catch (err) {
    console.error('创建存储桶失败:', err.message);
    return false;
  }
}

// 配置静态网站托管
async function setupStaticWebsite() {
  try {
    await cos.putBucketWebsite({
      Bucket: bucketName,
      WebsiteConfiguration: {
        IndexDocument: { Suffix: 'index.html' },
        ErrorDocument: { Key: 'index.html' }
      }
    }).promise();
    console.log('✓ 静态网站托管配置成功');
    return true;
  } catch (err) {
    console.error('配置静态网站失败:', err.message);
    return false;
  }
}

// 上传文件
async function uploadFile(filePath, key) {
  const content = fs.readFileSync(filePath);
  const contentType = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  }[path.extname(filePath)] || 'application/octet-stream';

  try {
    await cos.putObject({
      Bucket: bucketName,
      Key: key,
      Body: content,
      ContentType: contentType,
      ACL: 'public-read'
    }).promise();
    console.log('  上传:', key);
    return true;
  } catch (err) {
    console.error('  上传失败:', key, err.message);
    return false;
  }
}

// 递归上传目录
async function uploadDir(dirPath, prefix = '') {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const key = prefix ? `${prefix}/${file}` : file;
    
    if (fs.statSync(filePath).isDirectory()) {
      await uploadDir(filePath, key);
    } else {
      await uploadFile(filePath, key);
    }
  }
}

// 主函数
async function deploy() {
  console.log('开始部署宿舍管理系统...\n');
  
  if (!fs.existsSync(distPath)) {
    console.error('错误: dist 目录不存在');
    process.exit(1);
  }

  // 创建存储桶
  if (!await createBucket()) process.exit(1);
  
  // 配置静态网站
  if (!await setupStaticWebsite()) process.exit(1);
  
  // 上传文件
  console.log('\n上传文件:');
  await uploadDir(distPath);
  
  console.log('\n✓ 部署完成!');
  console.log('\n访问地址:');
  console.log(`http://${bucketName}.cos-website.ap-beijing.myqcloud.com`);
}

deploy().catch(console.error);
