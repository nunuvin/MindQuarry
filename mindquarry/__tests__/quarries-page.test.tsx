import { render, screen } from '@testing-library/react'

import QuarriesIndex from '@/app/q/page'

const quarriesChain = {
  selectAll: jest.fn(),
  orderBy: jest.fn(),
  execute: jest.fn(),
}

quarriesChain.selectAll.mockReturnValue(quarriesChain)
quarriesChain.orderBy.mockReturnValue(quarriesChain)
quarriesChain.execute.mockResolvedValue([
  {
    id: 'quarry-1',
    name: 'javascript',
    description: 'JavaScript questions, debugging, and architecture tradeoffs.',
    visibility: 'public',
  },
])

jest.mock('@/lib/settings', () => ({
  getSiteSettings: jest.fn().mockResolvedValue({
    simplified_mode_enabled: false,
  }),
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

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: jest.fn((table: string) => {
      if (table === 'quarries') return quarriesChain
      throw new Error(`Unexpected table ${table}`)
    }),
  },
}))

describe('Quarries index page', () => {
  it('renders the communities heading', async () => {
    const Component = await QuarriesIndex()

    render(Component)

    expect(screen.getByRole('heading', { name: 'Communities' })).toBeInTheDocument()
  })

  it('renders the create quarry action', async () => {
    const Component = await QuarriesIndex()

    render(Component)

    expect(screen.getByRole('link', { name: 'Create Quarry' })).toBeInTheDocument()
  })

  it('renders a visible community card', async () => {
    const Component = await QuarriesIndex()

    render(Component)

    expect(screen.getByRole('link', { name: /q\/javascript/i })).toBeInTheDocument()
    expect(screen.getByText('JavaScript questions, debugging, and architecture tradeoffs.')).toBeInTheDocument()
  })
})