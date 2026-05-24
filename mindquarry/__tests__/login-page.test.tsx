import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import LoginPage from '@/app/login/page'

const replace = jest.fn()
const refresh = jest.fn()
const emailSignIn = jest.fn()
const usernameSignIn = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace,
    refresh,
  }),
}))

jest.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      email: (...args: unknown[]) => emailSignIn(...args),
      username: (...args: unknown[]) => usernameSignIn(...args),
    },
  },
}))

describe('Login page', () => {
  beforeEach(() => {
    replace.mockReset()
    refresh.mockReset()
    emailSignIn.mockReset()
    usernameSignIn.mockReset()
  })

  it('renders the username or email input', () => {
    render(<LoginPage />)

    expect(screen.getByLabelText('Username or Email')).toBeInTheDocument()
  })

  it('renders the password input and submit action', () => {
    render(<LoginPage />)

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('renders the password reset hint and sign-up link', () => {
    render(<LoginPage />)

    expect(screen.getByText('Password reset is not available yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup')
  })

  it('toggles password visibility', () => {
    render(<LoginPage />)

    const passwordInput = screen.getByLabelText('Password')
    const toggleButton = screen.getByRole('button', { name: 'Show password' })

    fireEvent.click(toggleButton)

    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument()
  })

  it('submits username credentials and redirects on success', async () => {
    usernameSignIn.mockResolvedValue({ error: null })
    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Username or Email'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery staple' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(usernameSignIn).toHaveBeenCalledWith({ username: 'alice', password: 'correct horse battery staple' })
    })
    expect(emailSignIn).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/')
    expect(refresh).toHaveBeenCalled()
  })

  it('submits email credentials and redirects on success', async () => {
    emailSignIn.mockResolvedValue({ error: null })
    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Username or Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery staple' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(emailSignIn).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'correct horse battery staple' })
    })
    expect(usernameSignIn).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/')
    expect(refresh).toHaveBeenCalled()
  })

  it('shows an error message when sign-in fails', async () => {
    usernameSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } })
    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Username or Email'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
})
