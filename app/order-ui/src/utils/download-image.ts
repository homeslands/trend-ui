import { Capacitor } from '@capacitor/core'
import { showToast, showErrorToastMessage } from './toast'
import { PhotoLibrary } from '@/plugins/photo-library'

/**
 * Download QR code image
 * - Web: tải file về (Downloads)
 * - Native:
 *   - Nếu plugin PhotoLibrary sẵn sàng: lưu trực tiếp vào Gallery/Photos
 *   - Nếu KHÔNG: fallback về Share API (drawer chia sẻ như hiện tại)
 */
export async function downloadQrCode(
  imageUrl: string,
  filename: string,
): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await downloadQrCodeNative(imageUrl, filename)
    } else {
      await downloadQrCodeWeb(imageUrl, filename)
    }
  } catch (error: unknown) {
    // const errorObj = error as Error
    showErrorToastMessage('toast.downloadQrError')
    throw error
  }
}

/**
 * Web implementation: Downloads to browser's download folder
 * Uses createObjectURL + anchor tag download (existing behavior)
 */
async function downloadQrCodeWeb(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    const blob = await response.blob()
    const urlObj = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = urlObj
    a.download = filename.endsWith('.png') ? filename : `${filename}.png`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(urlObj)
    document.body.removeChild(a)
    
    showToast('toast.downloadQrSuccess')
  } catch {
    throw new Error('Web download failed')
  }
}

async function downloadQrCodeNative(url: string, filename: string): Promise<void> {
  const finalFilename = filename.endsWith('.png') ? filename : `${filename}.png`

  // Thử dùng native plugin PhotoLibrary trước

  try {
    const result = await PhotoLibrary.savePhoto({
      imageData: url,
      filename: finalFilename,
      albumName: 'TREND Coffee',
    })

    if (!result.success) {
      throw new Error('PhotoLibrary.savePhoto reported failure')
    }

    showToast('toast.downloadQrSuccess')
    return
  } catch (err: unknown) {
    const errorObj = err as { message?: string; code?: string }
    const message = errorObj.message || ''
    const code = errorObj.code

    const isUnimplemented =
      code === 'UNIMPLEMENTED' ||
      message.includes('not implemented on android') ||
      message.includes('not implemented')

    if (isUnimplemented) {
      // Plugin native chưa được bridge / chưa build vào app → fallback về Share API
      await downloadQrCodeNativeFallback(url, finalFilename)
      // Không ném lỗi nữa để UX coi như thành công (user sẽ tự lưu trong sheet)
      return
    }

    // Lỗi khác: ném ra cho tầng trên xử lý (toast lỗi)
    throw err
  }
}

/**
 * Fallback: Share API (drawer chia sẻ của Android/iOS)
 * - User sẽ chọn "Lưu vào Photos / Google Photos" thủ công
 */
async function downloadQrCodeNativeFallback(
  url: string,
  filename: string,
): Promise<void> {
  const { Share } = await import('@capacitor/share')
  const { Filesystem, Directory } = await import('@capacitor/filesystem')

  // url hiện tại là data URI (data:image/png;base64,...) → lấy base64
  const base64Data = extractBase64Data(url)

  const filePath = filename.endsWith('.png') ? filename : `${filename}.png`

  await Filesystem.writeFile({
    path: filePath,
    data: base64Data,
    directory: Directory.Cache,
  })

  const fileUri = await Filesystem.getUri({
    path: filePath,
    directory: Directory.Cache,
  })

  await Share.share({
    title: 'QR Code',
    text: 'Save this QR code to your photos',
    url: fileUri.uri,
  })
}

/**
 * Helper: lấy phần base64 từ data URI hoặc string base64 thuần
 */
function extractBase64Data(imageData: string): string {
  if (!imageData) return ''
  return imageData.includes(',')
    ? imageData.split(',')[1]
    : imageData.replace('data:image/png;base64,', '')
}