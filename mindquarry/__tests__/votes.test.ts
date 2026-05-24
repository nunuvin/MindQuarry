import { applyAnswerVote, applyQueryVote } from '@/lib/votes'

const refreshProfileMetrics = jest.fn()
const transactionExecute = jest.fn()
const transaction = jest.fn(() => ({ execute: transactionExecute }))

const executeTakeFirst = jest.fn()
const queryExecute = jest.fn()
const answerExecute = jest.fn()
const queryVoteExecute = jest.fn()
const answerVoteExecute = jest.fn()

const queryWhere = jest.fn(() => ({ executeTakeFirst }))
const answerWhere = jest.fn(() => ({ executeTakeFirst }))
const queryVoteWhereUser = jest.fn(() => ({ executeTakeFirst }))
const queryVoteWhereTarget = jest.fn(() => ({ where: queryVoteWhereUser }))
const answerVoteWhereUser = jest.fn(() => ({ executeTakeFirst }))
const answerVoteWhereTarget = jest.fn(() => ({ where: answerVoteWhereUser }))

const queryUpdateExecute = jest.fn()
const queryUpdateWhere = jest.fn(() => ({ execute: queryUpdateExecute }))
const queryUpdateSet = jest.fn(() => ({ where: queryUpdateWhere }))

const answerUpdateExecute = jest.fn()
const answerUpdateWhere = jest.fn(() => ({ execute: answerUpdateExecute }))
const answerUpdateSet = jest.fn(() => ({ where: answerUpdateWhere }))

const queryVoteUpdateExecute = jest.fn()
const queryVoteUpdateWhereUser = jest.fn(() => ({ execute: queryVoteUpdateExecute }))
const queryVoteUpdateWhereTarget = jest.fn(() => ({ where: queryVoteUpdateWhereUser }))
const queryVoteUpdateSet = jest.fn(() => ({ where: queryVoteUpdateWhereTarget }))

const answerVoteUpdateExecute = jest.fn()
const answerVoteUpdateWhereUser = jest.fn(() => ({ execute: answerVoteUpdateExecute }))
const answerVoteUpdateWhereTarget = jest.fn(() => ({ where: answerVoteUpdateWhereUser }))
const answerVoteUpdateSet = jest.fn(() => ({ where: answerVoteUpdateWhereTarget }))

const insertExecute = jest.fn()
const insertValues = jest.fn(() => ({ execute: insertExecute }))

const queryDeleteExecute = jest.fn()
const queryDeleteWhereUser = jest.fn(() => ({ execute: queryDeleteExecute }))
const queryDeleteWhereTarget = jest.fn(() => ({ where: queryDeleteWhereUser }))

const answerDeleteExecute = jest.fn()
const answerDeleteWhereUser = jest.fn(() => ({ execute: answerDeleteExecute }))
const answerDeleteWhereTarget = jest.fn(() => ({ where: answerDeleteWhereUser }))

const trx = {
  deleteFrom: jest.fn((table: string) => {
    if (table === 'query_votes') {
      return { where: queryDeleteWhereTarget }
    }

    if (table === 'answer_votes') {
      return { where: answerDeleteWhereTarget }
    }

    throw new Error(`Unexpected deleteFrom ${table}`)
  }),
  insertInto: jest.fn((table: string) => ({ values: insertValues })),
  selectFrom: jest.fn((table: string) => {
    if (table === 'queries') {
      return { select: jest.fn(() => ({ where: queryWhere })) }
    }

    if (table === 'answers') {
      return { select: jest.fn(() => ({ where: answerWhere })) }
    }

    if (table === 'query_votes') {
      return { select: jest.fn(() => ({ where: queryVoteWhereTarget })) }
    }

    if (table === 'answer_votes') {
      return { select: jest.fn(() => ({ where: answerVoteWhereTarget })) }
    }

    throw new Error(`Unexpected selectFrom ${table}`)
  }),
  updateTable: jest.fn((table: string) => {
    if (table === 'queries') {
      return { set: queryUpdateSet }
    }

    if (table === 'answers') {
      return { set: answerUpdateSet }
    }

    if (table === 'query_votes') {
      return { set: queryVoteUpdateSet }
    }

    if (table === 'answer_votes') {
      return { set: answerVoteUpdateSet }
    }

    throw new Error(`Unexpected updateTable ${table}`)
  }),
}

jest.mock('@/lib/db', () => ({
  db: {
    transaction: (...args: unknown[]) => transaction(...args),
  },
}))

jest.mock('@/lib/notifications', () => ({
  refreshProfileMetrics: (...args: unknown[]) => refreshProfileMetrics(...args),
}))

describe('vote helpers', () => {
  beforeEach(() => {
    refreshProfileMetrics.mockReset()
    executeTakeFirst.mockReset()
    queryExecute.mockReset()
    answerExecute.mockReset()
    queryVoteExecute.mockReset()
    answerVoteExecute.mockReset()
    queryWhere.mockClear()
    answerWhere.mockClear()
    queryVoteWhereUser.mockClear()
    queryVoteWhereTarget.mockClear()
    answerVoteWhereUser.mockClear()
    answerVoteWhereTarget.mockClear()
    queryUpdateExecute.mockReset()
    queryUpdateWhere.mockClear()
    queryUpdateSet.mockClear()
    answerUpdateExecute.mockReset()
    answerUpdateWhere.mockClear()
    answerUpdateSet.mockClear()
    queryVoteUpdateExecute.mockReset()
    queryVoteUpdateWhereUser.mockClear()
    queryVoteUpdateWhereTarget.mockClear()
    queryVoteUpdateSet.mockClear()
    answerVoteUpdateExecute.mockReset()
    answerVoteUpdateWhereUser.mockClear()
    answerVoteUpdateWhereTarget.mockClear()
    answerVoteUpdateSet.mockClear()
    insertExecute.mockReset()
    insertValues.mockClear()
    queryDeleteExecute.mockReset()
    queryDeleteWhereUser.mockClear()
    queryDeleteWhereTarget.mockClear()
    answerDeleteExecute.mockReset()
    answerDeleteWhereUser.mockClear()
    answerDeleteWhereTarget.mockClear()
    trx.deleteFrom.mockClear()
    trx.insertInto.mockClear()
    trx.selectFrom.mockClear()
    trx.updateTable.mockClear()
    transactionExecute.mockImplementation(async (callback: (trx: typeof trx) => Promise<void>) => callback(trx))
  })

  it('creates a new query vote and refreshes the query author metrics', async () => {
    executeTakeFirst
      .mockResolvedValueOnce({ user_id: 'author-1' })
      .mockResolvedValueOnce(undefined)
    insertExecute.mockResolvedValue(undefined)
    queryUpdateExecute.mockResolvedValue(undefined)
    refreshProfileMetrics.mockResolvedValue(undefined)

    await applyQueryVote('query-1', 'user-1', 1)

    expect(trx.insertInto).toHaveBeenCalledWith('query_votes')
    expect(insertValues).toHaveBeenCalledWith({ query_id: 'query-1', user_id: 'user-1', value: 1 })
    expect(queryUpdateSet).toHaveBeenCalledWith({ score: expect.anything() })
    expect(refreshProfileMetrics).toHaveBeenCalledWith('author-1')
  })

  it('removes an existing query vote when the same value is submitted again', async () => {
    executeTakeFirst
      .mockResolvedValueOnce({ user_id: 'author-1' })
      .mockResolvedValueOnce({ value: 1 })
    queryDeleteExecute.mockResolvedValue(undefined)
    queryUpdateExecute.mockResolvedValue(undefined)
    refreshProfileMetrics.mockResolvedValue(undefined)

    await applyQueryVote('query-1', 'user-1', 1)

    expect(trx.deleteFrom).toHaveBeenCalledWith('query_votes')
    expect(queryDeleteWhereTarget).toHaveBeenCalledWith('query_id', '=', 'query-1')
    expect(queryDeleteWhereUser).toHaveBeenCalledWith('user_id', '=', 'user-1')
    expect(refreshProfileMetrics).toHaveBeenCalledWith('author-1')
  })

  it('creates a new answer vote and refreshes the answer author metrics', async () => {
    executeTakeFirst
      .mockResolvedValueOnce({ user_id: 'author-2' })
      .mockResolvedValueOnce(undefined)
    insertExecute.mockResolvedValue(undefined)
    answerUpdateExecute.mockResolvedValue(undefined)
    refreshProfileMetrics.mockResolvedValue(undefined)

    await applyAnswerVote('answer-1', 'user-1', 1)

    expect(trx.insertInto).toHaveBeenCalledWith('answer_votes')
    expect(insertValues).toHaveBeenCalledWith({ answer_id: 'answer-1', user_id: 'user-1', value: 1 })
    expect(answerUpdateSet).toHaveBeenCalledWith({ score: expect.anything() })
    expect(refreshProfileMetrics).toHaveBeenCalledWith('author-2')
  })
})
