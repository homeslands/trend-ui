import { describe, it, expect } from 'vitest'
import { detectPlatform } from '@/utils/detect-platform'

describe('detectPlatform', () => {
  it('returns android for Android UA', () => {
    expect(
      detectPlatform('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120')
    ).toBe('android')
  })

  it('returns ios for iPhone UA', () => {
    expect(
      detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
    ).toBe('ios')
  })

  it('returns ios for iPad UA', () => {
    expect(
      detectPlatform('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
    ).toBe('ios')
  })

  it('returns ios for iPod UA', () => {
    expect(
      detectPlatform('Mozilla/5.0 (iPod touch; CPU iPhone OS 17_0 like Mac OS X)')
    ).toBe('ios')
  })

  it('returns desktop for Windows Chrome UA', () => {
    expect(
      detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120')
    ).toBe('desktop')
  })

  it('returns desktop for macOS Safari UA', () => {
    expect(
      detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15')
    ).toBe('desktop')
  })

  it('returns desktop for empty string', () => {
    expect(detectPlatform('')).toBe('desktop')
  })
})
