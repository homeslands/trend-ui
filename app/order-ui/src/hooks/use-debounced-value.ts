import { useDebounce } from 'use-debounce'

/**
 * Custom hook để debounce một giá trị bất kỳ
 * @param value - Giá trị cần debounce
 * @param delay - Thời gian delay (ms), mặc định 800ms
 * @returns Debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number = 800): T {
  const [debouncedValue] = useDebounce(value, delay)
  return debouncedValue
}
