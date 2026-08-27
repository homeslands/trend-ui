/// <reference types="vitest" />
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) }
  return {
    assetsInclude: ['**/*.ttf'], // Ensure .ttf files are treated as assets
    plugins: [react()],
    optimizeDeps: {
      // Force re-optimize dependencies
      force: true,
      // Exclude problematic dependencies if needed
      exclude: [],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5177,
      // Vite chặn host lạ để phòng tấn công DNS rebinding vào máy dev. Khi thử
      // trên điện thoại qua tunnel HTTPS thì phải khai tên miền tunnel ra, mà
      // tên miền đó đổi theo từng người và từng lần chạy — nên để trong `.env`
      // (không vào git) thay vì viết cứng ở đây. Không khai thì giữ nguyên mức
      // chặn mặc định.
      allowedHosts: process.env.VITE_DEV_ALLOWED_HOSTS
        ? process.env.VITE_DEV_ALLOWED_HOSTS.split(',').map((h) => h.trim())
        : undefined,
      hmr: {
        port: 5177,
      },
      proxy: {
        '/api/v1': {
          // `VITE_API_PROXY_TARGET` tách riêng khỏi `VITE_BASE_API_URL`: cái sau
          // là thứ TRÌNH DUYỆT gọi (đường dẫn tương đối để tránh CORS), còn cái
          // này là đích thật mà dev server chuyển tiếp tới. Fallback giữ nguyên
          // hành vi cũ cho máy chưa khai biến mới.
          target:
            process.env.VITE_API_PROXY_TARGET || process.env.VITE_BASE_API_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/v1/, ''),
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/tests/setup.ts',
    },
  }
})
