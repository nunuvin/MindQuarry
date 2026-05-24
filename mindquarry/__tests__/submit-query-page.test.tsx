import { render, screen } from '@testing-library/react'

import SubmitQueryPage from '@/app/q/[name]/submit/page'

function createChain<T>(result: T, methods: string[] = ['select', 'where']) {
  const chain: Record<string, jest.Mock> = {
    executeTakeFirst: jest.fn().mockResolvedValue(result),
  }

  methods.forEach((method) => {
    chain[method] = jest.fn(() => chain)
  })

  return chain
}

const quarryChain = createChain({
  id: 'quarry-1',
  name: 'postgres',
  visibility: 'public',
  is_invite_only: false,
  allow_user_tags: true,
})

const getAvailableTagsForQuarry = jest.fn()

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
    },
  },
}))

jest.mock('next/headers', () => ({
  headers: () => new Map(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: jest.fn((table: string) => {
      if (table === 'quarries') return quarryChain
      throw new Error(`Unexpected table ${table}`)
    }),
  },
}))

jest.mock('@/lib/visibility', () => ({
  canViewQuarry: jest.fn().mockResolvedValue({ allowed: true }),
}))

jest.mock('@/lib/tags', () => ({
  getAvailableTagsForQuarry: (...args: unknown[]) => getAvailableTagsForQuarry(...args),
  assignTagsToQuery: jest.fn(),
}))

jest.mock('@/components/TipTapEditor', () => ({
  TipTapEditor: ({ placeholder }: { placeholder: string }) => <div>{placeholder}</div>,
}))

describe('Submit query page', () => {
  beforeEach(() => {
    getAvailableTagsForQuarry.mockReset()
  })

  it('renders tag choices and custom tags when the quarry allows them', async () => {
    getAvailableTagsForQuarry.mockResolvedValue([
      { id: 'tag-1', name: 'testing', description: 'Tests', quarry_id: null },
      { id: 'tag-2', name: 'full-text-search', description: 'Search', quarry_id: 'quarry-1' },
    ])

    const Component = await SubmitQueryPage({ params: Promise.resolve({ name: 'postgres' }) })

    render(Component)

    expect(screen.getByRole('heading', { name: 'Submit Query to q/postgres' })).toBeInTheDocument()
    expect(screen.getByText('testing')).toBeInTheDocument()
    expect(screen.getByText('full-text-search')).toBeInTheDocument()
    expect(screen.getByLabelText('Custom Tags')).toBeInTheDocument()
  })
})