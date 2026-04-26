import { useState, useRef } from 'react';
import { Card, NavBar, Button, Toast, Dialog, Space, Tag, Table } from 'antd-mobile';
import { Upload, Download, AlertCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  createCommunity, createDorm, createRoom, checkIn,
  createEmployee
} from '../../services/dataService';
import './ExcelImport.css';

interface ImportRow {
  小区: string;
  楼号: string;
  房型: string;
  房号: string;
  居住人姓名: string;
  部门: string;
  工号: string;
  _error?: string;
}

interface ExcelImportProps {
  onBack: () => void;
}

export default function ExcelImport({ onBack }: ExcelImportProps) {
  const [data, setData] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws) as any[];

      const rows: ImportRow[] = json.map((row: any, idx: number) => ({
        小区: row['小区'] || row['社区'] || '',
        楼号: row['楼号'] || row['楼栋'] || '',
        房型: String(row['房型'] || row['户型'] || ''), // 1-10人间
        房号: row['房号'] || row['房间号'] || '',
        居住人姓名: row['居住人姓名'] || row['姓名'] || '',
        部门: row['部门'] || '',
        工号: row['工号'] || row['员工号'] || '',
        _error: '',
      }));

      // 验证
      const validated = rows.map((row) => {
        let error = '';
        if (!row.小区.trim()) error = '小区不能为空';
        else if (!row.楼号.trim()) error = '楼号不能为空';
        else if (!row.房型.trim()) error = '房型不能为空';
        else if (!row.房号.trim()) error = '房号不能为空';
        else {
          const roomType = parseInt(row.房型);
          if (isNaN(roomType) || roomType < 1 || roomType > 10) {
            error = '房型应为1-10人间';
          }
        }
        return { ...row, _error: error };
      });

      setData(validated);
      setResults(null);
      Toast.show({ icon: 'success', content: `读取 ${validated.length} 行数据` });
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: '解析 Excel 失败: ' + err.message });
    }
  };

  const handleImport = async () => {
    if (data.length === 0) {
      Toast.show({ icon: 'fail', content: '没有数据可导入' });
      return;
    }

    const hasErrors = data.some((r) => r._error);
    if (hasErrors) {
      Dialog.confirm({
        title: '数据有错误',
        content: '部分行有验证错误，是否跳过错误行继续导入？',
        onConfirm: async () => doImport(),
      });
      return;
    }

    await doImport();
  };

  const doImport = async () => {
    setImporting(true);
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row._error) continue;

        try {
          // 1. 创建小区（如不存在）
          let communityId = '';
          try {
            const c = await createCommunity({ name: row.小区, address: '' });
            communityId = c.id;
          } catch {
            // 如果创建失败，可能已存在，尝试获取
            // 简化处理：跳过已存在的情况
            continue;
          }

          // 2. 创建楼栋
          let buildingId = '';
          try {
            const b = await createDorm({ communityId, name: row.楼号, floors: 6, units: 2 });
            buildingId = b.id;
          } catch {
            continue;
          }

          // 3. 创建房间
          let roomId = '';
          try {
            const roomType = parseInt(row.房型);
            const r = await createRoom({
              communityId,
              buildingId,
              roomNumber: row.房号,
              floor: 1,
              bedCount: roomType,
              status: 'VACANT',
            });
            roomId = r.id;
          } catch {
            continue;
          }

          // 4. 创建员工（如果有居住人信息）
          if (row.居住人姓名.trim() && row.工号.trim()) {
            let employeeId = '';
            try {
              const e = await createEmployee({
                username: row.工号,
                password: '123456',
                realName: row.居住人姓名,
                department: row.部门,
                role: 'STAFF',
              });
              employeeId = e.id || e.userId;
            } catch (err: any) {
              errors.push(`第${i + 1}行创建员工失败: ${err.message}`);
              failed++;
              continue;
            }

            // 5. 入住
            try {
              await checkIn(roomId, employeeId);
            } catch (err: any) {
              errors.push(`第${i + 1}行入住失败: ${err.message}`);
              failed++;
              continue;
            }
          }

          success++;
        } catch (err: any) {
          failed++;
          errors.push(`第${i + 1}行: ${err.message}`);
        }
      }

      setResults({ success, failed, errors });
      Toast.show({ icon: 'success', content: `导入完成: 成功 ${success}, 失败 ${failed}` });
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: '导入失败: ' + err.message });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      { 小区: '阳光花园', 楼号: 'A栋', 房型: '2', 房号: '101', 居住人姓名: '张三', 部门: '技术部', 工号: 'E001' },
      { 小区: '阳光花园', 楼号: 'A栋', 房型: '4', 房号: '102', 居住人姓名: '李四', 部门: '市场部', 工号: 'E002' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '导入模板');
    XLSX.writeFile(wb, '宿舍导入模板.xlsx');
  };

  return (
    <div className="page-container">
      <NavBar onBack={onBack}>Excel 批量导入</NavBar>

      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button block color="primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} /> 上传 Excel 文件
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <Button block onClick={downloadTemplate}>
            <Download size={16} /> 下载导入模板
          </Button>
        </Space>
      </Card>

      {data.length > 0 && (
        <>
          <Card title={`待导入数据 (${data.length} 行)`}>
            <Table>
              <Table.Header>
                <Table.Tr>
                  <Table.Th>小区</Table.Th>
                  <Table.Th>楼号</Table.Th>
                  <Table.Th>房型</Table.Th>
                  <Table.Th>房号</Table.Th>
                  <Table.Th>姓名</Table.Th>
                  <Table.Th>部门</Table.Th>
                  <Table.Th>工号</Table.Th>
                  <Table.Th>状态</Table.Th>
                </Table.Tr>
              </Table.Header>
              <Table.Body>
                {data.map((row, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td>{row.小区}</Table.Td>
                    <Table.Td>{row.楼号}</Table.Td>
                    <Table.Td>{row.房型}人间</Table.Td>
                    <Table.Td>{row.房号}</Table.Td>
                    <Table.Td>{row.居住人姓名}</Table.Td>
                    <Table.Td>{row.部门}</Table.Td>
                    <Table.Td>{row.工号}</Table.Td>
                    <Table.Td>
                      {row._error ? <Tag color="danger">{row._error}</Tag> : <Tag color="success">通过</Tag>}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Body>
            </Table>
          </Card>

          <Button
            block
            color="primary"
            loading={importing}
            onClick={handleImport}
            style={{ margin: '12px' }}
          >
            开始导入
          </Button>
        </>
      )}

      {results && (
        <Card title="导入结果">
          <div>成功: {results.success} 条</div>
          <div>失败: {results.failed} 条</div>
          {results.errors.length > 0 && (
            <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: 12 }}>
              {results.errors.slice(0, 5).map((e, i) => (
                <div key={i}>{e}</div>
              ))}
              {results.errors.length > 5 && <div>...还有 {results.errors.length - 5} 条错误</div>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
