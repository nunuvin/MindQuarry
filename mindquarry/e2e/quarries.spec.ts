import { expect, test } from '@playwright/test'

test('quarries index renders its main heading', async ({ page }) => {
  await page.goto('/q')

  await expect(page.getByRole('heading', { name: 'Communities' })).toBeVisible()
})

test('quarries index renders its primary action', async ({ page }) => {
  await page.goto('/q')

  await expect(page.getByRole('link', { name: 'Create Quarry' })).toBeVisible()
})

test('anonymous users are redirected to login from the create quarry page', async ({ page }) => {
  await page.goto('/q/new')

  await expect(page).toHaveURL(/\/login$/)
})