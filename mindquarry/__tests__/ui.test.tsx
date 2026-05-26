import { act, render, screen, waitFor } from '@testing-library/react'
import Navbar from '@/components/navbar'

const useSession = jest.fn()
const eventSources: Array<{
  onmessage: ((event: MessageEvent) => void) | null
  close: jest.Mock
  url: string
}> = []

// We need to mock next/navigation as it's used in components
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
}))

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
  ThemeProvider: ({ children }: any) => <div>{children}</div>,
}))

// Explicitly mock better auth client to completely bypass compilation of original file in jest
jest.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: (...args: unknown[]) => useSession(...args),
  }
}))

describe('Navbar Component', () => {
  beforeEach(() => {
    useSession.mockReset()
    useSession.mockReturnValue({ data: null, isPending: false })
    eventSources.length = 0
    global.EventSource = class {
      onmessage: ((event: MessageEvent) => void) | null = null
      close = jest.fn()

      constructor(public url: string) {
        eventSources.push(this)
      }
    } as never
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    }) as never
  })

  it('renders a navbar with logo text', () => {
    render(<Navbar notificationBadgeCap={9} notificationPollIntervalMs={15000} />)
    const logo = screen.getByText('MindQuarry')
    expect(logo).toBeInTheDocument()
  })

  it('subscribes to the notification stream and updates the badge count from SSE payloads', async () => {
    useSession.mockReturnValue({ data: { user: { id: 'user-1', username: 'alice' } }, isPending: false })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 2 }),
    }) as never

    render(<Navbar notificationBadgeCap={9} notificationPollIntervalMs={15000} />)

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    expect(eventSources[0]?.url).toBe('/api/notifications/stream')

    await act(async () => {
      eventSources[0]?.onmessage?.({
        data: JSON.stringify({ type: 'notifications_updated', count: 7 }),
      } as MessageEvent)
    })

    await waitFor(() => {
      expect(screen.getByText('7')).toBeInTheDocument()
    })
  })
})
