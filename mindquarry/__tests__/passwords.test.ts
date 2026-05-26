import { clampTemporaryPasswordLength, generateSecureTemporaryPassword } from '@/lib/passwords'

describe('password helpers', () => {
  it('clamps temporary password lengths into the supported range', () => {
    expect(clampTemporaryPasswordLength(Number.NaN)).toBe(16)
    expect(clampTemporaryPasswordLength(2)).toBe(8)
    expect(clampTemporaryPasswordLength(72)).toBe(64)
    expect(clampTemporaryPasswordLength(16.9)).toBe(16)
  })

  it('generates keyboard-friendly temporary passwords at the requested length', () => {
    const password = generateSecureTemporaryPassword(16)

    expect(password).toHaveLength(16)
    expect(password).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]+$/)
  })

  it('respects clamped bounds when generating temporary passwords', () => {
    expect(generateSecureTemporaryPassword(4)).toHaveLength(8)
    expect(generateSecureTemporaryPassword(80)).toHaveLength(64)
  })
})