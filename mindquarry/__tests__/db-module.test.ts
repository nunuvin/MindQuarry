describe('db module', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL

  beforeEach(() => {
    jest.resetModules()
    process.env.DATABASE_URL = 'postgres://mindquarry:test@localhost:5432/mindquarry'
  })

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl
  })

  it('creates the pg pool and Kysely client with the expected search path', async () => {
    const Pool = jest.fn().mockImplementation((config) => ({ kind: 'pool', config }))
    const PostgresDialect = jest.fn().mockImplementation((config) => ({ kind: 'dialect', config }))
    const Kysely = jest.fn().mockImplementation((config) => ({ kind: 'db', config }))

    jest.doMock('pg', () => ({
      Pool,
    }))

    jest.doMock('kysely', () => ({
      Kysely,
      PostgresDialect,
    }))

    const { db } = await import('@/lib/db')
    const pool = Pool.mock.results[0].value
    const dialect = PostgresDialect.mock.results[0].value

    expect(Pool).toHaveBeenCalledWith({
      connectionString: 'postgres://mindquarry:test@localhost:5432/mindquarry',
      options: '-c search_path=mq_public,mqauth',
      ssl: false,
    })
    expect(PostgresDialect).toHaveBeenCalledWith({ pool })
    expect(Kysely).toHaveBeenCalledWith({ dialect })
    expect(db).toEqual({ kind: 'db', config: { dialect } })
  })
})