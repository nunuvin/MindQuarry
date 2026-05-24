const headers = jest.fn()
const getSession = jest.fn()

jest.mock('next/headers', () => ({
  headers: (...args: unknown[]) => headers(...args),
}))

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}))

import { isLoggedIn } from '@/lib/authHelpers'

describe('isLoggedIn', () => {
  beforeEach(() => {
    headers.mockReset()
    getSession.mockReset()
  })

  it('returns true when the session contains a user', async () => {
    const rawHeaders = { cookie: 'session=value' }
    headers.mockResolvedValue(rawHeaders)
    getSession.mockResolvedValue({ user: { id: 'user-1' } })

    await expect(isLoggedIn()).resolves.toBe(true)
    expect(getSession).toHaveBeenCalledWith({ headers: rawHeaders })
  })

  it('returns false when no authenticated user is present', async () => {
    headers.mockResolvedValue({})
    getSession.mockResolvedValue(null)

    await expect(isLoggedIn()).resolves.toBe(false)
  })
})