import * as XLSX from 'xlsx';
import { db } from '../db/db';
import type { ImportError } from '../types';

/**
 * 数据导入 API 服务
 * 模拟 RESTful API: POST /api/import/:type
 */

export interface ApiImportRequest {
  type: 'employees' | 'dorms' | 'assets' | 'allocations';
  file: File;
  options?: {
    skipValidation?: boolean;
    updateExisting?: boolean;
  };
}

export interface ApiImportResponse {
  success: boolean;
  code: number;
  message: string;
  data: {
    total: number;
    success: number;
    failed: number;
    errors: ImportError[];
  };
}

/**
 * 导入员工数据
 */
async function importEmployees(
  data: any[],
  options?: { updateExisting?: boolean }
): Promise<ApiImportResponse> {
  const errors: ImportError[] = [];
  let success = 0;
  let failed = 0;

  const existingEmployees = await db.employees.toArray();
  const existingIds = new Set(existingEmployees.map(e => e._id));

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;

    // 校验必填字段
    if (!row['工号']) {
      errors.push({ row: rowNum, field: '工号', value: row['工号'], reason: '工号不能为空' });
      failed++;
      continue;
    }

    if (!row['姓名']) {
      errors.push({ row: rowNum, field: '姓名', value: row['姓名'], reason: '姓名不能为空' });
      failed++;
      continue;
    }

    // 校验工号唯一性
    if (existingIds.has(row['工号']) && !options?.updateExisting) {
      errors.push({ row: rowNum, field: '工号', value: row['工号'], reason: '工号已存在' });
      failed++;
      continue;
    }

    // 校验手机号格式
    if (row['手机号'] && !/^1[3-9]\d{9}$/.test(row['手机号'])) {
      errors.push({ row: rowNum, field: '手机号', value: row['手机号'], reason: '手机号格式不正确' });
      failed++;
      continue;
    }

    try {
      const employee = {
        _id: row['工号'],
        name: row['姓名'],
        department: row['部门'] || '未分配',
        phone: row['手机号'] || '',
        entryDate: row['入职日期'] ? new Date(row['入职日期']) : new Date(),
        role: row['角色'] || 'employee',
        status: 'active' as const,
        password: btoa('123456'),
        avatar: null,
        currentCommunityId: null,
        currentDormId: null,
        currentRoomId: null,
        isMaintainer: false,
        maintainerType: [] as ('水电' | '木工' | '综合')[],
        maintainerCommunities: [] as string[],
        history: [] as any[],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (existingIds.has(row['工号']) && options?.updateExisting) {
        await db.employees.update(row['工号'], employee);
      } else {
        await db.employees.add(employee);
      }
      success++;
    } catch (err: any) {
      errors.push({ row: rowNum, field: '导入', value: row['工号'], reason: err.message });
      failed++;
    }
  }

  return {
    success: errors.length === 0,
    code: errors.length === 0 ? 200 : 400,
    message: errors.length === 0 ? '导入成功' : `导入完成，成功${success}条，失败${failed}条`,
    data: {
      total: data.length,
      success,
      failed,
      errors,
    },
  };
}

/**
 * 导入宿舍数据
 */
async function importDorms(data: any[]): Promise<ApiImportResponse> {
  const errors: ImportError[] = [];
  let success = 0;
  let failed = 0;

  const communities = await db.communities.toArray();
  const communityMap = new Map(communities.map(c => [c.name, c._id]));

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;

    if (!row['小区ID'] && !row['小区']) {
      errors.push({ row: rowNum, field: '小区', value: null, reason: '小区不能为空' });
      failed++;
      continue;
    }

    const communityId = row['小区ID'] || communityMap.get(row['小区']);
    if (!communityId) {
      errors.push({ row: rowNum, field: '小区', value: row['小区'] || row['小区ID'], reason: '小区不存在' });
      failed++;
      continue;
    }

    try {
      const dormId = `${communityId}-${row['楼栋']}-${row['楼层']}`;
      const dorm = {
        _id: dormId,
        communityId,
        building: row['楼栋'],
        floor: parseInt(row['楼层']) || 1,
        status: 'normal' as const,
        repairCount: 0,
        lastRepairDate: null,
        createdAt: new Date(),
      };

      await db.dorms.put(dorm);

      // 房型解析：家庭房=0, 1人间=1, 2人间=1, 3人间及以上=3
      let layout: 0 | 1 | 3 = 3;
      const layoutStr = String(row['户型'] || '').trim();
      if (layoutStr.includes('家庭') || layoutStr.includes('单')) {
        layout = 0; // 家庭房（单人）
      } else {
        const layoutValue = parseInt(layoutStr) || 3;
        layout = layoutValue <= 2 ? 1 : 3;
      }

      // 创建房间
      const roomId = `${dormId}-${row['房间号']}`;
      const room = {
        _id: roomId,
        dormId,
        communityId,
        roomNo: row['房间号'],
        layout: layout,
        status: 'vacant' as const,
        occupantId: null as string | null,
        occupantName: null as string | null,
        occupantDept: null as string | null,
        checkInDate: null as Date | null,
        roomAssets: [] as any[],
      };

      await db.rooms.put(room);
      success++;
    } catch (err: any) {
      errors.push({ row: rowNum, field: '导入', value: row['房间号'], reason: err.message });
      failed++;
    }
  }

  return {
    success: errors.length === 0,
    code: errors.length === 0 ? 200 : 400,
    message: errors.length === 0 ? '导入成功' : `导入完成，成功${success}条，失败${failed}条`,
    data: {
      total: data.length,
      success,
      failed,
      errors,
    },
  };
}

/**
 * 导入资产数据
 */
async function importAssets(data: any[]): Promise<ApiImportResponse> {
  const errors: ImportError[] = [];
  let success = 0;
  let failed = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;

    if (!row['资产类型']) {
      errors.push({ row: rowNum, field: '资产类型', value: null, reason: '资产类型不能为空' });
      failed++;
      continue;
    }

    try {
      const assetId = `A${Date.now()}${i}`;
      const asset = {
        _id: assetId,
        category: row['资产类型'],
        brand: row['品牌'] || '',
        model: row['型号'] || '',
        serialNo: row['序列号'] || '',
        purchaseDate: row['购买日期'] ? new Date(row['购买日期']) : new Date(),
        warrantyYears: parseInt(row['保修年限']) || 3,
        location: row['所在宿舍ID'] || '',
        status: 'normal' as const,
        nextMaintenance: undefined as Date | undefined,
        maintenanceCount: 0,
        communityId: row['小区ID'] || '',
        dormId: row['宿舍ID'] || '',
      };

      await db.dormAssets.add(asset);
      success++;
    } catch (err: any) {
      errors.push({ row: rowNum, field: '导入', value: row['资产类型'], reason: err.message });
      failed++;
    }
  }

  return {
    success: errors.length === 0,
    code: errors.length === 0 ? 200 : 400,
    message: errors.length === 0 ? '导入成功' : `导入完成，成功${success}条，失败${failed}条`,
    data: {
      total: data.length,
      success,
      failed,
      errors,
    },
  };
}

/**
 * 导入入住分配数据
 */
async function importAllocations(data: any[]): Promise<ApiImportResponse> {
  const errors: ImportError[] = [];
  let success = 0;
  let failed = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;

    if (!row['工号']) {
      errors.push({ row: rowNum, field: '工号', value: null, reason: '工号不能为空' });
      failed++;
      continue;
    }

    if (!row['宿舍ID'] || !row['房间号']) {
      errors.push({ row: rowNum, field: '宿舍/房间', value: null, reason: '宿舍ID和房间号不能为空' });
      failed++;
      continue;
    }

    // 校验员工存在
    const employee = await db.employees.get(row['工号']);
    if (!employee) {
      errors.push({ row: rowNum, field: '工号', value: row['工号'], reason: '员工不存在' });
      failed++;
      continue;
    }

    // 校验房间存在
    const roomId = `${row['宿舍ID']}-${row['房间号']}`;
    const room = await db.rooms.get(roomId);
    if (!room) {
      errors.push({ row: rowNum, field: '房间', value: roomId, reason: '房间不存在' });
      failed++;
      continue;
    }

    // 校验房间是否已入住
    if (room.status === 'occupied' && room.occupantId !== row['工号']) {
      errors.push({ row: rowNum, field: '房间', value: roomId, reason: '房间已被占用' });
      failed++;
      continue;
    }

    try {
      // 更新房间
      await db.rooms.update(roomId, {
        occupantId: row['工号'],
        occupantName: employee.name,
        occupantDept: employee.department,
        checkInDate: row['入住日期'] ? new Date(row['入住日期']) : new Date(),
        status: 'occupied',
      });

      // 更新员工
      await db.employees.update(row['工号'], {
        currentCommunityId: room.communityId,
        currentDormId: room.dormId,
        currentRoomId: roomId,
      });

      success++;
    } catch (err: any) {
      errors.push({ row: rowNum, field: '导入', value: row['工号'], reason: err.message });
      failed++;
    }
  }

  return {
    success: errors.length === 0,
    code: errors.length === 0 ? 200 : 400,
    message: errors.length === 0 ? '导入成功' : `导入完成，成功${success}条，失败${failed}条`,
    data: {
      total: data.length,
      success,
      failed,
      errors,
    },
  };
}

/**
 * 主导入 API
 * POST /api/import/:type
 */
export async function apiImport(
  request: ApiImportRequest
): Promise<ApiImportResponse> {
  const { type, file, options } = request;

  try {
    // 读取 Excel 文件
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return {
        success: false,
        code: 400,
        message: '文件为空',
        data: { total: 0, success: 0, failed: 0, errors: [] },
      };
    }

    // 大文件流式处理（>10MB）
    if (file.size > 10 * 1024 * 1024) {
      console.log('大文件处理，使用流式处理');
      // 这里可以实现分块处理逻辑
    }

    // 根据类型调用不同导入函数
    switch (type) {
      case 'employees':
        return await importEmployees(data, options);
      case 'dorms':
        return await importDorms(data);
      case 'assets':
        return await importAssets(data);
      case 'allocations':
        return await importAllocations(data);
      default:
        return {
          success: false,
          code: 400,
          message: '不支持的导入类型',
          data: { total: 0, success: 0, failed: 0, errors: [] },
        };
    }
  } catch (err: any) {
    return {
      success: false,
      code: 500,
      message: `导入失败: ${err.message}`,
      data: { total: 0, success: 0, failed: 0, errors: [] },
    };
  }
}

/**
 * 批量导入（流式处理大文件）
 */
export async function apiImportStream(
  type: 'employees' | 'dorms' | 'assets' | 'allocations',
  file: File,
  onProgress?: (progress: number) => void
): Promise<ApiImportResponse> {
  const chunkSize = 1000; // 每批处理1000条
  
  // 读取文件
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const allData = XLSX.utils.sheet_to_json(worksheet);
  
  const total = allData.length;
  let processed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  const allErrors: ImportError[] = [];

  // 分批处理
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = allData.slice(i, i + chunkSize);
    
    // 创建临时 workbook
    const tempWb = XLSX.utils.book_new();
    const tempWs = XLSX.utils.json_to_sheet(chunk);
    XLSX.utils.book_append_sheet(tempWb, tempWs, 'Sheet1');
    
    const result = await apiImport({
      type,
      file: new File([XLSX.write(tempWb, { bookType: 'xlsx', type: 'array' })], 'chunk.xlsx'),
    });

    totalSuccess += result.data.success;
    totalFailed += result.data.failed;
    allErrors.push(...result.data.errors);
    processed += chunk.length;

    if (onProgress) {
      onProgress(Math.round((processed / total) * 100));
    }
  }

  return {
    success: totalFailed === 0,
    code: totalFailed === 0 ? 200 : 400,
    message: `导入完成，成功${totalSuccess}条，失败${totalFailed}条`,
    data: {
      total,
      success: totalSuccess,
      failed: totalFailed,
      errors: allErrors,
    },
  };
}

export default {
  apiImport,
  apiImportStream,
};
