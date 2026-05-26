import { render, screen } from '@testing-library/react'

import AdminUsersPage from '@/app/admin/users/page'

const getSession = jest.fn()
const isGlobalAdmin = jest.fn()
const getSiteSettings = jest.fn()
const listPostingPolicies = jest.fn()

function createChain<T>(result: T, methods: string[] = ['select', 'where', 'innerJoin']) {
  const chain: Record<string, jest.Mock> = {
    execute: jest.fn().mockResolvedValue(result),
    executeTakeFirst: jest.fn().mockResolvedValue(result),
  }

  methods.forEach((method) => {
    chain[method] = jest.fn(() => chain)
  })

  return chain
}

const globalAdminsChain = createChain([
  { user_id: 'user-1', username: 'root', displayUsername: 'Root', name: 'Root User' },
])
const firstAdminChain = createChain({ id: 'user-1', username: 'root', displayUsername: 'Root', name: 'Root User' }, ['select', 'where'])

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}))

jest.mock('@/lib/admin', () => ({
  isGlobalAdmin: (...args: unknown[]) => isGlobalAdmin(...args),
}))

jest.mock('@/lib/settings', () => ({
  getSiteSettings: (...args: unknown[]) => getSiteSettings(...args),
}))

jest.mock('@/lib/moderation', () => ({
  listPostingPolicies: (...args: unknown[]) => listPostingPolicies(...args),
  upsertPostingPolicy: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: jest.fn((table: string) => {
      if (table === 'global_admins') return globalAdminsChain
      if (table === 'user') return firstAdminChain
      throw new Error(`Unexpected table ${table}`)
    }),
  },
}))

jest.mock('next/headers', () => ({
  headers: () => new Map(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

describe('Admin users page', () => {
  beforeEach(() => {
    getSession.mockReset()
    isGlobalAdmin.mockReset()
    getSiteSettings.mockReset()
    listPostingPolicies.mockReset()
  })

  it('renders the password reset controls for instance admins', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    isGlobalAdmin.mockResolvedValue(true)
    getSiteSettings.mockResolvedValue({ first_admin_user_id: 'user-1' })
    listPostingPolicies.mockResolvedValue([])

    const Component = await AdminUsersPage()
    render(Component)

    expect(screen.getByText('Reset User Password')).toBeInTheDocument()
    expect(screen.getByText('Temporary password length')).toBeInTheDocument()
    expect(screen.getByText('Founder / First Admin')).toBeInTheDocument()
  })
})