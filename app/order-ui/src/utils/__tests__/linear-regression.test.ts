import { describe, it, expect } from 'vitest'
import { linearRegression } from '../linear-regression'

describe('linearRegression', () => {
  it('fits a perfectly increasing line y = 2x', () => {
    const r = linearRegression([
      { x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 },
    ])
    expect(r).not.toBeNull()
    expect(r!.slope).toBeCloseTo(2, 6)
    expect(r!.intercept).toBeCloseTo(0, 6)
    expect(r!.at(4)).toBeCloseTo(8, 6)
  })

  it('fits a decreasing line (negative slope)', () => {
    const r = linearRegression([{ x: 0, y: 10 }, { x: 1, y: 8 }, { x: 2, y: 6 }])
    expect(r!.slope).toBeCloseTo(-2, 6)
    expect(r!.at(3)).toBeCloseTo(4, 6)
  })

  it('returns slope 0 for constant data', () => {
    const r = linearRegression([{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }])
    expect(r!.slope).toBeCloseTo(0, 6)
    expect(r!.intercept).toBeCloseTo(5, 6)
  })

  it('returns null for fewer than 2 points', () => {
    expect(linearRegression([])).toBeNull()
    expect(linearRegression([{ x: 1, y: 1 }])).toBeNull()
  })

  it('returns null when all x are identical (zero variance)', () => {
    expect(linearRegression([{ x: 2, y: 1 }, { x: 2, y: 5 }])).toBeNull()
  })

  describe('r2', () => {
    it('is 1 for a perfect fit', () => {
      const r = linearRegression([
        { x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 },
      ])
      expect(r!.r2).toBeCloseTo(1, 6)
    })

    it('is 1 for constant y (flat line fits the points exactly)', () => {
      const r = linearRegression([{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }])
      expect(r!.r2).toBeCloseTo(1, 6)
    })

    it('is near 0 when the points carry no linear signal', () => {
      // Đối xứng quanh trung bình: slope ~ 0 nhưng y dao động mạnh → đường thẳng không
      // giải thích được gì. Đây chính là ca mà slope một mình sẽ đánh lừa người đọc.
      const r = linearRegression([
        { x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 3, y: 0 },
      ])
      expect(r!.slope).toBeCloseTo(0, 6)
      expect(r!.r2).toBeCloseTo(0, 6)
    })

    it('is between 0 and 1 for a noisy but rising series', () => {
      const r = linearRegression([
        { x: 0, y: 1 }, { x: 1, y: 4 }, { x: 2, y: 2 }, { x: 3, y: 7 },
      ])
      expect(r!.slope).toBeGreaterThan(0)
      expect(r!.r2).toBeGreaterThan(0)
      expect(r!.r2).toBeLessThan(1)
    })
  })
})
