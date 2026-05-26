import { render, screen, waitFor } from '@testing-library/react'

import { SearchResultsClient } from '@/app/search/SearchResultsClient'

describe('SearchResultsClient', () => {
  beforeEach(() => {
    global.IntersectionObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    } as never

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        scope: 'all',
        term: 'postgres',
        users: {
          items: [
            { id: 'user-1', username: 'alice', displayUsername: 'alice', name: 'Alice', image: null, accessLevel: 'admin' },
          ],
          nextOffset: null,
        },
        quarries: {
          items: [
            { id: 'quarry-1', name: 'postgres', description: 'Database', visibility: 'members', accessLevel: 'members' },
          ],
          nextOffset: null,
        },
        queries: {
          items: [
            {
              id: 'query-1',
              title: 'How do I index JSONB?',
              body: '<p>Body</p>',
              score: 5,
              accepted_answer_id: null,
              created_at: null,
              name: 'Alice',
              displayUsername: 'alice',
              username: 'alice',
              quarry_name: 'postgres',
              answer_match_preview: null,
              accessLevel: 'authenticated',
            },
          ],
          nextOffset: null,
        },
      }),
    }) as never
  })

  it('renders access metadata for search result cards', async () => {
    const { container } = render(<SearchResultsClient initialQuery="postgres" />)

    await screen.findByText('Database')
    expect(screen.getByText('Edge legend')).toBeInTheDocument()

    await waitFor(() => {
      expect(container.querySelector('[data-access-level="members"]')).toBeTruthy()
      expect(container.querySelector('[data-access-level="authenticated"]')).toBeTruthy()
      expect(container.querySelector('[data-access-level="admin"]')).toBeTruthy()
    })
  })
})