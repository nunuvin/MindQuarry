import path from 'path'

import { expect, test } from '@playwright/test'

test.use({ storageState: path.join(process.cwd(), 'playwright', '.auth', 'user.json') })

test('authenticated users can open settings', async ({ page }) => {
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'Profile Settings' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/login$/)
})

test('authenticated users can open follows', async ({ page }) => {
  await page.goto('/settings/follows')

  await expect(page.getByRole('heading', { name: 'Things You Follow' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/login$/)
})

test('authenticated users can open notifications', async ({ page }) => {
  await page.goto('/notifications')

  await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/login$/)
})

test('authenticated users can open messages', async ({ page }) => {
  await page.goto('/messages')

  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/login$/)
})

test('non-admin authenticated users see the admin access guard', async ({ page }) => {
  await page.goto('/admin')

  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
})