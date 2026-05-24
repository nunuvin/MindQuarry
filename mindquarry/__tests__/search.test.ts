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

  it('falls back to all-scope when the prefix is unknown', async () => {
    const { parseSearchInput } = await import('@/lib/search')

    expect(parseSearchInput('tag: search')).toEqual({
      scope: 'all',
      term: 'tag: search',
    })
  })
})