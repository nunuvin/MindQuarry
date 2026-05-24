import { recordQueryView } from '@/lib/queryViews'

const executeTakeFirst = jest.fn()
const queryViewWhereViewer = jest.fn(() => ({ executeTakeFirst }))
const queryViewWhereQuery = jest.fn(() => ({ where: queryViewWhereViewer }))
const queryViewSelect = jest.fn(() => ({ where: queryViewWhereQuery }))

const updateExecute = jest.fn()
const updateWhereViewer = jest.fn(() => ({ execute: updateExecute }))
const updateWhereQuery = jest.fn(() => ({ where: updateWhereViewer }))
const updateSet = jest.fn(() => ({ where: updateWhereQuery }))
const updateTable = jest.fn(() => ({ set: updateSet }))

const sessionInsertExecute = jest.fn()
const sessionInsertValues = jest.fn(() => ({ execute: sessionInsertExecute }))

const viewInsertExecute = jest.fn()
const doUpdateSet = jest.fn(() => ({ execute: viewInsertExecute }))
const onConflict = jest.fn((handler?: (oc: { column: (columnName: string) => { doUpdateSet: typeof doUpdateSet } }) => unknown) => {
  handler?.({
    column: () => ({ doUpdateSet }),
  })

  return { execute: viewInsertExecute }
})
const viewInsertValues = jest.fn(() => ({ onConflict }))

const insertInto = jest.fn((table: string) => {
  if (table === 'query_view_sessions') {
    return { values: sessionInsertValues }
  }

  if (table === 'query_views') {
    return { values: viewInsertValues }
  }

  throw new Error(`Unexpected table ${table}`)
})

const transactionExecute = jest.fn(async (callback: (trx: typeof trx) => Promise<boolean>) => callback(trx))
const transaction = jest.fn(() => ({ execute: transactionExecute }))

const trx = {
  insertInto,
  selectFrom: jest.fn((table: string) => {
    if (table !== 'query_view_sessions') {
      throw new Error(`Unexpected table ${table}`)
    }

    return { select: queryViewSelect }
  }),
  updateTable,
}

jest.mock('@/lib/db', () => ({
  db: {
    transaction: (...args: unknown[]) => transaction(...args),
  },
}))

describe('recordQueryView', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-23T12:00:00Z'))
    executeTakeFirst.mockReset()
    queryViewWhereViewer.mockClear()
    queryViewWhereQuery.mockClear()
    queryViewSelect.mockClear()
    updateExecute.mockReset()
    updateWhereViewer.mockClear()
    updateWhereQuery.mockClear()
    updateSet.mockClear()
    updateTable.mockClear()
    sessionInsertExecute.mockReset()
    sessionInsertValues.mockClear()
    viewInsertExecute.mockReset()
    doUpdateSet.mockClear()
    onConflict.mockClear()
    viewInsertValues.mockClear()
    insertInto.mockClear()
    transactionExecute.mockClear()
    transaction.mockClear()
    trx.selectFrom.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('creates a new view session and increments the aggregate counter', async () => {
    executeTakeFirst.mockResolvedValue(undefined)
    sessionInsertExecute.mockResolvedValue(undefined)
    viewInsertExecute.mockResolvedValue(undefined)

    await expect(recordQueryView({
      queryId: 'query-1',
      rawHeaders: new Headers({ 'x-forwarded-for': '127.0.0.1', 'user-agent': 'jest' }),
      userId: 'user-1',
    })).resolves.toBe(true)

    expect(insertInto).toHaveBeenCalledWith('query_view_sessions')
    expect(sessionInsertValues).toHaveBeenCalledWith(expect.objectContaining({
      query_id: 'query-1',
      viewer_key: expect.stringMatching(/^[a-f0-9]{64}$/),
      last_viewed_at: expect.any(Date),
    }))
    expect(insertInto).toHaveBeenCalledWith('query_views')
    expect(viewInsertValues).toHaveBeenCalledWith({ query_id: 'query-1', views: 1 })
  })

  it('skips increments inside the configured view window', async () => {
    executeTakeFirst.mockResolvedValue({ last_viewed_at: new Date('2026-05-23T11:59:00Z') })

    await expect(recordQueryView({
      queryId: 'query-1',
      rawHeaders: new Headers({ 'x-forwarded-for': '127.0.0.1', 'user-agent': 'jest' }),
      userId: 'user-1',
    })).resolves.toBe(false)

    expect(updateTable).not.toHaveBeenCalled()
    expect(insertInto).not.toHaveBeenCalledWith('query_views')
  })

  it('updates an expired session and increments the aggregate counter again', async () => {
    executeTakeFirst.mockResolvedValue({ last_viewed_at: new Date('2026-05-23T11:50:00Z') })
    updateExecute.mockResolvedValue(undefined)
    viewInsertExecute.mockResolvedValue(undefined)

    await expect(recordQueryView({
      queryId: 'query-1',
      rawHeaders: new Headers({ 'x-forwarded-for': '127.0.0.1', 'user-agent': 'jest' }),
    })).resolves.toBe(true)

    expect(updateTable).toHaveBeenCalledWith('query_view_sessions')
    expect(updateSet).toHaveBeenCalledWith({ last_viewed_at: expect.any(Date) })
    expect(viewInsertValues).toHaveBeenCalledWith({ query_id: 'query-1', views: 1 })
  })
})
