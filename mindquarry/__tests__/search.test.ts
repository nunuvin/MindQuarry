const dbMock = {}

jest.mock('@/lib/db', () => ({
  db: dbMock,
}))

describe('search helpers', () => {
  it('parses default search terms without a scope prefix', async () => {
    const { parseSearchInput } = await import('@/lib/search')

    expect(parseSearchInput('alice cooper')).toEqual({
      scope: 'all',
      term: 'alice cooper',
    })
  })

  it('parses a user-scoped query with quotes', async () => {
    const { parseSearchInput } = await import('@/lib/search')

    expect(parseSearchInput('u: "alice"')).toEqual({
      scope: 'users',
      term: 'alice',
    })
  })

  it('parses a quarry-scoped query', async () => {
    const { parseSearchInput } = await import('@/lib/search')

    expect(parseSearchInput('q: postgres')).toEqual({
      scope: 'quarries',
      term: 'postgres',
    })
  })

  it('parses an explicit query scope', async () => {
    const { parseSearchInput } = await import('@/lib/search')

    expect(parseSearchInput('query: indexing')).toEqual({
      scope: 'queries',
      term: 'indexing',
    })
  })

  it('parses the post alias for query search', async () => {
    const { parseSearchInput } = await import('@/lib/search')

    expect(parseSearchInput('p: indexing')).toEqual({
      scope: 'queries',
      term: 'indexing',
    })
  })

  it('falls back to all-scope when the prefix is unknown', async () => {
    const { parseSearchInput } = await import('@/lib/search')

    expect(parseSearchInput('tag: search')).toEqual({
      scope: 'all',
      term: 'tag: search',
    })
  })

  it('classifies search access levels for visibility and admin overrides', async () => {
    const { resolveQuarrySearchAccessLevel, resolveQuerySearchAccessLevel, resolveUserSearchAccessLevel } = await import('@/lib/search')

    expect(resolveQuarrySearchAccessLevel({ visibility: 'public' })).toBe('public')
    expect(resolveQuarrySearchAccessLevel({ visibility: 'authenticated' })).toBe('authenticated')
    expect(resolveQuarrySearchAccessLevel({ visibility: 'members', isMember: true })).toBe('members')
    expect(resolveQuarrySearchAccessLevel({ visibility: 'members', isMember: false, viewerIsGlobalAdmin: true })).toBe('admin')
    expect(resolveQuerySearchAccessLevel({ visibility: 'public', isHidden: true, viewerIsGlobalAdmin: true })).toBe('admin')
    expect(resolveUserSearchAccessLevel({ profileVisibility: 'private', viewerIsGlobalAdmin: true })).toBe('admin')
  })
})