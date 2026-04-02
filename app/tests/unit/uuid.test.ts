import { describe, it, expect } from 'vitest'
import { isValidUUID } from '@/lib/uuid'

describe('isValidUUID', () => {
  it('accepts a standard UUID v4', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('accepts a UUID with uppercase hex digits', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('accepts a mixed-case UUID', () => {
    expect(isValidUUID('550e8400-E29B-41d4-A716-446655440000')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isValidUUID('')).toBe(false)
  })

  it('rejects a plain integer string', () => {
    expect(isValidUUID('12345')).toBe(false)
  })

  it('rejects SQL injection attempt', () => {
    expect(isValidUUID("1' OR '1'='1")).toBe(false)
  })

  it('rejects a UUID with missing segment', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false)
  })

  it('rejects a UUID with an extra segment', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false)
  })

  it('rejects a UUID with non-hex characters in a segment', () => {
    expect(isValidUUID('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')).toBe(false)
  })

  it('rejects a UUID without dashes', () => {
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false)
  })

  it('rejects undefined coerced to string (extra guard)', () => {
    // Simulate what happens when params are missing
    expect(isValidUUID('undefined')).toBe(false)
    expect(isValidUUID('null')).toBe(false)
  })
})
