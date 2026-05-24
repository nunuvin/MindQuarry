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
  { id: '1', name: 'javascript', description: 'JS discussions', visibility: 'public' }
])

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: jest.fn((table: string) => {
      if (table === 'quarries') return quarriesChain
      throw new Error(`Unexpected table ${table}`)
    }),
  }
}))

jest.mock('@/lib/settings', () => ({
  getSiteSettings: jest.fn().mockResolvedValue({
    simplified_mode_enabled: false
  })
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

describe('Quarries Index', () => {
  it('renders a list of communities', async () => {
    const Component = await QuarriesIndex()
    render(Component)
    expect(screen.getByRole('heading', { name: 'Communities' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'q/javascript' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create Quarry' })).toBeInTheDocument()
  })
})
