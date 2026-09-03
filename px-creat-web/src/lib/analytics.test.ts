import { describe, expect, it } from 'vitest';

import { createLocalAnalytics } from './analytics';

describe('createLocalAnalytics', () => {
  it('记录事件并保持顺序', () => {
    const analytics = createLocalAnalytics();
    analytics.record('editor_open');
    analytics.record('import_convert', { targetW: 29, mode: 'cartoon' });
    analytics.record('finish_preset_apply', { preset: 'glitter', intensity: 80 });
    const events = analytics.events();
    expect(events.map((e) => e.name)).toEqual(['editor_open', 'import_convert', 'finish_preset_apply']);
    expect(events[0].ts).toBeLessThanOrEqual(events[1].ts);
    expect(events[1].props).toEqual({ targetW: 29, mode: 'cartoon' });
    expect(events[2].props).toEqual({ preset: 'glitter', intensity: 80 });
  });

  it('容量上限 FIFO 丢弃旧事件', () => {
    const analytics = createLocalAnalytics(3);
    for (let i = 0; i < 5; i++) analytics.record('editor_open', { i });
    const events = analytics.events();
    expect(events).toHaveLength(3);
    expect(events[0].props).toEqual({ i: 2 });
    expect(events[2].props).toEqual({ i: 4 });
  });

  it('clear 清空', () => {
    const analytics = createLocalAnalytics();
    analytics.record('editor_open');
    analytics.clear();
    expect(analytics.events()).toHaveLength(0);
  });

  it('非法容量抛错', () => {
    expect(() => createLocalAnalytics(0)).toThrow();
    expect(() => createLocalAnalytics(1.5)).toThrow();
  });
});
