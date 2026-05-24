import { TextDecoder, TextEncoder } from 'util'
import { ReadableStream } from 'stream/web'

;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as typeof global.TextEncoder
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as typeof global.TextDecoder
}

if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = ReadableStream as typeof global.ReadableStream
}

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true