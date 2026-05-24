describe('isRateLimited', () => {
  let isRateLimited: typeof import('@/lib/rateLimit').isRateLimited
  let now = 1_000

  beforeEach(async () => {
    jest.resetModules()
    jest.spyOn(Date, 'now').mockImplementation(() => now)
    ;({ isRateLimited } = await import('@/lib/rateLimit'))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('allows the first request in a fresh window', () => {
    expect(isRateLimited('user-1', 'post_query', 2, 60_000)).toBe(false)
  })

  it('blocks requests after the maximum count is exceeded', () => {
    expect(isRateLimited('user-1', 'post_query', 2, 60_000)).toBe(false)
    expect(isRateLimited('user-1', 'post_query', 2, 60_000)).toBe(false)
    expect(isRateLimited('user-1', 'post_query', 2, 60_000)).toBe(true)
  })

  it('keeps the same window active at the exact reset boundary', () => {
    expect(isRateLimited('user-1', 'post_query', 1, 60_000)).toBe(false)

    now += 60_000

    expect(isRateLimited('user-1', 'post_query', 1, 60_000)).toBe(true)
  })

  it('resets the counter once the window has expired', () => {
    expect(isRateLimited('user-1', 'post_query', 1, 60_000)).toBe(false)

    now += 60_001

    expect(isRateLimited('user-1', 'post_query', 1, 60_000)).toBe(false)
  })
})