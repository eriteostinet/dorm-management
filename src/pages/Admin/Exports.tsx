import { useState, useEffect } from 'react';
import { Card, Button, NavBar, Toast } from 'antd-mobile';
import { createExportTask, getExportTasks } from '../../services/dataService';
import { auth } from '../../utils/auth';
import type { ExportTask } from '../../types';
import './Exports.css';

interface ExportsProps {
  onBack: () => void;
}

const exportTypes = [
  { key: 'allocation', name: '宿舍分配表', desc: '包含所有宿舍的入住情况' },
  { key: 'assets', name: '资产盘点表', desc: '所有资产清单及保修状态' },
  { key: 'repair', name: '维修明细表', desc: '所有维修工单记录' },
  { key: 'repairStats', name: '维修统计表', desc: '维修工绩效统计' },
];

export default function Exports({ onBack }: ExportsProps) {
  const [tasks, setTasks] = useState<ExportTask[]>([]);

  useEffect(() => {
    const loadTasks = async () => {
      const result = await getExportTasks();
      setTasks(result);
    };
    loadTasks();
  }, []);

  const handleExport = async (type: string, name: string) => {
    const userId = auth.getUserId();
    if (!userId) return;
    
    await createExportTask({
      fileName: `${name}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      type: type as any,
      creatorId: userId,
    });
    
    Toast.show({ icon: 'success', content: '导出任务已创建' });
    setTimeout(async () => {
      const result = await getExportTasks();
      setTasks(result);
    }, 500);
  };

  return (
    <div className="page-container">
      <NavBar onBack={onBack}>数据导出</NavBar>

      <Card title="导出类型">
        {exportTypes.map(t => (
          <div key={t.key} className="export-type">
            <div className="export-info">
              <div className="export-name">{t.name}</div>
              <div className="export-desc">{t.desc}</div>
            </div>
            <Button size="small" color="primary" onClick={() => handleExport(t.key, t.name)}>
              导出
            </Button>
          </div>
        ))}
      </Card>

      <Card title="导出历史">
        {tasks.length > 0 ? (
          tasks.map(task => (
            <div key={task._id} className="task-item">
              <div className="task-name">{task.fileName}</div>
              <div className={`task-status ${task.status}`}>
                {task.status === 'done' ? '已完成' : task.status === 'processing' ? '处理中' : '待处理'}
              </div>
            </div>
          ))
        ) : (
          <p className="no-task">暂无导出记录</p>
        )}
      </Card>
    </div>
  );
}
