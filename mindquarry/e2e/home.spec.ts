import { expect, test } from '@playwright/test'

test('home page shows the main feed heading', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Main Feed' })).toBeVisible()
})

test('home page shows the discovery sort controls', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'New' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Top' })).toBeVisible()
})

test('home page shows the MindQuarry promo rail by default', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'MindQuarry' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Explore Quarries' })).toBeVisible()
})

test('home page lets the user dismiss the promo rail', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Dismiss MindQuarry introduction' }).click()

  await expect(page.getByRole('heading', { name: 'MindQuarry' })).toHaveCount(0)
})

test('home page lets the user dismiss the cookie notice', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('MindQuarry uses essential cookies')).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss cookie notice' }).click()
  await expect(page.getByText('MindQuarry uses essential cookies')).toHaveCount(0)
})

test('home page lets the user collapse the sidebar', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Collapse sidebar' }).click()

  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
})