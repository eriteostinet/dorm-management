// db.ts - 已废弃
// 
// ⚠️ 重要说明：
// 本文件原本使用 Dexie (IndexedDB) 在浏览器本地存储数据。
// 现在系统已升级为后端 API + PostgreSQL 架构，所有数据操作通过 API 进行。
// 
// 请使用以下方式替代：
//   import { api } from '../api/client';
//   import { getRooms, createTicket, etc } from '../services/dataService';
//
// 保留此文件仅为兼容，防止旧引用报错。所有函数已改为空实现或打印警告。

// 兼容旧代码的表对象
function createMockTable(_name: string) {
  const table = {
    toArray: async (): Promise<any[]> => [],
    get: async (id: string): Promise<any | null> => null,
    update: async (id: string, data: any): Promise<number> => 0,
    put: async (data: any): Promise<string> => '',
    add: async (data: any): Promise<string> => '',
    bulkAdd: async (data: any[]): Promise<void> => undefined,
    bulkDelete: async (ids: string[]): Promise<void> => undefined,
    bulkPut: async (data: any[]): Promise<void> => undefined,
    delete: async (id: string): Promise<void> => undefined,
    clear: async (): Promise<void> => undefined,
    count: async (): Promise<number> => 0,
    sortBy: async (_field: string): Promise<any[]> => [],
    where: (_query: any) => ({
      equals: (_val: any) => ({
        first: async (): Promise<any | null> => null,
        toArray: async (): Promise<any[]> => [],
        sortBy: (_field: string) => ({
          toArray: async (): Promise<any[]> => [],
        }),
        delete: async (): Promise<void> => undefined,
        modify: async (_changes: any): Promise<number> => 0,
      }),
      anyOf: (_vals: any[]) => ({
        toArray: async (): Promise<any[]> => [],
        sortBy: (_field: string) => ({
          toArray: async (): Promise<any[]> => [],
        }),
        delete: async (): Promise<void> => undefined,
        modify: async (_changes: any): Promise<number> => 0,
      }),
      startsWith: (_prefix: string) => ({
        toArray: async (): Promise<any[]> => [],
        sortBy: (_field: string) => ({
          toArray: async (): Promise<any[]> => [],
        }),
        delete: async (): Promise<void> => undefined,
        modify: async (_changes: any): Promise<number> => 0,
      }),
      above: (_val: any) => ({
        toArray: async (): Promise<any[]> => [],
      }),
      aboveOrEqual: (_val: any) => ({
        toArray: async (): Promise<any[]> => [],
      }),
      below: (_val: any) => ({
        toArray: async (): Promise<any[]> => [],
      }),
      belowOrEqual: (_val: any) => ({
        toArray: async (): Promise<any[]> => [],
      }),
      between: (_a: any, _b: any) => ({
        toArray: async (): Promise<any[]> => [],
      }),
      startsWithAnyOf: (_prefixes: string[]) => ({
        toArray: async (): Promise<any[]> => [],
      }),
      noneOf: (_vals: any[]) => ({
        toArray: async (): Promise<any[]> => [],
      }),
      notEqual: (_val: any) => ({
        toArray: async (): Promise<any[]> => [],
      }),
      first: async (): Promise<any | null> => null,
      toArray: async (): Promise<any[]> => [],
      sortBy: (_field: string) => ({
        toArray: async (): Promise<any[]> => [],
      }),
      delete: async (): Promise<void> => undefined,
      modify: async (_changes: any): Promise<number> => 0,
    }),
    filter: (_predicate: any) => ({
      toArray: async (): Promise<any[]> => [],
      first: async (): Promise<any | null> => null,
      count: async (): Promise<number> => 0,
    }),
    reverse: () => ({
      toArray: async (): Promise<any[]> => [],
      first: async (): Promise<any | null> => null,
    }),
    limit: (_n: number) => ({
      toArray: async (): Promise<any[]> => [],
    }),
    offset: (_n: number) => ({
      toArray: async (): Promise<any[]> => [],
    }),
    each: async (_callback: any): Promise<void> => undefined,
    keys: async (): Promise<any[]> => [],
    uniqueKeys: async (): Promise<any[]> => [],
    until: (_predicate: any) => ({
      toArray: async (): Promise<any[]> => [],
    }),
    or: (_indexName: string) => ({
      equals: (_val: any) => ({
        toArray: async (): Promise<any[]> => [],
      }),
    }),
  };
  return table;
}

export const db = {
  communities: createMockTable('communities'),
  dorms: createMockTable('dorms'),
  rooms: createMockTable('rooms'),
  employees: createMockTable('employees'),
  repairTickets: createMockTable('repairTickets'),
  payments: createMockTable('payments'),
  dormAssets: createMockTable('dormAssets'),
  assetAllocations: createMockTable('assetAllocations'),
  repairLogs: createMockTable('repairLogs'),
  rentPayments: createMockTable('rentPayments'),
};

// 兼容旧代码的初始化函数
export async function initDefaultData() {
  console.log('[db.ts] 已废弃，数据由后端管理');
  return true;
}

export async function syncAllToCloud() {
  console.log('[db.ts] 已废弃，数据已在服务器端');
  return true;
}

export async function syncFromCloud() {
  console.log('[db.ts] 已废弃，数据已在服务器端');
  return true;
}

export async function clearAllData() {
  console.warn('[db.ts] clearAllData 已被禁用');
  return false;
}

// 数据导出/导入/备份兼容函数
export async function exportAllData() {
  console.log('[db.ts] exportAllData 已废弃');
  return {
    communities: [],
    dorms: [],
    rooms: [],
    employees: [],
    repairTickets: [],
    payments: [],
    dormAssets: [],
    assetAllocations: [],
    repairLogs: [],
    rentPayments: [],
    timestamp: Date.now(),
  };
}

export async function importAllData(_json: string) {
  console.log('[db.ts] importAllData 已废弃');
  return { success: true, count: 0 };
}

export async function restoreFromCloud() {
  console.log('[db.ts] restoreFromCloud 已废弃');
  return { success: true };
}

export async function getSyncStatus() {
  console.log('[db.ts] getSyncStatus 已废弃');
  return { lastSync: null as Date | null, isOnline: true };
}

// 兼容旧代码的 CloudBase 初始化
export function initCloudBase() {
  console.log('[db.ts] CloudBase 已废弃');
  return {};
}

export function getCloudDB() {
  console.log('[db.ts] CloudBase 已废弃');
  return {};
}

// 兼容旧代码的 CloudBase 初始化
export function initCloudBase() {
  console.log('[db.ts] CloudBase 已废弃');
  return {};
}

export function getCloudDB() {
  console.log('[db.ts] CloudBase 已废弃');
  return {};
}
