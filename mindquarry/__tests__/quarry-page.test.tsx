import { render, screen } from '@testing-library/react'

import QuarryPage from '@/app/q/[name]/page'

function createChain<T>(result: T, methods: string[] = ['leftJoin', 'select', 'where', 'orderBy']) {
  const chain: Record<string, jest.Mock> = {
    executeTakeFirst: jest.fn().mockResolvedValue(result),
    execute: jest.fn().mockResolvedValue(result),
  }

  methods.forEach((method) => {
    chain[method] = jest.fn(() => chain)
  })

  return chain
}

const quarryChain = createChain({
  id: 'quarry-1',
  name: 'javascript',
  description: 'JS topics',
  visibility: 'members',
  is_invite_only: false,
}, ['selectAll', 'where'])
const membershipChain = createChain({ role: 'moderator' }, ['select', 'where'])
const queriesChain = createChain([
  {
    id: 'query-1',
    title: 'How do I test this?',
    body: '<p>Question body</p>',
    score: 2,
    accepted_answer_id: null,
    created_at: new Date('2026-05-25T10:00:00Z'),
    author_id: 'user-1',
    name: 'Alice',
    displayUsername: 'alice',
    username: 'alice',
    views: 4,
    validation_status: 'approved',
    is_archived: false,
    first_answer_body: null,
  },
], ['leftJoin', 'select', 'where', 'orderBy'])
const authorRolesChain = createChain([
  { user_id: 'user-1', role: 'admin' },
], ['select', 'where'])

const getQueryTagMap = jest.fn().mockResolvedValue(new Map())

const selectFrom = jest.fn()

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: (table: string) => selectFrom(table),
  },
}))

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn().mockResolvedValue({
        user: { id: 'viewer-1' },
      }),
    },
  },
}))

jest.mock('next/headers', () => ({
  headers: () => new Map(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/visibility', () => ({
  canViewQuarry: jest.fn().mockResolvedValue({ allowed: true }),
  getQuarryVisibility: jest.fn(() => 'members'),
}))

jest.mock('@/lib/votes', () => ({
  applyQueryVote: jest.fn(),
}))

jest.mock('@/lib/admin', () => ({
  isGlobalAdmin: jest.fn().mockResolvedValue(false),
}))

jest.mock('@/lib/tags', () => ({
  getQueryTagMap: (...args: unknown[]) => getQueryTagMap(...args),
}))

describe('Quarry page', () => {
  beforeEach(() => {
    selectFrom.mockReset()
    selectFrom.mockImplementation((table: string) => {
      if (table === 'quarries') return quarryChain
      if (table === 'quarry_members') {
        const quarryMemberCalls = selectFrom.mock.calls.filter(([calledTable]) => calledTable === 'quarry_members').length
        return quarryMemberCalls === 1 ? membershipChain : authorRolesChain
      }
      if (table === 'queries') return queriesChain
      throw new Error(`Unexpected table ${table}`)
    })
  })

  it('renders quarry role badges for query authors', async () => {
    const Component = await QuarryPage({
      params: Promise.resolve({ name: 'javascript' }),
      searchParams: Promise.resolve({}),
    })

    render(Component)

    expect(screen.getByText('qadmin')).toBeInTheDocument()
    expect(screen.getByText('How do I test this?')).toBeInTheDocument()
  })
})