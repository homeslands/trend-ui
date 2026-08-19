export type Platform = 'android' | 'ios' | 'desktop'

export function detectPlatform(userAgent: string = navigator.userAgent): Platform {
  if (/Android/i.test(userAgent)) return 'android'
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  return 'desktop'
}
