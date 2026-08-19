import { useTheme } from '@/components/app/theme-provider'

export interface ChartColors {
  newCustomer: string
  spending: string
  previous: string
  trend: string
  label: string
  splitLine: string
  /** Nền của Card chứa chart — dùng làm màu viền "khoảng cách" giữa các đoạn cột
   * chồng (stacked bar spacer), KHÔNG phải màu vẽ dữ liệu. */
  surface: string
  /** Bốn màu phương thức thanh toán cho cột chi tiêu chồng (stacked-by-method). Đã
   * chạy qua palette validator ở cả hai theme (dải sáng, sàn chroma, tách CVD,
   * contrast >= 3:1) — KHÔNG tự đổi giá trị, chỉ đọc qua `useChartColors()`. */
  mixBank: string
  mixCash: string
  mixPoint: string
  mixCredit: string
}

/**
 * Bước màu dark KHÔNG phải là bản lật của light — chúng được chọn lại cho nền
 * tối và đã chạy qua validator (dải sáng, sàn chroma, tách CVD, contrast >= 3:1).
 * Cặp cam <-> xanh giữ CVD ΔE 29.9 (light) / 21.5 (dark), thừa ngưỡng 8.
 */
const PALETTE: Record<'light' | 'dark', ChartColors> = {
  light: {
    newCustomer: '#f89209',
    spending: '#2a78d6',
    previous: '#cbd5e1',
    trend: '#6b6459',
    label: '#6b7280',
    splitLine: '#e5e7eb',
    // Nền `--card` ở light theme (`index.css`): hsl(0 0% 100%) = trắng thuần.
    surface: '#ffffff',
    mixBank: '#2a78d6',
    mixCash: '#1baf7a',
    mixPoint: '#eda100',
    mixCredit: '#4a3aa7',
  },
  dark: {
    newCustomer: '#c97a07',
    spending: '#3987e5',
    previous: '#4d5561',
    trend: '#a49d92',
    label: '#9ca3af',
    splitLine: '#2b2927',
    // Nền `--card` ở dark theme (`index.css`): hsl(0 0% 12.55%) ≈ #202020.
    surface: '#202020',
    mixBank: '#3987e5',
    mixCash: '#199e70',
    mixPoint: '#c98500',
    mixCredit: '#9085e9',
  },
}

export const useChartColors = (): ChartColors => {
  const { theme } = useTheme()
  return PALETTE[theme] ?? PALETTE.light
}
