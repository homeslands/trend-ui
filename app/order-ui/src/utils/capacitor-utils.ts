// src/utils/capacitor-utils.ts
/* eslint-disable no-console */
import { Capacitor } from '@capacitor/core'

/**
 * Kiểm tra xem Capacitor bridge đã sẵn sàng chưa
 * Trên một số thiết bị, Capacitor bridge có thể chưa sẵn sàng ngay sau khi app khởi động
 */
export async function isCapacitorReady(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true // Web platform luôn sẵn sàng
  }

  try {
    // Kiểm tra xem Capacitor có sẵn sàng bằng cách thử access platform
    const platform = Capacitor.getPlatform()
    if (!platform) {
      return false
    }

    // Thử access Capacitor.isPluginAvailable để đảm bảo bridge đã load
    // Nếu bridge chưa sẵn sàng, method này có thể throw error
    if (typeof Capacitor.isPluginAvailable === 'function') {
      // Test với một plugin phổ biến
      Capacitor.isPluginAvailable('App')
    }

    return true
  } catch (error) {
    console.warn('[CapacitorUtils] Capacitor bridge not ready yet:', error)
    return false
  }
}

/**
 * Đợi cho đến khi Capacitor bridge sẵn sàng
 * @param maxWaitTime Thời gian tối đa để đợi (ms), mặc định 5s
 * @param checkInterval Khoảng thời gian giữa các lần check (ms), mặc định 100ms
 */
export async function waitForCapacitorReady(
  maxWaitTime: number = 5000,
  checkInterval: number = 100,
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true
  }

  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    if (await isCapacitorReady()) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, checkInterval))
  }

  console.warn('[CapacitorUtils] Capacitor bridge not ready after timeout')
  return false
}

/**
 * Wrapper để đảm bảo Capacitor sẵn sàng trước khi thực thi function
 * @param fn Function cần thực thi
 * @param fallbackValue Giá trị trả về nếu Capacitor chưa sẵn sàng
 */
export async function ensureCapacitorReady<T>(
  fn: () => Promise<T>,
  fallbackValue: T | null = null,
): Promise<T | null> {
  const isReady = await waitForCapacitorReady()
  if (!isReady) {
    console.warn('[CapacitorUtils] Capacitor not ready, returning fallback value')
    return fallbackValue
  }

  try {
    return await fn()
  } catch (error) {
    console.error('[CapacitorUtils] Error executing function:', error)
    return fallbackValue
  }
}

