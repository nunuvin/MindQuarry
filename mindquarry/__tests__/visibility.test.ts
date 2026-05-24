import { canViewProfile, canViewQuarry, getProfileVisibility, getQuarryVisibility } from '@/lib/visibility'

const executeTakeFirst = jest.fn()
const whereUser = jest.fn(() => ({ executeTakeFirst }))
const whereQuarry = jest.fn(() => ({ where: whereUser }))
const select = jest.fn(() => ({ where: whereQuarry }))
const selectFrom = jest.fn(() => ({ select }))

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: (...args: unknown[]) => selectFrom(...args),
  },
}))

describe('visibility helpers', () => {
  beforeEach(() => {
    executeTakeFirst.mockReset()
    whereUser.mockClear()
    whereQuarry.mockClear()
    select.mockClear()
    selectFrom.mockClear()
  })

  it('defaults quarry visibility to public', () => {
    expect(getQuarryVisibility({})).toBe('public')
  })

  it('maps invite-only quarries to members visibility', () => {
    expect(getQuarryVisibility({ is_invite_only: true })).toBe('members')
  })

  it('returns explicit authenticated quarry visibility', () => {
    expect(getQuarryVisibility({ visibility: 'authenticated' })).toBe('authenticated')
  })

  it('allows public quarries without authentication', async () => {
    await expect(canViewQuarry({ id: 'quarry-1', visibility: 'public' })).resolves.toEqual({
      allowed: true,
      visibility: 'public',
      isMember: false,
    })
  })

  it('requires a viewer for authenticated quarries', async () => {
    await expect(canViewQuarry({ id: 'quarry-1', visibility: 'authenticated' })).resolves.toEqual({
      allowed: false,
      visibility: 'authenticated',
      isMember: false,
    })
  })

  it('allows authenticated quarries for signed-in viewers', async () => {
    await expect(canViewQuarry({ id: 'quarry-1', visibility: 'authenticated' }, 'user-1')).resolves.toEqual({
      allowed: true,
      visibility: 'authenticated',
      isMember: false,
    })
  })

  it('denies member-only quarries to anonymous viewers', async () => {
    await expect(canViewQuarry({ id: 'quarry-1', visibility: 'members' })).resolves.toEqual({
      allowed: false,
      visibility: 'members',
      isMember: false,
    })
  })

  it('allows member-only quarries when a membership exists', async () => {
    executeTakeFirst.mockResolvedValue({ user_id: 'user-1' })

    await expect(canViewQuarry({ id: 'quarry-1', visibility: 'members' }, 'user-1')).resolves.toEqual({
      allowed: true,
      visibility: 'members',
      isMember: true,
    })
  })

  it('denies member-only quarries when no membership exists', async () => {
    executeTakeFirst.mockResolvedValue(undefined)

    await expect(canViewQuarry({ id: 'quarry-1', visibility: 'members' }, 'user-1')).resolves.toEqual({
      allowed: false,
      visibility: 'members',
      isMember: false,
    })
  })

  it('defaults profile visibility to public', () => {
    expect(getProfileVisibility(undefined)).toBe('public')
  })

  it('returns explicit private profile visibility', () => {
    expect(getProfileVisibility({ profile_visibility: 'private' })).toBe('private')
  })

  it('always allows the profile owner to view their own profile', () => {
    expect(canViewProfile('user-1', 'private', 'user-1')).toBe(true)
  })

  it('requires authentication for authenticated profiles', () => {
    expect(canViewProfile('user-1', 'authenticated')).toBe(false)
  })

  it('denies private profiles to other viewers', () => {
    expect(canViewProfile('user-1', 'private', 'user-2')).toBe(false)
  })
})
