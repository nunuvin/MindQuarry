import { cn, generateUUID, getRichTextPreview, hasRichTextContent, richTextToPlainText } from '@/lib/utils'

describe('utility helpers', () => {
  const originalCrypto = globalThis.crypto

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    })
  })

  it('merges class names with tailwind conflict resolution', () => {
    expect(cn('p-2', ['p-4', 'text-sm'], undefined, false && 'hidden')).toBe('p-4 text-sm')
  })

  it('strips markup and decodes supported entities into plain text', () => {
    expect(
      richTextToPlainText('<style>.x{}</style><p>Hello&nbsp;&amp;&lt;world&gt;</p><script>alert(1)</script><p>&#39;quote&#39; &quot;double&quot;</p>'),
    ).toBe(`Hello &<world> 'quote' "double"`)
  })

  it('detects when rich text content is effectively empty', () => {
    expect(hasRichTextContent('<p> &nbsp; </p>')).toBe(false)
    expect(hasRichTextContent('<p>Visible</p>')).toBe(true)
  })

  it('returns the original preview when the plain text fits within the limit', () => {
    expect(getRichTextPreview('<p>Short preview</p>', 20)).toBe('Short preview')
  })

  it('truncates previews that exceed the requested length', () => {
    expect(getRichTextPreview('<p>Hello there general kenobi</p>', 12)).toBe('Hello there...')
  })

  it('uses crypto.randomUUID when it is available', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID: jest.fn(() => 'uuid-from-randomUUID'),
      },
    })

    expect(generateUUID()).toBe('uuid-from-randomUUID')
  })

  it('falls back to getRandomValues when randomUUID is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: jest.fn((buffer: Uint8Array) => {
          buffer.set(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]))
          return buffer
        }),
      },
    })

    expect(generateUUID()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  })

  it('throws when secure uuid APIs are unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    })

    expect(() => generateUUID()).toThrow('Secure UUID generation is not available in this environment.')
  })
})