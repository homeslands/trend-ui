import { registerPlugin } from '@capacitor/core'
import type { PhotoLibraryPlugin } from './definitions'

// Đăng ký plugin PhotoLibrary với Capacitor
export const PhotoLibrary = registerPlugin<PhotoLibraryPlugin>('PhotoLibrary', {
  web: () => import('./web').then((m) => new m.PhotoLibraryWeb()),
})

export * from './definitions'


