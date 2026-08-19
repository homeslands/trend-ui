import { useEffect, useState } from 'react'

/**
 * Hook trả về chiều cao viewport hiện tại.
 * Cập nhật khi resize hoặc khi tab trở lại visible (visibilitychange).
 * Giải quyết lỗi 100vh sai khi chuyển tab rồi quay lại (đặc biệt trên mobile).
 */
export function useViewportHeight(): number {
  const [height, setHeight] = useState(() => {
    if (typeof window === 'undefined') return 0
    return window.visualViewport?.height ?? window.innerHeight
  })

  useEffect(() => {
    const updateHeight = () => {
      const h = window.visualViewport?.height ?? window.innerHeight
      setHeight(h)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateHeight()
      }
    }

    updateHeight()

    window.addEventListener('resize', updateHeight)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.visualViewport?.addEventListener('resize', updateHeight)

    return () => {
      window.removeEventListener('resize', updateHeight)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.visualViewport?.removeEventListener('resize', updateHeight)
    }
  }, [])

  return height
}
