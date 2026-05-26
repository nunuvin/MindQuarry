const getSiteSettings = jest.fn()
const executeTakeFirst = jest.fn()
const where = jest.fn(() => ({ executeTakeFirst }))
const select = jest.fn(() => ({ where }))
const selectFrom = jest.fn(() => ({ select }))

jest.mock('@/lib/settings', () => ({
  getSiteSettings: (...args: unknown[]) => getSiteSettings(...args),
}))

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: (...args: unknown[]) => selectFrom(...args),
  },
}))

import { isGlobalAdmin } from '@/lib/admin'

describe('isGlobalAdmin', () => {
  beforeEach(() => {
    getSiteSettings.mockReset()
    executeTakeFirst.mockReset()
    where.mockClear()
    select.mockClear()
    selectFrom.mockClear()
  })

  it('returns true when the user matches the configured first admin id', async () => {
    getSiteSettings.mockResolvedValue({ first_admin_user_id: 'user-1' })

    await expect(isGlobalAdmin('user-1')).resolves.toBe(true)
    expect(selectFrom).not.toHaveBeenCalled()
  })

  it('returns true when the user is listed in the global admins table', async () => {
    getSiteSettings.mockResolvedValue({ first_admin_user_id: 'user-9' })
    executeTakeFirst.mockResolvedValue({ user_id: 'user-1' })

    await expect(isGlobalAdmin('user-1')).resolves.toBe(true)
    expect(selectFrom).toHaveBeenCalledWith('global_admins')
    expect(where).toHaveBeenCalledWith('user_id', '=', 'user-1')
  })

  it('returns false when the user is neither the first admin nor in the admin table', async () => {
    getSiteSettings.mockResolvedValue({ first_admin_user_id: 'user-9' })
    executeTakeFirst.mockResolvedValue(undefined)

    await expect(isGlobalAdmin('user-1')).resolves.toBe(false)
  })
})