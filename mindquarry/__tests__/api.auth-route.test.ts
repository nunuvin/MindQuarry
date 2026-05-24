describe('auth route', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('exports the GET and POST handlers returned by better-auth', async () => {
    const toNextJsHandler = jest.fn(() => ({ GET: 'get-handler', POST: 'post-handler' }))

    jest.doMock('@/lib/auth', () => ({
      auth: {
        handler: 'auth-handler',
      },
    }))

    jest.doMock('better-auth/next-js', () => ({
      toNextJsHandler,
    }))

    const routeModule = await import('@/app/api/auth/[...all]/route')

    expect(toNextJsHandler).toHaveBeenCalledWith('auth-handler')
    expect(routeModule.GET).toBe('get-handler')
    expect(routeModule.POST).toBe('post-handler')
  })
})