import { render, screen } from '@testing-library/react'

import SearchPage from '@/app/search/page'

function createChain<T>(result: T, methods: string[]) {
  const chain: Record<string, jest.Mock> = {
    execute: jest.fn().mockResolvedValue(result),
  }

  methods.forEach((method) => {
    chain[method] = jest.fn(() => chain)
  })

  return chain
}

const quarriesChain = createChain([
  { id: 'quarry-1', name: 'postgres', description: 'Database topics' },
], ['selectAll', 'where', 'orderBy', 'limit'])

const queriesChain = createChain([
  {
    id: 'query-1',
    title: 'How do I rank full text search?',
    body: '<p>Use ts_rank</p>',
    score: 5,
    accepted_answer_id: null,
    created_at: new Date('2026-05-23T10:00:00Z'),
    name: 'Alice',
    displayUsername: 'alice',
    username: 'alice',
    quarry_name: 'postgres',
  },
], ['leftJoin', 'select', 'where', 'orderBy', 'limit'])

const searchTags = jest.fn()
const getTaggedQueryIds = jest.fn()
const getQueryTagMap = jest.fn()

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: jest.fn((table: string) => {
      if (table === 'quarries') return quarriesChain
      if (table === 'queries') return queriesChain
      throw new Error(`Unexpected table ${table}`)
    }),
  },
}))

jest.mock('@/lib/tags', () => ({
  searchTags: (...args: unknown[]) => searchTags(...args),
  getTaggedQueryIds: (...args: unknown[]) => getTaggedQueryIds(...args),
  getQueryTagMap: (...args: unknown[]) => getQueryTagMap(...args),
}))

describe('Search page', () => {
  beforeEach(() => {
    searchTags.mockReset()
    getTaggedQueryIds.mockReset()
    getQueryTagMap.mockReset()
  })

  it('renders the empty search prompt when no query is provided', async () => {
    const Component = await SearchPage({ searchParams: Promise.resolve({}) })

    render(Component)

    expect(screen.getByText('Enter a term to search the platform.')).toBeInTheDocument()
  })

  it('renders matching tags, communities, and posts for a query', async () => {
    searchTags.mockResolvedValue([{ id: 'tag-1', name: 'full-text-search', quarry_id: 'quarry-1' }])
    getTaggedQueryIds.mockResolvedValue(['query-1'])
    getQueryTagMap.mockResolvedValue(new Map([
      ['query-1', [{ id: 'tag-1', name: 'full-text-search', quarry_id: 'quarry-1' }]],
    ]))

    const Component = await SearchPage({ searchParams: Promise.resolve({ q: 'search' }) })

    render(Component)

    expect(screen.getByText('Matching tags')).toBeInTheDocument()
    expect(screen.getByText('#full-text-search')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /How do I rank full text search/i })).toBeInTheDocument()
    expect(screen.getByText('full-text-search')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /q\/postgres/i })).toBeInTheDocument()
  })
})