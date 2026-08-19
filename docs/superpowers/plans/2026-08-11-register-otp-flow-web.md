# Luồng đăng ký OTP 3 bước cho web (TRE-470) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay luồng đăng ký một bước trên web bằng luồng OTP 3 bước (SĐT → OTP + mật khẩu → hồ sơ tuỳ chọn), dùng đúng các endpoint backend đã có, để mọi tài khoản mới đều được xác thực số điện thoại và khách đăng nhập sẵn ngay sau khi tạo tài khoản.

**Architecture:** Ba route riêng dưới `/auth/register`, trạng thái giữa các bước nằm trong một zustand store persist localStorage. Trang chỉ lo khung + guard + điều hướng; form lo nhập liệu và gọi API. Logic sau đăng nhập được tách khỏi `LoginForm` thành hook `useHandleAuthSuccess` dùng chung cho cả đăng nhập và đăng ký.

**Tech Stack:** React 18 + TypeScript, Vite, react-router-dom 6, TanStack Query, react-hook-form + Zod 3, zustand (persist), i18next, Tailwind + shadcn/Radix, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-11-register-otp-flow-web-design.md`

## Global Constraints

- Thư mục làm việc: `app/order-ui`. Mọi lệnh chạy từ đó (`npm run test`, `npm run lint`, `npm run build`).
- Không sửa bất cứ file nào trong `app/order-api`. Backend đã đủ endpoint.
- Import theo alias `@/…`, không dùng đường dẫn tương đối xuyên thư mục.
- Form dùng `react-hook-form` + `zodResolver`, schema đặt trong `src/schemas/auth.schema.ts` và export kèm type `T…Schema`.
- Hook TanStack Query đặt trong `src/hooks/use-*.ts`, bọc hàm thô trong `src/api/*.ts`.
- Ba mutation đăng ký đều gắn `meta: { ignoreGlobalError: true }` — form tự xử lý lỗi theo mã.
- Mã lỗi khai báo tập trung trong bảng `errorCodes` của `src/utils/toast.ts`, không hardcode trong component.
- i18n: mọi khoá mới phải có đủ ở `src/locales/vi/` **và** `src/locales/en/`. Namespace `auth`, nhóm `register.*`; toast dùng namespace `toast`.
- OTP: 6 ký tự chữ-số. `OTPInput` phải bật `allowText`. Gửi lên server viết HOA (`otp.toUpperCase()`).
- `dob` gửi lên API định dạng `DD/MM/YYYY`, rỗng thì gửi `null`.
- Cooldown gửi lại OTP: 120 giây. Hạn OTP: 10 phút. Hai con số này lấy từ backend, khai báo thành hằng trong store.
- Commit message theo lịch sử repo: `TaskId: TRE-470 (N) <mô tả>`.
- Không đổi hành vi luồng đăng nhập hiện tại.

---

### Task 1: Tầng API và hook cho 3 endpoint đăng ký

**Files:**
- Modify: `src/types/auth.type.ts`
- Modify: `src/api/auth.ts`
- Modify: `src/hooks/use-auth.ts`
- Test: `src/tests/api/auth.test.ts`

**Interfaces:**
- Consumes: `http` từ `@/utils`, `IApiResponse` từ `@/types`.
- Produces:
  - `IInitiateRegisterRequest`, `IInitiateRegisterResponse`, `IResendRegisterOtpRequest`, `ICompleteRegisterRequest`, `ICompleteRegisterResponse`
  - `initiateRegister(params) => Promise<IApiResponse<IInitiateRegisterResponse>>`
  - `resendRegisterOtp(params) => Promise<IApiResponse<IInitiateRegisterResponse>>`
  - `completeRegister(params) => Promise<IApiResponse<ICompleteRegisterResponse>>`
  - `useInitiateRegister()`, `useResendRegisterOtp()`, `useCompleteRegister()`

- [ ] **Step 1: Viết test thất bại cho 3 hàm API**

Mở `src/tests/api/auth.test.ts`. Trong danh sách import từ `@/api`, **xoá** `register` và **thêm** `initiateRegister`, `resendRegisterOtp`, `completeRegister`. Xoá nguyên khối `describe('register', …)` hiện có. Thêm vào cuối file, trước dấu đóng của `describe('Auth API', …)`:

```ts
  describe('initiateRegister', () => {
    it('should call the initiate endpoint and return expiresAt', async () => {
      const mockResponse = {
        data: { result: { expiresAt: '2026-08-11T10:00:00.000Z' } },
      }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const result = await initiateRegister({ phonenumber: '0376295216' })

      expect(http.post).toHaveBeenCalledWith('/auth/register/initiate', {
        phonenumber: '0376295216',
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('should propagate the 119041 error when the phone number exists', async () => {
      ;(http.post as Mock).mockRejectedValue({
        response: { status: 400, data: { statusCode: 119041 } },
      })

      await expect(
        initiateRegister({ phonenumber: '0376295216' }),
      ).rejects.toMatchObject({ response: { data: { statusCode: 119041 } } })
    })
  })

  describe('resendRegisterOtp', () => {
    it('should call the resend endpoint', async () => {
      const mockResponse = {
        data: { result: { expiresAt: '2026-08-11T10:10:00.000Z' } },
      }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const result = await resendRegisterOtp({ phonenumber: '0376295216' })

      expect(http.post).toHaveBeenCalledWith('/auth/register/resend', {
        phonenumber: '0376295216',
      })
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('completeRegister', () => {
    it('should call the complete endpoint and return tokens', async () => {
      const mockResponse = {
        data: {
          result: {
            accessToken: 'access',
            refreshToken: 'refresh',
            expireTime: '2026-08-11T11:00:00.000Z',
            expireTimeRefreshToken: '2026-08-18T11:00:00.000Z',
          },
        },
      }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const params = {
        phonenumber: '0376295216',
        otp: 'A1B2C3',
        password: 'matkhau123',
      }
      const result = await completeRegister(params)

      expect(http.post).toHaveBeenCalledWith('/auth/register/complete', params)
      expect(result).toEqual(mockResponse.data)
    })

    it('should propagate the 119049 error when the OTP is wrong', async () => {
      ;(http.post as Mock).mockRejectedValue({
        response: { status: 400, data: { statusCode: 119049 } },
      })

      await expect(
        completeRegister({
          phonenumber: '0376295216',
          otp: 'ZZZZZZ',
          password: 'matkhau123',
        }),
      ).rejects.toMatchObject({ response: { data: { statusCode: 119049 } } })
    })
  })
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/tests/api/auth.test.ts`
Expected: FAIL — không import được `initiateRegister` / `resendRegisterOtp` / `completeRegister` từ `@/api`.

- [ ] **Step 3: Thêm type vào `src/types/auth.type.ts`**

Thêm ngay dưới `ILoginResponse`, và **xoá** `IRegisterSchema` cùng `IRegisterRequest`:

```ts
export interface IInitiateRegisterRequest {
  phonenumber: string
}

export interface IInitiateRegisterResponse {
  expiresAt: string
}

export interface IResendRegisterOtpRequest {
  phonenumber: string
}

export interface ICompleteRegisterRequest {
  phonenumber: string
  otp: string
  password: string
}

export interface ICompleteRegisterResponse {
  accessToken: string
  refreshToken: string
  expireTime: string
  expireTimeRefreshToken: string
}
```

- [ ] **Step 4: Thay hàm `register` bằng 3 hàm mới trong `src/api/auth.ts`**

Xoá hàm `register` và import `IRegisterRequest`. Thêm:

```ts
export async function initiateRegister(
  params: IInitiateRegisterRequest,
): Promise<IApiResponse<IInitiateRegisterResponse>> {
  const response = await http.post<IApiResponse<IInitiateRegisterResponse>>(
    '/auth/register/initiate',
    params,
  )
  return response.data
}

export async function resendRegisterOtp(
  params: IResendRegisterOtpRequest,
): Promise<IApiResponse<IInitiateRegisterResponse>> {
  const response = await http.post<IApiResponse<IInitiateRegisterResponse>>(
    '/auth/register/resend',
    params,
  )
  return response.data
}

export async function completeRegister(
  params: ICompleteRegisterRequest,
): Promise<IApiResponse<ICompleteRegisterResponse>> {
  const response = await http.post<IApiResponse<ICompleteRegisterResponse>>(
    '/auth/register/complete',
    params,
  )
  return response.data
}
```

Nhớ cập nhật khối import type ở đầu file cho khớp.

- [ ] **Step 5: Thay `useRegister` bằng 3 hook mới trong `src/hooks/use-auth.ts`**

Xoá `useRegister` và import `register` / `IRegisterRequest`. Thêm:

```ts
export const useInitiateRegister = () => {
  return useMutation({
    mutationFn: async (data: IInitiateRegisterRequest) => {
      return initiateRegister(data)
    },
    meta: { ignoreGlobalError: true },
  })
}

export const useResendRegisterOtp = () => {
  return useMutation({
    mutationFn: async (data: IResendRegisterOtpRequest) => {
      return resendRegisterOtp(data)
    },
    meta: { ignoreGlobalError: true },
  })
}

export const useCompleteRegister = () => {
  return useMutation({
    mutationFn: async (data: ICompleteRegisterRequest) => {
      return completeRegister(data)
    },
    meta: { ignoreGlobalError: true },
  })
}
```

- [ ] **Step 6: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/api/auth.test.ts`
Expected: PASS.

Lúc này `src/app/auth/Register.tsx` và `src/components/app/form/register-form.tsx` sẽ lỗi TypeScript vì `useRegister` không còn — đúng như dự kiến, Task 7 sẽ thay thế chúng. Chưa chạy `npm run build` ở bước này.

- [ ] **Step 7: Commit**

```bash
git add src/types/auth.type.ts src/api/auth.ts src/hooks/use-auth.ts src/tests/api/auth.test.ts
git commit -m "TaskId: TRE-470 (1) Add OTP registration API layer and hooks"
```

---

### Task 2: Store cho luồng đăng ký

**Files:**
- Create: `src/stores/register-flow.store.ts`
- Modify: `src/stores/index.ts`
- Test: `src/tests/stores/register-flow.store.test.ts`

**Interfaces:**
- Produces: `useRegisterFlowStore` với `phonenumber`, `otpExpiresAt`, `resendAvailableAt`, `setPhonenumber`, `setOtpExpiresAt`, `setResendAvailableAt`, `startFlow(phonenumber, expiresAt)`, `markOtpSent(expiresAt)`, `clearRegisterFlow`; hằng `OTP_TTL_MS`, `RESEND_COOLDOWN_MS`.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/tests/stores/register-flow.store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'

import {
  useRegisterFlowStore,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
} from '@/stores'

describe('useRegisterFlowStore', () => {
  beforeEach(() => {
    useRegisterFlowStore.getState().clearRegisterFlow()
  })

  it('should expose backend timings as constants', () => {
    expect(OTP_TTL_MS).toBe(10 * 60 * 1000)
    expect(RESEND_COOLDOWN_MS).toBe(2 * 60 * 1000)
  })

  it('should start empty', () => {
    const state = useRegisterFlowStore.getState()
    expect(state.phonenumber).toBe('')
    expect(state.otpExpiresAt).toBe('')
    expect(state.resendAvailableAt).toBe('')
  })

  it('should store the phone number and both timestamps when the flow starts', () => {
    const expiresAt = '2026-08-11T10:00:00.000Z'
    const before = Date.now()

    useRegisterFlowStore.getState().startFlow('0376295216', expiresAt)

    const state = useRegisterFlowStore.getState()
    expect(state.phonenumber).toBe('0376295216')
    expect(state.otpExpiresAt).toBe(expiresAt)
    expect(new Date(state.resendAvailableAt).getTime()).toBeGreaterThanOrEqual(
      before + RESEND_COOLDOWN_MS,
    )
  })

  it('should refresh both timestamps but keep the phone number when the OTP is resent', () => {
    useRegisterFlowStore
      .getState()
      .startFlow('0376295216', '2026-08-11T10:00:00.000Z')

    useRegisterFlowStore.getState().markOtpSent('2026-08-11T10:10:00.000Z')

    const state = useRegisterFlowStore.getState()
    expect(state.phonenumber).toBe('0376295216')
    expect(state.otpExpiresAt).toBe('2026-08-11T10:10:00.000Z')
  })

  it('should fall back to now + OTP_TTL_MS when the server omits expiresAt', () => {
    const before = Date.now()

    useRegisterFlowStore.getState().startFlow('0376295216', '')

    const state = useRegisterFlowStore.getState()
    expect(new Date(state.otpExpiresAt).getTime()).toBeGreaterThanOrEqual(
      before + OTP_TTL_MS,
    )
  })

  it('should reset every field when cleared', () => {
    useRegisterFlowStore
      .getState()
      .startFlow('0376295216', '2026-08-11T10:00:00.000Z')

    useRegisterFlowStore.getState().clearRegisterFlow()

    const state = useRegisterFlowStore.getState()
    expect(state.phonenumber).toBe('')
    expect(state.otpExpiresAt).toBe('')
    expect(state.resendAvailableAt).toBe('')
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/tests/stores/register-flow.store.test.ts`
Expected: FAIL — `useRegisterFlowStore` không tồn tại trong `@/stores`.

- [ ] **Step 3: Tạo store**

Tạo `src/stores/register-flow.store.ts`:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** OTP đăng ký sống 10 phút — khớp auth.service.ts của backend. */
export const OTP_TTL_MS = 10 * 60 * 1000
/** Backend chặn gửi lại trong 120 giây kể từ lần gửi gần nhất. */
export const RESEND_COOLDOWN_MS = 2 * 60 * 1000

export interface IRegisterFlowStore {
  phonenumber: string
  otpExpiresAt: string
  resendAvailableAt: string
  setPhonenumber: (phonenumber: string) => void
  setOtpExpiresAt: (otpExpiresAt: string) => void
  setResendAvailableAt: (resendAvailableAt: string) => void
  startFlow: (phonenumber: string, expiresAt: string) => void
  markOtpSent: (expiresAt: string) => void
  clearRegisterFlow: () => void
}

const resolveExpiresAt = (expiresAt: string) =>
  expiresAt || new Date(Date.now() + OTP_TTL_MS).toISOString()

const nextResendAvailableAt = () =>
  new Date(Date.now() + RESEND_COOLDOWN_MS).toISOString()

export const useRegisterFlowStore = create<IRegisterFlowStore>()(
  persist(
    (set) => ({
      phonenumber: '',
      otpExpiresAt: '',
      resendAvailableAt: '',
      setPhonenumber: (phonenumber: string) => {
        set({ phonenumber })
      },
      setOtpExpiresAt: (otpExpiresAt: string) => {
        set({ otpExpiresAt })
      },
      setResendAvailableAt: (resendAvailableAt: string) => {
        set({ resendAvailableAt })
      },
      startFlow: (phonenumber: string, expiresAt: string) => {
        set({
          phonenumber,
          otpExpiresAt: resolveExpiresAt(expiresAt),
          resendAvailableAt: nextResendAvailableAt(),
        })
      },
      markOtpSent: (expiresAt: string) => {
        set({
          otpExpiresAt: resolveExpiresAt(expiresAt),
          resendAvailableAt: nextResendAvailableAt(),
        })
      },
      clearRegisterFlow: () => {
        set({ phonenumber: '', otpExpiresAt: '', resendAvailableAt: '' })
      },
    }),
    {
      name: 'register-flow-store',
    },
  ),
)
```

- [ ] **Step 4: Export store**

Thêm vào `src/stores/index.ts`:

```ts
export * from './register-flow.store'
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/stores/register-flow.store.test.ts`
Expected: PASS (6 test).

- [ ] **Step 6: Commit**

```bash
git add src/stores/register-flow.store.ts src/stores/index.ts src/tests/stores/register-flow.store.test.ts
git commit -m "TaskId: TRE-470 (2) Add register flow store"
```

---

### Task 3: Mã lỗi và chuỗi i18n

**Files:**
- Modify: `src/utils/toast.ts`
- Modify: `src/locales/vi/toast.json`, `src/locales/en/toast.json`
- Modify: `src/locales/vi/auth.json`, `src/locales/en/auth.json`
- Test: `src/tests/utils/register-error-codes.test.ts`

**Interfaces:**
- Produces: `errorCodes` phủ 7 mã `119041`, `119046`–`119051`; nhóm khoá `register.*` mới cho Step 2 và Step 3.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/tests/utils/register-error-codes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

import viToast from '@/locales/vi/toast.json'
import enToast from '@/locales/en/toast.json'
import viAuth from '@/locales/vi/auth.json'
import enAuth from '@/locales/en/auth.json'

const REGISTER_TOAST_KEYS = [
  'phoneNumberAlreadyExists',
  'registerOtpAlreadySent',
  'registerOtpNotFound',
  'registerOtpExpired',
  'registerOtpInvalid',
  'registerOtpResendTooSoon',
  'registerOtpMaxAttempts',
]

const REGISTER_AUTH_KEYS = [
  'stepPhone',
  'stepVerify',
  'stepProfile',
  'phoneTitle',
  'phoneSubtitle',
  'continue',
  'otpTitle',
  'otpSentTo',
  'otpExpiresIn',
  'otpExpired',
  'resend',
  'resendIn',
  'sendNewCode',
  'createAccount',
  'changePhone',
  'changePhoneTitle',
  'changePhoneMessage',
  'changePhoneConfirm',
  'profileTitle',
  'profileSubtitle',
  'complete',
  'skip',
  'goToLogin',
  'goToForgotPassword',
]

describe('register i18n keys', () => {
  it.each([
    ['vi', viToast],
    ['en', enToast],
  ])('%s toast.json should define every register toast key', (_lng, file) => {
    const toast = (file as { toast: Record<string, string> }).toast
    REGISTER_TOAST_KEYS.forEach((key) => {
      expect(toast[key], `missing toast.${key}`).toBeTruthy()
    })
  })

  it.each([
    ['vi', viAuth],
    ['en', enAuth],
  ])('%s auth.json should define every register key', (_lng, file) => {
    const register = (file as { register: Record<string, string> }).register
    REGISTER_AUTH_KEYS.forEach((key) => {
      expect(register[key], `missing register.${key}`).toBeTruthy()
    })
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/tests/utils/register-error-codes.test.ts`
Expected: FAIL — thiếu khoá ở cả 4 file locale.

- [ ] **Step 3: Thêm 7 mã vào bảng `errorCodes`**

Trong `src/utils/toast.ts`, thêm vào object `errorCodes` (đặt cạnh nhóm `1190xx` sẵn có):

```ts
  119041: 'toast.phoneNumberAlreadyExists',
  119046: 'toast.registerOtpAlreadySent',
  119047: 'toast.registerOtpNotFound',
  119048: 'toast.registerOtpExpired',
  119049: 'toast.registerOtpInvalid',
  119050: 'toast.registerOtpResendTooSoon',
  119051: 'toast.registerOtpMaxAttempts',
```

- [ ] **Step 4: Thêm chuỗi vào `toast.json`**

`src/locales/vi/toast.json`, trong object `toast`:

```json
"phoneNumberAlreadyExists": "Số điện thoại này đã được đăng ký",
"registerOtpAlreadySent": "Mã xác thực đã được gửi, vui lòng kiểm tra tin nhắn",
"registerOtpNotFound": "Mã xác thực không còn hiệu lực, vui lòng lấy mã mới",
"registerOtpExpired": "Mã xác thực đã hết hạn, vui lòng lấy mã mới",
"registerOtpInvalid": "Mã xác thực không đúng",
"registerOtpResendTooSoon": "Vui lòng đợi trước khi gửi lại mã",
"registerOtpMaxAttempts": "Bạn đã nhập sai quá số lần cho phép, vui lòng đăng ký lại"
```

`src/locales/en/toast.json`, cùng vị trí:

```json
"phoneNumberAlreadyExists": "This phone number is already registered",
"registerOtpAlreadySent": "A verification code was already sent, please check your messages",
"registerOtpNotFound": "This verification code is no longer valid, please request a new one",
"registerOtpExpired": "The verification code has expired, please request a new one",
"registerOtpInvalid": "Incorrect verification code",
"registerOtpResendTooSoon": "Please wait before requesting a new code",
"registerOtpMaxAttempts": "Too many incorrect attempts, please register again"
```

- [ ] **Step 5: Thêm chuỗi vào `auth.json`**

`src/locales/vi/auth.json`, trong object `register` (giữ nguyên các khoá đang có):

```json
"stepPhone": "Số điện thoại",
"stepVerify": "Xác thực",
"stepProfile": "Hồ sơ",
"phoneTitle": "Đăng ký tài khoản",
"phoneSubtitle": "Nhập số điện thoại để nhận mã xác thực",
"continue": "Tiếp tục",
"otpTitle": "Xác thực số điện thoại",
"otpSentTo": "Mã gồm 6 ký tự đã được gửi tới {{phone}}",
"otpExpiresIn": "Mã hết hạn sau",
"otpExpired": "Mã xác thực đã hết hạn",
"resend": "Gửi lại mã",
"resendIn": "Gửi lại sau {{time}}",
"sendNewCode": "Gửi mã mới",
"createAccount": "Tạo tài khoản",
"changePhone": "Đổi số điện thoại",
"changePhoneTitle": "Đổi số điện thoại?",
"changePhoneMessage": "Bạn sẽ phải nhập lại số điện thoại và nhận mã xác thực mới. Tiến trình hiện tại sẽ bị huỷ.",
"changePhoneConfirm": "Đổi số",
"profileTitle": "Hoàn thiện hồ sơ",
"profileSubtitle": "Bạn có thể bỏ qua và cập nhật sau trong trang Hồ sơ",
"complete": "Hoàn tất",
"skip": "Bỏ qua",
"goToLogin": "Đăng nhập",
"goToForgotPassword": "Quên mật khẩu?"
```

`src/locales/en/auth.json`, trong object `register`:

```json
"stepPhone": "Phone number",
"stepVerify": "Verification",
"stepProfile": "Profile",
"phoneTitle": "Create an account",
"phoneSubtitle": "Enter your phone number to receive a verification code",
"continue": "Continue",
"otpTitle": "Verify your phone number",
"otpSentTo": "A 6-character code has been sent to {{phone}}",
"otpExpiresIn": "Code expires in",
"otpExpired": "The verification code has expired",
"resend": "Resend code",
"resendIn": "Resend in {{time}}",
"sendNewCode": "Send a new code",
"createAccount": "Create account",
"changePhone": "Change phone number",
"changePhoneTitle": "Change phone number?",
"changePhoneMessage": "You will need to enter your phone number again and receive a new code. Your current progress will be discarded.",
"changePhoneConfirm": "Change number",
"profileTitle": "Complete your profile",
"profileSubtitle": "You can skip this and update it later in your Profile page",
"complete": "Finish",
"skip": "Skip",
"goToLogin": "Log in",
"goToForgotPassword": "Forgot password?"
```

- [ ] **Step 6: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/utils/register-error-codes.test.ts`
Expected: PASS (4 test).

- [ ] **Step 7: Commit**

```bash
git add src/utils/toast.ts src/locales src/tests/utils/register-error-codes.test.ts
git commit -m "TaskId: TRE-470 (3) Add register error codes and i18n strings"
```

---

### Task 4: `CountdownTimer` nhận `bufferMs`

**Files:**
- Modify: `src/components/ui/countdown-timer.tsx`
- Test: `src/tests/components/countdown-timer.test.tsx`

**Interfaces:**
- Produces: `CountdownTimerProps` thêm `bufferMs?: number` (mặc định `30000`).

- [ ] **Step 1: Viết test thất bại**

Tạo `src/tests/components/countdown-timer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CountdownTimer } from '@/components/ui'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should subtract the default 30s buffer', () => {
    // hết hạn sau 60s → còn 30s sau khi trừ buffer
    render(<CountdownTimer expiresAt="2026-08-11T10:01:00.000Z" />)

    expect(screen.getByText(/0:30/)).toBeInTheDocument()
  })

  it('should show the full remaining time when bufferMs is 0', () => {
    render(<CountdownTimer expiresAt="2026-08-11T10:01:00.000Z" bufferMs={0} />)

    expect(screen.getByText(/1:00/)).toBeInTheDocument()
  })
})
```

Nếu chuỗi hiển thị hiện tại không có dạng `m:ss`, sửa biểu thức tìm kiếm cho khớp phần render thật của component thay vì đổi component.

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/tests/components/countdown-timer.test.tsx`
Expected: FAIL ở test thứ hai — prop `bufferMs` chưa tồn tại nên vẫn trừ 30 giây.

- [ ] **Step 3: Thêm prop**

Trong `src/components/ui/countdown-timer.tsx`:

```tsx
interface CountdownTimerProps {
    expiresAt: string // ISO string timestamp when the timer expires
    onExpired?: () => void
    className?: string
    /**
     * Biên an toàn trừ vào thời gian còn lại, bù cho độ trễ mạng.
     * Mặc định 30s để giữ nguyên hành vi của các dialog xác thực SĐT/email.
     * Luồng đăng ký truyền 0 vì đã đọc expiresAt trực tiếp từ server.
     */
    bufferMs?: number
}
```

Trong phần khai báo tham số thêm `bufferMs = 30000`, và thay dòng trừ cứng:

```tsx
const bufferedRemaining = Math.max(0, remaining - bufferMs)
```

Thêm `bufferMs` vào mảng dependency của `useEffect` chứa `calculateTimeLeft`.

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/components/countdown-timer.test.tsx`
Expected: PASS (2 test).

- [ ] **Step 5: Kiểm tra không vỡ chỗ đang dùng**

Run: `npx tsc -b --noEmit` (hoặc `npm run lint`)
Expected: `send-verify-phone-number-dialog.tsx` và `send-verify-email-dialog.tsx` vẫn biên dịch được, không cần sửa vì `bufferMs` có giá trị mặc định.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/countdown-timer.tsx src/tests/components/countdown-timer.test.tsx
git commit -m "TaskId: TRE-470 (4) Make CountdownTimer buffer configurable"
```

---

### Task 5: Tách `useHandleAuthSuccess` khỏi `LoginForm`

Đây là task rủi ro nhất vì đụng luồng đăng nhập. Làm xong phải thử tay đăng nhập bằng cả tài khoản khách và tài khoản nhân viên trước khi sang task sau.

**Files:**
- Create: `src/hooks/use-post-auth-actions.ts`
- Modify: `src/hooks/index.ts`
- Modify: `src/components/app/form/login-form.tsx`
- Test: `src/tests/hooks/use-post-auth-actions.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore`, `useUserStore`, `useCartItemStore`, `useCurrentUrlStore`, `useProfile`, `calculateSmartNavigationUrl`, `safeNavigate`.
- Produces:
  ```ts
  interface IHandleAuthSuccessOptions {
    onSuccess?: (navigationUrl: string) => void
  }
  useHandleAuthSuccess(): (
    tokens: ICompleteRegisterResponse,
    options?: IHandleAuthSuccessOptions,
  ) => Promise<void>
  ```
  Ném lỗi khi không lấy được hồ sơ, sau khi đã dọn sạch auth state.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/tests/hooks/use-post-auth-actions.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const setToken = vi.fn()
const setRefreshToken = vi.fn()
const setExpireTime = vi.fn()
const setExpireTimeRefreshToken = vi.fn()
const setLogout = vi.fn()
const setUserInfo = vi.fn()
const removeUserInfo = vi.fn()
const clearCart = vi.fn()
const clearUrl = vi.fn()
const refetchProfile = vi.fn()
const navigate = vi.fn()

vi.mock('@/stores', () => ({
  useAuthStore: () => ({
    setToken,
    setRefreshToken,
    setExpireTime,
    setExpireTimeRefreshToken,
    setLogout,
  }),
  useUserStore: () => ({ setUserInfo, removeUserInfo }),
  useCartItemStore: () => ({ clearCart }),
  useCurrentUrlStore: () => ({ currentUrl: null, clearUrl }),
}))

vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ refetch: refetchProfile }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))

vi.mock('jwt-decode', () => ({
  jwtDecode: () => ({ scope: JSON.stringify({ role: 'CUSTOMER', permissions: [] }) }),
}))

vi.mock('@/utils', () => ({
  calculateSmartNavigationUrl: () => '/',
  safeNavigate: () => true,
}))

import { useHandleAuthSuccess } from '@/hooks/use-post-auth-actions'

const tokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expireTime: '2026-08-11T11:00:00.000Z',
  expireTimeRefreshToken: '2026-08-18T11:00:00.000Z',
}

describe('useHandleAuthSuccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should store tokens, set the user info and call onSuccess with the navigation url', async () => {
    refetchProfile.mockResolvedValue({
      data: { result: { slug: 'user-1', role: { name: 'CUSTOMER' } } },
    })
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useHandleAuthSuccess())
    await act(async () => {
      await result.current(tokens, { onSuccess })
    })

    expect(setToken).toHaveBeenCalledWith('access')
    expect(setRefreshToken).toHaveBeenCalledWith('refresh')
    expect(setUserInfo).toHaveBeenCalledWith({
      slug: 'user-1',
      role: { name: 'CUSTOMER' },
    })
    expect(onSuccess).toHaveBeenCalledWith('/')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('should navigate itself when no onSuccess callback is given', async () => {
    refetchProfile.mockResolvedValue({
      data: { result: { slug: 'user-1', role: { name: 'CUSTOMER' } } },
    })

    const { result } = renderHook(() => useHandleAuthSuccess())
    await act(async () => {
      await result.current(tokens)
    })

    expect(clearUrl).toHaveBeenCalled()
  })

  it('should roll back the auth state and rethrow when the profile cannot be fetched', async () => {
    refetchProfile.mockResolvedValue({ data: undefined })

    const { result } = renderHook(() => useHandleAuthSuccess())

    await expect(
      act(async () => {
        await result.current(tokens)
      }),
    ).rejects.toThrow()

    expect(setLogout).toHaveBeenCalled()
    expect(removeUserInfo).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/tests/hooks/use-post-auth-actions.test.tsx`
Expected: FAIL — không tìm thấy module `@/hooks/use-post-auth-actions`.

- [ ] **Step 3: Tạo hook**

Tạo `src/hooks/use-post-auth-actions.ts`:

```ts
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'

import {
  useAuthStore,
  useCartItemStore,
  useCurrentUrlStore,
  useUserStore,
} from '@/stores'
import { calculateSmartNavigationUrl, safeNavigate } from '@/utils'
import { ICompleteRegisterResponse, IToken } from '@/types'
import { useProfile } from '@/hooks/use-profile'

export interface IHandleAuthSuccessOptions {
  /**
   * Nhận quyền điều hướng thay cho hook. Dùng khi nơi gọi cần rẽ nhánh riêng
   * (luồng đăng ký đi tiếp sang màn hồ sơ thay vì về thẳng navigationUrl).
   */
  onSuccess?: (navigationUrl: string) => void
}

/**
 * Xử lý phần việc chung sau khi có token: lưu token, lấy hồ sơ, tính điểm đến.
 * Dùng chung cho đăng nhập và bước hoàn tất đăng ký.
 * Ném lỗi sau khi đã dọn sạch auth state nếu không lấy được hồ sơ.
 */
export const useHandleAuthSuccess = () => {
  const {
    setToken,
    setRefreshToken,
    setExpireTime,
    setExpireTimeRefreshToken,
    setLogout,
  } = useAuthStore()
  const { clearCart } = useCartItemStore()
  const { setUserInfo, removeUserInfo } = useUserStore()
  const { currentUrl, clearUrl } = useCurrentUrlStore()
  const { refetch: refetchProfile } = useProfile()
  const navigate = useNavigate()

  return useCallback(
    async (
      tokens: ICompleteRegisterResponse,
      options?: IHandleAuthSuccessOptions,
    ) => {
      try {
        clearCart()

        setToken(tokens.accessToken)
        setRefreshToken(tokens.refreshToken)
        setExpireTime(tokens.expireTime)
        setExpireTimeRefreshToken(tokens.expireTimeRefreshToken)

        const profile = await refetchProfile()
        if (!profile.data) {
          throw new Error('Failed to fetch user profile')
        }

        const userInfo = profile.data.result
        setUserInfo(userInfo)

        let permissions: string[] = []
        try {
          const decoded: IToken = jwtDecode(tokens.accessToken)
          if (decoded.scope) {
            const scope =
              typeof decoded.scope === 'string'
                ? JSON.parse(decoded.scope)
                : decoded.scope
            permissions = scope.permissions || []
          }
        } catch {
          permissions = []
        }

        const navigationUrl = calculateSmartNavigationUrl({
          userInfo,
          permissions,
          currentUrl,
        })

        if (options?.onSuccess) {
          options.onSuccess(navigationUrl)
          return
        }

        const navigationSuccess = safeNavigate(
          navigate,
          navigationUrl,
          window.location.pathname,
        )
        if (navigationSuccess) {
          clearUrl()
        }
      } catch (error) {
        setLogout()
        removeUserInfo()
        throw error
      }
    },
    [
      clearCart,
      clearUrl,
      currentUrl,
      navigate,
      refetchProfile,
      removeUserInfo,
      setExpireTime,
      setExpireTimeRefreshToken,
      setLogout,
      setRefreshToken,
      setToken,
      setUserInfo,
    ],
  )
}
```

Thêm `export * from './use-post-auth-actions'` vào `src/hooks/index.ts`.

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/hooks/use-post-auth-actions.test.tsx`
Expected: PASS (3 test).

- [ ] **Step 5: Rút gọn `LoginForm` để dùng hook**

Trong `src/components/app/form/login-form.tsx`, thay toàn bộ thân `handleSubmit` bằng:

```tsx
  const handleAuthSuccess = useHandleAuthSuccess()

  const handleSubmit = async (data: z.infer<typeof loginSchema>) => {
    login(data, {
      onSuccess: async (response) => {
        try {
          await handleAuthSuccess(response.result)
          showToast(t('toast.loginSuccess'))
        } catch {
          showToast(t('toast.loginError') || 'Đăng nhập thất bại')
        }
      },
    })
  }
```

Xoá các import và biến chỉ còn phục vụ khối cũ (`useAuthStore`, `useCartItemStore`, `useUserStore`, `useCurrentUrlStore`, `useProfile`, `jwtDecode`, `calculateSmartNavigationUrl`, `safeNavigate`, `useNavigate`, `IToken`) nếu không còn chỗ nào dùng trong file.

Lưu ý thứ tự: trước đây toast thành công hiện **trước** khi điều hướng; giữ nguyên trải nghiệm bằng cách gọi `showToast` ngay sau `await`, vì `safeNavigate` là đồng bộ.

- [ ] **Step 6: Kiểm tra biên dịch và lint**

Run: `npm run lint`
Expected: không có lỗi mới ở `login-form.tsx`.

- [ ] **Step 7: Thử tay luồng đăng nhập**

Run: `npm run dev`
Kiểm tra: đăng nhập bằng tài khoản khách → về trang khách; đăng nhập bằng tài khoản nhân viên → về đúng trang hệ thống theo quyền; đăng nhập sai mật khẩu → toast lỗi và không bị mất trạng thái; vào một trang cần đăng nhập rồi bị đá ra login → sau khi đăng nhập quay lại đúng trang đó.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/use-post-auth-actions.ts src/hooks/index.ts src/components/app/form/login-form.tsx src/tests/hooks/use-post-auth-actions.test.tsx
git commit -m "TaskId: TRE-470 (5) Extract shared post-auth actions hook"
```

---

### Task 6: Schema cho 3 bước

**Files:**
- Modify: `src/schemas/auth.schema.ts`
- Test: `src/tests/schemas/register.schema.test.ts`

**Interfaces:**
- Produces: `useRegisterPhoneSchema`, `useRegisterPasswordSchema`, `useRegisterProfileSchema` cùng type `TRegisterPhoneSchema`, `TRegisterPasswordSchema`, `TRegisterProfileSchema`. Xoá `useRegisterSchema` và `TRegisterSchema`.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/tests/schemas/register.schema.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import {
  useRegisterPhoneSchema,
  useRegisterPasswordSchema,
  useRegisterProfileSchema,
} from '@/schemas'

describe('useRegisterPhoneSchema', () => {
  const schema = useRegisterPhoneSchema()

  it('should accept a 10 digit phone number', () => {
    expect(schema.safeParse({ phonenumber: '0376295216' }).success).toBe(true)
  })

  it.each([['037629521'], ['03762952160'], ['037629521a'], ['']])(
    'should reject %s',
    (phonenumber) => {
      expect(schema.safeParse({ phonenumber }).success).toBe(false)
    },
  )
})

describe('useRegisterPasswordSchema', () => {
  const schema = useRegisterPasswordSchema()

  it('should accept a password with at least 8 chars, one letter and one digit', () => {
    const result = schema.safeParse({
      password: 'matkhau1',
      confirmPassword: 'matkhau1',
    })
    expect(result.success).toBe(true)
  })

  it.each([
    ['mat1', 'too short'],
    ['matkhaudai', 'no digit'],
    ['12345678', 'no letter'],
  ])('should reject %s (%s)', (password) => {
    expect(
      schema.safeParse({ password, confirmPassword: password }).success,
    ).toBe(false)
  })

  it('should reject when the confirmation does not match', () => {
    const result = schema.safeParse({
      password: 'matkhau1',
      confirmPassword: 'matkhau2',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['confirmPassword'])
    }
  })
})

describe('useRegisterProfileSchema', () => {
  const schema = useRegisterProfileSchema()

  it('should accept every field empty', () => {
    const result = schema.safeParse({ firstName: '', lastName: '', dob: '' })
    expect(result.success).toBe(true)
  })

  it('should accept Vietnamese names and a valid date of birth', () => {
    const result = schema.safeParse({
      firstName: 'Thắng',
      lastName: 'Phan Quyết',
      dob: '01/01/1990',
    })
    expect(result.success).toBe(true)
  })

  it('should reject a name containing digits', () => {
    expect(
      schema.safeParse({ firstName: 'Thang1', lastName: '', dob: '' }).success,
    ).toBe(false)
  })

  it('should reject a name longer than 100 characters', () => {
    expect(
      schema.safeParse({ firstName: 'a'.repeat(101), lastName: '', dob: '' })
        .success,
    ).toBe(false)
  })

  it('should reject a malformed date of birth', () => {
    expect(
      schema.safeParse({ firstName: '', lastName: '', dob: '1990-01-01' })
        .success,
    ).toBe(false)
  })

  it('should reject a date of birth in the future', () => {
    const nextYear = new Date().getFullYear() + 1
    expect(
      schema.safeParse({ firstName: '', lastName: '', dob: `01/01/${nextYear}` })
        .success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/tests/schemas/register.schema.test.ts`
Expected: FAIL — ba hàm schema chưa tồn tại.

- [ ] **Step 3: Thay `useRegisterSchema` bằng 3 schema mới**

Trong `src/schemas/auth.schema.ts`, xoá `useRegisterSchema` và thêm:

```ts
export function useRegisterPhoneSchema() {
  const { t } = useTranslation('auth')
  return z.object({
    phonenumber: z
      .string()
      .min(1, t('register.phoneNumberRequired'))
      .length(10, t('register.phoneNumberMaxLength'))
      .regex(PHONE_NUMBER_REGEX, t('register.phoneNumberInvalid')),
  })
}

export function useRegisterPasswordSchema() {
  const { t } = useTranslation('auth')
  return z
    .object({
      password: z
        .string()
        .min(AuthRules.MIN_LENGTH, {
          message: t('register.minLength', { count: AuthRules.MIN_LENGTH }),
        })
        .refine((val) => /[A-Za-z]/.test(val), {
          message: t('register.hasLetter'),
        })
        .refine((val) => /\d/.test(val), {
          message: t('register.hasNumber'),
        }),
      confirmPassword: z.string().min(1, t('register.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('register.passwordNotMatch'),
      path: ['confirmPassword'],
    })
}

export function useRegisterProfileSchema() {
  const { t } = useTranslation('auth')
  const optionalName = (
    tooLong: string,
    invalid: string,
  ) =>
    z
      .string()
      .max(100, tooLong)
      .refine((val) => val === '' || NAME_REGEX.test(val), { message: invalid })

  return z.object({
    firstName: optionalName(
      t('register.firstNameTooLong', { count: 100 }),
      t('register.firstNameInvalid'),
    ),
    lastName: optionalName(
      t('register.lastNameTooLong', { count: 100 }),
      t('register.lastNameInvalid'),
    ),
    dob: z
      .string()
      .refine(
        (val) => val === '' || moment(val, 'DD/MM/YYYY', true).isValid(),
        { message: t('register.dobInvalid') },
      )
      .refine(
        (val) => val === '' || moment(val, 'DD/MM/YYYY', true).isSameOrBefore(moment(), 'day'),
        { message: t('register.dobInvalid') },
      ),
  })
}
```

Ở cuối file, thay `export type TRegisterSchema = …` bằng:

```ts
export type TRegisterPhoneSchema = z.infer<
  ReturnType<typeof useRegisterPhoneSchema>
>
export type TRegisterPasswordSchema = z.infer<
  ReturnType<typeof useRegisterPasswordSchema>
>
export type TRegisterProfileSchema = z.infer<
  ReturnType<typeof useRegisterProfileSchema>
>
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/schemas/register.schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/auth.schema.ts src/tests/schemas/register.schema.test.ts
git commit -m "TaskId: TRE-470 (6) Add per-step register schemas"
```

---

### Task 7: Route và Step 1 — nhập số điện thoại

**Files:**
- Modify: `src/constants/route.ts`
- Modify: `src/router/loadable.tsx`, `src/router/index.tsx`
- Modify: `src/app/auth/Register.tsx`, `src/app/auth/index.tsx`
- Create: `src/components/app/form/register-phone-form.tsx`
- Modify: `src/components/app/form/index.tsx`
- Delete: `src/components/app/form/register-form.tsx`
- Test: `src/tests/components/register-phone-form.test.tsx`

**Interfaces:**
- Consumes: `useInitiateRegister` (Task 1), `useRegisterFlowStore` (Task 2), `useRegisterPhoneSchema` (Task 6), `ROUTE.REGISTER_OTP`.
- Produces: `RegisterPhoneForm`; hằng route `REGISTER_OTP`, `REGISTER_PROFILE`; page `RegisterPage` render Step 1.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/tests/components/register-phone-form.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutate = vi.fn()
const startFlow = vi.fn()
const navigate = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/hooks', () => ({
  useInitiateRegister: () => ({ mutate, isPending: false }),
}))
vi.mock('@/stores', () => ({
  useRegisterFlowStore: () => ({ startFlow }),
}))
vi.mock('react-router-dom', async () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  NavLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

import { RegisterPhoneForm } from '@/components/app/form'

describe('RegisterPhoneForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should strip non digits and cap the input at 10 characters', async () => {
    render(<RegisterPhoneForm />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, '03a76295216999')

    expect(input).toHaveValue('0376295216')
  })

  it('should not call the API when the phone number is incomplete', async () => {
    render(<RegisterPhoneForm />)

    await userEvent.type(screen.getByRole('textbox'), '0376')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(mutate).not.toHaveBeenCalled()
  })

  it('should call initiate with the phone number when valid', async () => {
    render(<RegisterPhoneForm />)

    await userEvent.type(screen.getByRole('textbox'), '0376295216')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(mutate).toHaveBeenCalledWith(
      { phonenumber: '0376295216' },
      expect.any(Object),
    )
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/tests/components/register-phone-form.test.tsx`
Expected: FAIL — `RegisterPhoneForm` chưa được export.

- [ ] **Step 3: Thêm hằng route**

Trong `src/constants/route.ts`, ngay dưới `REGISTER`:

```ts
  REGISTER_OTP: '/auth/register/otp',
  REGISTER_PROFILE: '/auth/register/profile',
```

- [ ] **Step 4: Tạo `RegisterPhoneForm`**

Tạo `src/components/app/form/register-phone-form.tsx`:

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { AxiosError } from 'axios'

import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@/components/ui'
import { ButtonLoading } from '@/components/app/loading'
import { useInitiateRegister } from '@/hooks'
import { useRegisterFlowStore } from '@/stores'
import { useRegisterPhoneSchema, TRegisterPhoneSchema } from '@/schemas'
import { ROUTE } from '@/constants'
import { showErrorToast, showToast } from '@/utils'
import { IApiErrorResponse } from '@/types'

export const RegisterPhoneForm = () => {
  const { t } = useTranslation(['auth'])
  const navigate = useNavigate()
  const { startFlow } = useRegisterFlowStore()
  const { mutate: initiateRegister, isPending } = useInitiateRegister()
  const [existingAccount, setExistingAccount] = useState(false)

  const form = useForm<TRegisterPhoneSchema>({
    resolver: zodResolver(useRegisterPhoneSchema()),
    defaultValues: { phonenumber: '' },
  })

  const handleSubmit = (values: TRegisterPhoneSchema) => {
    setExistingAccount(false)
    initiateRegister(
      { phonenumber: values.phonenumber },
      {
        onSuccess: (response) => {
          startFlow(values.phonenumber, response.result?.expiresAt ?? '')
          navigate(ROUTE.REGISTER_OTP)
        },
        onError: (error) => {
          const statusCode = (error as AxiosError<IApiErrorResponse>).response
            ?.data?.statusCode

          // 119041: số đã có tài khoản. Không tự chuyển trang — hiện lỗi kèm
          // hai lối đi để khách tự chọn.
          if (statusCode === 119041) {
            setExistingAccount(true)
            form.setError('phonenumber', {
              message: t('register.phoneAlreadyRegistered'),
            })
            return
          }

          // 119046: OTP trước đó vẫn còn hiệu lực → đi thẳng sang bước nhập mã.
          if (statusCode === 119046) {
            showToast('toast.registerOtpAlreadySent')
            startFlow(values.phonenumber, '')
            navigate(ROUTE.REGISTER_OTP)
            return
          }

          if (statusCode) {
            showErrorToast(statusCode)
            return
          }

          showErrorToast(
            (error as AxiosError).response?.status ?? 0,
          )
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="phonenumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">
                {t('register.phoneNumber')}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('register.enterPhoneNumber')}
                  inputMode="numeric"
                  autoComplete="tel"
                  onChange={(e) =>
                    field.onChange(e.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {existingAccount && (
          <div className="flex gap-3 text-sm">
            <NavLink to={ROUTE.LOGIN} className="text-primary hover:underline">
              {t('register.goToLogin')}
            </NavLink>
            <NavLink
              to={ROUTE.FORGOT_PASSWORD}
              className="text-primary hover:underline"
            >
              {t('register.goToForgotPassword')}
            </NavLink>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <ButtonLoading /> : t('register.continue')}
        </Button>
      </form>
    </Form>
  )
}
```

Thêm khoá `register.phoneAlreadyRegistered` vào `src/locales/vi/auth.json` ("Số điện thoại này đã được đăng ký") và `src/locales/en/auth.json` ("This phone number is already registered"), rồi thêm `'phoneAlreadyRegistered'` vào mảng `REGISTER_AUTH_KEYS` trong `src/tests/utils/register-error-codes.test.ts`.

Export trong `src/components/app/form/index.tsx`:

```ts
export * from './register-phone-form'
```

Xoá dòng export của `register-form` trong cùng file, và xoá file `src/components/app/form/register-form.tsx`.

- [ ] **Step 5: Viết lại `Register.tsx` thành Step 1**

Thay toàn bộ `src/app/auth/Register.tsx`:

```tsx
import { useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { LoginBackground } from '@/assets/images'
import { RegisterPhoneForm } from '@/components/app/form'
import StepProgressBar from '@/app/auth/components/step-progress-bar'
import { ROUTE } from '@/constants'
import { useAuthStore } from '@/stores'
import { useTheme } from '@/components/app/theme-provider'

export default function Register() {
  const { t } = useTranslation(['auth'])
  const { theme, setTheme } = useTheme()
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (theme !== 'light') {
      setTheme('light')
    }
  }, [theme, setTheme])

  // Khách đã đăng nhập không có việc gì ở luồng đăng ký.
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(ROUTE.CLIENT_HOME, { replace: true })
    }
  }, [isAuthenticated, navigate])

  const steps = [
    t('register.stepPhone'),
    t('register.stepVerify'),
    t('register.stepProfile'),
  ]

  return (
    <div className="flex relative justify-center items-center min-h-screen">
      <img
        src={LoginBackground}
        className="object-cover absolute top-0 left-0 w-full h-full sm:object-fill"
      />
      <div className="flex relative z-10 justify-center items-center p-4 w-full">
        <Card className="w-full max-w-md border border-muted-foreground bg-white bg-opacity-10 shadow-xl backdrop-blur-xl">
          <CardHeader>
            <StepProgressBar currentStep={1} steps={steps} />
            <CardTitle className="text-xl text-center text-white sm:text-2xl">
              {t('register.phoneTitle')}
            </CardTitle>
            <CardDescription className="text-center text-white/80">
              {t('register.phoneSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterPhoneForm />
          </CardContent>
          <CardFooter className="flex flex-col gap-2 text-sm text-white">
            <div className="flex gap-1">
              <span>{t('register.haveAccount')}</span>
              <NavLink to={ROUTE.LOGIN} className="text-primary">
                {t('register.login')}
              </NavLink>
            </div>
            <NavLink to={ROUTE.CLIENT_HOME} className="text-muted/70 hover:underline">
              {t('login.goBackToHome')}
            </NavLink>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/components/register-phone-form.test.tsx src/tests/utils/register-error-codes.test.ts`
Expected: PASS.

- [ ] **Step 7: Thử tay Step 1**

Run: `npm run dev`, mở `/auth/register`.
Kiểm tra: gõ chữ vào ô SĐT không ăn; quá 10 số bị cắt; SĐT chưa đủ số thì hiện lỗi và không gọi API; SĐT đã có tài khoản hiện lỗi kèm 2 link; SĐT mới thì chuyển sang `/auth/register/otp` (màn trắng vì Task 8 chưa làm — chấp nhận được ở bước này) và nhận được tin nhắn OTP.

- [ ] **Step 8: Commit**

```bash
git add src/constants/route.ts src/app/auth/Register.tsx src/components/app/form src/locales src/tests
git rm src/components/app/form/register-form.tsx
git commit -m "TaskId: TRE-470 (7) Replace register form with OTP step 1"
```

---

### Task 8: Step 2 — OTP và mật khẩu

**Files:**
- Create: `src/app/auth/register-otp.tsx`
- Create: `src/components/app/form/register-otp-password-form.tsx`
- Create: `src/components/app/dialog/change-phone-confirm-dialog.tsx`
- Modify: `src/app/auth/index.tsx`, `src/router/loadable.tsx`, `src/router/index.tsx`
- Modify: `src/components/app/form/index.tsx`, `src/components/app/dialog/index.tsx`
- Test: `src/tests/components/register-otp-password-form.test.tsx`

**Interfaces:**
- Consumes: `useCompleteRegister`, `useResendRegisterOtp`, `useInitiateRegister`, `useHandleAuthSuccess`, `useRegisterFlowStore`, `useRegisterPasswordSchema`, `CountdownTimer` với `bufferMs={0}`, `OTPInput` với `allowText`.
- Produces: `RegisterOtpPasswordForm`, `ChangePhoneConfirmDialog`, page `RegisterOtpPage`.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/tests/components/register-otp-password-form.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const completeMutate = vi.fn()
const resendMutate = vi.fn()
const initiateMutate = vi.fn()
const clearRegisterFlow = vi.fn()
const markOtpSent = vi.fn()
const handleAuthSuccess = vi.fn()
const navigate = vi.fn()

let storeState = {
  phonenumber: '0376295216',
  // OTP còn hạn
  otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  // cooldown gửi lại đã hết
  resendAvailableAt: new Date(Date.now() - 1000).toISOString(),
  clearRegisterFlow,
  markOtpSent,
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/hooks', () => ({
  useCompleteRegister: () => ({ mutate: completeMutate, isPending: false }),
  useResendRegisterOtp: () => ({ mutate: resendMutate, isPending: false }),
  useInitiateRegister: () => ({ mutate: initiateMutate, isPending: false }),
  useHandleAuthSuccess: () => handleAuthSuccess,
}))
vi.mock('@/stores', () => ({
  useRegisterFlowStore: () => storeState,
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

import { RegisterOtpPasswordForm } from '@/components/app/form'

const typeOtp = async (value: string) => {
  const boxes = screen.getAllByRole('textbox')
  for (let i = 0; i < value.length; i += 1) {
    await userEvent.type(boxes[i], value[i])
  }
}

describe('RegisterOtpPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState = {
      ...storeState,
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      resendAvailableAt: new Date(Date.now() - 1000).toISOString(),
    }
  })

  it('should keep the password section hidden until 6 characters are entered', async () => {
    render(<RegisterOtpPasswordForm />)

    expect(screen.getByTestId('register-password-section')).toHaveAttribute(
      'data-visible',
      'false',
    )

    await typeOtp('A1B2C3')

    expect(screen.getByTestId('register-password-section')).toHaveAttribute(
      'data-visible',
      'true',
    )
  })

  it('should call resend when the OTP is still valid', async () => {
    render(<RegisterOtpPasswordForm />)

    await userEvent.click(screen.getByRole('button', { name: /resend/i }))

    expect(resendMutate).toHaveBeenCalled()
    expect(initiateMutate).not.toHaveBeenCalled()
  })

  it('should call initiate instead of resend once the OTP has expired', async () => {
    storeState = {
      ...storeState,
      otpExpiresAt: new Date(Date.now() - 1000).toISOString(),
    }
    render(<RegisterOtpPasswordForm />)

    await userEvent.click(screen.getByRole('button', { name: /sendNewCode/i }))

    expect(initiateMutate).toHaveBeenCalled()
    expect(resendMutate).not.toHaveBeenCalled()
  })

  it('should keep the submit button disabled until the terms are accepted', async () => {
    render(<RegisterOtpPasswordForm />)

    await typeOtp('A1B2C3')
    await userEvent.type(
      screen.getByPlaceholderText('register.enterPassword'),
      'matkhau1',
    )
    await userEvent.type(
      screen.getByPlaceholderText('register.enterConfirmPassword'),
      'matkhau1',
    )

    expect(
      screen.getByRole('button', { name: /createAccount/i }),
    ).toBeDisabled()
  })

  it('should send the OTP uppercased together with the password', async () => {
    render(<RegisterOtpPasswordForm />)

    await typeOtp('a1b2c3')
    await userEvent.type(
      screen.getByPlaceholderText('register.enterPassword'),
      'matkhau1',
    )
    await userEvent.type(
      screen.getByPlaceholderText('register.enterConfirmPassword'),
      'matkhau1',
    )
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(
      screen.getByRole('button', { name: /createAccount/i }),
    )

    expect(completeMutate).toHaveBeenCalledWith(
      {
        phonenumber: '0376295216',
        otp: 'A1B2C3',
        password: 'matkhau1',
      },
      expect.any(Object),
    )
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/tests/components/register-otp-password-form.test.tsx`
Expected: FAIL — `RegisterOtpPasswordForm` chưa tồn tại.

- [ ] **Step 3: Tạo dialog xác nhận đổi số**

Tạo `src/components/app/dialog/change-phone-confirm-dialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui'

interface IChangePhoneConfirmDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export default function ChangePhoneConfirmDialog({
  isOpen,
  onOpenChange,
  onConfirm,
}: IChangePhoneConfirmDialogProps) {
  const { t } = useTranslation(['auth'])

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex gap-2 items-center">
            <TriangleAlert className="w-5 h-5 text-destructive" />
            {t('register.changePhoneTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('register.changePhoneMessage')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('register.backToOtp')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('register.changePhoneConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

Thêm khoá `register.backToOtp` ("Quay lại nhập mã" / "Back to code entry") vào cả hai file `auth.json`, và thêm `'backToOtp'` vào `REGISTER_AUTH_KEYS` của test i18n.

Export trong `src/components/app/dialog/index.tsx` theo đúng kiểu các dialog khác trong file đó.

Nếu `AlertDialog` chưa được export từ `@/components/ui`, kiểm tra `src/components/ui/index.ts`; shadcn alert-dialog đã có sẵn trong dự án, chỉ cần export.

- [ ] **Step 4: Tạo `RegisterOtpPasswordForm`**

Tạo `src/components/app/form/register-otp-password-form.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { AxiosError } from 'axios'

import {
  Button,
  Checkbox,
  CountdownTimer,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Label,
  OTPInput,
  PasswordInput,
} from '@/components/ui'
import { PasswordWithRulesInput } from '@/components/app/input'
import { ButtonLoading } from '@/components/app/loading'
import { ChangePhoneConfirmDialog } from '@/components/app/dialog'
import {
  useCompleteRegister,
  useHandleAuthSuccess,
  useInitiateRegister,
  useResendRegisterOtp,
} from '@/hooks'
import { useRegisterFlowStore } from '@/stores'
import { useRegisterPasswordSchema, TRegisterPasswordSchema } from '@/schemas'
import { ROUTE } from '@/constants'
import { showErrorToast, showToast } from '@/utils'
import { IApiErrorResponse } from '@/types'

export const RegisterOtpPasswordForm = () => {
  const { t } = useTranslation(['auth'])
  const navigate = useNavigate()
  const {
    phonenumber,
    otpExpiresAt,
    resendAvailableAt,
    markOtpSent,
    clearRegisterFlow,
  } = useRegisterFlowStore()

  const [otpValue, setOtpValue] = useState('')
  const [otpError, setOtpError] = useState('')
  const [isExpired, setIsExpired] = useState(
    () => !!otpExpiresAt && new Date(otpExpiresAt).getTime() <= Date.now(),
  )
  const [isResendReady, setIsResendReady] = useState(
    () => !resendAvailableAt || new Date(resendAvailableAt).getTime() <= Date.now(),
  )
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isTermsAccepted, setIsTermsAccepted] = useState(false)

  const { mutate: completeRegister, isPending: isCompleting } =
    useCompleteRegister()
  const { mutate: resendOtp, isPending: isResending } = useResendRegisterOtp()
  const { mutate: initiateRegister, isPending: isInitiating } =
    useInitiateRegister()
  const handleAuthSuccess = useHandleAuthSuccess()

  const form = useForm<TRegisterPasswordSchema>({
    resolver: zodResolver(useRegisterPasswordSchema()),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const isPasswordSectionVisible = otpValue.length === 6 && !isExpired

  const onOtpSent = (expiresAt: string) => {
    markOtpSent(expiresAt)
    setIsExpired(false)
    setIsResendReady(false)
    setOtpValue('')
    setOtpError('')
  }

  // Hết hạn thì token cũ không còn, backend trả 119047 nếu gọi resend.
  // Đường đúng lúc này là xin mã mới bằng initiate.
  const handleResend = () => {
    if (isExpired) {
      initiateRegister(
        { phonenumber },
        {
          onSuccess: (response) => {
            onOtpSent(response.result?.expiresAt ?? '')
            showToast('toast.registerOtpAlreadySent')
          },
          onError: (error) => handleOtpError(error),
        },
      )
      return
    }

    resendOtp(
      { phonenumber },
      {
        onSuccess: (response) => {
          onOtpSent(response.result?.expiresAt ?? '')
        },
        onError: (error) => handleOtpError(error),
      },
    )
  }

  const restartFlow = () => {
    clearRegisterFlow()
    navigate(ROUTE.REGISTER, { replace: true })
  }

  const handleOtpError = (error: unknown) => {
    const statusCode = (error as AxiosError<IApiErrorResponse>).response?.data
      ?.statusCode

    switch (statusCode) {
      case 119049:
        setOtpError(t('register.otpInvalid'))
        setOtpValue('')
        return
      case 119047:
      case 119048:
        setIsExpired(true)
        setOtpValue('')
        setOtpError(t('register.otpExpired'))
        return
      case 119050:
        showErrorToast(119050)
        setIsResendReady(false)
        return
      case 119051:
        showErrorToast(119051)
        restartFlow()
        return
      case 119041:
        showErrorToast(119041)
        restartFlow()
        return
      default:
        if (statusCode) {
          showErrorToast(statusCode)
          return
        }
        showErrorToast((error as AxiosError).response?.status ?? 0)
    }
  }

  const handleSubmit = (values: TRegisterPasswordSchema) => {
    setOtpError('')
    completeRegister(
      {
        phonenumber,
        otp: otpValue.toUpperCase(),
        password: values.password,
      },
      {
        onSuccess: async (response) => {
          try {
            await handleAuthSuccess(response.result, {
              onSuccess: (navigationUrl) => {
                clearRegisterFlow()
                showToast('toast.registerSuccess')
                // Khách đang dở việc (giỏ hàng, thanh toán) thì trả về đúng chỗ,
                // bỏ qua bước hồ sơ.
                if (navigationUrl !== ROUTE.HOME) {
                  navigate(navigationUrl, { replace: true })
                  return
                }
                navigate(ROUTE.REGISTER_PROFILE, { replace: true })
              },
            })
          } catch {
            showErrorToast(0)
          }
        },
        onError: (error) => handleOtpError(error),
      },
    )
  }

  const isSubmitDisabled =
    !isPasswordSectionVisible ||
    isCompleting ||
    !isTermsAccepted ||
    !form.formState.isValid

  const resendLabel = useMemo(() => {
    if (isExpired) return t('register.sendNewCode')
    return t('register.resend')
  }, [isExpired, t])

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-2">
          <OTPInput
            length={6}
            allowText
            value={otpValue}
            onChange={(value) => {
              setOtpValue(value.toUpperCase())
              setOtpError('')
            }}
            disabled={isExpired}
          />
          {otpError && (
            <p className="text-sm text-center text-destructive">{otpError}</p>
          )}
        </div>

        <div className="flex justify-between items-center text-sm text-white">
          {isExpired ? (
            <span className="text-destructive">{t('register.otpExpired')}</span>
          ) : (
            <span className="flex gap-1 items-center">
              {t('register.otpExpiresIn')}
              <CountdownTimer
                expiresAt={otpExpiresAt}
                bufferMs={0}
                onExpired={() => setIsExpired(true)}
              />
            </span>
          )}

          <Button
            type="button"
            variant="link"
            className="px-0 text-primary"
            disabled={
              (!isResendReady && !isExpired) || isResending || isInitiating
            }
            onClick={handleResend}
          >
            {isResending || isInitiating ? <ButtonLoading /> : resendLabel}
          </Button>
        </div>

        {!isResendReady && !isExpired && (
          <div className="text-xs text-right text-white/70">
            <CountdownTimer
              expiresAt={resendAvailableAt}
              bufferMs={0}
              onExpired={() => setIsResendReady(true)}
            />
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div
              data-testid="register-password-section"
              data-visible={isPasswordSectionVisible ? 'true' : 'false'}
              className={`grid transition-all duration-300 ${
                isPasswordSectionVisible
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">
                        {t('register.password')}
                      </FormLabel>
                      <FormControl>
                        <PasswordWithRulesInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={t('register.enterPassword')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">
                        {t('register.confirmPassword')}
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          {...field}
                          placeholder={t('register.enterConfirmPassword')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Giữ nguyên ràng buộc chấp thuận của form cũ, nhưng mở link ở tab
                mới để khách không mất dữ liệu đang nhập. */}
            <div className="flex items-start space-x-2">
              <Checkbox
                className="mt-0.5"
                id="terms"
                checked={isTermsAccepted}
                onCheckedChange={(checked) =>
                  setIsTermsAccepted(checked as boolean)
                }
              />
              <Label htmlFor="terms" className="text-sm text-gray-300">
                {t('register.policyCondition')}
                <Link
                  to={ROUTE.POLICY}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {t('register.policy')}
                </Link>
                <span className="text-gray-300">{t('register.and')}</span>
                <Link
                  to={ROUTE.SECURITY}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {t('register.securityTerm')}
                </Link>
                {t('register.ofTrendCoffee')}
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {isCompleting ? <ButtonLoading /> : t('register.createAccount')}
            </Button>
          </form>
        </Form>

        <Button
          type="button"
          variant="ghost"
          className="w-full text-white"
          onClick={() =>
            otpValue.length > 0 ? setIsConfirmOpen(true) : restartFlow()
          }
        >
          {t('register.changePhone')}
        </Button>
      </div>

      <ChangePhoneConfirmDialog
        isOpen={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={restartFlow}
      />
    </>
  )
}
```

Thêm khoá `register.otpInvalid` ("Mã xác thực không đúng" / "Incorrect verification code") vào hai file `auth.json` và vào `REGISTER_AUTH_KEYS`.

Export form trong `src/components/app/form/index.tsx`.

- [ ] **Step 5: Tạo trang Step 2**

Tạo `src/app/auth/register-otp.tsx`:

```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { LoginBackground } from '@/assets/images'
import { RegisterOtpPasswordForm } from '@/components/app/form'
import StepProgressBar from '@/app/auth/components/step-progress-bar'
import { ROUTE } from '@/constants'
import { useAuthStore, useRegisterFlowStore } from '@/stores'
import { useTheme } from '@/components/app/theme-provider'

export default function RegisterOtp() {
  const { t } = useTranslation(['auth'])
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { phonenumber } = useRegisterFlowStore()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (theme !== 'light') {
      setTheme('light')
    }
  }, [theme, setTheme])

  // Đã đăng nhập thì không còn việc ở đây; chưa qua Step 1 thì không có số để xác thực.
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(ROUTE.CLIENT_HOME, { replace: true })
      return
    }
    if (!phonenumber) {
      navigate(ROUTE.REGISTER, { replace: true })
    }
  }, [isAuthenticated, phonenumber, navigate])

  if (!phonenumber) return null

  const steps = [
    t('register.stepPhone'),
    t('register.stepVerify'),
    t('register.stepProfile'),
  ]

  return (
    <div className="flex relative justify-center items-center min-h-screen">
      <img
        src={LoginBackground}
        className="object-cover absolute top-0 left-0 w-full h-full sm:object-fill"
      />
      <div className="flex relative z-10 justify-center items-center p-4 w-full">
        <Card className="w-full max-w-md border border-muted-foreground bg-white bg-opacity-10 shadow-xl backdrop-blur-xl">
          <CardHeader>
            <StepProgressBar currentStep={2} steps={steps} />
            <CardTitle className="text-xl text-center text-white sm:text-2xl">
              {t('register.otpTitle')}
            </CardTitle>
            <CardDescription className="text-center text-white/80">
              {t('register.otpSentTo', { phone: phonenumber })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterOtpPasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Nối route**

`src/app/auth/index.tsx`:

```ts
export { default as RegisterOtpPage } from './register-otp'
```

`src/router/loadable.tsx` — thêm theo đúng khuôn các entry sẵn có:

```tsx
export const RegisterOtpPage = React.lazy(() =>
  import('@/app/auth').then((module) => ({
    default: module.RegisterOtpPage,
  })),
)
```

`src/router/index.tsx` — thêm ngay sau route `ROUTE.REGISTER`:

```tsx
      {
        path: ROUTE.REGISTER_OTP,
        element: <SuspenseElement component={RegisterOtpPage} />,
      },
```

- [ ] **Step 7: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/components/register-otp-password-form.test.tsx src/tests/utils/register-error-codes.test.ts`
Expected: PASS.

- [ ] **Step 8: Thử tay Step 2**

Run: `npm run dev`
Kiểm tra: nhập đủ 6 ký tự thì khối mật khẩu hiện ra; chưa tick điều khoản thì nút "Tạo tài khoản" vẫn khoá; bấm vào "Điều khoản sử dụng" mở tab mới và form không mất dữ liệu; nhập sai mã → lỗi dưới ô OTP, mật khẩu đã gõ không bị mất; bấm gửi lại khi chưa hết 2 phút → nút bị khoá; để mã hết hạn → nút đổi thành "Gửi mã mới" và gọi initiate; đổi số điện thoại khi đã gõ OTP → hiện dialog xác nhận; đăng ký thành công → vào thẳng `/auth/register/profile` và header đã ở trạng thái đăng nhập. F5 giữa chừng → vẫn ở Step 2 với đúng số điện thoại.

- [ ] **Step 9: Commit**

```bash
git add src/app/auth src/components/app/form src/components/app/dialog src/router src/locales src/tests
git commit -m "TaskId: TRE-470 (8) Add OTP and password step"
```

---

### Task 9: Step 3 — hoàn thiện hồ sơ

**Files:**
- Create: `src/app/auth/register-profile.tsx`
- Create: `src/components/app/form/register-profile-form.tsx`
- Modify: `src/app/auth/index.tsx`, `src/router/loadable.tsx`, `src/router/index.tsx`
- Modify: `src/components/app/form/index.tsx`
- Modify: `src/types/user.type.ts` (`IUpdateProfileRequest.address` thành tuỳ chọn)
- Test: `src/tests/components/register-profile-form.test.tsx`

**Interfaces:**
- Consumes: `useUpdateProfile`, `useUserStore`, `useRegisterProfileSchema`, `DatePicker`.
- Produces: `RegisterProfileForm`, page `RegisterProfilePage`.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/tests/components/register-profile-form.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutate = vi.fn()
const setUserInfo = vi.fn()
const navigate = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/hooks', () => ({
  useUpdateProfile: () => ({ mutate, isPending: false }),
}))
vi.mock('@/stores', () => ({
  useUserStore: () => ({ setUserInfo }),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))
vi.mock('@/components/app/picker', () => ({
  DatePicker: ({ onSelect }: { onSelect: (v: string) => void }) => (
    <button type="button" onClick={() => onSelect('01/01/1990')}>
      date-picker
    </button>
  ),
}))

import { RegisterProfileForm } from '@/components/app/form'

describe('RegisterProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should send nulls when everything is left empty', async () => {
    render(<RegisterProfileForm />)

    await userEvent.click(screen.getByRole('button', { name: /complete/i }))

    expect(mutate).toHaveBeenCalledWith(
      { firstName: null, lastName: null, dob: null },
      expect.any(Object),
    )
  })

  it('should send the filled values with dob as DD/MM/YYYY', async () => {
    render(<RegisterProfileForm />)

    await userEvent.type(screen.getByLabelText(/register.lastName/i), 'Phan')
    await userEvent.type(screen.getByLabelText(/register.firstName/i), 'Thắng')
    await userEvent.click(screen.getByRole('button', { name: /date-picker/i }))
    await userEvent.click(screen.getByRole('button', { name: /complete/i }))

    expect(mutate).toHaveBeenCalledWith(
      { firstName: 'Thắng', lastName: 'Phan', dob: '01/01/1990' },
      expect.any(Object),
    )
  })

  it('should skip without calling the API', async () => {
    render(<RegisterProfileForm />)

    await userEvent.click(screen.getByRole('button', { name: /skip/i }))

    expect(mutate).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/tests/components/register-profile-form.test.tsx`
Expected: FAIL — `RegisterProfileForm` chưa tồn tại.

- [ ] **Step 3: Nới `IUpdateProfileRequest`**

Trong `src/types/user.type.ts`:

```ts
export interface IUpdateProfileRequest {
  firstName: string | null
  lastName: string | null
  dob?: string | null
  address?: string
  branch?: string
}
```

Chạy `npx tsc -b --noEmit` để chắc chắn các form hồ sơ khác vẫn biên dịch (chúng đang truyền `address` nên không bị ảnh hưởng).

- [ ] **Step 4: Tạo `RegisterProfileForm`**

Tạo `src/components/app/form/register-profile-form.tsx`:

```tsx
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@/components/ui'
import { DatePicker } from '@/components/app/picker'
import { ButtonLoading } from '@/components/app/loading'
import { useUpdateProfile } from '@/hooks'
import { useUserStore } from '@/stores'
import { useRegisterProfileSchema, TRegisterProfileSchema } from '@/schemas'
import { ROUTE } from '@/constants'
import { showToast } from '@/utils'

export const RegisterProfileForm = () => {
  const { t } = useTranslation(['auth'])
  const navigate = useNavigate()
  const { setUserInfo } = useUserStore()
  const { mutate: updateProfile, isPending } = useUpdateProfile()

  const form = useForm<TRegisterProfileSchema>({
    resolver: zodResolver(useRegisterProfileSchema()),
    defaultValues: { firstName: '', lastName: '', dob: '' },
  })

  const goHome = () => navigate(ROUTE.CLIENT_HOME, { replace: true })

  const handleSubmit = (values: TRegisterProfileSchema) => {
    updateProfile(
      {
        firstName: values.firstName || null,
        lastName: values.lastName || null,
        dob: values.dob || null,
      },
      {
        onSuccess: (response) => {
          if (response?.result) {
            setUserInfo(response.result)
          }
          showToast('toast.updateProfileSuccess')
          goHome()
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">
                {t('register.lastName')}
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('register.enterLastName')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">
                {t('register.firstName')}
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('register.enterFirstName')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dob"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">{t('register.dob')}</FormLabel>
              <FormControl>
                <DatePicker
                  backgroundColor="bg-transparent"
                  date={field.value}
                  onSelect={(selectedDate) => field.onChange(selectedDate)}
                  validateDate={(date) => date <= new Date()}
                  disableFutureDate
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2 pt-2">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <ButtonLoading /> : t('register.complete')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isPending}
            onClick={goHome}
          >
            {t('register.skip')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
```

Export trong `src/components/app/form/index.tsx`.

- [ ] **Step 5: Tạo trang Step 3 và nối route**

Tạo `src/app/auth/register-profile.tsx`:

```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { LoginBackground } from '@/assets/images'
import { RegisterProfileForm } from '@/components/app/form'
import StepProgressBar from '@/app/auth/components/step-progress-bar'
import { ROUTE } from '@/constants'
import { useAuthStore } from '@/stores'
import { useTheme } from '@/components/app/theme-provider'

export default function RegisterProfile() {
  const { t } = useTranslation(['auth'])
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (theme !== 'light') {
      setTheme('light')
    }
  }, [theme, setTheme])

  // Bước này chỉ dành cho người đã đăng nhập xong ở Step 2.
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate(ROUTE.LOGIN, { replace: true })
    }
  }, [isAuthenticated, navigate])

  const steps = [
    t('register.stepPhone'),
    t('register.stepVerify'),
    t('register.stepProfile'),
  ]

  return (
    <div className="flex relative justify-center items-center min-h-screen">
      <img
        src={LoginBackground}
        className="object-cover absolute top-0 left-0 w-full h-full sm:object-fill"
      />
      <div className="flex relative z-10 justify-center items-center p-4 w-full">
        <Card className="w-full max-w-md border border-muted-foreground bg-white bg-opacity-10 shadow-xl backdrop-blur-xl">
          <CardHeader>
            <StepProgressBar currentStep={3} steps={steps} />
            <CardTitle className="text-xl text-center text-white sm:text-2xl">
              {t('register.profileTitle')}
            </CardTitle>
            <CardDescription className="text-center text-white/80">
              {t('register.profileSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterProfileForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

Nối route — `src/app/auth/index.tsx`:

```ts
export { default as RegisterProfilePage } from './register-profile'
```

`src/router/loadable.tsx`:

```tsx
export const RegisterProfilePage = React.lazy(() =>
  import('@/app/auth').then((module) => ({
    default: module.RegisterProfilePage,
  })),
)
```

`src/router/index.tsx`, ngay sau route `ROUTE.REGISTER_OTP`:

```tsx
      {
        path: ROUTE.REGISTER_PROFILE,
        element: <SuspenseElement component={RegisterProfilePage} />,
      },
```

- [ ] **Step 6: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/components/register-profile-form.test.tsx`
Expected: PASS (3 test).

- [ ] **Step 7: Thử tay Step 3**

Run: `npm run dev`
Kiểm tra: bấm "Bỏ qua" → về trang chủ, không gọi API; điền đủ 3 trường → lưu thành công, tên hiện đúng ở header; nhập tên có số → báo lỗi tại chỗ; mở thẳng `/auth/register/profile` khi chưa đăng nhập → bị đẩy về trang đăng nhập.

- [ ] **Step 8: Commit**

```bash
git add src/app/auth src/components/app/form src/router src/types/user.type.ts src/tests
git commit -m "TaskId: TRE-470 (9) Add optional profile step"
```

---

### Task 10: Dọn dẹp và kiểm tra tổng thể

**Files:**
- Modify: bất kỳ file nào còn tham chiếu luồng cũ.
- Test: toàn bộ.

- [ ] **Step 1: Tìm tàn dư của luồng cũ**

Run:
```bash
grep -rn "useRegister\b\|useRegisterSchema\|TRegisterSchema\|IRegisterSchema\|IRegisterRequest\|RegisterForm\b" src
```
Expected: không còn kết quả nào. Nếu còn, xoá hoặc thay bằng API mới.

- [ ] **Step 2: Chạy toàn bộ test**

Run: `npm run test`
Expected: PASS toàn bộ, không có test nào bị bỏ qua ngoài dự kiến.

- [ ] **Step 3: Lint và build**

Run: `npm run build`
Expected: lint sạch, `tsc -b` không lỗi, build thành công.

- [ ] **Step 4: Thử tay toàn luồng**

Run: `npm run dev`

Kịch bản phải chạy đúng:
1. Từ trang khách bấm "Tài khoản" → Đăng nhập → "Đăng ký" → Step 1.
2. SĐT mới → nhận OTP qua Zalo hoặc SMS → nhập mã → đặt mật khẩu → tạo tài khoản → vào Step 3 → "Bỏ qua" → về trang chủ, đã đăng nhập.
3. Đăng ký lại bằng chính số vừa dùng → Step 1 báo đã tồn tại kèm 2 link.
4. Thêm sản phẩm vào giỏ → vào trang cần đăng nhập → bị đá ra login → bấm "Đăng ký" → hoàn tất Step 2 → quay về đúng trang đang dở, **không** đi qua Step 3.
5. Dán 6 ký tự OTP một lần vào ô đầu tiên → điền đủ 6 ô.
6. Nhập sai OTP 5 lần → nhận thông báo phải đăng ký lại và bị đưa về Step 1.
7. Mở `/auth/register/otp` ở tab mới khi store rỗng → bị đẩy về `/auth/register`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "TaskId: TRE-470 (10) Clean up legacy register flow"
```

---

## Ghi chú cho người thực hiện

- Nếu backend trả `expiresAt` rỗng ở bất kỳ đâu, store tự lùi về `now + 10 phút`. Đồng hồ có thể lệch so với server — đây là đánh đổi đã biết, không phải lỗi.
- Ba mutation đăng ký cố tình bỏ qua global error handler. Nếu quên `meta: { ignoreGlobalError: true }`, khách sẽ thấy hai toast cho cùng một lỗi.
- `OTPInput` mặc định lọc chỉ số. Thiếu `allowText` thì OTP có chữ sẽ không gõ được — đây là lỗi dễ bỏ sót nhất trong cả plan.
- Không chặn nút Back của trình duyệt ở bất kỳ bước nào. Các guard đã đủ để khách không quay ngược vào luồng sai trạng thái.
