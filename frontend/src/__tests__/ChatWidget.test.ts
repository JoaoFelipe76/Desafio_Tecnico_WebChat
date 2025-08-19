import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatWidget from '../components/ChatWidget.vue'

function mountWidget(opts: { apiBase?: string } = {}) {
  const apiBase = opts.apiBase ?? 'http://localhost:3000'
  return mount(ChatWidget, {
    props: { apiBase, agentName: 'Test', agentAvatar: '' },
    attachTo: document.body,
  })
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
}

async function waitFor(check: () => boolean, timeoutMs = 1000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (check()) return
    await Promise.resolve()
  }
  throw new Error('waitFor timeout')
}

describe('ChatWidget', () => {
  const originalRAF = globalThis.requestAnimationFrame
  const originalFetch = globalThis.fetch
  const originalLocation = globalThis.location

  beforeEach(() => {
    // fast-forward scrolls
    ;(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0)
      return 0 as any
    }
    // jsdom location can be tricky to override; reassign via defineProperty
    Object.defineProperty(globalThis, 'location', {
      value: new URL('http://localhost'),
      writable: true,
    })
    localStorage.clear()
    vi.useRealTimers()
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ reply: 'ok', sessionId: 's1' }), { status: 200, headers: { 'Content-Type': 'application/json' } }) as any
    }) as any
  })

  afterEach(() => {
    ;(globalThis as any).requestAnimationFrame = originalRAF
    globalThis.fetch = originalFetch as any
    Object.defineProperty(globalThis, 'location', { value: originalLocation })
  })

  it('does not send empty or whitespace-only messages', async () => {
    const wrapper = mountWidget()
    const input = wrapper.find('input')
    await input.setValue('   ')
    await wrapper.find('form').trigger('submit.prevent')
    await flush()
    expect(wrapper.findAll('.bubble').length).toBe(0)
    expect((globalThis.fetch as any).mock.calls.length).toBe(0)
    wrapper.unmount()
  })

  it('sanitizes user input (removes tags and attributes)', async () => {
    const wrapper = mountWidget()
    const input = wrapper.find('input')
    await input.setValue('<img src=x onerror=alert(1)>hello')
    await wrapper.find('form').trigger('submit.prevent')
    await waitFor(() => wrapper.findAll('.bubble').length >= 2)
    const bubbles = wrapper.findAll('.bubble')
    expect(bubbles[0].text()).toBe('hello')
    const last = bubbles[bubbles.length - 1]
    expect(last.text()).toBe('ok')
    wrapper.unmount()
  })

  it('rate limits rapid consecutive sends', async () => {
    const wrapper = mountWidget()
    const input = wrapper.find('input')
    await input.setValue('first')
    await wrapper.find('form').trigger('submit.prevent')
    await flush()
    // freeze time to force min-interval violation
    const realNow = Date.now
    let now = realNow()
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    await input.setValue('second')
    await wrapper.find('form').trigger('submit.prevent')
    await waitFor(() => wrapper.findAll('.bubble').some(b => b.text().includes('Aguarde')))
    const bubbles = wrapper.findAll('.bubble')
    const hasRateLimitMsg = bubbles.some(b => b.text().includes('Aguarde'))
    expect(hasRateLimitMsg).toBe(true)
    ;(Date.now as any).mockRestore?.()
    wrapper.unmount()
  })

  it('uses cache for repeated question within TTL and avoids network', async () => {
    const wrapper = mountWidget()
    const input = wrapper.find('input')
    // first send
    await input.setValue('cached?')
    await wrapper.find('form').trigger('submit.prevent')
    await flush()
    const fetchSpy = globalThis.fetch as any
    expect(fetchSpy.mock.calls.length).toBe(1)
    // advance time to bypass min-interval but stay within TTL
    const realNow = Date.now
    let now = realNow()
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    now += 1000
    ;(Date.now as any).mockImplementation(() => now)
    await input.setValue('cached?')
    await wrapper.find('form').trigger('submit.prevent')
    await flush()
    expect(fetchSpy.mock.calls.length).toBe(1)
    ;(Date.now as any).mockRestore?.()
    wrapper.unmount()
  })

  it('blocks insecure API over HTTP when page is HTTPS', async () => {
    Object.defineProperty(globalThis, 'location', { value: new URL('https://example.com') })
    const wrapper = mountWidget({ apiBase: 'http://insecure.local' })
    const input = wrapper.find('input')
    await input.setValue('hi')
    await wrapper.find('form').trigger('submit.prevent')
    await flush()
    const bubbles = wrapper.findAll('.bubble')
    const hasHttpsWarn = bubbles.some(b => b.text().includes('Conexão insegura'))
    expect(hasHttpsWarn).toBe(true)
    expect((globalThis.fetch as any).mock.calls.length).toBe(0)
    wrapper.unmount()
  })
})


