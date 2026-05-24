import { getSiteSettings } from '@/lib/settings'

const executeTakeFirst = jest.fn()
const insertExecute = jest.fn()
const values = jest.fn(() => ({ execute: insertExecute }))
const insertInto = jest.fn(() => ({ values }))
const selectAll = jest.fn(() => ({ executeTakeFirst }))
const selectFrom = jest.fn(() => ({ selectAll }))

jest.mock('@/lib/db', () => ({
  db: {
    insertInto: (...args: unknown[]) => insertInto(...args),
    selectFrom: (...args: unknown[]) => selectFrom(...args),
  },
}))

describe('getSiteSettings', () => {
  beforeEach(() => {
    executeTakeFirst.mockReset()
    insertExecute.mockReset()
    values.mockClear()
    insertInto.mockClear()
    selectAll.mockClear()
    selectFrom.mockClear()
  })

  it('returns the existing settings row when it already exists', async () => {
    const existingSettings = { id: 1, registration_enabled: true }
    executeTakeFirst.mockResolvedValue(existingSettings)

    await expect(getSiteSettings()).resolves.toEqual(existingSettings)
    expect(insertInto).not.toHaveBeenCalled()
  })

  it('bootstraps default settings when the row is missing', async () => {
    const bootstrappedSettings = {
      id: 1,
      registration_enabled: true,
      simplified_mode_enabled: false,
      admin_monitoring_dms: false,
    }
    executeTakeFirst
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(bootstrappedSettings)
    insertExecute.mockResolvedValue(undefined)

    await expect(getSiteSettings()).resolves.toEqual(bootstrappedSettings)
    expect(insertInto).toHaveBeenCalledWith('site_settings')
    expect(values).toHaveBeenCalledWith({
      id: 1,
      registration_enabled: true,
      simplified_mode_enabled: false,
      admin_monitoring_dms: false,
    })
  })
})
