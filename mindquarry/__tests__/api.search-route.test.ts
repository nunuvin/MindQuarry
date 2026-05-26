import { GET } from '@/app/api/search/route'

const getSession = jest.fn()
const isGlobalAdmin = jest.fn()
const isRateLimited = jest.fn()
const runSearch = jest.fn()
const buildSearchRateLimitKey = jest.fn()

jest.mock('@/lib/admin', () => ({
  isGlobalAdmin: (...args: unknown[]) => isGlobalAdmin(...args),
}))

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}))

jest.mock('@/lib/rateLimit', () => ({
  isRateLimited: (...args: unknown[]) => isRateLimited(...args),
}))

jest.mock('@/lib/search', () => ({
  buildSearchRateLimitKey: (...args: unknown[]) => buildSearchRateLimitKey(...args),
  runSearch: (...args: unknown[]) => runSearch(...args),
}))

describe('GET /api/search', () => {
  beforeEach(() => {
    getSession.mockReset()
    isGlobalAdmin.mockReset()
    isRateLimited.mockReset()
    runSearch.mockReset()
    buildSearchRateLimitKey.mockReset()
  })

  it('returns a rate-limited response when the threshold is exceeded', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    isGlobalAdmin.mockResolvedValue(false)
    buildSearchRateLimitKey.mockReturnValue('fingerprint-1')
    isRateLimited.mockReturnValue(true)

    const response = await GET({
      headers: new Headers(),
      nextUrl: new URL('http://localhost/api/search?q=alice'),
    } as never)

    expect(buildSearchRateLimitKey).toHaveBeenCalledWith(expect.any(Headers), 'user-1')
    expect(isRateLimited).toHaveBeenCalledWith('fingerprint-1', 'search:initial:all', 30, 60000)
    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({ error: 'Search rate limited.' })
  })

  it('passes search pagination parameters through to the shared search helper', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-2' } })
    isGlobalAdmin.mockResolvedValue(true)
    buildSearchRateLimitKey.mockReturnValue('fingerprint-2')
    isRateLimited.mockReturnValue(false)
    runSearch.mockResolvedValue({
      scope: 'users',
      term: 'alice',
      users: { items: [{ id: 'u1', username: 'alice', displayUsername: 'Alice', name: 'Alice', image: null, accessLevel: 'admin' }], nextOffset: 10 },
      quarries: { items: [], nextOffset: null },
      queries: { items: [], nextOffset: null },
    })

    const response = await GET({
      headers: new Headers(),
      nextUrl: new URL('http://localhost/api/search?q=u:%20%22alice%22&mode=more&section=users&offset=5'),
    } as never)

    expect(isRateLimited).toHaveBeenCalledWith('fingerprint-2', 'search:more:users', 120, 60000)
    expect(runSearch).toHaveBeenCalledWith({
      rawQuery: 'u: "alice"',
      viewerId: 'user-2',
      viewerIsGlobalAdmin: true,
      mode: 'more',
      section: 'users',
      offset: 5,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      scope: 'users',
      term: 'alice',
      users: { items: [{ id: 'u1', username: 'alice', displayUsername: 'Alice', name: 'Alice', image: null, accessLevel: 'admin' }], nextOffset: 10 },
      quarries: { items: [], nextOffset: null },
      queries: { items: [], nextOffset: null },
    })
  })
})