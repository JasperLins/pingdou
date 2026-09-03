/**
 * 本地匿名事件接口留位（P0 降级决议：仅本地内存数组 + 类型定义，不上报、无面板）。
 *
 * 事件名是 UI 层调用契约；如需扩展（P1 图库联动）在 {@link AnalyticsEventName}
 * 联合类型中追加即可。数据永不离开浏览器。
 */

/** 本地事件名（编辑器关键动作）。 */
export type AnalyticsEventName =
  | 'editor_open'
  | 'import_convert'
  | 'convert_run'
  | 'finish_preset_apply'
  | 'export_pattern'
  | 'export_bom'
  | 'export_project'
  | 'project_autosave';

/** 事件附加属性（仅基本类型，不含用户标识）。 */
export type AnalyticsProps = Record<string, string | number | boolean>;

/** 一条本地事件。 */
export interface AnalyticsEvent {
  name: AnalyticsEventName;
  /** 记录时间（Date.now()）。 */
  ts: number;
  props?: AnalyticsProps;
}

/** 本地匿名事件接口。 */
export interface Analytics {
  /** 记录一条事件。 */
  record(name: AnalyticsEventName, props?: AnalyticsProps): void;
  /** 已记录事件（时间升序；超出容量的旧事件被丢弃）。 */
  events(): readonly AnalyticsEvent[];
  /** 清空。 */
  clear(): void;
}

/**
 * 创建本地匿名事件记录器（内存数组，容量上限 FIFO）。
 *
 * @param capacity 容量上限（默认 500）
 */
export function createLocalAnalytics(capacity = 500): Analytics {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('capacity 必须为正整数');
  const buffer: AnalyticsEvent[] = [];
  return {
    record(name, props) {
      buffer.push({ name, ts: Date.now(), ...(props === undefined ? {} : { props }) });
      if (buffer.length > capacity) buffer.splice(0, buffer.length - capacity);
    },
    events() {
      return buffer;
    },
    clear() {
      buffer.length = 0;
    },
  };
}

let sharedAnalytics: Analytics | null = null;

/** 应用级共享记录器（UI 层埋点留位调用入口；懒创建，永不离开浏览器）。 */
export function getAnalytics(): Analytics {
  sharedAnalytics ??= createLocalAnalytics();
  return sharedAnalytics;
}
