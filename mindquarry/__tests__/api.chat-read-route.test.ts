import { POST } from '@/app/api/chat/[conversationId]/read/route'

const getSession = jest.fn()
const execute = jest.fn()
const whereConversation = jest.fn(() => ({ where: whereUser }))
const whereUser = jest.fn(() => ({ execute }))
const set = jest.fn(() => ({ where: whereConversation }))
const updateTable = jest.fn(() => ({ set }))

jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}))

jest.mock('@/lib/db', () => ({
  db: {
    updateTable: (...args: unknown[]) => updateTable(...args),
  },
}))

jest.mock('next/headers', () => ({
  headers: () => new Headers(),
}))

describe('POST /api/chat/[conversationId]/read', () => {
  beforeEach(() => {
    getSession.mockReset()
    execute.mockReset()
    whereConversation.mockClear()
    whereUser.mockClear()
    set.mockClear()
    updateTable.mockClear()
  })

  it('returns unauthorized when there is no session', async () => {
    getSession.mockResolvedValue(null)

    const response = await POST({} as never, {
      params: Promise.resolve({ conversationId: 'conv-1' }),
    })

    expect(response.status).toBe(401)
    await expect(response.text()).resolves.toBe('Unauthorized')
  })

  it('updates the last read timestamp for the participant', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    execute.mockResolvedValue(undefined)

    const response = await POST({} as never, {
      params: Promise.resolve({ conversationId: 'conv-1' }),
    })

    expect(updateTable).toHaveBeenCalledWith('conversation_participants')
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ last_read_at: expect.any(Date) }))
    expect(whereConversation).toHaveBeenCalledWith('conversation_id', '=', 'conv-1')
    expect(whereUser).toHaveBeenCalledWith('user_id', '=', 'user-1')
    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('OK')
  })

  it('returns a server error when the update fails', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    execute.mockRejectedValue(new Error('write failed'))

    const response = await POST({} as never, {
      params: Promise.resolve({ conversationId: 'conv-1' }),
    })

    expect(response.status).toBe(500)
    await expect(response.text()).resolves.toBe('Error updating read receipt')
  })
})
