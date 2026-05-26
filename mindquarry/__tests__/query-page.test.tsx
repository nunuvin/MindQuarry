import { render, screen } from '@testing-library/react'

import QueryDiscussionPage from '@/app/q/[name]/query/[id]/page'

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

const quarryChain = createChain({ id: 'quarry-1', name: 'javascript', is_invite_only: false }, ['select', 'where'])
const quarryMembershipChain = createChain({ role: 'admin' }, ['select', 'where'])
const authorRolesChain = createChain([
  { user_id: 'user-1', role: 'admin' },
  { user_id: 'user-2', role: 'moderator' },
], ['select', 'where'])
const subscriptionChain = createChain(null, ['select', 'where'])
const queryChain = createChain({
  id: 'query-1',
  title: 'How do replies work?',
  body: '<p>Question body</p>',
  score: 4,
  accepted_answer_id: null,
  created_at: new Date('2026-05-23T10:00:00Z'),
  author_id: 'user-1',
  name: 'Alice',
  displayUsername: 'alice',
  username: 'alice',
  views: 12,
}, ['leftJoin', 'select', 'where'])
const answersChain = createChain([
  {
    id: 'answer-1',
    body: '<p>First answer</p>',
    score: 2,
    parent_answer_id: null,
    created_at: new Date('2026-05-23T11:00:00Z'),
    author_id: 'user-2',
    name: 'Bob',
    displayUsername: 'bob',
    username: 'bob',
  },
], ['leftJoin', 'select', 'where', 'orderBy'])

const getQueryTagMap = jest.fn().mockResolvedValue(new Map([
  ['query-1', [{ id: 'tag-1', name: 'testing', quarry_id: null }]],
]))
const getAvailableTagsForQuarry = jest.fn().mockResolvedValue([
  { id: 'tag-1', name: 'testing', description: 'Testing topics', quarry_id: null },
])

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: jest.fn((table: string) => {
      if (table === 'quarries') return quarryChain
      if (table === 'quarry_members') {
        const quarryMemberCalls = (jest.requireMock('@/lib/db').db.selectFrom as jest.Mock).mock.calls.filter(([calledTable]: [string]) => calledTable === 'quarry_members').length
        return quarryMemberCalls === 1 ? quarryMembershipChain : authorRolesChain
      }
      if (table === 'query_subscriptions') return subscriptionChain
      if (table === 'queries') return queryChain
      if (table === 'answers') return answersChain
      throw new Error(`Unexpected table ${table}`)
    }),
    insertInto: jest.fn(() => {
      const chain = {
        values: jest.fn(() => chain),
        onConflict: jest.fn(() => chain),
        doUpdateSet: jest.fn(() => chain),
        execute: jest.fn().mockResolvedValue(undefined),
      }

      return chain
    }),
  },
}))

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn().mockResolvedValue({
        user: { id: 'user-1', name: 'Alice' },
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

jest.mock('@/lib/rateLimit', () => ({
  isRateLimited: jest.fn(() => false),
}))

jest.mock('@/components/TipTapRenderer', () => ({
  TipTapRenderer: ({ content }: { content: string }) => <div>{content.replace(/<[^>]+>/g, '')}</div>,
}))

jest.mock('@/lib/tags', () => ({
  getQueryTagMap: (...args: unknown[]) => getQueryTagMap(...args),
  getAvailableTagsForQuarry: (...args: unknown[]) => getAvailableTagsForQuarry(...args),
  replaceTagsForQuery: jest.fn(),
}))

jest.mock('@/lib/admin', () => ({
  isGlobalAdmin: jest.fn().mockResolvedValue(false),
}))

jest.mock('@/app/q/[name]/query/[id]/CopyLinkButton', () => ({
  CopyLinkButton: ({ answerId }: { answerId: string }) => <button type="button">Copy {answerId}</button>,
}))

describe('Query discussion page', () => {
  it('renders the query title', async () => {
    const Component = await QueryDiscussionPage({ params: Promise.resolve({ name: 'javascript', id: 'query-1' }) })

    render(Component)

    expect(screen.getByText('How do replies work?')).toBeInTheDocument()
  })

  it('renders the answer body', async () => {
    const Component = await QueryDiscussionPage({ params: Promise.resolve({ name: 'javascript', id: 'query-1' }) })

    render(Component)

    expect(screen.getAllByText('First answer').length).toBeGreaterThanOrEqual(1)
  })

  it('renders vote controls for the query and answers', async () => {
    const Component = await QueryDiscussionPage({ params: Promise.resolve({ name: 'javascript', id: 'query-1' }) })

    render(Component)

    expect(screen.getAllByRole('button', { name: 'Upvote' }).length).toBeGreaterThanOrEqual(2)
  })

  it('renders the reply affordance', async () => {
    const Component = await QueryDiscussionPage({ params: Promise.resolve({ name: 'javascript', id: 'query-1' }) })

    render(Component)

    expect(screen.getByText('Reply / Quote')).toBeInTheDocument()
  })

  it('renders the answer composer', async () => {
    const Component = await QueryDiscussionPage({ params: Promise.resolve({ name: 'javascript', id: 'query-1' }) })

    render(Component)

    expect(screen.getByText('Your Answer')).toBeInTheDocument()
  })

  it('renders the followed state when the viewer already follows the thread', async () => {
    subscriptionChain.executeTakeFirst.mockResolvedValueOnce({ user_id: 'user-1' })

    const Component = await QueryDiscussionPage({ params: Promise.resolve({ name: 'javascript', id: 'query-1' }) })

    render(Component)

    expect(screen.getByRole('button', { name: 'Followed' })).toBeInTheDocument()
  })

  it('renders the query tags', async () => {
    const Component = await QueryDiscussionPage({ params: Promise.resolve({ name: 'javascript', id: 'query-1' }) })

    render(Component)

    expect(screen.getAllByText('testing').length).toBeGreaterThanOrEqual(1)
  })

  it('renders quarry role badges for the question and answers', async () => {
    const Component = await QueryDiscussionPage({ params: Promise.resolve({ name: 'javascript', id: 'query-1' }) })

    render(Component)

    expect(screen.getByText('qadmin')).toBeInTheDocument()
    expect(screen.getByText('qmod')).toBeInTheDocument()
  })
})