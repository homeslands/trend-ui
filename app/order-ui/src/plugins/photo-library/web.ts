import { WebPlugin } from '@capacitor/core'
import type {
  PhotoLibraryPlugin,
  SavePhotoOptions,
  SavePhotoResult,
} from './definitions'

/**
 * Web implementation – fallback:
 * - Chuyển base64/data URI thành Blob
 * - Dùng thẻ <a download> để tải file về
 */
export class PhotoLibraryWeb extends WebPlugin implements PhotoLibraryPlugin {
  async savePhoto(options: SavePhotoOptions): Promise<SavePhotoResult> {
    const { imageData, filename = 'image.png' } = options

    // Lấy phần base64 thuần
    const base64 =
      imageData && imageData.includes(',')
        ? imageData.split(',')[1]
        : imageData.replace('data:image/png;base64,', '')

    const byteChars = atob(base64)
    const byteNums = new Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) {
      byteNums[i] = byteChars.charCodeAt(i)
    }

    const blob = new Blob([new Uint8Array(byteNums)], { type: 'image/png' })

    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    return { success: true }
  }
}


