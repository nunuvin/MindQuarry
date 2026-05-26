import { chromium, type FullConfig, type Page } from '@playwright/test'
import { promises as fs } from 'fs'
import path from 'path'

import { authStatePath, readPlaywrightCredentials } from './auth.shared'

async function dismissCookieNotice(page: Page) {
  const cookieButton = page.getByRole('button', { name: 'Dismiss cookie notice' })

  if (await cookieButton.isVisible().catch(() => false)) {
    await cookieButton.click()
  }
}

async function waitForSignedInRedirect(page: Page) {
  await page.waitForURL((url) => !url.pathname.endsWith('/login') && !url.pathname.endsWith('/signup'), {
    timeout: 10000,
  })
}

async function tryLogin(page: Page, username: string, password: string) {
  await page.goto('/login')
  await dismissCookieNotice(page)
  await page.locator('#identifier').fill(username)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  try {
    await waitForSignedInRedirect(page)
    return true
  } catch {
    return false
  }
}

async function signUp(page: Page, username: string, email: string, password: string) {
  await page.goto('/signup')
  await dismissCookieNotice(page)

  const response = await page.evaluate(async ({ username: nextUsername, email: nextEmail, password: nextPassword }) => {
    const signupResponse = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: nextUsername,
        username: nextUsername,
        email: nextEmail,
        password: nextPassword,
      }),
    })

    return {
      ok: signupResponse.ok,
      status: signupResponse.status,
      body: await signupResponse.text(),
    }
  }, { username, email, password })

  if (!response.ok) {
    throw new Error(`Failed to provision Playwright user (${response.status}): ${response.body}`)
  }

  await page.goto('/settings')

  if (page.url().endsWith('/login')) {
    const loggedIn = await tryLogin(page, username, password)

    if (!loggedIn) {
      throw new Error('Provisioned the Playwright user, but could not establish an authenticated session.')
    }
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL
  if (typeof baseURL !== 'string' || !baseURL) {
    throw new Error('Playwright baseURL is required for authenticated setup.')
  }

  const credentials = await readPlaywrightCredentials()
  await fs.mkdir(path.dirname(authStatePath), { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()

  const loggedIn = await tryLogin(page, credentials.username, credentials.password)

  if (!loggedIn) {
    await signUp(page, credentials.username, credentials.email, credentials.password)
  }

  await context.storageState({ path: authStatePath })
  await browser.close()
}