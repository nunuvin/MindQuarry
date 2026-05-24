import { fireEvent, render, screen } from '@testing-library/react'

import HomeInfoRail from '@/app/HomeInfoRail'

describe('HomeInfoRail', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders the MindQuarry promo content by default', async () => {
    render(<HomeInfoRail />)

    expect(await screen.findByRole('heading', { name: 'MindQuarry' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explore Quarries' })).toHaveAttribute('href', '/q')
  })

  it('dismisses the promo rail and stores the dismissal', async () => {
    render(<HomeInfoRail />)

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss MindQuarry introduction' }))

    expect(screen.queryByRole('heading', { name: 'MindQuarry' })).not.toBeInTheDocument()
    expect(window.localStorage.getItem('mq.home.info.dismissed')).toBe('true')
  })
})
