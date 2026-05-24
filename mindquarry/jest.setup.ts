import '@testing-library/jest-dom'
import * as React from 'react'
import { act } from 'react-dom/test-utils'

if (!(React as typeof React & { act?: typeof act }).act) {
  ;(React as typeof React & { act?: typeof act }).act = act
}

// Mock Request/Response for Better Auth which relies on native fetch APIs not present in JSDOM testing
if (typeof global.Request === 'undefined') {
  global.Request = class Request {} as any;
}
if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    body: string | null
    status: number
    headers: Map<string, string>

    constructor(body?: string | null, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body ?? null
      this.status = init?.status ?? 200
      this.headers = new Map(Object.entries(init?.headers ?? {}))
    }

    static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return new Response(JSON.stringify(body), {
        status: init?.status,
        headers: {
          'content-type': 'application/json',
          ...(init?.headers ?? {}),
        },
      })
    }

    async json() {
      return this.body ? JSON.parse(this.body) : null
    }

    async text() {
      return this.body ?? ''
    }
  } as any;
} else if (typeof (global.Response as typeof Response & { json?: unknown }).json !== 'function') {
  ;(global.Response as typeof Response & { json?: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => Response }).json = (body, init) => new global.Response(JSON.stringify(body), {
    status: init?.status,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}
