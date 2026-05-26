import { fireEvent, render, screen } from '@testing-library/react'

import UserMenu from '@/components/user-menu'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => <img alt={String(props.alt || '')} />,
}))

jest.mock('@/lib/auth-client', () => ({
  authClient: {
    signOut: jest.fn(),
  },
}))

describe('UserMenu', () => {
  it('keeps the instance-admin badge and also shows the quarry badge inside a quarry', () => {
    render(
      <UserMenu
        user={{
          id: 'user-1',
          displayUsername: 'alice',
          email: 'alice@example.com',
          role: 'admin',
        }}
        contextRole="moderator"
        isGlobalAdmin
      />,
    )

    expect(screen.getByText('qmod')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('falls back to the instance-admin badge outside quarry context', () => {
    render(
      <UserMenu
        user={{
          id: 'user-1',
          displayUsername: 'alice',
          email: 'alice@example.com',
          role: 'admin',
        }}
        isGlobalAdmin
      />,
    )

    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('shows a quarry badge for non-admin quarry moderators', () => {
    render(
      <UserMenu
        user={{
          id: 'user-2',
          displayUsername: 'bob',
          email: 'bob@example.com',
          role: 'user',
        }}
        contextRole="moderator"
      />,
    )

    expect(screen.getByText('qmod')).toBeInTheDocument()
    expect(screen.queryByText(/^admin$/i)).not.toBeInTheDocument()
  })

  it('shows an instance admin link in the dropdown for real global admins', () => {
    render(
      <UserMenu
        user={{
          id: 'user-1',
          displayUsername: 'alice',
          email: 'alice@example.com',
        }}
        isGlobalAdmin
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'User menu' }))

    expect(screen.getByRole('link', { name: 'Instance Admin' })).toHaveAttribute('href', '/admin')
  })
})