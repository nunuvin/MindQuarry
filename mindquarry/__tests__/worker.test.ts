const generateUUID = jest.fn(() => 'job-uuid')

const insertExecute = jest.fn()
const insertValues = jest.fn(() => ({ execute: insertExecute }))
const insertInto = jest.fn(() => ({ values: insertValues }))

const executeTakeFirst = jest.fn()
const skipLocked = jest.fn(() => ({ executeTakeFirst }))
const forUpdate = jest.fn(() => ({ skipLocked }))
const limit = jest.fn(() => ({ forUpdate }))
const orderBy = jest.fn(() => ({ limit }))
const wherePending = jest.fn(() => ({ orderBy }))
const selectAll = jest.fn(() => ({ where: wherePending }))

const transactionUpdateExecute = jest.fn()
const transactionUpdateWhere = jest.fn(() => ({ execute: transactionUpdateExecute }))
const transactionUpdateSet = jest.fn(() => ({ where: transactionUpdateWhere }))

const backgroundUpdateExecute = jest.fn()
const backgroundUpdateWhere = jest.fn(() => ({ execute: backgroundUpdateExecute }))
const backgroundUpdateSet = jest.fn(() => ({ where: backgroundUpdateWhere }))

const trx = {
  selectFrom: jest.fn(() => ({ selectAll })),
  updateTable: jest.fn(() => ({ set: transactionUpdateSet })),
}

const transactionExecute = jest.fn((callback: (trx: typeof trx) => Promise<unknown>) => callback(trx))
const transaction = jest.fn(() => ({ execute: transactionExecute }))
const updateTable = jest.fn(() => ({ set: backgroundUpdateSet }))

jest.mock('@/lib/db', () => ({
  db: {
    insertInto: (...args: unknown[]) => insertInto(...args),
    transaction: (...args: unknown[]) => transaction(...args),
    updateTable: (...args: unknown[]) => updateTable(...args),
  },
}))

jest.mock('@/lib/utils', () => ({
  generateUUID: (...args: unknown[]) => generateUUID(...args),
}))

import { enqueueJob, startWorker } from '@/lib/worker'

describe('worker helpers', () => {
  const originalSetImmediate = (globalThis as typeof globalThis & { setImmediate?: (...args: unknown[]) => unknown }).setImmediate

  beforeEach(() => {
    jest.useFakeTimers()
    generateUUID.mockReset()
    generateUUID.mockReturnValue('job-uuid')
    insertExecute.mockReset()
    insertValues.mockClear()
    insertInto.mockClear()
    executeTakeFirst.mockReset()
    skipLocked.mockClear()
    forUpdate.mockClear()
    limit.mockClear()
    orderBy.mockClear()
    wherePending.mockClear()
    selectAll.mockClear()
    transactionUpdateExecute.mockReset()
    transactionUpdateWhere.mockClear()
    transactionUpdateSet.mockClear()
    backgroundUpdateExecute.mockReset()
    backgroundUpdateWhere.mockClear()
    backgroundUpdateSet.mockClear()
    trx.selectFrom.mockClear()
    trx.updateTable.mockClear()
    transactionExecute.mockImplementation((callback: (trx: typeof trx) => Promise<unknown>) => callback(trx))
    transaction.mockClear()
    updateTable.mockClear()
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'setImmediate', {
      configurable: true,
      value: originalSetImmediate,
      writable: true,
    })
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('enqueues a pending background job with a generated id', async () => {
    insertExecute.mockResolvedValue(undefined)

    await enqueueJob('recompute_metrics', { userId: 'user-1' })

    expect(insertInto).toHaveBeenCalledWith('background_jobs')
    expect(insertValues).toHaveBeenCalledWith({
      id: 'job-uuid',
      job_type: 'recompute_metrics',
      payload: { userId: 'user-1' },
      status: 'pending',
    })
  })

  it('schedules another poll when no pending jobs are available', async () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout')
    executeTakeFirst.mockResolvedValue(null)

    const stopWorker = startWorker()

    await Promise.resolve()
    await Promise.resolve()

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000)

    stopWorker()
  })

  it('marks a claimed job as processing and then completed', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const setImmediateSpy = jest.fn(() => 0 as unknown as NodeJS.Immediate)

    Object.defineProperty(globalThis, 'setImmediate', {
      configurable: true,
      value: setImmediateSpy,
      writable: true,
    })

    executeTakeFirst.mockResolvedValue({ id: 'job-1', job_type: 'send_notification' })
    transactionUpdateExecute.mockResolvedValue(undefined)
    backgroundUpdateExecute.mockResolvedValue(undefined)

    const stopWorker = startWorker()

    await Promise.resolve()
    await Promise.resolve()
    await jest.advanceTimersByTimeAsync(500)
    await Promise.resolve()

    expect(trx.updateTable).toHaveBeenCalledWith('background_jobs')
    expect(transactionUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      status: 'processing',
      locked_at: expect.any(Date),
      locked_by: 'worker_process',
    }))
    expect(updateTable).toHaveBeenCalledWith('background_jobs')
    expect(backgroundUpdateSet).toHaveBeenCalledWith({ status: 'completed' })
    expect(backgroundUpdateWhere).toHaveBeenCalledWith('id', '=', 'job-1')
    expect(logSpy).toHaveBeenCalledWith('Processing job job-1 of type send_notification')
    expect(setImmediateSpy).toHaveBeenCalledWith(expect.any(Function))

    stopWorker()
  })
})