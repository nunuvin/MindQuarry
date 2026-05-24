import { render, screen } from '@testing-library/react'

import NewQuarryPage from '@/app/q/new/page'

const redirect = jest.fn((href: string) => {
  throw new Error(`REDIRECT:${href}`)
})

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
    },
  },
}))

jest.mock('@/lib/settings', () => ({
  getSiteSettings: jest.fn().mockResolvedValue({ simplified_mode_enabled: false }),
}))

jest.mock('next/headers', () => ({
  headers: () => new Map(),
}))

jest.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirect(...args),
}))

describe('New quarry page', () => {
  beforeEach(() => {
    redirect.mockClear()
  })

  it('renders the quarry creation form and tag option', async () => {
    const Component = await NewQuarryPage()

    render(Component)

    expect(screen.getByRole('heading', { name: 'Create a New Quarry' })).toBeInTheDocument()
    expect(screen.getByLabelText('Allow members to create new tags when posting')).toBeInTheDocument()
  })
})