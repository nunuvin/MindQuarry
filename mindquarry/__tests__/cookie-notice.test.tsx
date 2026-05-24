import { fireEvent, render, screen } from '@testing-library/react'

import CookieNotice from '@/components/cookie-notice'

describe('CookieNotice', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('does not render when disabled', () => {
    render(<CookieNotice enabled={false} message="Cookies are used." />)

    expect(screen.queryByText('Cookies are used.')).not.toBeInTheDocument()
  })

  it('renders the configured cookie message when enabled', async () => {
    render(<CookieNotice enabled message="Cookies are used." />)

    expect(await screen.findByText('Cookies are used.')).toBeInTheDocument()
  })

  it('dismisses the notice and persists the dismissal', async () => {
    render(<CookieNotice enabled message="Cookies are used." />)

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss cookie notice' }))

    expect(screen.queryByText('Cookies are used.')).not.toBeInTheDocument()
    expect(window.localStorage.getItem('mq.cookie.notice.dismissed')).toBe('true')
  })
})
