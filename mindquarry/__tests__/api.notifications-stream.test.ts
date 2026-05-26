import { EventEmitter } from 'events'

import { GET } from '@/app/api/notifications/stream/route'

const getSession = jest.fn()
const getUnreadNotificationCount = jest.fn()
const getSharedPgListener = jest.fn()

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}))

jest.mock('@/lib/notifications', () => ({
  getUnreadNotificationCount: (...args: unknown[]) => getUnreadNotificationCount(...args),
}))

jest.mock('@/lib/pgListener', () => ({
  chatEventEmitter: new EventEmitter(),
  getSharedPgListener: (...args: unknown[]) => getSharedPgListener(...args),
}))

const { chatEventEmitter } = jest.requireMock('@/lib/pgListener') as { chatEventEmitter: EventEmitter }

function readChunk(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  return new TextDecoder().decode(value as ArrayBufferView)
}

jest.mock('next/headers', () => ({
  headers: () => new Headers(),
}))

describe('GET /api/notifications/stream', () => {
  beforeEach(() => {
    getSession.mockReset()
    getUnreadNotificationCount.mockReset()
    getSharedPgListener.mockReset()
    chatEventEmitter.removeAllListeners()
  })

  it('rejects anonymous users', async () => {
    getSession.mockResolvedValue(null)

    const response = await GET({ signal: new AbortController().signal } as never)

    expect(response.status).toBe(401)
    await expect(response.text()).resolves.toBe('Unauthorized')
  })

  it('streams the initial count and later notification updates for the signed-in user', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getSharedPgListener.mockResolvedValue({})
    getUnreadNotificationCount.mockResolvedValueOnce(4).mockResolvedValueOnce(9)

    const response = await GET({ signal: new AbortController().signal } as never)
    const reader = response.body?.getReader()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(getSharedPgListener).toHaveBeenCalled()

    const firstChunk = await reader?.read()
    expect(readChunk(firstChunk?.value)).toContain('"count":4')

    chatEventEmitter.emit('notification_event', 'user-1')

    const secondChunk = await reader?.read()
    expect(readChunk(secondChunk?.value)).toContain('"count":9')

    await reader?.cancel()
  })
})