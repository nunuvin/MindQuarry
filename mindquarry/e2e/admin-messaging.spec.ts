import { expect, test } from '@playwright/test'

test('admin route redirects anonymous users to sign in', async ({ page }) => {
  await page.goto('/admin')

  await page.waitForURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('messages route redirects anonymous users to sign in', async ({ page }) => {
  await page.goto('/messages')

  await page.waitForURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})