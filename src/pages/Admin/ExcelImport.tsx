import { useState, useRef, useMemo } from 'react';
import { Card, NavBar, Button, Toast, Dialog, Space, Tag, Input, Modal } from 'antd-mobile';
import { FileSpreadsheet, Upload, Download, AlertCircle, Trash2, Edit3, Save, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, syncAllToCloud } from '../../db/db';
import type { Employee } from '../../types';
import './ExcelImport.css';

interface ImportRow {
  id: string;
  小区: string;
  楼号: string;
  房型: string;
  房号: string;
  居住人姓名: string;
  部门: string;
  工号: string;
  _error?: string;
  _warning?: string;
}

interface ExcelImportProps {
  onBack: () => void;
}

const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export default function ExcelImport({ onBack }: ExcelImportProps) {
  const [data, setData] = useState<ImportRow[]>([]);
  const [editingCell, setEditingCell] = useState<{rowId: string, field: string} | null>(null);
  const [editValue, setEditValue] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const headers = ['小区', '楼号', '房型', '房号', '居住人姓名', '部门', '工号'];

  // 验证数据 - 使用 useMemo 实时计算
  const { validatedData, stats } = useMemo(() => {
    const roomTypeMap = new Map<string, string>();
    let validCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    
    const validated = data.map((row) => {
      let error = '';
      let warning = '';
      
      if (!row.小区?.trim()) {
        error = '小区不能为空';
        errorCount++;
      } else if (!row.楼号?.trim()) {
        error = '楼号不能为空';
        errorCount++;
      } else if (!row.房型?.trim()) {
        error = '房型不能为空';
        errorCount++;
      } else if (!row.房号?.trim()) {
        error = '房号不能为空';
        errorCount++;
      } else {
        const roomType = parseInt(row.房型);
        if (isNaN(roomType) || roomType < 1 || roomType > 10) {
          warning = '房型应为1-10人间';
          warningCount++;
        }
        
        const roomKey = `${row.小区}-${row.楼号}-${row.房号}`;
        const existingType = roomTypeMap.get(roomKey);
        if (existingType && existingType !== row.房型) {
          warning = warning ? `${warning}; 房型与其他行不一致` : '房型与其他行不一致';
          warningCount++;
        } else {
          roomTypeMap.set(roomKey, row.房型);
        }
      }
      
      if ((row.居住人姓名?.trim() || row.部门?.trim() || row.工号?.trim()) && !row.居住人姓名?.trim()) {
        error = error || '居住人姓名不能为空';
        errorCount++;
      }
      
      if (!error) validCount++;
      
      return { ...row, _error: error, _warning: warning };
    });
    
    return {
      validatedData: validated,
      stats: {
        total: data.length,
        valid: validCount,
        errors: errorCount,
        warnings: warningCount
      }
    };
  }, [data]);

  const addRow = () => {
    setData(prev => [...prev, {
      id: generateId('row'),
      小区: '',
      楼号: '',
      房型: '4',
      房号: '',
      居住人姓名: '',
      部门: '',
      工号: '',
    }]);
  };

  const deleteRow = (id: string) => {
    setData(prev => prev.filter(row => row.id !== id));
    Toast.show({ icon: 'success', content: '已删除' });
  };

  const clearAll = () => {
    Dialog.confirm({
      title: '确认清空',
      content: '确定清空所有数据吗？',
      confirmText: '清空',
      onConfirm: () => {
        setData([]);
        Toast.show({ icon: 'success', content: '已清空' });
      }
    });
  };

  const startEdit = (rowId: string, field: string, value: string) => {
    setEditingCell({ rowId, field });
    setEditValue(value || '');
  };

  const saveEdit = () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;
    setData(prev => prev.map(row => 
      row.id === rowId ? { ...row, [field]: editValue } : row
    ));
    setEditingCell(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      Toast.show({ icon: 'fail', content: '文件太大，请上传小于10MB的文件' });
      return;
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      Toast.show({ icon: 'fail', content: '请上传 .xlsx 或 .xls 格式的Excel文件' });
      return;
    }

    setImportLoading(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (!result) {
          Toast.show({ icon: 'fail', content: '文件内容为空' });
          setImportLoading(false);
          return;
        }

        const data = new Uint8Array(result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        
        if (!jsonData || jsonData.length === 0) {
          Toast.show({ icon: 'fail', content: 'Excel文件数据为空' });
          setImportLoading(false);
          return;
        }

        if (jsonData.length > 1000) {
          Toast.show({ icon: 'fail', content: '数据行数超过1000行，请分批导入' });
          setImportLoading(false);
          return;
        }

        const mappedData: ImportRow[] = jsonData.map((row: any) => ({
          id: generateId('row'),
          小区: String(row['小区'] || row['社区'] || ''),
          楼号: String(row['楼号'] || row['楼栋'] || row['楼'] || ''),
          房型: String(row['房型'] || row['户型'] || ''),
          房号: String(row['房号'] || row['房间号'] || row['房间'] || ''),
          居住人姓名: String(row['居住人姓名'] || row['姓名'] || row['名字'] || ''),
          部门: String(row['部门'] || row['单位'] || ''),
          工号: String(row['工号'] || row['员工号'] || row['编号'] || ''),
        }));
        
        setData(mappedData);
        Toast.show({ icon: 'success', content: `成功导入 ${jsonData.length} 行数据` });
      } catch (_err) {
        Toast.show({ icon: 'fail', content: '处理Excel文件时出错' });
      }
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const template = [
      { 小区: '天悦龙庭', 楼号: '4栋2单元', 房型: '4', 房号: '505', 居住人姓名: '冯子清', 部门: '锂电部', 工号: '214204' },
      { 小区: '天悦龙庭', 楼号: '4栋2单元', 房型: '4', 房号: '505', 居住人姓名: '肖德军', 部门: '锂电部', 工号: '303308' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '宿舍入住导入模板');
    XLSX.writeFile(wb, '宿舍入住导入模板.xlsx');
  };

  const exportData = () => {
    const exportRows = validatedData.map(row => ({
      小区: row.小区,
      楼号: row.楼号,
      房型: row.房型,
      房号: row.房号,
      居住人姓名: row.居住人姓名,
      部门: row.部门,
      工号: row.工号,
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '宿舍入住数据');
    XLSX.writeFile(wb, `宿舍入住数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleSubmit = async () => {
    if (stats.errors > 0) {
      Toast.show({ icon: 'fail', content: `请先修正 ${stats.errors} 处错误` });
      return;
    }
    if (stats.valid === 0) {
      Toast.show({ icon: 'fail', content: '没有有效数据可导入' });
      return;
    }

    // 直接导入，不使用确认对话框
    console.log('开始导入...');
    setImportLoading(true);
    try {
      await importData();
    } catch (err) {
      console.error('导入出错:', err);
      Toast.show({ icon: 'fail', content: '导入失败，请查看控制台' });
    }
    setImportLoading(false);
  };

  const importData = async () => {
    console.log('=== 开始导入数据 ===');
    console.log('待导入数据行数:', validatedData.length);
    
    const existingCommunities = await db.communities.toArray();
    const existingDorms = await db.dorms.toArray();
    const existingEmployees = await db.employees.toArray();
    
    console.log('现有本地数据:', {
      communities: existingCommunities.length,
      dorms: existingDorms.length,
      employees: existingEmployees.length
    });
    
    const communityMap = new Map(existingCommunities.map(c => [c.name, c]));
    const dormMap = new Map(existingDorms.map(d => [`${d.communityId}-${d.building}`, d]));
    const employeeMap = new Map(existingEmployees.map(e => [e._id, e]));
    
    let communityCount = 0, dormCount = 0, roomCount = 0, employeeCount = 0, checkInCount = 0;
    let skipCount = 0;
    const processedRooms = new Map<string, string>();
    
    for (let i = 0; i < validatedData.length; i++) {
      const row = validatedData[i];
      console.log(`处理第${i+1}行:`, {
        小区: row.小区,
        楼号: row.楼号,
        房型: row.房型,
        房号: row.房号,
        姓名: row.居住人姓名,
        错误: row._error,
        警告: row._warning
      });
      
      if (row._error) {
        console.log(`第${i+1}行有错误，跳过`);
        skipCount++;
        continue;
      }
      
      let community = communityMap.get(row.小区);
      if (!community) {
        community = {
          _id: generateId('C'),
          name: row.小区,
          address: '', manager: '', managerPhone: '',
          status: 'active',
          sortOrder: (await db.communities.count()) + 1,
          createdAt: new Date(), updatedAt: new Date(),
        };
        await db.communities.add(community);
        communityMap.set(row.小区, community);
        communityCount++;
      }
      
      const dormKey = `${community._id}-${row.楼号}`;
      let dorm = dormMap.get(dormKey);
      if (!dorm) {
        dorm = {
          _id: generateId('D'),
          communityId: community._id,
          building: row.楼号,
          floor: Math.floor(parseInt(row.房号) / 100) || 1,
          status: 'normal', repairCount: 0, lastRepairDate: null,
          createdAt: new Date(),
        };
        await db.dorms.add(dorm);
        dormMap.set(dormKey, dorm);
        dormCount++;
      }
      
      // 房型解析：家庭房=0, 1人间=1, 2人间=1, 3人间及以上=3
      let layout: 0 | 1 | 3 = 3;
      const layoutStr = String(row.房型 || '').trim();
      if (layoutStr.includes('家庭') || layoutStr.includes('单')) {
        layout = 0; // 家庭房（单人）
      } else {
        const layoutNum = parseInt(layoutStr) || 3;
        layout = layoutNum <= 2 ? 1 : 3;
      }
      
      const roomKey = `${dorm._id}-${row.房号}`;
      let roomId = processedRooms.get(roomKey);
      
      if (!roomId) {
        const existingRoom = await db.rooms.where({ dormId: dorm._id, roomNo: row.房号 }).first();
        if (!existingRoom) {
          roomId = generateId('R');
          await db.rooms.add({
            _id: roomId,
            communityId: community._id,
            dormId: dorm._id,
            roomNo: row.房号,
            layout: layout,
            status: 'vacant',
            occupantId: null, occupantName: null, occupantDept: null,
            checkInDate: null, roomAssets: [],
          });
          roomCount++;
        } else {
          roomId = existingRoom._id;
        }
        if (roomId) {
          processedRooms.set(roomKey, roomId);
        }
      }
      
      if (row.居住人姓名?.trim() && roomId) {
        const roomIdStr = roomId as string;
        const empId = (row.工号?.trim() || generateId('E')) as string;
        let employee = employeeMap.get(empId);
        
        if (!employee) {
          employee = {
            _id: empId,
            name: row.居住人姓名,
            department: row.部门,
            phone: '',
            entryDate: new Date(),
            role: 'employee', status: 'active',
            password: btoa('123456'),
            avatar: null,
            currentCommunityId: community._id,
            currentDormId: dorm._id,
            currentRoomId: roomIdStr,
            isMaintainer: false, maintainerType: [] as ('水电' | '木工' | '综合')[], maintainerCommunities: [] as string[],
            history: [] as Employee['history'],
            createdAt: new Date(), updatedAt: new Date(),
          };
          await db.employees.add(employee);
          employeeMap.set(empId, employee);
          employeeCount++;
        }
        
        if (roomIdStr) {
          await db.rooms.update(roomIdStr, {
            status: 'occupied',
            occupantId: employee._id,
            occupantName: employee.name,
            occupantDept: employee.department,
            checkInDate: new Date(),
          });
          checkInCount++;
        }
      }
    }  // <-- for循环结束
    
    console.log('=== 导入循环结束 ===');
    console.log('统计:', { communityCount, dormCount, roomCount, employeeCount, checkInCount, skipCount });
    
    if (communityCount === 0 && dormCount === 0 && roomCount === 0) {
      console.warn('没有导入任何数据');
      Toast.show({ icon: 'fail', content: '没有导入任何数据，请检查数据格式' });
      return;
    }
    
    // 先保存到本地，云端同步放在后台
    console.log('数据已保存到本地，开始后台同步...');
    syncAllToCloud().then((result) => {
      console.log('云端同步结果:', result);
    }).catch((err) => {
      console.warn('云端同步失败（不影响本地数据）:', err);
    });
    
    // 触发数据更新事件，通知看板刷新
    window.dispatchEvent(new CustomEvent('dorm-data-updated'));
    
    Toast.show({ 
      icon: 'success', 
      content: `导入成功！小区${communityCount}个、楼栋${dormCount}个、房间${roomCount}个、员工${employeeCount}人、入住${checkInCount}条${skipCount > 0 ? `，跳过${skipCount}行` : ''}` 
    });
    
    // 清空数据
    setData([]);
  };

  const renderRow = (row: ImportRow, index: number) => {
    const isEditing = editingCell?.rowId === row.id;
    const hasError = !!row._error;
    const hasWarning = !!row._warning;
    
    const renderCell = (field: keyof ImportRow, value: string) => {
      if (isEditing && editingCell?.field === field) {
        return (
          <div className="row-cell cell-editor">
            <Input value={editValue} onChange={setEditValue} onEnterPress={saveEdit} />
            <Space>
              <Button size="mini" color="primary" onClick={saveEdit}>✓</Button>
              <Button size="mini" onClick={cancelEdit}>✕</Button>
            </Space>
          </div>
        );
      }
      return (
        <div className="row-cell" onClick={() => startEdit(row.id, field, value)}>
          <div className="cell-content">{value || <span className="cell-placeholder">-</span>}</div>
        </div>
      );
    };
    
    return (
      <div key={row.id} className={`table-row ${hasError ? 'error' : ''} ${hasWarning ? 'warning' : ''}`}>
        <div className="row-number">{index + 1}</div>
        {renderCell('小区', row.小区)}
        {renderCell('楼号', row.楼号)}
        {renderCell('房型', row.房型)}
        {renderCell('房号', row.房号)}
        {renderCell('居住人姓名', row.居住人姓名)}
        {renderCell('部门', row.部门)}
        {renderCell('工号', row.工号)}
        <div className="row-actions">
          <Button size="mini" fill="none" onClick={() => deleteRow(row.id)}>
            <Trash2 size={16} color="#ff4d4f" />
          </Button>
        </div>
        
        {hasError && (
          <div className="row-error-tooltip"><AlertCircle size={14} />{row._error}</div>
        )}
        {hasWarning && !hasError && (
          <div className="row-warning-tooltip"><AlertCircle size={14} />{row._warning}</div>
        )}
      </div>
    );
  };

  return (
    <div className="page-container excel-import-page">
      <NavBar onBack={onBack}>在线Excel导入</NavBar>

      <div className="stats-cards">
        <div className="stat-card total"><div className="stat-value">{stats.total}</div><div className="stat-label">总行数</div></div>
        <div className="stat-card valid"><div className="stat-value">{stats.valid}</div><div className="stat-label">有效</div></div>
        <div className="stat-card error"><div className="stat-value">{stats.errors}</div><div className="stat-label">错误</div></div>
        <div className="stat-card warning"><div className="stat-value">{stats.warnings}</div><div className="stat-label">警告</div></div>
      </div>

      <Card className="toolbar-card">
        <Space wrap>
          <Button size="small" color="primary" onClick={addRow}><Edit3 size={14} /> 添加行</Button>
          <Button size="small" onClick={() => fileInputRef.current?.click()} loading={importLoading}>
            <Upload size={14} /> 导入Excel
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelUpload} />
          <Button size="small" onClick={downloadTemplate}><Download size={14} /> 下载模板</Button>
          <Button size="small" onClick={exportData}><FileSpreadsheet size={14} /> 导出数据</Button>
          <Button size="small" color="danger" onClick={clearAll}><Trash2 size={14} /> 清空</Button>
        </Space>
      </Card>

      <Card className="table-card">
        <div className="excel-table" ref={tableRef}>
          <div className="table-header" style={{ gridTemplateColumns: '40px repeat(7, 1fr) 60px' }}>
            <div className="header-cell row-number">#</div>
            {headers.map(h => <div key={h} className="header-cell">{h}</div>)}
            <div className="header-cell action">操作</div>
          </div>
          <div className="table-body">
            {validatedData.length === 0 ? (
              <div className="empty-state">
                <FileSpreadsheet size={48} color="#d9d9d9" />
                <p>暂无数据，点击"添加行"或导入Excel</p>
              </div>
            ) : (
              validatedData.map((row, index) => renderRow(row, index))
            )}
          </div>
        </div>
      </Card>

      {validatedData.length > 0 && (
        <div className="submit-bar">
          <div className="submit-info">
            {stats.errors > 0 ? (
              <Tag color="danger">请先修正 {stats.errors} 处错误</Tag>
            ) : stats.warnings > 0 ? (
              <Tag color="warning">有 {stats.warnings} 条警告，可继续导入</Tag>
            ) : (
              <Tag color="success">数据验证通过</Tag>
            )}
          </div>
          <Space>
            <Button onClick={() => setPreviewVisible(true)}><Eye size={14} /> 预览</Button>
            <Button color="primary" disabled={stats.errors > 0 || stats.valid === 0} loading={importLoading} onClick={handleSubmit}>
              <Save size={14} /> 确认导入
            </Button>
          </Space>
        </div>
      )}

      <Modal
        visible={previewVisible}
        title="数据预览"
        content={
          <div className="preview-content">
            <div className="preview-stats">
              <Tag color="primary">总 {stats.total} 条</Tag>
              <Tag color="success">有效 {stats.valid} 条</Tag>
              {stats.errors > 0 && <Tag color="danger">错误 {stats.errors} 条</Tag>}
              {stats.warnings > 0 && <Tag color="warning">警告 {stats.warnings} 条</Tag>}
            </div>
            <div className="preview-table">
              <table>
                <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {validatedData.slice(0, 10).map((row) => (
                    <tr key={row.id} className={row._error ? 'error' : row._warning ? 'warning' : ''}>
                      <td>{row.小区}</td><td>{row.楼号}</td><td>{row.房型}</td><td>{row.房号}</td>
                      <td>{row.居住人姓名 || '-'}</td><td>{row.部门 || '-'}</td><td>{row.工号 || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {validatedData.length > 10 && <div className="preview-more">还有 {validatedData.length - 10} 条数据...</div>}
            </div>
          </div>
        }
        closeOnAction
        onClose={() => setPreviewVisible(false)}
        actions={[{ key: 'close', text: '关闭' }]}
      />

      <Card className="help-card">
        <div className="help-title">使用说明</div>
        <ul className="help-list">
          <li>1. 导入格式：小区、楼号、房型、房号、居住人姓名、部门、工号</li>
          <li>2. 宿舍必填：小区、楼号、房型、房号</li>
          <li>3. 居住人信息可选，填写姓名时部门可为空</li>
          <li>4. 一个房间可以住多人</li>
          <li>5. 红色行表示有错误，必须修正后才能导入</li>
        </ul>
      </Card>
    </div>
  );
}
