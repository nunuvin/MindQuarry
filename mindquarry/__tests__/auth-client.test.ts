describe('authClient', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('configures the better-auth client with username and admin plugins', async () => {
    const createAuthClient = jest.fn(() => ({ kind: 'auth-client' }))
    const usernameClient = jest.fn(() => ({ kind: 'username-plugin' }))
    const adminClient = jest.fn(() => ({ kind: 'admin-plugin' }))

    jest.doMock('better-auth/react', () => ({
      createAuthClient,
    }))

    jest.doMock('better-auth/client/plugins', () => ({
      adminClient,
      usernameClient,
    }))

    const { authClient } = await import('@/lib/auth-client')

    expect(usernameClient).toHaveBeenCalled()
    expect(adminClient).toHaveBeenCalled()
    expect(createAuthClient).toHaveBeenCalledWith({
      plugins: [
        { kind: 'username-plugin' },
        { kind: 'admin-plugin' },
      ],
    })
    expect(authClient).toEqual({ kind: 'auth-client' })
  })
})