import { render, screen } from '@testing-library/react'
import Navbar from '@/components/navbar'

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
    useSession: () => ({ data: null, isPending: false }),
  }
}))

describe('Navbar Component', () => {
  it('renders a navbar with logo text', () => {
    render(<Navbar />)
    const logo = screen.getByText('MindQuarry')
    expect(logo).toBeInTheDocument()
  })
})
