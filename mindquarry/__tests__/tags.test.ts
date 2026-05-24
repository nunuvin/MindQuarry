import { getDefaultQuarryTags, INSTANCE_DEFAULT_TAGS, normalizeTagName, parseTagInput } from '@/lib/tags'

describe('tag helpers', () => {
  it('normalizes tag names into stable lowercase slugs', () => {
    expect(normalizeTagName('  Full Text Search  ')).toBe('full-text-search')
  })

  it('parses comma-separated tags, dedupes them, and drops short entries', () => {
    expect(parseTagInput(' Search, testing, search, x, full text ')).toEqual([
      'search',
      'testing',
      'full-text',
    ])
  })

  it('exposes instance-wide default tags for every quarry', () => {
    expect(INSTANCE_DEFAULT_TAGS.map((tag) => tag.name)).toEqual(expect.arrayContaining([
      'discussion',
      'testing',
      'database',
    ]))
  })

  it('returns generic quarry tags for any quarry', () => {
    expect(getDefaultQuarryTags('custom-quarry').map((tag) => tag.name)).toEqual(expect.arrayContaining([
      'getting-started',
      'troubleshooting',
      'best-practices',
    ]))
  })

  it('adds quarry-specific presets for known quarry names', () => {
    expect(getDefaultQuarryTags('postgres').map((tag) => tag.name)).toEqual(expect.arrayContaining([
      'sql',
      'indexes',
      'full-text-search',
    ]))
  })
})