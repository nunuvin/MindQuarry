import { GET } from '@/app/api/auth/password-reset-status/route'

const getSession = jest.fn()
const isRateLimited = jest.fn()
const executeTakeFirst = jest.fn()
const where = jest.fn(() => ({ executeTakeFirst }))
const select = jest.fn(() => ({ where }))
const selectFrom = jest.fn(() => ({ select }))

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

jest.mock('@/lib/rateLimit', () => ({
  isRateLimited: (...args: unknown[]) => isRateLimited(...args),
}))

describe('GET /api/auth/password-reset-status', () => {
  beforeEach(() => {
    getSession.mockReset()
    isRateLimited.mockReset()
    executeTakeFirst.mockReset()
    where.mockClear()
    select.mockClear()
    selectFrom.mockClear()
  })

  it('returns 401 for anonymous users', async () => {
    getSession.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost/api/auth/password-reset-status'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ required: false })
  })

  it('returns 429 when password-reset status checks are rate limited', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    isRateLimited.mockReturnValue(true)

    const response = await GET(new Request('http://localhost/api/auth/password-reset-status'))

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({ required: false, rateLimited: true })
    expect(selectFrom).not.toHaveBeenCalled()
  })

  it('returns the force-reset flag for authenticated users', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    isRateLimited.mockReturnValue(false)
    executeTakeFirst.mockResolvedValue({ force_password_reset: true })

    const response = await GET(new Request('http://localhost/api/auth/password-reset-status'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ required: true })
    expect(selectFrom).toHaveBeenCalledWith('profiles')
    expect(where).toHaveBeenCalledWith('user_id', '=', 'user-1')
  })
})