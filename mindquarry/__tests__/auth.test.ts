describe('auth', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('configures better-auth with the shared db client and expected plugins', async () => {
    const betterAuth = jest.fn(() => ({ kind: 'auth-instance' }))
    const username = jest.fn(() => ({ kind: 'username-plugin' }))
    const admin = jest.fn(() => ({ kind: 'admin-plugin' }))

    jest.doMock('better-auth', () => ({
      betterAuth,
    }))

    jest.doMock('better-auth/plugins', () => ({
      admin,
      username,
    }))

    jest.doMock('@/lib/db', () => ({
      db: { kind: 'db-client' },
    }))

    const { auth } = await import('@/lib/auth')

    expect(username).toHaveBeenCalled()
    expect(admin).toHaveBeenCalled()
    expect(betterAuth).toHaveBeenCalledWith({
      database: { db: { kind: 'db-client' } },
      emailAndPassword: { enabled: true },
      plugins: [
        { kind: 'username-plugin' },
        { kind: 'admin-plugin' },
      ],
    })
    expect(auth).toEqual({ kind: 'auth-instance' })
  })
})