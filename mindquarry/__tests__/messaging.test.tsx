import { render, screen } from '@testing-library/react'
import MessagesPage from '@/app/messages/page'

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([
      { id: 'msg-1', is_group: false, name: null, updated_at: new Date(), displayUsername: 'bobUser' }
    ]),
    executeTakeFirst: jest.fn().mockResolvedValue({
      name: 'Bob', displayUsername: 'bobUser', username: 'bob123'
    })
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
      getSession: jest.fn().mockResolvedValue({
        user: { id: 'user-1', name: 'Admin User' }
      })
    }
  }
}))

jest.mock('next/headers', () => ({
  headers: () => new Map()
}))

describe('Messaging Inbox', () => {
  it('renders the inbox heading', async () => {
    const Component = await MessagesPage()
    render(Component)

    expect(screen.getByText('Inbox')).toBeInTheDocument()
  })

  it('renders the start new chat action', async () => {
    const Component = await MessagesPage()
    render(Component)

    expect(screen.getByText('Start New Chat')).toBeInTheDocument()
  })

  it('renders the active conversation entry', async () => {
    const Component = await MessagesPage()
    render(Component)

    expect(screen.getByText('bobUser')).toBeInTheDocument()
  })
})
