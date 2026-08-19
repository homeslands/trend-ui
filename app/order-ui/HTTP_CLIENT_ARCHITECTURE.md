# HTTP Client (order-ui)

Phân tích `src/utils/http.ts` (axios client) và các cấu trúc liên quan: refresh token, hàng đợi request, NProgress/loading, auth store.

## 0. ⚠️ Client nào đang chạy thật?

- Barrel `src/utils/index.ts` export: `export { default as http } from './http'` → **`http.ts`**.
- Mọi file `api/*.ts` dùng `import { http } from '@/utils'` → tức **`http.ts`**.
- **`http.ts` LÀ client active** (instance thật ở dòng 256–408).
- **`http.unified.ts` hiện KHÔNG được import ở đâu** (unused) — là bản gần trùng, sạch hơn (thiếu khối FCM).

> **Lưu ý:** `CLAUDE.md` ghi "dùng `http.unified.ts`, `http.ts` là legacy đã comment" — **không đúng thực tế hiện tại**. Thực tế `http.ts` mới là client đang chạy; `http.unified.ts` không được dùng. Cần cập nhật CLAUDE.md hoặc gộp 2 file.

## 1. Bố cục file `http.ts`

- **Dòng ~1–207:** phiên bản CŨ, **đã comment toàn bộ** (`// const axiosInstance = axios.create(...)`, `// export default axiosInstance`). Chết, chỉ để tham chiếu.
- **Dòng ~209–255:** import + helper module-level (refresh queue).
- **Dòng ~256–408:** instance **ĐANG CHẠY** + 2 interceptor + `export default axiosInstance`.

## 2. Khởi tạo instance

```ts
const axiosInstance = axios.create({
  baseURL,            // từ constants; dev proxy /api/v1/* → VITE_BASE_API_URL
  timeout: 10000,     // 10s
  withCredentials: true,
})
```

## 3. Request interceptor — điểm phức tạp nhất

Chạy **trước mỗi request**, làm 3 việc:

### 3a. Refresh token CHỦ ĐỘNG (proactive, theo thời gian hết hạn)

```ts
if (token && expireTime && isTokenExpired(expireTime) && !isRefreshing) {
  isRefreshing = true
  setIsRefreshing(true)
  // POST /auth/refresh { refreshToken, accessToken: token }
  // → setToken/setRefreshToken/setExpireTime/setExpireTimeRefreshToken
  // → processQueue(null, newToken)   (giải phóng request đang chờ)
  // → (native) kiểm tra & đăng ký lại FCM token nếu đổi
}
```

- Refresh dựa trên **`expireTime` local** (so bằng `moment`), **không phải** phản ứng theo lỗi 401 từ server.
- Trên **Capacitor native**: sau khi refresh còn kiểm tra **FCM token** (async, fire-and-forget) — nếu đổi thì `unregisterDeviceToken` cũ + `tokenRegistrationQueue.enqueue` mới. Lỗi FCM bị nuốt, không ảnh hưởng auth. *(Đây là điểm khác duy nhất so với `http.unified.ts`.)*

### 3b. Request đến trong lúc đang refresh → xếp hàng

```ts
} else if (isRefreshing) {
  return new Promise((resolve, reject) => {
    failedQueue.push({
      resolve: (currentToken) => {
        config.headers['Authorization'] = `Bearer ${currentToken}`
        resolve(config)
      },
      reject,
    })
  })
}
```

- Các request song song **bị treo** (pending Promise) tới khi refresh xong → `processQueue` gọi `resolve(newToken)` → tiếp tục với token mới. Tránh refresh nhiều lần đồng thời.

### 3c. Gắn token + bật loading/NProgress

```ts
if (token) {
  config.headers['Authorization'] = `Bearer ${token}`
  if (!config.doNotShowLoading) {
    useLoadingStore.getState().setIsLoading(true)
    if (requestStore.requestQueueSize === 0) NProgress.start()
    requestStore.incrementRequestQueueSize()
  }
}
```

- Request **có token** mới gắn `Authorization`; không token → gửi như guest.
- `doNotShowLoading: true` (config tùy biến) → **bỏ qua** thanh loading NProgress.

### Refresh thất bại

```ts
catch (error) {
  processQueue(error, null)        // reject tất cả request đang chờ
  setLogout()                      // clear auth
  showErrorToast(1017)             // "phiên hết hạn / refresh failed"
  // lưu currentUrl (nếu hợp lệ) để quay lại sau login
}
```

## 4. Response interceptor

```ts
(response) => {
  useLoadingStore.getState().setIsLoading(false)
  if (!response.config?.doNotShowLoading) setProgressBarDone()
  return response
},
async (error) => {
  useLoadingStore.getState().setIsLoading(false)
  if (!error.config?.doNotShowLoading) setProgressBarDone()
  return Promise.reject(error)     // KHÔNG tự refresh/redirect theo 401 ở đây
}
```

- Chỉ tắt loading + tiến/kết thúc NProgress rồi **reject** để tầng trên (TanStack `onError` → toast) xử lý.
- **Không có xử lý 401 phản ứng** (reactive) ở response — mọi refresh nằm ở **request interceptor** (proactive).

## 5. Hàng đợi refresh (module-level)

```ts
let isRefreshing = false            // cờ gate refresh + queue (biến module)
let failedQueue: { resolve, reject }[] = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => token ? p.resolve(token) : p.reject(error))
  failedQueue = []
}

const isTokenExpired = (expiry) => moment().isAfter(moment(expiry))
```

- `isRefreshing` (biến module) là **khoá thật** điều phối hàng đợi; song song còn `authStore.isRefreshing` (dùng cho UI, vd `ProtectedElement` hiện spinner).

## 6. NProgress / loading

```ts
NProgress.configure({ showSpinner: false, trickleSpeed: 200 })

async function setProgressBarDone() {
  requestStore.requestQueueSize -= 1
  if (requestStore.requestQueueSize > 0) NProgress.inc()
  else NProgress.done()
}
```

- `requestStore.requestQueueSize` đếm số request đang chạy → thanh NProgress chỉ `done()` khi **hết** request.
- `useLoadingStore.isLoading` cờ loading toàn cục (bật ở request, tắt ở response).

## 7. `doNotShowLoading` — opt-out thanh loading

```ts
interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  doNotShowLoading?: boolean
}
```

Truyền `{ doNotShowLoading: true }` trong config request để **không** hiện NProgress (vd polling nền, request phụ).

## 8. Các cấu trúc liên quan

| Thành phần | Vai trò trong http |
|---|---|
| `stores/auth.store` | `token`, `expireTime`, `refreshToken`, `isRefreshing`; setters `setToken/setLogout/…` |
| `stores/current-url.store` | Lưu URL trước khi logout (post-login redirect) |
| `stores/loading.store` | Cờ `isLoading` toàn cục |
| `stores/request.store` | `requestQueueSize` đếm request cho NProgress |
| `stores/user.store` | (native) đọc/ghi FCM device token, userInfo |
| `utils/toast` | `showErrorToast(1017)` khi refresh fail |
| `utils/current-url-manager` | `isValidRedirectUrl`, `shouldUpdateUrl` |
| `constants` | `baseURL`, `ROUTE.LOGIN` |
| `services/token-registration-queue` | Đăng ký lại FCM token (native) |
| `utils/getNativeFcmToken` | Lấy FCM token native |
| `POST /auth/refresh` | Endpoint làm mới access token |

## 9. Luồng tổng quát

```
api.get/post (import { http } from '@/utils' → http.ts)
  → REQUEST interceptor
       ├─ token hết hạn (theo expireTime) & !isRefreshing → POST /auth/refresh
       │     ├─ ok  → cập nhật token, processQueue(resolve), (native) refresh FCM
       │     └─ fail→ processQueue(reject), setLogout, toast(1017), lưu currentUrl
       ├─ đang refresh → treo request vào failedQueue (chờ token mới)
       └─ gắn Bearer token + NProgress.start (trừ doNotShowLoading)
  → server
  → RESPONSE interceptor → tắt loading + NProgress.done/inc → trả/reject
       └─ reject → TanStack onError → showErrorToast (xem TOAST_ARCHITECTURE.md)
```

## 10. Quirk / rủi ro

1. **Sai lệch với CLAUDE.md** — CLAUDE.md nói dùng `http.unified.ts`; thực tế `http.ts` mới chạy. Dễ gây nhầm khi sửa. → cập nhật doc hoặc gộp file.
2. **Hai client gần trùng** (`http.ts` active + `http.unified.ts` unused) — trùng lặp ~150 dòng, khác mỗi khối FCM. Nên gộp về một.
3. **Refresh chỉ CHỦ ĐỘNG theo `expireTime` local** — không refresh/ retry khi server trả **401** (response interceptor chỉ reject). Nếu lệch giờ client/server hoặc token bị thu hồi sớm, request hỏng sẽ không tự thử lại.
4. **`http.ts` còn ~207 dòng code CŨ đã comment** ở đầu file — nhiễu, nên xóa.
5. **`isRefreshing` tồn tại 2 nơi** (biến module + `authStore.isRefreshing`) — cần đồng bộ đúng; biến module mới là khoá thật của hàng đợi.
6. **`showErrorToast(1017)`** dùng magic code cho "refresh failed" — phụ thuộc map `errorCodes`.
7. **FCM re-check nhét trong luồng auth refresh** — ghép cặp auth với notification (chỉ native, fire-and-forget) → khó theo dõi.

## 11. Files

| File | Vai trò |
|---|---|
| `src/utils/http.ts` | **Client axios đang chạy** (interceptor refresh + NProgress) |
| `src/utils/http.unified.ts` | Bản gần trùng, **không được dùng** |
| `src/utils/index.ts` | Barrel: `export { default as http } from './http'` |
| `src/api/*.ts` | Gọi API qua `http` |
| `src/app/App.tsx` | `QueryCache/MutationCache.onError` → toast lỗi (tầng trên) |
