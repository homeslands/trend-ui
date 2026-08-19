const lgamma = (z: number): number => {
  const c = [
    76.18009172947146, -86.50532032941678, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let y = z
  const x = z
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) ser += c[j] / ++y
  return -tmp + Math.log((2.5066282746310007 * ser) / x)
}

const betacf = (a: number, b: number, x: number): number => {
  const MAXIT = 200
  const EPS = 3e-14
  const FPMIN = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** Beta không đầy đủ đã chuẩn hoá I_x(a,b). Nền tảng cho cả F-test lẫn t-quantile. */
export function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  )
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(a, b, x)) / a
    : 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** p-value hai phía cho độ dốc hồi quy tuyến tính đơn biến, từ R², số điểm n và độ dốc
 *  `slope` (dùng để nhận diện input suy biến — xem nhánh `r2 >= 1` bên dưới).
 *  Trả về 1 khi df < 1 (không đủ điểm để kiểm định). */
export function pValueFromR2(r2: number, n: number, slope: number): number {
  const df = n - 2
  if (df < 1) return 1
  // r2 >= 1 xảy ra ở hai tình huống KHÁC NHAU mà chỉ mình `r2` không phân biệt được:
  // (a) hồi quy khớp hoàn hảo một xu hướng THẬT (slope ≠ 0, vd y = 10x + 5) — chắc chắn
  //     có xu hướng, p = 0.
  // (b) mọi y bằng nhau (SS_tot = 0, xem `linearRegression`) — khi đó slope LUÔN LÀ 0
  //     (không có gì để khớp), r2 = 1 chỉ theo quy ước chứ không phải một xu hướng được
  //     phát hiện. Coi như không kiểm định được gì, p = 1 (giống df < 1).
  if (r2 >= 1) return slope === 0 ? 1 : 0
  const F = (r2 / (1 - r2)) * df
  return regularizedIncompleteBeta(df / 2, 0.5, df / (df + F))
}

/** Phân vị t hai phía, ví dụ tQuantile(0.975, 5) = 2.571. */
export function tQuantile(p: number, df: number): number {
  const cdf = (t: number): number =>
    1 - 0.5 * regularizedIncompleteBeta(df / 2, 0.5, df / (df + t * t))

  let lo = 0
  let hi = 100
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (cdf(mid) < p) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return (lo + hi) / 2
}
