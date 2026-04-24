// 直接导入数据的脚本 - 在浏览器控制台运行
(async () => {
  console.log('开始导入宿舍名录数据...');
  
  try {
    // 获取数据
    const response = await fetch('/import-data.json');
    const data = await response.json();
    
    console.log(`准备导入：${data.communities.length}个小区, ${data.dorms.length}个宿舍, ${data.rooms.length}间房间, ${data.employees.length}名员工`);
    
    // 打开数据库
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('DormManagementDB', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    // 清空现有数据
    const clearStore = (storeName) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    };
    
    await clearStore('communities');
    await clearStore('dorms');
    await clearStore('rooms');
    await clearStore('employees');
    console.log('✓ 已清空现有数据');
    
    // 导入数据函数
    const importStore = (storeName, items) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        
        let count = 0;
        items.forEach(item => {
          const req = store.add(item);
          req.onsuccess = () => { count++; };
        });
        
        tx.oncomplete = () => resolve(count);
        tx.onerror = () => reject(tx.error);
      });
    };
    
    // 导入各类数据
    const cCount = await importStore('communities', data.communities);
    console.log(`✓ 导入 ${cCount} 个小区`);
    
    const dCount = await importStore('dorms', data.dorms);
    console.log(`✓ 导入 ${dCount} 个宿舍`);
    
    const rCount = await importStore('rooms', data.rooms);
    console.log(`✓ 导入 ${rCount} 间房间`);
    
    const eCount = await importStore('employees', data.employees);
    console.log(`✓ 导入 ${eCount} 名员工`);
    
    console.log('\n🎉 导入完成！请刷新页面查看数据');
    alert(`导入成功！\n${cCount}个小区\n${dCount}个宿舍\n${rCount}间房间\n${eCount}名员工\n\n请刷新页面`);
    
  } catch (err) {
    console.error('导入失败:', err);
    alert('导入失败: ' + err.message);
  }
})();
