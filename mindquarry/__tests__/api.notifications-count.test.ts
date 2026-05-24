import { GET } from '@/app/api/notifications/count/route'

const getSession = jest.fn()
const getUnreadNotificationCount = jest.fn()
const isRateLimited = jest.fn()

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

jest.mock('@/lib/rateLimit', () => ({
  isRateLimited: (...args: unknown[]) => isRateLimited(...args),
}))

jest.mock('next/headers', () => ({
  headers: () => new Headers(),
}))

describe('GET /api/notifications/count', () => {
  beforeEach(() => {
    getSession.mockReset()
    getUnreadNotificationCount.mockReset()
    isRateLimited.mockReset()
  })

  it('returns zero for anonymous users', async () => {
    getSession.mockResolvedValue(null)

    const response = await GET()

    await expect(response.json()).resolves.toEqual({ count: 0 })
    expect(response.status).toBe(200)
    expect(getUnreadNotificationCount).not.toHaveBeenCalled()
  })

  it('returns a rate-limited response for excessive polling', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    isRateLimited.mockReturnValue(true)

    const response = await GET()

    await expect(response.json()).resolves.toEqual({ count: 0, rateLimited: true })
    expect(response.status).toBe(429)
    expect(getUnreadNotificationCount).not.toHaveBeenCalled()
  })

  it('returns the unread notification count for an authenticated user', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    isRateLimited.mockReturnValue(false)
    getUnreadNotificationCount.mockResolvedValue(7)

    const response = await GET()

    await expect(response.json()).resolves.toEqual({ count: 7 })
    expect(response.status).toBe(200)
    expect(getUnreadNotificationCount).toHaveBeenCalledWith('user-1')
  })
})
