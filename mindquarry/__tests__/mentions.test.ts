const selectFrom = jest.fn()

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: (table: string) => selectFrom(table),
  },
}))

describe('mention helpers', () => {
  beforeEach(() => {
    selectFrom.mockReset()
  })

  it('extracts usernames once and ignores quoted mention text', async () => {
    const { extractMentionedUsernames } = await import('@/lib/mentions')

    expect(extractMentionedUsernames('<blockquote><p>@alice</p></blockquote><p>Hello @Bob and @bob and @carol</p>')).toEqual(['bob', 'carol'])
  })

  it('applies mention markup to the first resolved valid username only', async () => {
    const execute = jest.fn().mockResolvedValue([
      { id: 'user-2', username: 'bob' },
      { id: 'user-3', username: 'carol' },
    ])
    const whereExclude = jest.fn(() => ({ execute }))
    const whereUsernames = jest.fn(() => ({ where: whereExclude }))
    const select = jest.fn(() => ({ where: whereUsernames }))

    selectFrom.mockImplementation((table: string) => {
      if (table === 'user') {
        return { select }
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const { normalizeMentionContent } = await import('@/lib/mentions')
    const normalized = await normalizeMentionContent('<p>Hello @bob and @carol</p>', 'user-1')

    expect(normalized.mention).toEqual({ id: 'user-2', username: 'bob' })
    expect(normalized.content).toContain('href="/users/bob"')
    expect(normalized.content).toContain('data-mention="true"')
    expect(normalized.content).toContain('@carol')
    expect(normalized.content).not.toContain('href="/users/carol"')
  })
})