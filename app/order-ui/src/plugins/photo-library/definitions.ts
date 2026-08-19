export interface SavePhotoOptions {
  /**
   * Ảnh ở dạng data URI (data:image/png;base64,...) hoặc base64 thuần
   */
  imageData: string

  /**
   * Tên file khi lưu vào thư viện ảnh (mặc định: image.png)
   */
  filename?: string

  /**
   * Tên album (thư mục) trên Android, ví dụ: "TREND Coffee"
   * iOS sẽ bỏ qua trường này.
   */
  albumName?: string
}

export interface SavePhotoResult {
  success: boolean
  uri?: string // Android: MediaStore URI
  identifier?: string // iOS: PHAsset identifier (nếu cần sau này)
}

export interface PhotoLibraryPlugin {
  /**
   * Lưu ảnh vào thư viện ảnh (Gallery / Photos)
   * - Native: dùng MediaStore (Android) / PhotoKit (iOS)
   * - Web: fallback tải file về (download attribute)
   */
  savePhoto(options: SavePhotoOptions): Promise<SavePhotoResult>
}


