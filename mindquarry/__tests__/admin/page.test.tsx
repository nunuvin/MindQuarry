import { render, screen } from '@testing-library/react'
import AdminDashboardPage from '@/app/admin/page'

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: jest.fn().mockReturnThis(),
    selectAll: jest.fn().mockReturnThis(),
    executeTakeFirst: jest.fn().mockResolvedValue({
      id: 1,
      registration_enabled: true,
      simplified_mode_enabled: false,
      first_admin_user_id: 'user-1'
    }),
    insertInto: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(true),
    updateTable: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  }
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

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

describe('Admin Dashboard', () => {
  it('renders the global admin panel heading', async () => {
    const Component = await AdminDashboardPage()
    render(Component)

    expect(screen.getByText('Global Admin Panel')).toBeInTheDocument()
  })

  it('renders the simplified mode control', async () => {
    const Component = await AdminDashboardPage()
    render(Component)

    expect(screen.getByText('Simplified Mode')).toBeInTheDocument()
  })
})
