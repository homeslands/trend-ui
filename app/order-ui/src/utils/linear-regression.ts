export interface LinearRegressionResult {
  slope: number
  intercept: number
  /**
   * Hệ số xác định R² — phần phương sai của y được đường thẳng giải thích, trong [0, 1].
   * Gần 1 = dữ liệu bám sát đường; gần 0 = đường thẳng gần như không nói lên điều gì.
   * BẮT BUỘC hiển thị kèm mỗi khi hiển thị `slope`: một mình slope không cho người đọc
   * biết xu hướng đó có đáng tin hay chỉ là nhiễu.
   *
   * Trường hợp mọi y bằng nhau (SS_tot = 0): R² về mặt toán học không xác định, ở đây
   * quy ước = 1 vì đường ngang đi qua các điểm đó khớp hoàn hảo (slope = 0, sai số = 0)
   * — đọc ra là "chắc chắn không có xu hướng", đúng với thực tế.
   */
  r2: number
  at: (x: number) => number
}

/**
 * Least-squares linear regression. Returns null when there are fewer than
 * 2 points or when all x values are identical (denominator = 0).
 */
export function linearRegression(
  points: { x: number; y: number }[],
): LinearRegressionResult | null {
  const n = points.length
  if (n < 2) return null

  const meanX = points.reduce((s, p) => s + p.x, 0) / n
  const meanY = points.reduce((s, p) => s + p.y, 0) / n

  let num = 0
  let den = 0
  for (const p of points) {
    const dx = p.x - meanX
    num += dx * (p.y - meanY)
    den += dx * dx
  }
  if (den === 0) return null

  const slope = num / den
  const intercept = meanY - slope * meanX
  const at = (x: number) => intercept + slope * x

  let ssRes = 0
  let ssTot = 0
  for (const p of points) {
    ssRes += (p.y - at(p.x)) ** 2
    ssTot += (p.y - meanY) ** 2
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot))

  return { slope, intercept, r2, at }
}
