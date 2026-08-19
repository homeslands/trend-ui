import { describe, it, expect } from 'vitest'
import { regularizedIncompleteBeta, pValueFromR2, tQuantile } from '../statistics'

describe('tQuantile', () => {
  it('matches standard t-table values at p = 0.975 (two-sided 95%)', () => {
    expect(tQuantile(0.975, 5)).toBeCloseTo(2.571, 2)
    expect(tQuantile(0.975, 10)).toBeCloseTo(2.228, 2)
    expect(tQuantile(0.975, 20)).toBeCloseTo(2.086, 2)
    expect(tQuantile(0.975, 30)).toBeCloseTo(2.042, 2)
  })
})

describe('pValueFromR2', () => {
  // `slope` chỉ dùng để phân biệt hai ca suy biến ở nhánh r2 >= 1; với r2 < 1 giá trị
  // của nó không ảnh hưởng kết quả, nên các test dưới truyền một slope khác 0 bất kỳ.
  it('is >> 0.05 for weak real trend data (n = 7)', () => {
    expect(pValueFromR2(0.018, 7, 1)).toBeCloseTo(0.774, 2)
    expect(pValueFromR2(0.025, 7, 1)).toBeCloseTo(0.735, 2)
  })

  it('is approximately 0.05 at the significance boundary for n = 7', () => {
    expect(pValueFromR2(0.57, 7, 1)).toBeCloseTo(0.05, 1)
  })

  it('returns 1 when df < 1 (not enough points)', () => {
    expect(pValueFromR2(0.5, 2, 1)).toBe(1)
  })

  // Nhánh r2 >= 1 tách làm hai theo `slope`: khớp hoàn hảo một xu hướng thật thì p = 0,
  // còn chuỗi phẳng (mọi y bằng nhau -> slope = 0, r2 = 1 chỉ theo quy ước) thì p = 1.
  // Không tách, chuỗi phẳng sẽ bị báo là "xu hướng rõ và đáng tin cậy".
  it('returns 0 for a perfect fit with a real slope', () => {
    expect(pValueFromR2(1, 10, 10)).toBe(0)
  })

  it('returns 1 for a flat series (r2 = 1 by convention but slope = 0)', () => {
    expect(pValueFromR2(1, 10, 0)).toBe(1)
  })
})

describe('regularizedIncompleteBeta', () => {
  it('is 0 at x = 0 and 1 at x = 1', () => {
    expect(regularizedIncompleteBeta(2, 3, 0)).toBe(0)
    expect(regularizedIncompleteBeta(2, 3, 1)).toBe(1)
  })
})
