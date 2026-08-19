import { describe, it, expect } from 'vitest'
import { resolveDefaultBranch } from '../resolve-default-branch'

describe('resolveDefaultBranch', () => {
  it('returns empty string when the branch list has not loaded yet', () => {
    expect(resolveDefaultBranch([], 'hcm-7')).toBe('')
    expect(resolveDefaultBranch([])).toBe('')
  })

  it('prefers the store branch when it exists in the loaded list', () => {
    const branches = [{ slug: 'hn-1' }, { slug: 'hcm-7' }]
    expect(resolveDefaultBranch(branches, 'hcm-7')).toBe('hcm-7')
  })

  it('falls back to the first branch when there is no store branch', () => {
    const branches = [{ slug: 'hn-1' }, { slug: 'hcm-7' }]
    expect(resolveDefaultBranch(branches)).toBe('hn-1')
  })

  it('falls back to the first branch when the store branch no longer exists in the list', () => {
    const branches = [{ slug: 'hn-1' }, { slug: 'hcm-7' }]
    expect(resolveDefaultBranch(branches, 'stale-slug')).toBe('hn-1')
  })
})
