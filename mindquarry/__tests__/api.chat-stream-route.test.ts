import { GET } from '@/app/api/chat/[conversationId]/stream/route'

const getSession = jest.fn()
const executeTakeFirst = jest.fn()
const whereUser = jest.fn(() => ({ executeTakeFirst }))
const whereConversation = jest.fn(() => ({ where: whereUser }))
const selectFrom = jest.fn(() => ({ where: whereConversation }))
const getSharedPgListener = jest.fn()
const on = jest.fn()
const off = jest.fn()

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}))

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: (...args: unknown[]) => selectFrom(...args),
  },
}))

jest.mock('@/lib/pgListener', () => ({
  getSharedPgListener: (...args: unknown[]) => getSharedPgListener(...args),
  chatEventEmitter: {
    on: (...args: unknown[]) => on(...args),
    off: (...args: unknown[]) => off(...args),
  },
}))

jest.mock('next/headers', () => ({
  headers: () => new Headers(),
}))

describe('GET /api/chat/[conversationId]/stream', () => {
  beforeEach(() => {
    getSession.mockReset()
    executeTakeFirst.mockReset()
    whereUser.mockClear()
    whereConversation.mockClear()
    selectFrom.mockClear()
    getSharedPgListener.mockReset()
    on.mockReset()
    off.mockReset()
  })

  it('returns unauthorized when there is no session', async () => {
    getSession.mockResolvedValue(null)
    const controller = new AbortController()

    const response = await GET({ signal: controller.signal } as never, {
      params: Promise.resolve({ conversationId: 'conv-1' }),
    })

    expect(response.status).toBe(401)
    await expect(response.text()).resolves.toBe('Unauthorized')
  })

  it('returns forbidden when the user is not a participant', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    executeTakeFirst.mockResolvedValue(undefined)
    const controller = new AbortController()

    const response = await GET({ signal: controller.signal } as never, {
      params: Promise.resolve({ conversationId: 'conv-1' }),
    })

    expect(selectFrom).toHaveBeenCalledWith('conversation_participants')
    expect(response.status).toBe(403)
    await expect(response.text()).resolves.toBe('Forbidden')
  })

  it('returns an event stream response for authorized participants', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    executeTakeFirst.mockResolvedValue({ conversation_id: 'conv-1', user_id: 'user-1' })
    getSharedPgListener.mockResolvedValue(undefined)
    const controller = new AbortController()

    const response = await GET({ signal: controller.signal } as never, {
      params: Promise.resolve({ conversationId: 'conv-1' }),
    })

    expect(getSharedPgListener).toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(on).toHaveBeenCalledTimes(2)

    controller.abort()
  })
})
