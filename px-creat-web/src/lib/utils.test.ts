import { describe, expect, it } from 'vitest'
import { cn, escapeHtml } from '@/lib/utils'

describe('cn', () => {
  it('过滤假值', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('展平数组', () => {
    expect(cn(['a', 'b'], ['c'])).toBe('a b c')
  })

  it('读取对象真值键', () => {
    expect(cn({ a: true, b: false, c: true })).toBe('a c')
  })

  it('混合输入', () => {
    expect(cn('card', ['p-4', { 'shadow-soft': true, hidden: false }], 0)).toBe('card p-4 shadow-soft')
  })

  it('空输入返回空串', () => {
    expect(cn()).toBe('')
    expect(cn(null, undefined, false)).toBe('')
  })
})

describe('escapeHtml', () => {
  it('转义五个危险字符', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')
  })

  it('普通文本不变', () => {
    expect(escapeHtml('拼豆 PinDou')).toBe('拼豆 PinDou')
  })
})
