import { render, screen } from '@testing-library/react'

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
  it('shows the quarry moderator badge ahead of the instance-admin badge inside a quarry', () => {
    render(
      <UserMenu
        user={{
          id: 'user-1',
          displayUsername: 'alice',
          email: 'alice@example.com',
          role: 'admin',
        }}
        contextRole="moderator"
      />,
    )

    expect(screen.getByText('qmod')).toBeInTheDocument()
    expect(screen.queryByText(/^admin$/i)).not.toBeInTheDocument()
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
      />,
    )

    expect(screen.getByText('admin')).toBeInTheDocument()
  })
})