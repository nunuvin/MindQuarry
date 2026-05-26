import { fireEvent, render, screen } from '@testing-library/react'

import Sidebar from '@/components/sidebar'

const usePathname = jest.fn()

jest.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}))

describe('Sidebar', () => {
  beforeEach(() => {
    usePathname.mockReset()
    usePathname.mockReturnValue('/')
    window.localStorage.clear()
  })

  it('renders navigation labels when expanded', () => {
    render(<Sidebar />)

    expect(screen.getByText('Feed')).toBeInTheDocument()
    expect(screen.getByText('Communities')).toBeInTheDocument()
    expect(screen.getByText('Messages')).toBeInTheDocument()
  })

  it('renders admin links when the user is a global admin', () => {
    render(<Sidebar isGlobalAdmin />)

    expect(screen.getByText('Instance Admin')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('Moderation')).toBeInTheDocument()
  })

  it('does not render the removed admin quarry jump panel', () => {
    render(
      <Sidebar
        isGlobalAdmin
        adminQuarries={[{ id: 'quarry-1', name: 'javascript' }]}
      />,
    )

    expect(screen.queryByText('Jump to quarry')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open Queue' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open Settings' })).not.toBeInTheDocument()
  })

  it('starts collapsed when the stored preference is true', () => {
    window.localStorage.setItem('mq.sidebar.collapsed', 'true')

    render(<Sidebar />)

    expect(screen.queryByText('Feed')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it('persists the collapsed state when toggled', () => {
    render(<Sidebar />)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(window.localStorage.getItem('mq.sidebar.collapsed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })
})
