/**
 * 工程持久化：分层存储 + 工程 JSON 导入导出（§4.4 / §4.8，2026-09-04 定案）。
 *
 * 分层策略：
 * - localStorage 只存工程数据（cells 等小体积，30s 自动保存由 UI 层定时调用 saveProject）；
 * - 参考图 Blob 存 IndexedDB（{@link RefImageStore} 可注入适配器，便于测试）；
 * - 导出的工程 JSON 内嵌参考图（dataURL）保证可迁移；导入时优先取内嵌图。
 *
 * 本模块的类型引用 DOM 全局类型（Blob/indexedDB/localStorage），运行时句柄
 * 均由调用方或浏览器环境注入，不直接访问 window。
 */

import {
  BRAND_KEYS,
  DEFAULT_FINISH,
  FINISH_PRESETS,
  PROJECT_SCHEMA_VERSION,
  type BrandKey,
  type FinishSetting,
  type Project,
} from './types';

// ---------------------------------------------------------------------------
// 工程数据规范化（§4.8 schema 校验）
// ---------------------------------------------------------------------------

/** localStorage 存储键（单工程槽位；多工程列表随 P1 图库云端化再扩展）。 */
export const PROJECT_STORAGE_KEY = 'px-creat-web:project:v1';

/** 参考图内嵌结构（工程 JSON 导出文件用；本地 localStorage 不存）。 */
export interface RefImageEmbed {
  /** dataURL（含 MIME 前缀）。 */
  dataUrl: string;
  /** 原文件名（可缺省）。 */
  name?: string;
}

/** 工程文件 = 工程 JSON（§4.8）+ 可选内嵌参考图。 */
export interface ProjectFileV1 extends Project {
  refImage?: RefImageEmbed;
}

/** 解析结果：成功返回规范化工程与内嵌参考图；失败返回原因（不抛异常）。 */
export type ProjectParseResult =
  | { ok: true; project: Project; refImage: RefImageEmbed | null }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 规范化工程对象：校验并修正 §4.8 字段。
 * 宽进严出——非法值抛错由上层转为用户提示；可修正的（finish 缺省、intensity 越界）就地修正。
 *
 * @param raw 待规范化的对象（通常来自 JSON.parse）
 * @param strict 为 true 时字段类型不合法直接判失败；否则尽量修正
 */
export function normalizeProject(raw: unknown, strict: boolean): Project | null {
  if (!isRecord(raw)) return null;
  if (raw.v !== PROJECT_SCHEMA_VERSION) return null;
  const title = typeof raw.title === 'string' ? raw.title : strict ? null : String(raw.title ?? '未命名作品');
  if (title === null) return null;
  const brandKey = BRAND_KEYS.includes(raw.brandKey as BrandKey) ? (raw.brandKey as BrandKey) : null;
  if (brandKey === null) return null;
  const w = raw.w;
  const h = raw.h;
  if (!Number.isInteger(w) || !Number.isInteger(h) || (w as number) < 1 || (h as number) < 1 || (w as number) > 512 || (h as number) > 512) {
    return null;
  }
  if (!Array.isArray(raw.cells) || raw.cells.length !== (w as number) * (h as number)) return null;
  for (const cell of raw.cells) {
    if (!Number.isInteger(cell) || (cell as number) < -1) return null;
  }

  let finish: FinishSetting | undefined;
  if (raw.finish !== undefined) {
    if (!isRecord(raw.finish)) return null;
    const preset = FINISH_PRESETS.includes(raw.finish.preset as never)
      ? (raw.finish.preset as FinishSetting['preset'])
      : 'normal';
    const rawIntensity = raw.finish.intensity;
    const intensity = Number.isFinite(rawIntensity) ? Math.round(Number(rawIntensity)) : DEFAULT_FINISH.intensity;
    finish = { preset, intensity: Math.min(100, Math.max(0, intensity)) };
  }
  return {
    v: PROJECT_SCHEMA_VERSION,
    title,
    brandKey,
    w: w as number,
    h: h as number,
    cells: raw.cells as number[],
    ...(finish === undefined ? {} : { finish }),
  };
}

/**
 * 取工程的有效烫染设置（§4.8：finish 缺省 = normal + 100）。
 *
 * @param project 工程数据
 */
export function getFinish(project: Project): FinishSetting {
  return project.finish ?? DEFAULT_FINISH;
}

// ---------------------------------------------------------------------------
// localStorage 层（工程数据）
// ---------------------------------------------------------------------------

/** 最小存储接口（结构兼容 localStorage，可注入内存 mock 测试）。 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * 保存工程到 localStorage（自动保存 30s 周期由 UI 调用；本函数同步写、小体积不阻塞）。
 *
 * @param store 注入的存储（浏览器传 localStorage）
 * @param project 工程数据（不含参考图大对象）
 * @param key 存储键（默认 PROJECT_STORAGE_KEY）
 */
export function saveProject(store: StorageLike, project: Project, key = PROJECT_STORAGE_KEY): void {
  store.setItem(key, JSON.stringify(project));
}

/**
 * 读取 localStorage 工程。
 *
 * @param store 注入的存储
 * @param key 存储键
 * @returns 工程数据；无存档或数据损坏（无法规范化）返回 null
 */
export function loadProject(store: StorageLike, key = PROJECT_STORAGE_KEY): Project | null {
  const raw = store.getItem(key);
  if (raw === null) return null;
  try {
    return normalizeProject(JSON.parse(raw), false);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// IndexedDB 层（参考图 Blob）
// ---------------------------------------------------------------------------

/** 参考图存储适配器（put/get/delete；生产实现走 IndexedDB，测试注入内存实现）。 */
export interface RefImageStore {
  put(projectKey: string, blob: Blob): Promise<void>;
  get(projectKey: string): Promise<Blob | null>;
  delete(projectKey: string): Promise<void>;
}

/**
 * 创建 IndexedDB 参考图存储（浏览器专用；blob 以单个对象存储记录保存）。
 *
 * @param dbName 库名（默认 px-creat-web）
 * @param storeName 对象存储名（默认 refImages）
 */
export function createIndexedDbRefImageStore(dbName = 'px-creat-web', storeName = 'refImages'): RefImageStore {
  const openDb = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(storeName)) {
          req.result.createObjectStore(storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
    });

  const run = async <T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
    const db = await openDb();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const req = work(tx.objectStore(storeName));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'));
      });
    } finally {
      db.close();
    }
  };

  return {
    async put(projectKey, blob) {
      await run('readwrite', (s) => s.put(blob, projectKey));
    },
    async get(projectKey) {
      const blob = await run<Blob | undefined>('readonly', (s) => s.get(projectKey));
      return blob ?? null;
    },
    async delete(projectKey) {
      await run('readwrite', (s) => s.delete(projectKey));
    },
  };
}

// ---------------------------------------------------------------------------
// 工程 JSON 导入 / 导出
// ---------------------------------------------------------------------------

/**
 * 序列化工程导出文件（含可选内嵌参考图 dataURL）。
 * 字段在 §4.8 工程结构上追加 `refImage`，旧版本读取时忽略即可。
 *
 * @param project 工程数据
 * @param refImage 内嵌参考图（缺省不内嵌）
 */
export function serializeProjectFile(project: Project, refImage?: RefImageEmbed): string {
  const file: ProjectFileV1 = refImage ? { ...project, refImage } : { ...project };
  return JSON.stringify(file);
}

/**
 * 解析工程导出文件（JSON 字符串）。导入优先取内嵌参考图，恢复参考层时由
 * UI 层先取 refImage 再回退 IndexedDB。
 *
 * @param json 工程 JSON 文本
 */
export function parseProjectFile(json: string): ProjectParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: '不是合法的 JSON 文件' };
  }
  const project = normalizeProject(raw, true);
  if (project === null) {
    return { ok: false, error: '工程文件结构不符合 schema（v/brandKey/w/h/cells 校验失败）' };
  }
  const ref = isRecord(raw) && isRecord(raw.refImage) && typeof raw.refImage.dataUrl === 'string'
    ? { dataUrl: raw.refImage.dataUrl, ...(typeof raw.refImage.name === 'string' ? { name: raw.refImage.name } : {}) }
    : null;
  return { ok: true, project, refImage: ref };
}
