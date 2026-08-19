# Router Architecture (order-ui)

Tài liệu mô tả cách hoạt động của logic router phía frontend: mount, cấu trúc cây route, code-splitting, phân quyền (guard), điều hướng an toàn, và các rủi ro cần lưu ý.

## 1. Điểm vào & mount

- `src/main.tsx` → `src/app/App.tsx`.
- `App` **chặn toàn bộ UI sau `isAuthInitialized`**: chạy `useGlobalTokenValidator` (dọn token hết hạn khỏi Zustand/localStorage), validate auth đồng bộ, rồi mới render `<RouterProvider router={router} />`. Trong khi khởi tạo hiển thị loader "Đang khởi tạo…".
- Router dùng **data router API**: `createBrowserRouter([...])` tại `src/router/index.tsx`.

> Không được bỏ/di chuyển cổng `isAuthInitialized` — nó tồn tại để tránh race condition trên auth state (localStorage cũ, token hỏng).

## 2. Cấu trúc cây route

Một route gốc duy nhất:

- `element: <RootLayout />` (`src/app/layouts/root-layout.tsx`)
- `errorElement: <ErrorPage />` (áp cho toàn cây).

`RootLayout` bọc **provider dùng chung toàn app**:

```tsx
<DialogProvider>
  <NotificationProvider />
  <Outlet />
</DialogProvider>
```

Dưới `RootLayout` là **~50+ route con phẳng**, chia 3 nhóm:

| Nhóm | Mẫu element | Guard |
|---|---|---|
| **Auth / public** (`/auth/*`, `/about`, `/403`, `/download`…) | `<SuspenseElement component={Page} />` | Không |
| **Client** (menu, cart, order history…) | dưới `ClientLayout` / `PublicClientLayout` / `AdaptiveClientShell` | Tùy trang |
| **System (staff)** | xem mẫu bên dưới | **`ProtectedElement`** |

Mẫu một route **system**:

```tsx
{
  path: ROUTE.STAFF_MENU,
  element: (
    <Suspense fallback={<SkeletonCart />}>
      <SuspenseElement component={SystemLayout} />
    </Suspense>
  ),
  children: [
    {
      index: true,
      element: (
        <ProtectedElement element={<SuspenseElement component={MenuPage} />} />
      ),
    },
  ],
}
```

- `SystemLayout` là **parent** (sidebar + `<Outlet/>`), render phần khung.
- Trang con `index` mới được bọc **`ProtectedElement`** (guard ở leaf).

Cuối cây:

- `/403` → `ForbiddenPage`
- `path: '*'` → `NotFoundPage` (catch-all 404)

## 3. Code-splitting

- `src/router/loadable.tsx`: mọi page/layout bọc
  `React.lazy(() => import('…').then((m) => ({ default: m.X })))`.
- `SuspenseElement` (`src/components/app/elements/suspense-element.tsx`) bọc mỗi lazy component trong `<Suspense>` (fallback rỗng).
- Một số route system bọc thêm `<Suspense fallback={<SkeletonCart />}>` quanh `SystemLayout`.

## 4. Guard phân quyền — `ProtectedElement`

`src/components/app/elements/protected-element.tsx` bọc **element của từng trang được bảo vệ** (51 chỗ trong `index.tsx`).

### Nguồn quyền = JWT

```ts
const decoded = jwtDecode(token)
const scope = typeof decoded.scope === 'string' ? JSON.parse(decoded.scope) : decoded.scope
const permissions = scope.permissions || []
```

Permission lấy trực tiếp từ **token**, không gọi API mỗi lần điều hướng.

### `hasPermissionForRoute(pathname) → boolean | 'loading'`

Thứ tự kiểm tra:

1. Đang load auth data → `'loading'` (chờ, không quyết định).
2. Không token / không `userInfo.role.name` → `false`.
3. `pathname === '/'` → `true`.
4. Role **CUSTOMER** → `false` nếu path chứa `/system` (khách bị chặn khỏi khu staff), ngược lại `true`.
5. **Public staff routes** (`STAFF_PROFILE`, `STAFF_ORDER_PAYMENT`, `ORDER_SUCCESS`) → `true` (không cần permission).
6. Token không có permission nào → `false`.
7. Tìm route trong `sidebarRoutes` bằng `pathname.includes(route.path)`:
   - **Không tìm thấy → mặc định `true` (cho qua).**
8. Có config → `tokenPermissions.includes(route.permission)`.

### Vòng đời (`useEffect` theo `location.pathname`)

- Đang `isRefreshing` hoặc `isAuthDataLoading` → chờ, không làm gì.
- `!isAuthenticated()` → lưu URL hiện tại vào `currentUrlStore` (post-login redirect), `handleLogout()` (clear auth + user + cart), toast "hết phiên", điều hướng `/login`.
- `hasPermission === false` → `safeNavigate` tới `/403`.
- `hasPermission === 'loading'` → không làm gì (đợi load xong).

### Render

- Đang refresh token → spinner.
- Đang load userInfo (có token nhưng chưa có user) → spinner "Đang tải thông tin người dùng…".
- Ngược lại → `<>{element}</>`.

## 5. `sidebarRoutes` — nguồn chân lý kép

`src/router/routes.ts` khai báo mảng `{ title, path, permission, icon }` (enum `Permission` từ `sidebar-permission`).

Được dùng cho **hai việc**:

1. Dựng **menu sidebar**.
2. Bảng tra **route → permission** cho `ProtectedElement`.

→ Thêm/sửa quyền một trang chỉ cần sửa ở đây.

## 6. Điều hướng an toàn & redirect

- `safeNavigate` (`src/utils/current-url-manager.ts`): **loop detection** — nếu điều hướng lặp cùng một path thì fallback về `HOME`, chống vòng lặp (vd forbidden → forbidden).
- `currentUrlStore`: lưu URL người dùng định vào **trước khi logout** để quay lại sau khi đăng nhập; `isValidRedirectUrl` / `shouldUpdateUrl` gác điều kiện lưu.
- `src/router/redirects.tsx`: component nhỏ dùng `<Navigate replace>` cho redirect nested theo slug (`RedirectToCustomerGroup`, `RedirectToVoucherGroup`).

## 7. Sơ đồ luồng (điều hướng vào một route system)

```
URL đổi
  → RootLayout (providers) render
  → SystemLayout (sidebar) render   ← KHÔNG guard ở đây
  → ProtectedElement (leaf) mount
       ├─ isRefreshing / authLoading? → spinner, chờ
       ├─ !isAuthenticated()          → lưu URL, logout, toast, /login
       ├─ hasPermission === false     → /403 (safeNavigate)
       ├─ hasPermission === 'loading' → chờ
       └─ else                        → render trang (SuspenseElement → lazy Page)
```

## 8. Rủi ro / điểm cần lưu ý

1. **Guard chạy trong `useEffect` (sau mount) rồi điều hướng mệnh lệnh.** Trang được bảo vệ **vẫn mount và có thể fetch dữ liệu** trước khi bị đá sang `/403` → flash nội dung trái phép + request thừa. Chuẩn data-router nên chặn **trước render** bằng `loader` + `redirect()`.
2. **`pathname.includes(route.path)` (substring) mong manh.** Một route là tiền tố của route khác dễ khớp nhầm; `sidebarRoutes.find` lấy **match đầu tiên** → thứ tự khai báo ảnh hưởng kết quả. Nên khớp chính xác/prefix có ranh giới.
3. **Mặc định CHO QUA route không nằm trong `sidebarRoutes`** (mục 4, bước 7). Thêm route bảo vệ mới mà **quên đăng ký** trong `sidebarRoutes` = trang **không được gác**. An toàn hơn nếu default là *deny*.
4. **Quyền chỉ đến từ JWT.** Đổi quyền phía server không phản ánh tới khi refresh token. Đây chỉ là authz phía client — **backend vẫn phải enforce**.
5. **`index.tsx` ~1430 dòng, lặp boilerplate** (`ProtectedElement` + `SystemLayout` copy 51 lần). Nên trích thành factory/mảng cấu hình để dễ bảo trì.
6. **Guard chỉ ở leaf page**, `SystemLayout` (parent) không bọc `ProtectedElement` → khung sidebar vẫn render khi chưa đủ quyền vào trang con.

## 9. Các file liên quan

| File | Vai trò |
|---|---|
| `src/app/App.tsx` | Cổng `isAuthInitialized`, mount `RouterProvider` |
| `src/router/index.tsx` | Định nghĩa cây route (`createBrowserRouter`) |
| `src/router/loadable.tsx` | `React.lazy` cho mọi page/layout |
| `src/router/routes.ts` | `sidebarRoutes` — map route → permission (+ menu) |
| `src/router/redirects.tsx` | Redirect nested theo slug |
| `src/app/layouts/root-layout.tsx` | Provider toàn cục + `<Outlet/>` |
| `src/components/app/elements/protected-element.tsx` | Guard auth + permission |
| `src/components/app/elements/suspense-element.tsx` | Bọc `<Suspense>` cho lazy component |
| `src/constants/route.ts` | Hằng `ROUTE` |
| `src/constants/sidebar-permission.ts` | Enum `Permission` |
| `src/utils/current-url-manager.ts` | `safeNavigate` (loop detection) + currentUrl |
| `src/utils/auth-helpers.ts` | `isAuthLoading` |
| `src/stores/auth.store.ts` | `isAuthenticated()`, token, refresh |
