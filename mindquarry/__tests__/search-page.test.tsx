import { render, screen } from '@testing-library/react'

import SearchPage from '@/app/search/page'

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn().mockResolvedValue(null),
    },
  },
}))

jest.mock('@/lib/votes', () => ({
  applyQueryVote: jest.fn(),
}))

jest.mock('next/headers', () => ({
  headers: () => new Map(),
}))

jest.mock('@/app/search/SearchResultsClient', () => ({
  SearchResultsClient: ({ initialQuery }: { initialQuery: string }) => <div>Results payload: {initialQuery || 'empty'}</div>,
}))

describe('Search page', () => {
  it('renders the empty search prompt when no query is provided', async () => {
    const Component = await SearchPage({ searchParams: Promise.resolve({}) })

    render(Component)

    expect(screen.getByPlaceholderText('Search queries, quarries, or users')).toBeInTheDocument()
    expect(screen.getByText(/Use/)).toBeInTheDocument()
    expect(screen.getByText('Results payload: empty')).toBeInTheDocument()
  })

  it('passes the active query into the client search results component', async () => {
    const Component = await SearchPage({ searchParams: Promise.resolve({ q: 'search' }) })

    render(Component)

    expect(screen.getByDisplayValue('search')).toBeInTheDocument()
    expect(screen.getByText('Results payload: search')).toBeInTheDocument()
  })
})