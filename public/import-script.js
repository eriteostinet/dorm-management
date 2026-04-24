// 宿舍名录数据导入脚本
// 使用方法：登录网站后，在浏览器控制台(F12)粘贴运行

async function importDormData() {
  const response = await fetch('/import-data.json');
  const data = await response.json();
  
  console.log('开始导入数据...');
  console.log(`小区: ${data.communities.length} 个`);
  console.log(`宿舍: ${data.dorms.length} 个`);
  console.log(`房间: ${data.rooms.length} 间`);
  console.log(`员工: ${data.employees.length} 人`);
  
  // 打开数据库
  const db = await openDatabase();
  
  // 清空现有数据
  await clearAllData(db);
  console.log('已清空现有数据');
  
  // 导入小区
  for (const comm of data.communities) {
    await db.communities.add(comm);
  }
  console.log(`✓ 导入 ${data.communities.length} 个小区`);
  
  // 导入宿舍
  for (const dorm of data.dorms) {
    await db.dorms.add(dorm);
  }
  console.log(`✓ 导入 ${data.dorms.length} 个宿舍`);
  
  // 导入房间
  for (const room of data.rooms) {
    await db.rooms.add(room);
  }
  console.log(`✓ 导入 ${data.rooms.length} 间房间`);
  
  // 导入员工
  for (const emp of data.employees) {
    await db.employees.add(emp);
  }
  console.log(`✓ 导入 ${data.employees.length} 名员工`);
  
  console.log('\n导入完成！请刷新页面查看数据');
  alert('数据导入成功！请刷新页面');
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DormManagementDB', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      resolve({
        communities: {
          add: (data) => new Promise((res, rej) => {
            const tx = db.transaction('communities', 'readwrite');
            tx.objectStore('communities').add(data);
            tx.oncomplete = res;
            tx.onerror = rej;
          })
        },
        dorms: {
          add: (data) => new Promise((res, rej) => {
            const tx = db.transaction('dorms', 'readwrite');
            tx.objectStore('dorms').add(data);
            tx.oncomplete = res;
            tx.onerror = rej;
          })
        },
        rooms: {
          add: (data) => new Promise((res, rej) => {
            const tx = db.transaction('rooms', 'readwrite');
            tx.objectStore('rooms').add(data);
            tx.oncomplete = res;
            tx.onerror = rej;
          })
        },
        employees: {
          add: (data) => new Promise((res, rej) => {
            const tx = db.transaction('employees', 'readwrite');
            tx.objectStore('employees').add(data);
            tx.oncomplete = res;
            tx.onerror = rej;
          })
        }
      });
    };
    request.onerror = reject;
  });
}

function clearAllData(db) {
  return Promise.all([
    clearStore(db, 'communities'),
    clearStore(db, 'dorms'),
    clearStore(db, 'rooms'),
    clearStore(db, 'employees')
  ]);
}

function clearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

// 运行导入
importDormData();
