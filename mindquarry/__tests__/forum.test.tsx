import { render, screen } from '@testing-library/react'
import QuarriesIndex from '@/app/q/page'

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: jest.fn().mockReturnThis(),
    selectAll: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([
      { id: '1', name: 'javascript', description: 'JS discussions' }
    ]),
  }
}))

jest.mock('@/lib/settings', () => ({
  getSiteSettings: jest.fn().mockResolvedValue({
    simplified_mode_enabled: false
  })
}))

describe('Quarries Index', () => {
  it('renders a list of communities', async () => {
    const Component = await QuarriesIndex()
    render(Component)
    expect(screen.getByText('Communities')).toBeInTheDocument()
    expect(screen.getByText('q/javascript')).toBeInTheDocument()
    expect(screen.getByText('Create Quarry')).toBeInTheDocument()
  })
})
