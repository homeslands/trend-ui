import { useEffect } from 'react'
import { Logo } from '@/assets/images'
import { detectPlatform } from '@/utils/detect-platform'

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.trendcoffee.order'
const APP_STORE_URL = 'https://apps.apple.com/vn/app/trend-coffee/id6767593023?l=vi'
const ANDROID_INTENT_URL =
  'intent://#Intent;scheme=trendcoffee;package=com.trendcoffee.order;' +
  `S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`

export function DownloadPage() {
  const platform = detectPlatform()

  useEffect(() => {
    if (platform === 'android') {
      window.location.href = ANDROID_INTENT_URL
    } else if (platform === 'ios') {
      window.location.href = APP_STORE_URL
    }
  }, [platform])

  const showAndroid = platform === 'android' || platform === 'desktop'
  const showIos = platform === 'ios' || platform === 'desktop'

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 px-6">
      {/* Brand */}
      <div className="flex flex-col items-center gap-3">
        <img src={Logo} alt="TREND Coffee" className="h-16 w-auto object-contain sm:h-24" />
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Đặt đồ uống yêu thích của bạn mọi lúc mọi nơi
        </p>
      </div>

      {/* Store badges */}
      <div className="flex flex-row gap-3">
        {showAndroid && (
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2.5 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="currentColor">
              <path d="M3.18 23.5c.3.17.64.2.96.1l13.2-11.6L13.5 8.1 3.18 23.5zm16.3-12.1L16.4 9.5 3.02.5C2.7.3 2.34.32 2.04.5L16.3 11.4l3.18 0zM2.04.5C1.72.68 1.5 1.02 1.5 1.42v21.16c0 .4.22.74.54.92L16.3 12.6 2.04.5zm19.46 10.5-3.1-1.73-3.4 3 3.4 3 3.12-1.74c.88-.5.88-1.54 0-2.03z" />
            </svg>
            <div>
              <div className="text-[10px] leading-none opacity-70 uppercase tracking-wide">Get it on</div>
              <div className="text-sm font-semibold leading-tight">Google Play</div>
            </div>
          </a>
        )}

        {showIos && (
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2.5 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <div>
              <div className="text-[10px] leading-none opacity-70 uppercase tracking-wide">Download on the</div>
              <div className="text-sm font-semibold leading-tight">App Store</div>
            </div>
          </a>
        )}
      </div>
    </div>
  )
}
