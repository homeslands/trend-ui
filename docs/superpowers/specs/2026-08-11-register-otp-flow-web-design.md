# Luồng đăng ký OTP 3 bước cho web — TRE-470

Ngày: 2026-08-11
Branch: `feature/TRE-470-FE-Update-Refactor-New-User-Registration-Flow`
Tài liệu tham chiếu (mobile React Native): `app/order-ui/src/docs/register-flow.md`

## 1. Bối cảnh

Web hiện đăng ký một bước: một form 6 trường gọi `POST /auth/register`, thành công thì đẩy về trang đăng nhập để khách tự nhập lại số điện thoại và mật khẩu. Tài khoản tạo ra có `isVerifiedPhonenumber = false` — không có bước xác thực nào, nên bất kỳ ai cũng đăng ký được bằng số của người khác và chiếm luôn số đó (cột `phonenumber` là unique).

Mobile đã chuyển sang luồng OTP 3 bước. Backend `order-api` **đã có sẵn toàn bộ endpoint** cho luồng này; web chỉ chưa dùng. Mục tiêu của đợt này là đưa web về đúng luồng đó, đồng thời sửa hai điểm mà tài liệu mobile mô tả sai so với backend thực tế.

## 2. Phạm vi

**Trong phạm vi** — chỉ `app/order-ui`:

- `src/api/auth.ts`, `src/hooks/use-auth.ts` — 3 endpoint đăng ký mới.
- `src/app/auth/` — viết lại `Register.tsx` (Step 1), thêm 2 trang mới.
- `src/components/app/form/` — 3 form mới, xoá `register-form.tsx`.
- `src/components/app/dialog/change-phone-confirm-dialog.tsx` — mới.
- `src/stores/register-flow.store.ts` — mới.
- `src/hooks/use-post-auth-actions.ts` — mới, tách từ `login-form.tsx`.
- `src/schemas/auth.schema.ts`, `src/types/auth.type.ts`, `src/constants/route.ts`, `src/router/`.
- `src/utils/toast.ts` — bổ sung 7 mã lỗi đăng ký.
- `src/components/ui/countdown-timer.tsx` — thêm prop `bufferMs`.
- `src/locales/vi/auth.json`, `src/locales/en/auth.json`, `src/locales/{vi,en}/toast.json`.

**Ngoài phạm vi**

- Backend. Không sửa `order-api`, kể cả endpoint `POST /auth/register` cũ (giữ lại cho tương thích ngược, web không gọi nữa).
- Bật lại các cổng kiểm tra `isVerifiedPhonenumber` đang bị comment (voucher định danh, quên mật khẩu). Quyết định riêng, tài khoản cũ chưa xác thực sẽ bị ảnh hưởng.
- Luồng đăng nhập, quên mật khẩu, xác thực SĐT/email trong trang Hồ sơ.
- Trang điều khoản và chính sách bảo mật.

## 3. Hợp đồng API

Ba endpoint đều `@Public`. Nguồn: `app/order-api/src/auth/auth.controller.ts`, `auth.service.ts`, `auth.dto.ts`.

### 3.1 `POST /auth/register/initiate`

```ts
// Request
{ phonenumber: string }        // 10 chữ số

// Response result — InitiateRegisterResponseDto
{ expiresAt: string }          // ISO. KHÔNG có isRegistered/createdAt/slug
```

Throttle 10 request / 60 giây. Backend gửi OTP qua Zalo ZNS + SMS đa kênh. OTP là **6 ký tự chữ-số viết HOA**, hạn 10 phút.

### 3.2 `POST /auth/register/resend`

```ts
// Request
{ phonenumber: string }
// Response result
{ expiresAt: string }
```

Chỉ hoạt động khi tồn tại token **chưa dùng và chưa hết hạn**. Cooldown phía server: 120 giây tính từ `lastSentAt`.

### 3.3 `POST /auth/register/complete`

```ts
// Request
{
  phonenumber: string
  otp: string
  password: string
  firstName?: string   // web KHÔNG gửi — thu ở Step 3
  lastName?: string
  email?: string
  dob?: string         // DD/MM/YYYY
}

// Response result — 4 token, giống đăng nhập
{ accessToken, refreshToken, expireTime, expireTimeRefreshToken }
```

Tài khoản tạo ra: role `Customer`, `isVerifiedPhonenumber = true`, được tạo shared balance và bắn sự kiện `USER_CREATED` (kèm `USER_BIRTHDAY_TRIGGERED` nếu hôm nay đúng sinh nhật). Sai OTP 5 lần thì token bị vô hiệu, phải đăng ký lại từ đầu.

### 3.4 `PATCH /auth/profile` (Step 3)

Đã có sẵn `updateProfile` + `useUpdateProfile` trên web. Gửi `{ firstName, lastName, dob }`, `dob` định dạng `DD/MM/YYYY` hoặc `null`.

### 3.5 Hai điểm tài liệu mobile mô tả sai

1. **Không có `isRegistered`.** Số đã có tài khoản thì backend ném lỗi `119041`, không trả cờ trong response. Web xử lý theo mã lỗi.
2. **Không được gọi `resend` khi OTP đã hết hạn** — backend trả `119047`. Khi hết hạn, web phải gọi lại `initiate` (token cũ đã hết hạn nên không còn vướng `119046`).

## 4. Kiến trúc

### 4.1 Route

```
/auth/register          Step 1 — nhập số điện thoại
/auth/register/otp      Step 2 — OTP + đặt mật khẩu
/auth/register/profile  Step 3 — hồ sơ (khách đã đăng nhập)
```

Ba route riêng thay vì một route nhiều bước: nút Back của trình duyệt hoạt động đúng (OTP quay lại màn nhập SĐT), F5 không mất luồng, và Step 3 vốn là màn sau đăng nhập nên tách URL là đúng bản chất.

Thêm vào `src/constants/route.ts`:

```ts
REGISTER: '/auth/register',              // giữ nguyên
REGISTER_OTP: '/auth/register/otp',
REGISTER_PROFILE: '/auth/register/profile',
```

`isValidRedirectUrl` trong `src/utils/current-url-manager.ts` đã loại mọi URL chứa `/auth/register`, nên hai route con tự động không bị lưu làm điểm quay lại — không cần sửa.

### 4.2 File

```
src/app/auth/
├── Register.tsx                    # Step 1 — viết lại nội dung, giữ tên file
├── register-otp.tsx                # Step 2 — mới
├── register-profile.tsx            # Step 3 — mới
├── index.tsx                       # export thêm 2 page
└── components/
    └── step-progress-bar.tsx       # đã có sẵn, chưa ai dùng — dùng lại

src/components/app/form/
├── register-phone-form.tsx         # mới
├── register-otp-password-form.tsx  # mới
├── register-profile-form.tsx       # mới
└── register-form.tsx               # XOÁ

src/components/app/dialog/
└── change-phone-confirm-dialog.tsx # mới

src/stores/register-flow.store.ts   # mới
src/hooks/use-post-auth-actions.ts  # mới
```

Trang chỉ lo khung `Card` + guard + điều hướng; toàn bộ form và logic gọi API nằm trong component form, đúng như cách `Login.tsx` và `LoginForm` đang chia.

### 4.3 Store

`src/stores/register-flow.store.ts`, persist localStorage, mirror `forgot-password.store.ts`:

```ts
interface IRegisterFlowStore {
  phonenumber: string
  otpExpiresAt: string        // ISO
  resendAvailableAt: string   // ISO — lastSentAt + 120s
  setPhonenumber: (v: string) => void
  setOtpExpiresAt: (v: string) => void
  setResendAvailableAt: (v: string) => void
  clearRegisterFlow: () => void
}
```

`resendAvailableAt` được ghi vào store (không chỉ giữ trong state của component) để cooldown sống sót qua F5 — đây là điểm mobile ghi nhận là thiếu ở mục 10.1 của tài liệu.

Store được xoá ở 3 thời điểm: đăng ký thành công, lỗi `119051`, và khách xác nhận đổi số điện thoại.

### 4.4 Hook `use-post-auth-actions`

Tách nguyên khối logic sau đăng nhập trong `login-form.tsx:50-116`:

```ts
useHandleAuthSuccess() → (tokens, options?: { onSuccess?: (navigationUrl: string) => void }) => Promise<void>
```

Trình tự: `clearCart()` → set 4 token vào `authStore` → `refetchProfile()` → nếu không có hồ sơ thì `setLogout()` + `removeUserInfo()` + ném lỗi → `setUserInfo` → giải mã permissions từ token → tính `navigationUrl` bằng `calculateSmartNavigationUrl({ userInfo, permissions, currentUrl })`.

Không có `onSuccess`: tự `safeNavigate` tới `navigationUrl` rồi `clearUrl()` — đúng hành vi đăng nhập hiện tại. Có `onSuccess`: giao quyền điều hướng cho nơi gọi, dùng cho Step 2.

`LoginForm` sau khi tách chỉ còn gọi `login()` rồi `handleAuthSuccess(response.result)`. Hành vi đăng nhập không được thay đổi — đây là ràng buộc bắt buộc khi review.

## 5. Step 1 — Nhập số điện thoại

**Guard:** đã đăng nhập (`useAuthStore.isAuthenticated()`) thì `navigate(ROUTE.CLIENT_HOME, { replace: true })`.

**UI:** `Card` trên `LoginBackground` giống `Login.tsx`, ép theme sáng. Trong card: `StepProgressBar currentStep={1}` với 3 nhãn (Số điện thoại / Xác thực / Hồ sơ), tiêu đề, phụ đề, một ô nhập số điện thoại, nút "Tiếp tục", link "Đã có tài khoản? Đăng nhập", link "Về trang chủ".

**Nhập liệu:** `onChange` lọc `\D` và cắt còn 10 ký tự, `inputMode="numeric"`.

**Schema** `useRegisterPhoneSchema()` trong `src/schemas/auth.schema.ts`:

```ts
phonenumber: z.string()
  .min(1,  t('register.phoneNumberRequired'))
  .length(10, t('register.phoneNumberMaxLength'))
  .regex(PHONE_NUMBER_REGEX, t('register.phoneNumberInvalid'))
```

**Submit:** `initiateRegister({ phonenumber })` → ghi `phonenumber`, `otpExpiresAt = result.expiresAt`, `resendAvailableAt = now + 120s` vào store → `navigate(ROUTE.REGISTER_OTP)` (push, để Back quay lại được).

**Lỗi:**

| Mã | Hành vi |
|---|---|
| `119041` SĐT đã tồn tại | Lỗi inline dưới ô SĐT, kèm 2 link "Đăng nhập" và "Quên mật khẩu". **Không tự điều hướng** — khác mobile, vì trên web khách cần thấy rõ chuyện gì xảy ra trước khi bị chuyển trang |
| `119046` OTP đã gửi | Toast cảnh báo; nếu store đang giữ đúng số này và `otpExpiresAt` vẫn ở tương lai thì sang thẳng Step 2 với mốc cũ, ngược lại đặt `otpExpiresAt = now + 10 phút` (ước lượng, có thể lệch với server) rồi sang Step 2 |
| `429` | Toast "thao tác quá nhanh, thử lại sau" |
| khác | `showErrorToast(code)` |

## 6. Step 2 — OTP và mật khẩu

**Guard:** store không có `phonenumber` → `navigate(ROUTE.REGISTER, { replace: true })`. Đã đăng nhập → về home.

**UI:**

```
Card
├── StepProgressBar currentStep={2}
├── Tiêu đề "Xác thực số điện thoại"
├── Phụ đề "Mã 6 ký tự đã gửi tới {{phone}}"
├── OTPInput length={6} allowText   ← bắt buộc bật allowText: OTP là chữ + số
├── Hàng trạng thái
│   ├── trái:  CountdownTimer bufferMs={0}  |  "Mã đã hết hạn" (đỏ)
│   └── phải:  "Gửi lại (m:ss)" disabled | "Gửi lại" | "Gửi mã mới"
├── Khối mật khẩu (ẩn tới khi OTP đủ 6 ký tự)
│   ├── PasswordWithRulesInput
│   └── PasswordInput (xác nhận)
├── Nút "Tạo tài khoản"
└── Nút "Đổi số điện thoại"
```

Khối mật khẩu hiện ra bằng `grid-template-rows: 0fr → 1fr` cộng `opacity`, transition 250ms — không dùng chiều cao cố định như mobile (mobile hardcode `maxHeight: 700`, có nguy cơ cắt nội dung).

OTP nhập chữ thường vẫn hợp lệ vì backend so sánh `otp.toUpperCase()`; input vẫn hiển thị chữ HOA cho dễ đối chiếu với tin nhắn.

**Schema** `useRegisterPasswordSchema()`: `password` tối thiểu 8 ký tự, có ít nhất một chữ và một số (tái dùng đúng luật của `useRegisterSchema` cũ); `confirmPassword` bắt buộc và phải khớp.

**Chấp thuận điều khoản.** Form đăng ký hiện tại bắt buộc tick ô đồng ý điều khoản và chính sách bảo mật; luồng mới giữ nguyên ràng buộc đó, đặt ngay trên nút "Tạo tài khoản" ở Step 2. Khác biệt duy nhất: hai liên kết mở **tab mới** (`target="_blank"`), vì ở form cũ chúng điều hướng cùng tab và làm khách mất sạch dữ liệu đang nhập.

**Nút "Tạo tài khoản"** bị vô hiệu khi: OTP chưa đủ 6 ký tự, OTP đã hết hạn, form mật khẩu chưa hợp lệ, chưa tick điều khoản, hoặc đang gửi.

**Submit:** `completeRegister({ phonenumber, otp, password })` → `handleAuthSuccess(result, { onSuccess })`. Trong `onSuccess`:

```
clearRegisterFlow()
toast "Đăng ký tài khoản thành công"
nếu navigationUrl !== ROUTE.HOME  (khách đang giữa luồng đặt hàng)
   → safeNavigate(navigationUrl) + clearUrl()      // bỏ qua Step 3
ngược lại
   → navigate(ROUTE.REGISTER_PROFILE, { replace: true })
```

`calculateSmartNavigationUrl` trả về `currentUrl` khi URL đó hợp lệ và khách có quyền truy cập, ngược lại trả `ROUTE.HOME` cho vai trò Customer. Vì vậy so sánh với `ROUTE.HOME` chính là câu hỏi "khách có đang dở việc gì không". Lưu ý `ROUTE.HOME` và `ROUTE.CLIENT_HOME` đều là `'/'`.

**Gửi lại mã** — nút có 3 trạng thái:

- Còn cooldown (`now < resendAvailableAt`): hiện "Gửi lại (m:ss)", disabled.
- Hết cooldown, OTP còn hạn: "Gửi lại" → gọi `resendRegisterOtp`.
- OTP đã hết hạn: **"Gửi mã mới"** → gọi `initiateRegister` (không phải `resend`).

Cả hai nhánh đều cập nhật lại `otpExpiresAt`, `resendAvailableAt = now + 120s`, và xoá ô OTP.

**Lỗi:**

| Mã | Hành vi |
|---|---|
| `119049` OTP sai | Lỗi inline dưới ô OTP, xoá ô OTP, **giữ nguyên mật khẩu đã nhập** |
| `119048` / `119047` OTP hết hạn hoặc không tồn tại | Khoá ô OTP, hiện trạng thái hết hạn, nút chuyển thành "Gửi mã mới" |
| `119050` Gửi lại quá sớm | Toast; đặt lại `resendAvailableAt = now + 120s` để nút khớp với server |
| `119051` Sai quá 5 lần | Toast "Bạn đã nhập sai quá số lần cho phép, vui lòng đăng ký lại" → `clearRegisterFlow()` → `navigate(ROUTE.REGISTER, { replace: true })` |
| `119041` SĐT vừa bị người khác đăng ký | `clearRegisterFlow()` → về Step 1 kèm lỗi inline |
| khác | `showErrorToast(code)` |

**Đổi số điện thoại:** nếu đã gõ OTP thì mở `AlertDialog` xác nhận ("Bạn sẽ phải nhập lại số điện thoại và nhận mã mới"), đồng ý thì `clearRegisterFlow()` + `navigate(ROUTE.REGISTER, { replace: true })`. Chưa gõ gì thì quay lại luôn.

## 7. Step 3 — Hoàn thiện hồ sơ

**Guard:** chưa đăng nhập → `navigate(ROUTE.LOGIN, { replace: true })`.

Không chặn nút Back của trình duyệt. Guard ở Step 1 và Step 2 (đã đăng nhập thì bị đẩy về home) đã đủ để khách không quay ngược vào luồng đăng ký.

**UI:** `StepProgressBar currentStep={3}`, ba trường **đều tuỳ chọn** theo thứ tự **Họ → Tên → Ngày sinh** (đúng quy ước tiếng Việt, khác form cũ đang để Tên trước), nút "Hoàn tất" và nút "Bỏ qua".

**Schema** `useRegisterProfileSchema()`: `firstName`/`lastName` tối đa 100 ký tự, khớp `NAME_REGEX`, cho phép chuỗi rỗng; `dob` tuỳ chọn, phải là `DD/MM/YYYY` hợp lệ và không ở tương lai.

**Submit:** `updateProfile({ firstName: v || null, lastName: v || null, dob: v || null })` → `setUserInfo(result)` → toast → `navigate(ROUTE.CLIENT_HOME, { replace: true })`.

`IUpdateProfileRequest` hiện bắt buộc `address`; đổi thành tuỳ chọn. Các form hồ sơ khác vẫn truyền `address` nên không bị ảnh hưởng.

**"Bỏ qua":** không gọi API, `navigate(ROUTE.CLIENT_HOME, { replace: true })`.

**Lỗi:** toast, ở lại màn để thử lại. "Bỏ qua" luôn là lối thoát.

## 8. Mã lỗi và i18n

Bổ sung vào bảng `errorCodes` tập trung trong `src/utils/toast.ts` — không hardcode rải rác trong component như mobile:

```ts
119041: 'toast.phoneNumberAlreadyExists',
119046: 'toast.registerOtpAlreadySent',
119047: 'toast.registerOtpNotFound',
119048: 'toast.registerOtpExpired',
119049: 'toast.registerOtpInvalid',
119050: 'toast.registerOtpResendTooSoon',
119051: 'toast.registerOtpMaxAttempts',
```

Namespace `auth`, nhóm `register.*` — bổ sung khoảng 20 khoá mới cho Step 2 và Step 3 (`otpTitle`, `otpSentTo`, `otpExpired`, `resend`, `sendNewCode`, `createAccount`, `changePhone`, `changePhoneTitle`, `changePhoneMessage`, `profileTitle`, `profileSubtitle`, `complete`, `skip`, `stepPhone`, `stepVerify`, `stepProfile`, `continue`…). Các khoá sẵn có (`phoneNumber`, `password`, `minLength`, `hasLetter`, `hasNumber`, `passwordNotMatch`, `firstName*`, `lastName*`, `dob*`) giữ nguyên và dùng lại. Đặt tên khoá bám theo bộ khoá của mobile để hai nền tảng dùng chung từ vựng.

Cả `vi` và `en` phải đủ khoá.

## 9. Sửa `CountdownTimer`

`src/components/ui/countdown-timer.tsx` đang trừ cứng 30 giây làm biên an toàn, khiến đồng hồ hiển thị lệch. Thêm prop `bufferMs` mặc định `30000` để hai dialog xác thực SĐT/email hiện có giữ nguyên hành vi; luồng đăng ký truyền `bufferMs={0}`.

## 10. Dọn dẹp luồng cũ

- Xoá `src/components/app/form/register-form.tsx` và export trong `form/index.tsx`.
- Xoá `useRegisterSchema` khỏi `auth.schema.ts`.
- Xoá `register()` khỏi `api/auth.ts`, `useRegister()` khỏi `hooks/use-auth.ts`, `IRegisterSchema`/`IRegisterRequest` khỏi `types/auth.type.ts`.
- Kiểm tra `src/tests/api/auth.test.ts` có test cho `register()` cũ không, sửa hoặc bỏ tương ứng.

Endpoint `POST /auth/register` ở backend giữ nguyên.

## 11. Kiểm thử

Vitest, theo `app/order-ui/.claude/skills` (tdd-workflow):

- `auth.schema` — SĐT (thiếu số, thừa số, ký tự lạ), mật khẩu (thiếu chữ, thiếu số, ngắn, không khớp), hồ sơ (tên quá dài, tên có số, dob tương lai, tất cả rỗng đều hợp lệ).
- `register-flow.store` — set/clear, dữ liệu sống sót qua rehydrate.
- Ánh xạ mã lỗi → thông điệp cho đủ 7 mã, và fallback khi mã lạ.
- `use-post-auth-actions` — thành công (set token, set userInfo, gọi `onSuccess` với `navigationUrl`) và thất bại (fetch hồ sơ lỗi → `setLogout` + `removeUserInfo`).
- Guard route kiểm bằng thử tay, không viết test render: vào `/auth/register/otp` khi store rỗng thì bị đẩy về `/auth/register`; vào `/auth/register` khi đã đăng nhập thì bị đẩy về trang chủ; vào `/auth/register/profile` khi chưa đăng nhập thì bị đẩy về trang đăng nhập.
- Logic chọn hành động của nút gửi lại: còn cooldown → disabled; hết cooldown và OTP còn hạn → gọi `resend`; OTP hết hạn → gọi `initiate`.

Không viết test render cho 3 trang — chi phí cao, giá trị thấp so với test logic ở trên.

## 12. Rủi ro

- **Chi phí và độ tin cậy của ZNS/SMS.** Web dễ bị lạm dụng hơn app. Throttle hiện tại là 10 request/60 giây cho toàn endpoint `initiate`. Nếu tỷ lệ lạm dụng cao, cần siết theo IP hoặc thêm captcha — nằm ngoài phạm vi đợt này nhưng phải theo dõi sau khi lên.
- **Không autofill OTP.** OTP gửi qua ZNS không có cơ chế tự điền trên trình duyệt. Thao tác dán 6 ký tự vào `OTPInput` phải hoạt động chuẩn — cần kiểm tra thủ công trên cả desktop và Safari iOS.
- **Tách `use-post-auth-actions` đụng luồng đăng nhập.** Đây là thay đổi rủi ro nhất trong đợt. Làm ở bước riêng, kiểm tra đăng nhập của cả khách hàng và nhân viên trước khi xây tiếp các màn đăng ký.
- **Khách mở hai tab.** Tab thứ hai gọi `initiate` sẽ dính `119046`. Đã có nhánh xử lý, nhưng cần thử tay.

## 13. Quyết định đã chốt

| Câu hỏi | Chốt |
|---|---|
| Luồng đăng ký 1 bước cũ | Thay thế hoàn toàn ở FE, giữ endpoint backend |
| Step 3 | Màn riêng, có nút "Bỏ qua" |
| Điều hướng sau Step 2 | Ưu tiên `currentUrl`; không có thì vào Step 3 |
| Phạm vi | Chỉ FE web, kèm sửa `CountdownTimer` và tách `use-post-auth-actions` |
| Kiến trúc route | 3 route riêng + store persist, không dùng một route nhiều bước |
