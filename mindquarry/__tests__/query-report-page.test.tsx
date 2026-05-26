import ReportQueryPage from '@/app/q/[name]/query/[id]/report/page'

const getSession = jest.fn()
const canViewQuarry = jest.fn()
const isGlobalAdmin = jest.fn()
const notFound = jest.fn(() => {
  throw new Error('notFound')
})

function createChain<T>(result: T, methods: string[] = ['selectAll', 'where']) {
  const chain: Record<string, jest.Mock> = {
    executeTakeFirst: jest.fn().mockResolvedValue(result),
  }

  methods.forEach((method) => {
    chain[method] = jest.fn(() => chain)
  })

  return chain
}

const quarryChain = createChain({ id: 'quarry-1', name: 'postgres', visibility: 'members', is_invite_only: false })
const quarryMembershipChain = createChain({ role: 'member' }, ['select', 'where'])

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}))

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: jest.fn((table: string) => {
      if (table === 'quarries') return quarryChain
      if (table === 'quarry_members') return quarryMembershipChain
      throw new Error(`Unexpected table ${table}`)
    }),
  },
}))

jest.mock('@/lib/visibility', () => ({
  canViewQuarry: (...args: unknown[]) => canViewQuarry(...args),
}))

jest.mock('@/lib/admin', () => ({
  isGlobalAdmin: (...args: unknown[]) => isGlobalAdmin(...args),
}))

jest.mock('next/headers', () => ({
  headers: () => new Map(),
}))

jest.mock('next/navigation', () => ({
  notFound: () => notFound(),
  redirect: jest.fn(),
}))

describe('Report query page security', () => {
  beforeEach(() => {
    getSession.mockReset()
    canViewQuarry.mockReset()
    isGlobalAdmin.mockReset()
    notFound.mockClear()
  })

  it('rejects users who cannot view the quarry', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    isGlobalAdmin.mockResolvedValue(false)
    canViewQuarry.mockResolvedValue({ allowed: false })

    await expect(
      ReportQueryPage({
        params: Promise.resolve({ name: 'postgres', id: 'query-1' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('notFound')
  })
})