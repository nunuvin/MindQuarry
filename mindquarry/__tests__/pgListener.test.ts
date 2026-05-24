describe('getSharedPgListener', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL

  beforeEach(() => {
    jest.resetModules()
    process.env.DATABASE_URL = 'postgres://mindquarry:test@localhost:5432/mindquarry'
  })

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl
    jest.restoreAllMocks()
  })

  function createClient() {
    const handlers: Record<string, (payload: any) => void> = {}
    const client = {
      connect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn((event: string, handler: (payload: any) => void) => {
        handlers[event] = handler
        return client
      }),
      query: jest.fn().mockResolvedValue(undefined),
    }

    return { client, handlers }
  }

  it('connects once, subscribes to chat channels, and forwards notifications through the emitter', async () => {
    const { client, handlers } = createClient()
    const Client = jest.fn(() => client)

    jest.doMock('pg', () => ({
      Client,
    }))

    const { chatEventEmitter, getSharedPgListener } = await import('@/lib/pgListener')
    const listener = jest.fn()

    chatEventEmitter.on('new_message_event', listener)

    await expect(getSharedPgListener()).resolves.toBe(client)
    handlers.notification({ channel: 'new_message_event', payload: 'payload-1' })

    expect(Client).toHaveBeenCalledWith({
      connectionString: 'postgres://mindquarry:test@localhost:5432/mindquarry',
      ssl: false,
    })
    expect(client.query).toHaveBeenCalledWith('LISTEN new_message_event')
    expect(client.query).toHaveBeenCalledWith('LISTEN read_receipt_event')
    expect(listener).toHaveBeenCalledWith('payload-1')

    chatEventEmitter.removeAllListeners()
  })

  it('returns the cached client on subsequent calls', async () => {
    const { client } = createClient()
    const Client = jest.fn(() => client)

    jest.doMock('pg', () => ({
      Client,
    }))

    const { getSharedPgListener } = await import('@/lib/pgListener')
    const firstClient = await getSharedPgListener()
    const secondClient = await getSharedPgListener()

    expect(firstClient).toBe(client)
    expect(secondClient).toBe(client)
    expect(Client).toHaveBeenCalledTimes(1)
  })

  it('drops the cached client after an error so the next call reconnects', async () => {
    const first = createClient()
    const second = createClient()
    const Client = jest.fn()
      .mockImplementationOnce(() => first.client)
      .mockImplementationOnce(() => second.client)
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    jest.doMock('pg', () => ({
      Client,
    }))

    const { getSharedPgListener } = await import('@/lib/pgListener')

    await expect(getSharedPgListener()).resolves.toBe(first.client)
    first.handlers.error(new Error('listener-failed'))
    await expect(getSharedPgListener()).resolves.toBe(second.client)

    expect(Client).toHaveBeenCalledTimes(2)
    expect(errorSpy).toHaveBeenCalled()
  })
})