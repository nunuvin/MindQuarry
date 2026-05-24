import { render, screen } from '@testing-library/react'

import Home from '@/app/page'

function createQueryChain(result: unknown[]) {
  const chain = {
    leftJoin: jest.fn(() => chain),
    innerJoin: jest.fn(() => chain),
    select: jest.fn(() => chain),
    where: jest.fn(() => chain),
    orderBy: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    execute: jest.fn().mockResolvedValue(result),
  }

  return chain
}

const homeQueryChain = createQueryChain([
  {
    id: 'query-1',
    title: 'Why is my preview broken?',
    body: '<p>Hello <strong>world</strong> from the feed preview.</p>',
    score: 12,
    accepted_answer_id: null,
    created_at: new Date('2026-05-23T10:00:00Z'),
    name: 'Alice',
    displayUsername: 'alice',
    username: 'alice',
    quarry_name: 'javascript',
    views: 48,
  },
])

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: jest.fn(() => homeQueryChain),
  },
}))

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn().mockResolvedValue(null),
    },
  },
}))

jest.mock('next/headers', () => ({
  headers: () => new Map(),
}))

describe('Home page', () => {
  it('renders the main feed heading', async () => {
    const Component = await Home({ searchParams: Promise.resolve({}) })

    render(Component)

    expect(screen.getByRole('heading', { name: 'Main Feed' })).toBeInTheDocument()
  })

  it('renders a plain-text preview for feed items', async () => {
    const Component = await Home({ searchParams: Promise.resolve({}) })

    render(Component)

    expect(screen.getByText('Why is my preview broken?')).toBeInTheDocument()
    expect(screen.getByText('Hello world from the feed preview.')).toBeInTheDocument()
  })

  it('renders vote controls for feed items', async () => {
    const Component = await Home({ searchParams: Promise.resolve({}) })

    render(Component)

    expect(screen.getAllByRole('button', { name: 'Upvote' })).toHaveLength(1)
  })

  it('renders the MindQuarry promo rail', async () => {
    const Component = await Home({ searchParams: Promise.resolve({}) })

    render(Component)

    expect(screen.getByRole('heading', { name: 'MindQuarry' })).toBeInTheDocument()
  })
})