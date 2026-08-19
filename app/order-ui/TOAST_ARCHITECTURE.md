# Toast Logic (order-ui)

Tài liệu mô tả cách hệ thống toast (thông báo) hoạt động: thư viện, nơi mount, các hàm tiện ích, ánh xạ mã lỗi → i18n, và cơ chế bắt lỗi toàn cục qua TanStack Query.

## 1. Thư viện & nơi mount

- Thư viện: **`react-hot-toast`**.
- `<Toaster />` được mount **một lần** ở `src/main.tsx`, bên trong `ErrorBoundary` và **phía trên** `<App />`:

```tsx
createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <Toaster />
      <App />
    </ErrorBoundary>
  </StrictMode>
)
```

- `<Toaster />` không truyền option → dùng **mặc định** của react-hot-toast (vị trí top, auto-dismiss).

## 2. Hàm tiện ích — `src/utils/toast.ts`

Toàn bộ text đi qua `i18next.t(key, { ns: 'toast' })` (namespace **`toast`**) → toast được **đa ngôn ngữ**.

| Hàm | Kiểu toast | Đầu vào | Dùng khi |
|---|---|---|---|
| `showToast(message)` | `toast.success` | **i18n key** | Thông báo thành công (vd `toast.sessionExpired`) |
| `showErrorToast(code)` | `toast.error` | **mã lỗi số** (từ BE) | Bắt lỗi theo mã trả về |
| `useErrorToast(code)` | `toast.error` | mã lỗi số | **Giống hệt `showErrorToast`** (đặt tên "use" nhưng KHÔNG phải hook) |
| `showErrorToastMessage(message)` | `toast.error` | **i18n key** | Toast lỗi với message tự chọn (vd `toast.userNotFound`) |

```ts
export function showToast(message: string) {
  toast.success(i18next.t(message, { ns: 'toast' }))
}

export function showErrorToast(code: number) {
  const messageKey = errorCodes[code] || 'toast.requestFailed'
  toast.error(i18next.t(messageKey, { ns: 'toast' }))
}

export function showErrorToastMessage(message: string) {
  toast.error(i18next.t(message, { ns: 'toast' }))
}
```

## 3. Ánh xạ mã lỗi → i18n (`errorCodes`)

`src/utils/toast.ts` chứa map lớn:

```ts
const errorCodes: { [key: number]: string } = {
  409: 'toast.conflict',
  401: 'toast.unauthorized',
  403: 'toast.forbidden',
  137000: 'toast.userNotFound',
  143407: 'toast.voucherAlreadyUsed',
  // … ~250 mã lỗi backend
}
```

- Key = **mã lỗi số** do backend trả về; value = **i18n key** (namespace `toast`).
- `showErrorToast(code)` tra map; **không tìm thấy → fallback `toast.requestFailed`** (thông báo lỗi chung).

## 4. Bắt lỗi TOÀN CỤC qua TanStack Query — `src/app/App.tsx`

`QueryClient` gắn `QueryCache.onError` và `MutationCache.onError`. **Mọi** query/mutation lỗi sẽ **tự động** bật toast lỗi, trừ khi opt-out.

```ts
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.ignoreGlobalError) return              // opt-out
      if (isAxiosError(error)) {
        const axiosError = error as AxiosError<IApiResponse<void>>
        if (axiosError.response?.data.code) {
          showErrorToast(axiosError.response.data.code)       // dùng `data.code`
        }
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _, __, mutation) => {
      if (mutation.meta?.ignoreGlobalError) return            // opt-out
      if (isAxiosError(error)) {
        const axiosError = error as AxiosError<IApiErrorResponse>
        if (axiosError.response?.data.statusCode) {
          showErrorToast(axiosError.response?.data.statusCode) // dùng `data.statusCode`
        }
      }
    },
  }),
})
```

### Opt-out toast toàn cục

Đặt `meta: { ignoreGlobalError: true }` trên query/mutation để **tự xử lý lỗi** (không bật toast tự động):

```ts
useQuery({
  queryKey: [...],
  queryFn: ...,
  meta: { ignoreGlobalError: true },
})
```

### Lưu ý (khác biệt query vs mutation)

- **Query** đọc mã lỗi từ `response.data.code`.
- **Mutation** đọc mã lỗi từ `response.data.statusCode`.
- Cả hai bọc `try/catch`, log ra console nếu bản thân handler lỗi.

## 5. Dùng thủ công trong component

Ngoài lỗi tự động, code gọi trực tiếp cho **thành công** hoặc **thông báo cụ thể**:

```ts
import { showToast, showErrorToastMessage } from '@/utils'

showToast('toast.updateSuccess')                 // success
showErrorToastMessage('toast.userNotFound')      // error theo key
```

Ví dụ thực tế:
- `ProtectedElement` → `showToast(t('toast.sessionExpired'))` khi hết phiên.
- Tab khách hàng → `showErrorToastMessage('toast.userNotFound')` khi lọc không ra khách.

## 6. Sơ đồ luồng

```
Lỗi API (query/mutation)
  → TanStack onError
       ├─ meta.ignoreGlobalError === true  → bỏ qua (component tự xử lý)
       └─ isAxiosError + có code/statusCode → showErrorToast(code)
                                                → errorCodes[code] || 'toast.requestFailed'
                                                → i18next.t(key, ns:'toast')
                                                → toast.error(...)   (react-hot-toast)

Thành công / thông báo thủ công
  → showToast(key) / showErrorToastMessage(key)
       → i18next.t(key, ns:'toast') → toast.success/error(...)
```

## 7. Quirk / điểm cần lưu ý

1. **Query dùng `data.code`, mutation dùng `data.statusCode`** — không đồng nhất; nếu backend trả field khác nhau giữa 2 loại thì dễ sót toast. Nên thống nhất.
2. **`useErrorToast` trùng hệt `showErrorToast`** nhưng tên gợi ý là hook → dễ hiểu nhầm; không chứa hook nào.
3. **`<Toaster />` không cấu hình** (vị trí, thời lượng, style) → dùng mặc định thư viện. Muốn tùy biến phải sửa `main.tsx`.
4. **Fallback `toast.requestFailed`** cho mọi mã lỗi lạ — nên đảm bảo key này tồn tại ở mọi ngôn ngữ.
5. **`errorCodes` là map thủ công ~250 dòng** — thêm mã lỗi mới phải cập nhật tay + thêm i18n key; dễ lệch với backend.
6. Toast lỗi tự động chỉ bật khi **`isAxiosError`** và có `code`/`statusCode`; lỗi network/không có response → không có toast (trừ khi component tự xử lý).

## 8. Các file liên quan

| File | Vai trò |
|---|---|
| `src/main.tsx` | Mount `<Toaster />` (react-hot-toast) |
| `src/utils/toast.ts` | `errorCodes` map + `showToast` / `showErrorToast` / `useErrorToast` / `showErrorToastMessage` |
| `src/app/App.tsx` | `QueryCache`/`MutationCache` `onError` → toast lỗi toàn cục + opt-out `ignoreGlobalError` |
| `src/i18n.ts` + `src/locales/*/toast.json` | Bản dịch namespace `toast` |
