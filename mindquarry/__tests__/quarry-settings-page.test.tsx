import { render, screen } from '@testing-library/react'

import QuarrySettingsPage from '@/app/q/[name]/settings/page'

function createChain<T>(result: T, methods: string[] = ['selectAll', 'where']) {
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
  description: 'Database topics',
  visibility: 'public',
  is_invite_only: false,
  allow_user_tags: true,
  custom_ban_template: null,
})

const membershipChain = createChain({ role: 'admin' })
const teamMembersChain = createChain([
  {
    user_id: 'user-1',
    role: 'admin',
    name: 'Alice',
    displayUsername: 'alice',
    username: 'alice',
  },
], ['leftJoin', 'select', 'where', 'orderBy'])
const postingPoliciesChain = createChain([], ['leftJoin', 'select', 'where', 'orderBy'])
const getAvailableTagsForQuarry = jest.fn()
const selectFrom = jest.fn()

postingPoliciesChain.execute = jest.fn().mockResolvedValue([])
teamMembersChain.execute = jest.fn().mockResolvedValue([
  {
    user_id: 'user-1',
    role: 'admin',
    name: 'Alice',
    displayUsername: 'alice',
    username: 'alice',
  },
])

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
    selectFrom: (table: string) => selectFrom(table),
  },
}))

beforeEach(() => {
  selectFrom.mockReset()
  selectFrom.mockImplementation((table: string) => {
      if (table === 'quarries') return quarryChain
      if (table === 'quarry_members') {
        const quarryMemberCalls = selectFrom.mock.calls.filter(([calledTable]) => calledTable === 'quarry_members').length
        return quarryMemberCalls === 1 ? teamMembersChain : membershipChain
      }
      if (table === 'posting_policies') return postingPoliciesChain
      throw new Error(`Unexpected table ${table}`)
  })
})

jest.mock('@/lib/tags', () => ({
  getAvailableTagsForQuarry: (...args: unknown[]) => getAvailableTagsForQuarry(...args),
  addQuarryTags: jest.fn(),
}))

describe('Quarry settings page', () => {
  beforeEach(() => {
    getAvailableTagsForQuarry.mockReset()
  })

  it('renders tag management and moderation links for quarry admins', async () => {
    getAvailableTagsForQuarry.mockResolvedValue([
      { id: 'tag-1', name: 'database', quarry_id: null },
      { id: 'tag-2', name: 'full-text-search', quarry_id: 'quarry-1' },
    ])

    const Component = await QuarrySettingsPage({ params: Promise.resolve({ name: 'postgres' }) })

    render(Component)

    expect(screen.getByText('Instance Tags')).toBeInTheDocument()
    expect(screen.getByText('Quarry Tags')).toBeInTheDocument()
    expect(screen.getByText('database')).toBeInTheDocument()
    expect(screen.getByText('full-text-search')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Mod Queue' })).toHaveAttribute('href', '/q/postgres/mod/queue')
  })
})