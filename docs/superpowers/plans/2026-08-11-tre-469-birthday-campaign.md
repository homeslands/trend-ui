# TRE-469 Chiến dịch sinh nhật — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm cho chiến dịch sinh nhật chạy được end-to-end — tạo đúng contract backend, dừng được từ giao diện, và QA kiểm chứng được trong ngày.

**Architecture:** Sửa từ trong ra ngoài. Tầng type và schema trước (chúng ép TypeScript chỉ ra mọi chỗ cần sửa ở tầng UI), rồi mã lỗi, rồi các hành động mới trên giao diện. Mỗi task là một commit độc lập, tự kiểm chứng được.

**Tech Stack:** React 18, TypeScript, Vite, TanStack Query, react-hook-form + Zod, Radix/shadcn + Tailwind, i18next, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-11-tre-469-birthday-campaign-design.md`
**Demo UI:** https://claude.ai/code/artifact/bd24ee5a-f030-48d4-bc72-97c136d115ee

## Global Constraints

- Mọi đường dẫn trong plan tính từ `app/order-ui/`. Chạy lệnh từ thư mục đó.
- Commit message theo convention repo: `TaskId: TRE-469 (N) <mô tả>`.
- Nhãn tiếng Việt đã chốt, dùng đúng: **"Đóng chiến dịch"** (không phải "Kết thúc"), **"Chạy chiến dịch sinh nhật hôm nay"** (không phải "Gửi lời chúc").
- Mọi chuỗi hiển thị phải qua i18next, thêm đủ cả `vi` và `en`. Không hardcode chuỗi trong JSX.
- Không dùng `!` (non-null assertion) để bịt lỗi TypeScript sinh ra từ việc đổi type sang optional. Dùng optional chaining và giá trị mặc định.
- File locale nằm ở `src/locales/{vi,en}/`. Bản trong `public/locales/` và `dist/locales/` là bản build, **không sửa tay**.
- Sau mỗi task: `npm run lint` phải sạch cho các file vừa đụng.

## Hai sửa đổi so với bản nháp spec

Cả hai đã được cập nhật ngược lại vào file spec.

**1. Không chặn ngày quá khứ ở màn hình sửa.** Bản nháp spec §6.2 viết *"Thêm `disabledDates` cho picker `startDate`"* ở update sheet. Sai: chiến dịch đang chạy luôn có `startDate` trong quá khứ, chặn nó sẽ làm không lưu được bất kỳ thay đổi nào. Backend cũng chỉ kiểm luật này ở `POST`. Task 4 tách thành hai schema để chỉ create sheet chịu luật.

**2. Không thêm `UNLIMITED` vào `VOUCHER_USAGE_FREQUENCY_UNIT`.** Bản nháp spec §5.1 có mục này. Kiểm tra cho thấy `'unlimited'` đang được cast thủ công (`as unknown as VOUCHER_USAGE_FREQUENCY_UNIT`) ở ba sheet của tính năng **voucher** — `create-voucher-sheet`, `update-voucher-sheet`, `create-multiple-voucher-sheet` — chứ không riêng campaign. Dọn nó là đụng vào code voucher đang chạy, không phục vụ mục tiêu của ticket này. Để lại làm nợ riêng; plan này không có task nào cho nó.

---

## Cấu trúc file

**Tạo mới:**

| File | Trách nhiệm |
|---|---|
| `src/components/app/dialog/confirm-close-campaign-dialog.tsx` | Xác nhận + gọi PATCH đổi trạng thái sang `closed` |
| `src/components/app/dialog/confirm-delete-campaign-dialog.tsx` | Xác nhận + gọi DELETE, xử lý lỗi `159909` |
| `src/components/app/dialog/confirm-run-birthday-campaign-dialog.tsx` | Xác nhận + gọi trigger scheduler sinh nhật |
| `src/tests/schemas/campaign.schema.test.ts` | Test schema campaign (thư mục mới) |

**Sửa:**

| File | Việc |
|---|---|
| `src/constants/voucher.ts` | Thêm `CAMPAIGN_REWARD_TYPE`, thêm `UNLIMITED` vào `VOUCHER_USAGE_FREQUENCY_UNIT` |
| `src/types/campaign.type.ts` | `campaignType`, optional hóa, partial update, sửa query params |
| `src/types/base.type.ts` | `hasPrevios` |
| `src/schemas/campaign.schema.ts` | `recipientLimit` optional, tách schema create |
| `src/api/user.ts` | `triggerBirthdayCampaign` |
| `src/hooks/use-user.ts` | `useTriggerBirthdayCampaign` |
| `src/utils/toast.ts` | Map mã lỗi campaign |
| `src/components/app/sheet/create-campaign-sheet.tsx` | Payload + `recipientLimit` + schema create |
| `src/components/app/sheet/update-campaign-sheet.tsx` | Payload partial, guard template optional |
| `src/components/app/sheet/campaign-info-sheet.tsx` | Guard template optional |
| `src/components/app/form/campaign-template-fields.tsx` | Chú thích `duration` theo loại |
| `src/app/system/campaign/DataTable/columns/index.tsx` | Guard `endDate`, hiển thị `recipientLimit` |
| `src/app/system/campaign/DataTable/columns/campaign-actions.tsx` | Thêm Đóng + Xóa |
| `src/app/system/campaign/page.tsx` | Query params |
| `src/components/app/tabscontent/system-campaign-management.tabscontent.tsx` | Nút chạy tay + gate quyền |
| `src/components/app/dialog/index.tsx` | Export 3 dialog mới |
| `src/locales/{vi,en}/campaign.json` | Chuỗi mới |
| `src/locales/{vi,en}/customer.json` | Chuỗi mới |
| `src/locales/{vi,en}/toast.json` | Mã lỗi |
| `src/tests/api/campaign.test.ts` | Cập nhật theo contract mới |
| `src/tests/api/user.test.ts` | Test trigger |

**Xóa:** `src/app/system/campaign/components/{campaign-info-form,voucher-template-table,voucher-template-dialog}.tsx`

---

## Task 1: Xác nhận contract backend và thêm `campaignType`

Toàn bộ plan dựa trên giả định backend nhánh TRE-465 đã deploy. Task này xác nhận trước, rồi mới sửa.

**Files:**
- Modify: `src/constants/voucher.ts`
- Modify: `src/types/campaign.type.ts:74-82`
- Modify: `src/components/app/sheet/create-campaign-sheet.tsx:103-117`
- Test: `src/tests/api/campaign.test.ts`

**Interfaces:**
- Produces: `CAMPAIGN_REWARD_TYPE` enum (`VOUCHER = 'voucher'`, `GIFT = 'gift'`); `ICreateCampaignRequest.campaignType: CAMPAIGN_REWARD_TYPE`

- [ ] **Step 1: Contract đã được xác nhận — đọc để nắm, không cần chạy gì**

Backend nằm cùng repo tại `app/order-api`. Contract đã đối chiếu trực tiếp với source, không cần smoke-test:

| Điều cần chắc | Nguồn | Kết quả |
|---|---|---|
| `campaignType` bắt buộc | `app/order-api/src/campaign/campaign.dto.ts:331-338` | `@IsNotEmpty() @IsEnum(CampaignRewardType)` — bắt buộc, kèm `@MatchTemplateToCampaignType()` |
| `recipientLimit` optional | cùng file, dòng 310-315 | `@IsOptional()` |
| `UpdateCampaignRequestDto` không có `type` | cùng file, dòng 366-408 | Chỉ có `name`, `status`, `recipientLimit`, `startDate`, `endDate`, `voucherGroupSlug`, `voucherCampaignTemplate` |
| Template create không có `startDate`/`endDate` | cùng file, dòng 35-126 | Đúng, không có |
| Response optional cả hai template | cùng file, dòng 431-470 | `voucherCampaignTemplate?`, `giftCampaignTemplate?`, `recipientLimit?`, `endDate?` |
| Query dùng `size` chứ không phải `limit` | `app/order-api/src/app/base.dto.ts:15-49` | `page`, `size`, `sort: string[]` |
| Tên field phân trang | `app/order-api/src/app/app.dto.ts:49` | `hasPrevios` |
| Endpoint trigger tồn tại | `app/order-api/src/user/user.controller.ts:54` | `@Post('birthday/trigger')` |

Hai điều quan trọng phát hiện thêm, đã tính vào các task sau:

- Controller campaign dùng `ValidationPipe({ transform: true, whitelist: true })` **không** kèm `forbidNonWhitelisted` (`campaign.controller.ts:65,88,130`). Field lạ bị **âm thầm loại bỏ**, không trả 400. Nên `slug` trong body PATCH là vô hại — giữ nguyên.
- Trong `campaign.service.ts:252-287`, luật `duration` **chỉ chạy** khi payload có `voucherCampaignTemplate` hoặc `endDate`. Payload chỉ có `status` đi thẳng qua, không dính `159908`. Đây là điều làm Task 8 khả thi.
- `campaign.service.ts:230-238`: chỉ `opening` và `scheduled` bị ràng buộc theo mốc thời gian. **`closed` không có ràng buộc nào** — đóng chiến dịch luôn thành công.

- [ ] **Step 2: Viết test thất bại cho payload create**

Trong `src/tests/api/campaign.test.ts`, sửa import thêm `CAMPAIGN_REWARD_TYPE`:

```ts
import { APPLICABILITY_RULE, CAMPAIGN_REWARD_TYPE, CAMPAIGN_STATUS, CAMPAIGN_TYPE, VOUCHER_PAYMENT_METHOD, VOUCHER_TYPE } from '@/constants'
```

Thêm `campaignType` vào `createData` (ngay sau dòng `type:`):

```ts
      campaignType: CAMPAIGN_REWARD_TYPE.VOUCHER,
```

Và thêm test mới trong `describe('createCampaign')`:

```ts
    it('should send campaignType so the backend knows which template to expect', async () => {
      ;(http.post as Mock).mockResolvedValue({ data: { ...mockCampaign } })

      await createCampaign(createData)

      const body = (http.post as Mock).mock.calls[0][1]
      expect(body.campaignType).toBe('voucher')
    })
```

- [ ] **Step 3: Chạy test để xác nhận nó fail**

Run: `npx vitest run src/tests/api/campaign.test.ts`
Expected: FAIL — TypeScript báo `campaignType` không tồn tại trên `ICreateCampaignRequest`.

- [ ] **Step 4: Thêm enum**

Trong `src/constants/voucher.ts`, ngay sau `CAMPAIGN_STATUS`:

```ts
export enum CAMPAIGN_REWARD_TYPE {
  VOUCHER = 'voucher',
  GIFT = 'gift',
}
```

`GIFT` khai sẵn dù chưa render — enum phản ánh contract backend, không phản ánh UI.

- [ ] **Step 5: Thêm field vào type**

Trong `src/types/campaign.type.ts`, sửa import ở dòng 2 để có `CAMPAIGN_REWARD_TYPE`, rồi thêm vào `ICreateCampaignRequest`:

```ts
export interface ICreateCampaignRequest {
  name: string
  type: CAMPAIGN_TYPE
  campaignType: CAMPAIGN_REWARD_TYPE
  recipientLimit: number
  startDate: string
  endDate: string | null
  voucherGroupSlug: string
  voucherCampaignTemplate: ICampaignVoucherTemplate
}
```

- [ ] **Step 6: Gửi `campaignType` từ create sheet**

Trong `src/components/app/sheet/create-campaign-sheet.tsx`, sửa import constants để có `CAMPAIGN_REWARD_TYPE`, rồi trong `handleSubmit` thêm dòng ngay sau `type: data.type,`:

```ts
      campaignType: CAMPAIGN_REWARD_TYPE.VOUCHER,
```

Đây là hằng số, không phải giá trị từ form — chưa render selector vì nhánh gift chưa chạy được ở backend (mã `159912`).

- [ ] **Step 7: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/api/campaign.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/constants/voucher.ts src/types/campaign.type.ts src/components/app/sheet/create-campaign-sheet.tsx src/tests/api/campaign.test.ts
git commit -m "TaskId: TRE-469 (1) Gửi campaignType khi tạo chiến dịch"
```

---

## Task 2: `recipientLimit` cho phép bỏ trống

Backend coi `recipientLimit` là optional, bỏ trống nghĩa là không giới hạn. Chiến dịch sinh nhật về bản chất là "ai sinh nhật thì nhận" nên đây là trạng thái thường gặp, không phải ngoại lệ.

**Files:**
- Modify: `src/types/campaign.type.ts`
- Modify: `src/schemas/campaign.schema.ts:84-87`
- Modify: `src/components/app/sheet/create-campaign-sheet.tsx`
- Modify: `src/app/system/campaign/DataTable/columns/index.tsx:56-58`
- Modify: `src/locales/{vi,en}/campaign.json`
- Test: `src/tests/schemas/campaign.schema.test.ts` (tạo mới)

**Interfaces:**
- Consumes: `CAMPAIGN_REWARD_TYPE` (Task 1)
- Produces: `campaignFormSchema` với `recipientLimit?: number`; khóa i18n `campaign.recipientLimitUnlimited`

- [ ] **Step 1: Viết test thất bại cho schema**

Tạo `src/tests/schemas/campaign.schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { campaignFormSchema } from '@/schemas/campaign.schema'
import { APPLICABILITY_RULE, CAMPAIGN_TYPE, VOUCHER_PAYMENT_METHOD, VOUCHER_TYPE } from '@/constants'

const validTemplate = {
  title: 'Giảm 15% sinh nhật',
  description: '',
  type: VOUCHER_TYPE.PERCENT_ORDER,
  value: 15,
  maxUsage: 1,
  minOrderValue: 0,
  maxItems: 1,
  duration: 30,
  usageFrequencyUnit: 'unlimited' as const,
  usageFrequencyValue: null,
  applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
  paymentMethods: [VOUCHER_PAYMENT_METHOD.CASH],
  productSlugs: [],
}

const validForm = {
  name: 'Quà sinh nhật 2026',
  type: CAMPAIGN_TYPE.BIRTHDAY,
  startDate: '2027-09-01 08:00',
  endDate: '',
  voucherGroupSlug: 'vg-birthday',
  template: validTemplate,
}

describe('campaignFormSchema — recipientLimit', () => {
  it('accepts a campaign with no recipient limit', () => {
    const result = campaignFormSchema.safeParse({ ...validForm, recipientLimit: undefined })
    expect(result.success).toBe(true)
  })

  it('accepts a positive recipient limit', () => {
    const result = campaignFormSchema.safeParse({ ...validForm, recipientLimit: 500 })
    expect(result.success).toBe(true)
  })

  it('rejects a recipient limit of zero', () => {
    const result = campaignFormSchema.safeParse({ ...validForm, recipientLimit: 0 })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `npx vitest run src/tests/schemas/campaign.schema.test.ts`
Expected: FAIL — test đầu tiên fail vì `recipientLimit` đang bắt buộc.

- [ ] **Step 3: Sửa schema**

Trong `src/schemas/campaign.schema.ts`, thay khối `recipientLimit`:

```ts
    recipientLimit: z
      .number({ invalid_type_error: 'Giới hạn người nhận phải là số' })
      .int()
      .positive('Giới hạn người nhận phải lớn hơn 0')
      .optional(),
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/schemas/campaign.schema.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Sửa type request**

Trong `src/types/campaign.type.ts`, đổi `ICreateCampaignRequest`:

```ts
  recipientLimit?: number
```

và `ICampaign`:

```ts
  recipientLimit?: number
```

- [ ] **Step 6: Sửa create sheet**

Trong `src/components/app/sheet/create-campaign-sheet.tsx`:

Bỏ `recipientLimit: 100` khỏi `defaultValues` (để `undefined`).

Trong `handleSubmit`, thay dòng `recipientLimit: data.recipientLimit,` bằng cách bung có điều kiện:

```ts
      ...(data.recipientLimit ? { recipientLimit: data.recipientLimit } : {}),
```

Bỏ hẳn key khi trống, không gửi `null` — backend khai `IsOptional`, gửi `null` có thể trượt validate.

Trong JSX của field `recipientLimit`, bỏ dấu sao bắt buộc và cho phép ô trống:

```tsx
                    <FormField
                      control={form.control}
                      name="recipientLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('campaign.recipientLimit')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === '' ? undefined : Number(e.target.value),
                                )
                              }
                              placeholder={t('campaign.recipientLimitUnlimited')}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
```

`Number('')` bằng `0` chứ không phải `NaN`, nên phải kiểm chuỗi rỗng trước khi chuyển kiểu — nếu không, ô trống sẽ thành `0` và trượt validate `positive`.

- [ ] **Step 7: Hiển thị "Không giới hạn" ở bảng**

Trong `src/app/system/campaign/DataTable/columns/index.tsx`, thay cột `recipientLimit`:

```tsx
    {
      accessorKey: 'recipientLimit',
      header: t('campaign.recipientLimit'),
      cell: ({ row }) => {
        const limit = row.original.recipientLimit
        return limit ? (
          <span>{limit}</span>
        ) : (
          <span className="text-muted-foreground">{t('campaign.recipientLimitUnlimited')}</span>
        )
      },
    },
```

- [ ] **Step 8: Thêm chuỗi i18n**

`src/locales/vi/campaign.json`, trong object `campaign`, sau `"voucherGroups"`:

```json
    "recipientLimitUnlimited": "Không giới hạn",
```

`src/locales/en/campaign.json`, cùng vị trí:

```json
    "recipientLimitUnlimited": "Unlimited",
```

- [ ] **Step 9: Kiểm tra toàn bộ**

Run: `npx vitest run src/tests/schemas/campaign.schema.test.ts src/tests/api/campaign.test.ts`
Expected: PASS

Run: `npx tsc -b --noEmit`
Expected: không lỗi ở các file vừa sửa. Nếu còn lỗi ở `update-campaign-sheet.tsx` do `recipientLimit` optional, sửa luôn bằng `data.recipientLimit` giữ nguyên kiểu optional.

- [ ] **Step 10: Commit**

```bash
git add src/types/campaign.type.ts src/schemas/campaign.schema.ts src/components/app/sheet/create-campaign-sheet.tsx src/app/system/campaign/DataTable/columns/index.tsx src/locales/vi/campaign.json src/locales/en/campaign.json src/tests/schemas/campaign.schema.test.ts
git commit -m "TaskId: TRE-469 (2) Cho phép chiến dịch không giới hạn người nhận"
```

---

## Task 3: Response optional và sửa lỗi "Invalid Date"

Chiến dịch sinh nhật gần như luôn không có `endDate`. Cột hiện tại gọi `toLocaleDateString` thẳng lên `null` nên hiện `Invalid Date` — lỗi rơi đúng vào loại chiến dịch mà ticket này nhắm tới.

**Files:**
- Modify: `src/types/campaign.type.ts:52-61`
- Modify: `src/app/system/campaign/DataTable/columns/index.tsx:51-54`
- Modify: `src/components/app/sheet/campaign-info-sheet.tsx`
- Modify: `src/components/app/sheet/update-campaign-sheet.tsx`

**Interfaces:**
- Produces: `ICampaign.voucherCampaignTemplate?: ICampaignVoucherTemplateResponse`

- [ ] **Step 1: Optional hóa template trong response type**

Trong `src/types/campaign.type.ts`:

```ts
export interface ICampaign extends IBase {
  name: string
  type: CAMPAIGN_TYPE
  status: CAMPAIGN_STATUS
  recipientLimit?: number
  startDate: string
  endDate: string | null
  voucherGroup: ICampaignVoucherGroup
  voucherCampaignTemplate?: ICampaignVoucherTemplateResponse
}
```

Backend không trả `campaignType` trong response. Cách suy ra loại phần thưởng là xem template nào tồn tại — chiến dịch gift sẽ không có `voucherCampaignTemplate`.

- [ ] **Step 2: Chạy TypeScript để lộ ra mọi chỗ cần guard**

Run: `npx tsc -b --noEmit`
Expected: FAIL với danh sách lỗi ở `campaign-info-sheet.tsx` và `update-campaign-sheet.tsx`.

Đây là kết quả mong muốn — danh sách lỗi chính là danh sách chỗ cần sửa. **Không dùng `!` để bịt.**

- [ ] **Step 3: Guard cột `endDate`**

Trong `src/app/system/campaign/DataTable/columns/index.tsx`:

```tsx
    {
      accessorKey: 'endDate',
      header: t('campaign.endDate'),
      cell: ({ row }) => {
        const endDate = row.original.endDate
        return endDate ? (
          <span>{new Date(endDate).toLocaleDateString('vi-VN')}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
```

Dùng `row.original.endDate` thay vì `row.getValue<string>('endDate')` để giữ đúng kiểu `string | null`.

- [ ] **Step 4: Guard các chỗ TypeScript vừa báo**

Ở `campaign-info-sheet.tsx` và `update-campaign-sheet.tsx`, xử lý từng lỗi bằng optional chaining và giá trị mặc định. Ví dụ với `update-campaign-sheet.tsx`, biến `tpl` đã có nhánh `tpl ? {...} : form.getValues('template')` nên chỉ cần đảm bảo nguồn của `tpl` dùng `?.`:

```ts
  const tpl = detailData?.result?.voucherCampaignTemplate
```

Ở `campaign-info-sheet.tsx`, bọc cả khối hiển thị template:

```tsx
{campaign?.voucherCampaignTemplate && (
  /* khối hiển thị template giữ nguyên nội dung bên trong */
)}
```

- [ ] **Step 5: Chạy TypeScript để xác nhận sạch**

Run: `npx tsc -b --noEmit`
Expected: không lỗi.

- [ ] **Step 6: Kiểm tra bằng mắt**

Run: `npm run dev`

Vào `Quản lý khách hàng & marketing` → tab `Chiến dịch`. Tạo hoặc tìm một chiến dịch không có ngày kết thúc. Xác nhận cột "Ngày kết thúc" hiện `—` chứ không phải `Invalid Date`, và cột giới hạn hiện "Không giới hạn".

- [ ] **Step 7: Commit**

```bash
git add src/types/campaign.type.ts src/app/system/campaign/DataTable/columns/index.tsx src/components/app/sheet/campaign-info-sheet.tsx src/components/app/sheet/update-campaign-sheet.tsx
git commit -m "TaskId: TRE-469 (3) Xử lý chiến dịch không có ngày kết thúc"
```

---

## Task 4: Ngày bắt đầu phải ở tương lai — chỉ khi tạo mới

Backend chỉ kiểm `startDate > now` ở `POST`, không kiểm ở `PATCH`. Picker bật `showTime` nên chặn theo ngày là chưa đủ: chọn 08:00 hôm nay lúc 14:00 vẫn lọt và dính `159907`.

**Files:**
- Modify: `src/schemas/campaign.schema.ts`
- Modify: `src/components/app/sheet/create-campaign-sheet.tsx`
- Test: `src/tests/schemas/campaign.schema.test.ts`

**Interfaces:**
- Consumes: `campaignFormSchema` (Task 2)
- Produces: `campaignCreateFormSchema` — bản mở rộng của `campaignFormSchema`, chỉ create sheet dùng. Update sheet tiếp tục dùng `campaignFormSchema`.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `src/tests/schemas/campaign.schema.test.ts` (nhớ thêm `campaignCreateFormSchema` vào import):

```ts
describe('campaignCreateFormSchema — startDate', () => {
  const past = new Date(Date.now() - 60 * 60 * 1000)
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  it('rejects a start time that has already passed today', () => {
    const result = campaignCreateFormSchema.safeParse({
      ...validForm,
      recipientLimit: undefined,
      startDate: fmt(past),
    })
    expect(result.success).toBe(false)
  })

  it('accepts a start time in the future', () => {
    const result = campaignCreateFormSchema.safeParse({
      ...validForm,
      recipientLimit: undefined,
      startDate: fmt(future),
    })
    expect(result.success).toBe(true)
  })

  it('lets the shared schema keep a past start date, so running campaigns stay editable', () => {
    const result = campaignFormSchema.safeParse({
      ...validForm,
      recipientLimit: undefined,
      startDate: fmt(past),
    })
    expect(result.success).toBe(true)
  })
})
```

Test thứ ba là chốt chặn cho lỗi của spec: chiến dịch đang chạy có `startDate` quá khứ, sửa nó phải lưu được.

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `npx vitest run src/tests/schemas/campaign.schema.test.ts`
Expected: FAIL — `campaignCreateFormSchema` chưa tồn tại.

- [ ] **Step 3: Thêm schema create**

Ở cuối `src/schemas/campaign.schema.ts`, sau `TCampaignFormSchema`:

```ts
// Chỉ dùng khi TẠO MỚI. Backend chỉ kiểm startDate > now ở POST, không kiểm ở PATCH —
// chiến dịch đang chạy luôn có startDate trong quá khứ nên bản dùng chung không được có luật này.
export const campaignCreateFormSchema = campaignFormSchema.refine(
  (data) => {
    if (!data.startDate) return true
    const start = new Date(data.startDate.replace(' ', 'T'))
    if (Number.isNaN(start.getTime())) return false
    return start.getTime() > Date.now()
  },
  { message: 'Ngày bắt đầu phải sau thời điểm hiện tại', path: ['startDate'] },
)

export type TCampaignCreateFormSchema = z.infer<typeof campaignCreateFormSchema>
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/schemas/campaign.schema.test.ts`
Expected: PASS

- [ ] **Step 5: Dùng schema mới ở create sheet**

Trong `src/components/app/sheet/create-campaign-sheet.tsx`, đổi import và resolver:

```ts
import { campaignCreateFormSchema, TCampaignFormSchema } from '@/schemas/campaign.schema'
```

```ts
    resolver: zodResolver(campaignCreateFormSchema),
```

Giữ nguyên `TCampaignFormSchema` làm kiểu form — hai schema có cùng shape, chỉ khác luật.

- [ ] **Step 6: Chặn giờ đã qua ở picker**

Trong cùng file, thay `disableStartDate`:

```ts
  const disableStartDate = (date: Date) => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    return date < startOfToday
  }
```

Picker chỉ chọn được ngày, nên nó vẫn cho chọn hôm nay; phần giờ đã qua do schema ở Step 3 bắt. Giữ nguyên hành vi picker và để thông báo lỗi của form giải thích — đó là chỗ người dùng đọc được lý do.

- [ ] **Step 7: Xác nhận update sheet không đổi**

Run: `grep -n "campaignFormSchema" src/components/app/sheet/update-campaign-sheet.tsx`
Expected: vẫn là `campaignFormSchema`, không phải bản create.

- [ ] **Step 8: Kiểm tra bằng mắt**

Run: `npm run dev`

Mở sheet tạo chiến dịch, chọn ngày hôm nay với giờ đã qua → phải thấy lỗi "Ngày bắt đầu phải sau thời điểm hiện tại". Mở sheet sửa một chiến dịch đang chạy, bấm lưu → phải lưu được bình thường.

- [ ] **Step 9: Commit**

```bash
git add src/schemas/campaign.schema.ts src/components/app/sheet/create-campaign-sheet.tsx src/tests/schemas/campaign.schema.test.ts
git commit -m "TaskId: TRE-469 (4) Chặn ngày bắt đầu trong quá khứ khi tạo chiến dịch"
```

---

## Task 5: PATCH gửi đúng DTO

`UpdateCampaignRequestDto` khai tất cả field optional và **không có `type`**. Sheet hiện gửi trọn payload kèm `type` và kèm `startDate`/`endDate` của template — những field không tồn tại trong DTO. Task này đưa type về đúng contract, và mở đường cho hành động "Đóng chiến dịch" ở Task 8 gửi payload tối thiểu.

**Files:**
- Modify: `src/types/campaign.type.ts:84-93`
- Modify: `src/components/app/sheet/update-campaign-sheet.tsx`
- Test: `src/tests/api/campaign.test.ts`

**Interfaces:**
- Produces: `IUpdateCampaignRequest = { slug: string } & Partial<{ name, status, recipientLimit, startDate, endDate, voucherGroupSlug, voucherCampaignTemplate }>`. Task 8 gửi `{ slug, status }` và không gì khác.

- [ ] **Step 1: Viết test thất bại**

Trong `src/tests/api/campaign.test.ts`, thêm vào `describe('updateCampaign')`:

```ts
    it('should accept a status-only payload for closing a campaign', async () => {
      ;(http.patch as Mock).mockResolvedValue({ data: { ...mockCampaign, status: CAMPAIGN_STATUS.CLOSED } })

      await updateCampaign({ slug: 'campaign-1', status: CAMPAIGN_STATUS.CLOSED })

      expect(http.patch).toHaveBeenCalledWith('/campaign/campaign-1', {
        slug: 'campaign-1',
        status: CAMPAIGN_STATUS.CLOSED,
      })
    })
```

Và bỏ `type: CAMPAIGN_TYPE.NEW_USER,` khỏi object `updateData` — `UpdateCampaignRequestDto` không có field này.

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `npx vitest run src/tests/api/campaign.test.ts`
Expected: FAIL — TypeScript báo thiếu các field bắt buộc của `IUpdateCampaignRequest`.

- [ ] **Step 3: Sửa type**

Trong `src/types/campaign.type.ts`, thay `IUpdateCampaignRequest`:

```ts
// Mọi field optional theo UpdateCampaignRequestDto. Không có `type` —
// loại chiến dịch không đổi được sau khi tạo.
export interface IUpdateCampaignRequest {
  slug: string
  name?: string
  status?: CAMPAIGN_STATUS
  /** `null` = xóa giới hạn. Bỏ hẳn key = giữ nguyên giá trị cũ. */
  recipientLimit?: number | null
  startDate?: string
  endDate?: string | null
  voucherGroupSlug?: string
  voucherCampaignTemplate?: ICampaignVoucherTemplate
}
```

Task 2 có thể đã đặt sẵn `recipientLimit?: number | null`. Nếu vậy thì giữ nguyên, đừng thu hẹp lại.

- [ ] **Step 4: Bỏ field thừa khỏi template request**

Trong cùng file, bỏ hai dòng cuối của `ICampaignVoucherTemplate`:

```ts
  startDate?: string
  endDate?: string
```

`CreateVoucherCampaignTemplateDto` không có chúng. (Giữ nguyên ở `ICampaignVoucherTemplateResponse` — đó là type của response, không phải request.)

- [ ] **Step 5: Sửa payload update sheet**

Trong `src/components/app/sheet/update-campaign-sheet.tsx`, trong `handleSubmit` bỏ dòng `type: data.type,`. Payload còn:

```ts
    setFormData({
      slug: campaign.slug,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate || null,
      // Task 2 đã đặt: PATCH phải gửi null tường minh để xóa giới hạn.
      // Bỏ hẳn key nghĩa là "giữ nguyên giá trị cũ" — xem campaign.service.ts:295.
      recipientLimit: data.recipientLimit ?? null,
      voucherGroupSlug: data.voucherGroupSlug,
      voucherCampaignTemplate: {
        ...data.template,
        duration: data.endDate ? null : data.template.duration,
      },
    })
```

Select "Loại chiến dịch" vẫn hiển thị và vẫn `disabled` — chỉ để xem, không gửi đi.

**Không đổi dòng `recipientLimit` này về conditional spread.** Task 2 đã sửa một lỗi Critical đúng ở đây: backend `update` chạy `if (dto.recipientLimit !== undefined) campaign.recipientLimit = dto.recipientLimit` (`campaign.service.ts:295`), nên thiếu key là giữ nguyên giá trị cũ chứ không phải xóa giới hạn. Cột là `nullable: true` và DTO có `@IsOptional()` nên `null` lọt qua `@Min(1)` bình thường. Create thì ngược lại — bỏ hẳn key, vì ở POST không có giá trị cũ nào để giữ.

- [ ] **Step 6: Xử lý lỗi TypeScript còn lại**

Run: `npx tsc -b --noEmit`

Nếu báo lỗi ở chỗ bung `...data.template` vì `startDate`/`endDate` không còn trong type, bỏ hai key đó khỏi `defaultValues.template` của cả hai sheet và khỏi phần đổ dữ liệu `tpl` trong update sheet.

Cũng bỏ `startDate`/`endDate` khỏi `campaignVoucherTemplateSchema` trong `src/schemas/campaign.schema.ts` (hai dòng cuối của object).

- [ ] **Step 7: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/api/campaign.test.ts src/tests/schemas/campaign.schema.test.ts`
Expected: PASS

Run: `npx tsc -b --noEmit`
Expected: không lỗi.

- [ ] **Step 8: Commit**

```bash
git add src/types/campaign.type.ts src/schemas/campaign.schema.ts src/components/app/sheet/update-campaign-sheet.tsx src/components/app/sheet/create-campaign-sheet.tsx src/tests/api/campaign.test.ts
git commit -m "TaskId: TRE-469 (5) PATCH chiến dịch gửi đúng DTO"
```

---

## Task 6: Sửa tham số phân trang danh sách

Danh sách đang gửi `limit`, backend nhận `size` — nên đổi số dòng mỗi trang hiện không có tác dụng, backend luôn trả 10. Cũng đang gửi `startDate`/`endDate` mà `GetAllCampaignQueryRequestDto` không có.

**Files:**
- Modify: `src/types/campaign.type.ts:63-72`
- Modify: `src/types/base.type.ts:11-19`
- Modify: `src/app/system/campaign/page.tsx:26-34`

**Interfaces:**
- Produces: `IGetCampaignRequestParams` với `size` thay cho `limit`, không còn `startDate`/`endDate`, `sort?: string[]`

- [ ] **Step 1: Sửa type query**

Trong `src/types/campaign.type.ts`:

```ts
export interface IGetCampaignRequestParams {
  hasPaging?: boolean
  page?: number
  size?: number
  sort?: string[]
  status?: CAMPAIGN_STATUS
  type?: CAMPAIGN_TYPE
}
```

`sort` là mảng chuỗi dạng `createdAt:desc`, không phải `'DESC' | 'ASC'`.

- [ ] **Step 2: Sửa chỗ gọi**

Trong `src/app/system/campaign/page.tsx`, thay khối `useCampaigns`:

```ts
  const { data, isLoading } = useCampaigns({
    hasPaging: true,
    page: pagination.pageIndex,
    size: pagination.pageSize,
    status: statusFilter,
    type: typeFilter,
  })
```

`pagination.pageIndex` từ `usePagination` đã là 1-based, không cần cộng thêm.

- [ ] **Step 3: Dọn state không dùng nữa**

Run: `npx tsc -b --noEmit`

TypeScript sẽ báo `startDate`/`endDate` state trong `page.tsx` không còn được dùng. Xóa hai `useState` đó và mọi chỗ truyền setter của chúng xuống `DataTable`. Nếu `DataTable` cần prop date picker, truyền `hiddenDatePicker` như `CustomerBirthdayView` đang làm.

- [ ] **Step 4: Sửa tên field phân trang**

Trong `src/types/base.type.ts`:

```ts
export interface IPaginationResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  /** Backend viết thiếu chữ "u" — giữ đúng tên backend trả về. */
  hasPrevios: boolean
}
```

- [ ] **Step 5: Sửa consumer duy nhất**

Run: `grep -rn "hasPrevious" src/`

Chỉ có một chỗ dùng thật: `src/components/app/tabscontent/customer-order.tabscontent.tsx:280`. Đổi thành `hasPrevios`. Các chỗ còn lại là dữ liệu mock trong `src/tests/api/menu.test.ts` — đổi luôn cho khớp.

- [ ] **Step 6: Kiểm tra**

Run: `npx vitest run src/tests/api/`
Expected: PASS

Run: `npx tsc -b --noEmit`
Expected: không lỗi.

Run: `npm run dev` → vào danh sách chiến dịch, đổi số dòng mỗi trang từ 10 sang 20. Xác nhận số dòng thay đổi thật.

- [ ] **Step 7: Commit**

```bash
git add src/types/campaign.type.ts src/types/base.type.ts src/app/system/campaign/page.tsx src/components/app/tabscontent/customer-order.tabscontent.tsx src/tests/api/menu.test.ts
git commit -m "TaskId: TRE-469 (6) Sửa tham số phân trang danh sách chiến dịch"
```

---

## Task 7: Dịch mã lỗi chiến dịch

`src/utils/toast.ts` đã map sẵn `159908`. Bổ sung phần còn lại theo đúng pattern đó. Task 9 phụ thuộc vào `159909` nên task này phải xong trước.

**Files:**
- Modify: `src/utils/toast.ts:326`
- Modify: `src/locales/{vi,en}/toast.json`

**Interfaces:**
- Produces: khóa i18n `toast.campaignHasVouchers` (Task 9 dùng)

- [ ] **Step 1: Thêm mã vào bảng map**

Trong `src/utils/toast.ts`, ngay sau dòng `159908:`, thêm:

```ts
  159901: 'toast.campaignNotFound',
  159902: 'toast.campaignVoucherGroupNotFound',
  159903: 'toast.campaignProductNotFound',
  159906: 'toast.campaignInvalidDateRange',
  159907: 'toast.campaignInvalidStatusTransition',
  159909: 'toast.campaignHasVouchers',
  159910: 'toast.campaignTemplateRequiredForType',
  159911: 'toast.campaignTemplateTypeMismatch',
  159912: 'toast.campaignGiftNotYetSupported',
```

Bỏ qua `159904` và `159905` — lỗi nội bộ của scheduler, admin không gây ra được từ giao diện; chúng sẽ rơi vào `toast.requestFailed` mặc định.

- [ ] **Step 2: Thêm bản dịch tiếng Việt**

Trong `src/locales/vi/toast.json`, cạnh `"campaignDurationRequiredWhenHasNoEndDate"`:

```json
				"campaignNotFound": "Không tìm thấy chiến dịch",
				"campaignVoucherGroupNotFound": "Không tìm thấy nhóm voucher",
				"campaignProductNotFound": "Không tìm thấy sản phẩm áp dụng",
				"campaignInvalidDateRange": "Ngày kết thúc phải sau ngày bắt đầu",
				"campaignInvalidStatusTransition": "Trạng thái không khớp với mốc thời gian của chiến dịch",
				"campaignHasVouchers": "Chiến dịch đã phát phần thưởng cho khách nên không xóa được. Dùng \"Đóng chiến dịch\" để ngừng phát thưởng.",
				"campaignTemplateRequiredForType": "Thiếu mẫu phần thưởng cho loại chiến dịch này",
				"campaignTemplateTypeMismatch": "Mẫu phần thưởng không khớp loại chiến dịch",
				"campaignGiftNotYetSupported": "Chiến dịch quà tặng chưa khả dụng",
```

`campaignHasVouchers` nói cả lý do lẫn cách xử lý thay thế — đây là lỗi người dùng gặp thường xuyên nhất trong luồng này.

- [ ] **Step 3: Thêm bản dịch tiếng Anh**

Trong `src/locales/en/toast.json`, cạnh `"campaignDurationRequiredWhenHasNoEndDate"`:

```json
    "campaignNotFound": "Campaign not found",
    "campaignVoucherGroupNotFound": "Voucher group not found",
    "campaignProductNotFound": "Applicable product not found",
    "campaignInvalidDateRange": "End date must be after start date",
    "campaignInvalidStatusTransition": "The status does not match the campaign's date range",
    "campaignHasVouchers": "This campaign already granted rewards, so it cannot be deleted. Use \"Close campaign\" to stop granting rewards.",
    "campaignTemplateRequiredForType": "The reward template for this campaign type is missing",
    "campaignTemplateTypeMismatch": "The reward template does not match the campaign type",
    "campaignGiftNotYetSupported": "Gift campaigns are not available yet",
```

- [ ] **Step 4: Kiểm tra JSON hợp lệ**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/vi/toast.json','utf8')); JSON.parse(require('fs').readFileSync('src/locales/en/toast.json','utf8')); console.log('JSON hợp lệ')"`
Expected: in ra `JSON hợp lệ`

- [ ] **Step 5: Commit**

```bash
git add src/utils/toast.ts src/locales/vi/toast.json src/locales/en/toast.json
git commit -m "TaskId: TRE-469 (7) Dịch mã lỗi chiến dịch sang tiếng Việt"
```

---

## Task 8: Đóng chiến dịch

Chiến dịch sinh nhật không có `endDate` nên không bao giờ tự đóng. Không có hành động này thì tạo nhầm là kẹt vĩnh viễn.

**Files:**
- Create: `src/components/app/dialog/confirm-close-campaign-dialog.tsx`
- Modify: `src/components/app/dialog/index.tsx:210-211`
- Modify: `src/app/system/campaign/DataTable/columns/campaign-actions.tsx`
- Modify: `src/locales/{vi,en}/campaign.json`

**Interfaces:**
- Consumes: `IUpdateCampaignRequest` partial (Task 5), `useUpdateCampaign` (đã có)
- Produces: `ConfirmCloseCampaignDialog({ campaign: ICampaign })` — component tự quản lý trạng thái mở, tự render trigger, dùng được thẳng trong dropdown

- [ ] **Step 1: Thêm chuỗi i18n**

`src/locales/vi/campaign.json`, sau `"deleteSuccess"`:

```json
    "closeCampaign": "Đóng chiến dịch",
    "confirmClose": "Đóng chiến dịch?",
    "confirmCloseDescription": "Chiến dịch sẽ chuyển sang trạng thái Đã đóng và ngừng phát thưởng ngay.",
    "closeNote1": "Phần thưởng đã phát cho khách vẫn giữ nguyên.",
    "closeNote2": "Không mở lại được từ giao diện này.",
    "closeSuccess": "Đã đóng chiến dịch",
```

`src/locales/en/campaign.json`, cùng vị trí:

```json
    "closeCampaign": "Close campaign",
    "confirmClose": "Close this campaign?",
    "confirmCloseDescription": "The campaign moves to Closed and stops granting rewards immediately.",
    "closeNote1": "Rewards already granted stay with customers.",
    "closeNote2": "You cannot reopen it from this screen.",
    "closeSuccess": "Campaign closed",
```

- [ ] **Step 2: Tạo dialog**

Tạo `src/components/app/dialog/confirm-close-campaign-dialog.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleSlash } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'
import { ICampaign } from '@/types'
import { CAMPAIGN_STATUS } from '@/constants'
import { useUpdateCampaign } from '@/hooks'
import { showToast } from '@/utils'

export default function ConfirmCloseCampaignDialog({ campaign }: { campaign: ICampaign }) {
  const { t } = useTranslation('campaign')
  const [isOpen, setIsOpen] = useState(false)
  const { mutate: updateCampaign, isPending } = useUpdateCampaign()

  const handleConfirm = () => {
    updateCampaign(
      { slug: campaign.slug, status: CAMPAIGN_STATUS.CLOSED },
      {
        onSuccess: () => {
          showToast(t('campaign.closeSuccess'))
          setIsOpen(false)
        },
      },
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="gap-1 justify-start px-2 w-full text-sm">
          <CircleSlash className="icon" />
          {t('campaign.closeCampaign')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[22rem] rounded-md px-6 sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="pb-4 border-b">
            <div className="flex gap-2 items-center text-primary">
              <CircleSlash className="w-6 h-6" />
              {t('campaign.confirmClose')}
            </div>
          </DialogTitle>
          <div className="flex flex-col gap-3 py-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{campaign.name}</span> —{' '}
              {t('campaign.confirmCloseDescription')}
            </p>
            <ul className="flex flex-col gap-1 pl-5 list-disc">
              <li>{t('campaign.closeNote1')}</li>
              <li>{t('campaign.closeNote2')}</li>
            </ul>
          </div>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t('campaign.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {t('campaign.closeCampaign')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Payload chỉ có `slug` và `status` — đây là lý do Task 5 phải làm `IUpdateCampaignRequest` partial.

- [ ] **Step 3: Export**

Trong `src/components/app/dialog/index.tsx`, sau dòng 211:

```ts
export { default as ConfirmCloseCampaignDialog } from './confirm-close-campaign-dialog'
```

- [ ] **Step 4: Gắn vào menu hành động**

Thay toàn bộ `src/app/system/campaign/DataTable/columns/campaign-actions.tsx`:

```tsx
import { MoreHorizontal } from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui'
import { UpdateCampaignSheet } from '@/components/app/sheet'
import { ConfirmCloseCampaignDialog } from '@/components/app/dialog'
import { CAMPAIGN_STATUS } from '@/constants'
import { ICampaign } from '@/types'

export function CampaignActions({ campaign }: { campaign: ICampaign }) {
  const canClose = campaign.status !== CAMPAIGN_STATUS.CLOSED

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="flex flex-col gap-1 w-fit">
          <UpdateCampaignSheet campaign={campaign} />
          {canClose && <ConfirmCloseCampaignDialog campaign={campaign} />}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
```

- [ ] **Step 5: Kiểm tra bằng mắt**

Run: `npm run dev`

Vào danh sách chiến dịch, mở menu `···` của một chiến dịch đang mở → thấy "Đóng chiến dịch". Bấm → dialog hiện tên chiến dịch và hai gạch đầu dòng. Xác nhận → toast "Đã đóng chiến dịch", bảng tự làm mới, badge chuyển sang "Đã đóng". Mở lại menu của chính dòng đó → mục "Đóng chiến dịch" đã biến mất.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/dialog/confirm-close-campaign-dialog.tsx src/components/app/dialog/index.tsx src/app/system/campaign/DataTable/columns/campaign-actions.tsx src/locales/vi/campaign.json src/locales/en/campaign.json
git commit -m "TaskId: TRE-469 (8) Thêm hành động đóng chiến dịch"
```

---

## Task 9: Xóa chiến dịch

API, hook và chuỗi i18n đã có sẵn từ trước nhưng chưa nơi nào dùng.

Nút này **luôn hiện**, không disable theo điều kiện. Doc TRE-465 mục 6.6 khuyên ẩn khi chiến dịch đã có người nhận, nhưng `CampaignResponseDto` không trả số recipient nên FE không có cách nào biết trước. Cách xử lý là gọi API rồi bắt `159909` — Task 7 đã chuẩn bị sẵn thông báo.

**Files:**
- Create: `src/components/app/dialog/confirm-delete-campaign-dialog.tsx`
- Modify: `src/components/app/dialog/index.tsx`
- Modify: `src/app/system/campaign/DataTable/columns/campaign-actions.tsx`

**Interfaces:**
- Consumes: `useDeleteCampaign` (đã có), khóa `toast.campaignHasVouchers` (Task 7)
- Produces: `ConfirmDeleteCampaignDialog({ campaign: ICampaign })`

- [ ] **Step 1: Tạo dialog**

Tạo `src/components/app/dialog/confirm-delete-campaign-dialog.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, TriangleAlert } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'
import { ICampaign } from '@/types'
import { useDeleteCampaign } from '@/hooks'
import { showToast } from '@/utils'

export default function ConfirmDeleteCampaignDialog({ campaign }: { campaign: ICampaign }) {
  const { t } = useTranslation('campaign')
  const { t: tCommon } = useTranslation('common')
  const [isOpen, setIsOpen] = useState(false)
  const { mutate: deleteCampaign, isPending } = useDeleteCampaign()

  const handleConfirm = () => {
    deleteCampaign(campaign.slug, {
      onSuccess: () => {
        showToast(t('campaign.deleteSuccess'))
        setIsOpen(false)
      },
      onError: () => {
        // Lỗi 159909 (chiến dịch đã phát thưởng) đã có toast riêng từ MutationCache,
        // chỉ cần đóng dialog để người dùng đọc được thông báo.
        setIsOpen(false)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="gap-1 justify-start px-2 w-full text-sm text-destructive hover:text-destructive"
        >
          <Trash2 className="icon" />
          {t('campaign.deleteCampaign')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[22rem] rounded-md sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="pb-4 border-b border-destructive text-destructive">
            <div className="flex gap-2 items-center">
              <TriangleAlert className="w-6 h-6" />
              {t('campaign.deleteCampaign')}
            </div>
          </DialogTitle>
          <DialogDescription className="p-2 rounded-md bg-red-100 dark:bg-transparent text-destructive">
            {tCommon('common.deleteNote')}
          </DialogDescription>
          <div className="py-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{campaign.name}</span>
            <br />
            <br />
            {t('campaign.confirmDelete')}
          </div>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t('campaign.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {tCommon('common.confirmDelete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Xác nhận toast lỗi tự chạy**

Run: `grep -n "MutationCache" -A12 src/app/App.tsx`

Xác nhận `MutationCache` gọi `showErrorToast` cho mọi lỗi trừ khi mutation khai `meta: { ignoreGlobalError: true }`. `useDeleteCampaign` không khai meta đó, nên `159909` sẽ tự ra toast từ bảng map ở Task 7.

Nếu `MutationCache` **không** tự bắt, thì đọc mã lỗi trong `onError` và gọi tay:

```ts
      onError: (error: unknown) => {
        const code = (error as { response?: { data?: { errorCode?: number } } })?.response?.data?.errorCode
        if (code) showErrorToast(code)
        setIsOpen(false)
      },
```

- [ ] **Step 3: Export**

Trong `src/components/app/dialog/index.tsx`:

```ts
export { default as ConfirmDeleteCampaignDialog } from './confirm-delete-campaign-dialog'
```

- [ ] **Step 4: Gắn vào menu**

Trong `src/app/system/campaign/DataTable/columns/campaign-actions.tsx`, thêm import và render sau `ConfirmCloseCampaignDialog`:

```tsx
import { ConfirmCloseCampaignDialog, ConfirmDeleteCampaignDialog } from '@/components/app/dialog'
```

```tsx
          {canClose && <ConfirmCloseCampaignDialog campaign={campaign} />}
          <ConfirmDeleteCampaignDialog campaign={campaign} />
```

- [ ] **Step 5: Kiểm tra cả hai nhánh**

Run: `npm run dev`

Nhánh xóa được: tạo một chiến dịch mới với `startDate` xa trong tương lai (chưa ai nhận), xóa nó → toast "Xóa chiến dịch thành công", dòng biến mất.

Nhánh bị chặn: xóa một chiến dịch đã phát thưởng → toast tiếng Việt *"Chiến dịch đã phát phần thưởng cho khách nên không xóa được. Dùng "Đóng chiến dịch" để ngừng phát thưởng."* Không phải message tiếng Anh thô.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/dialog/confirm-delete-campaign-dialog.tsx src/components/app/dialog/index.tsx src/app/system/campaign/DataTable/columns/campaign-actions.tsx
git commit -m "TaskId: TRE-469 (9) Thêm hành động xóa chiến dịch"
```

---

## Task 10: Chú thích thời hạn theo loại chiến dịch

Nhãn hiện tại chỉ ghi "Thời hạn (ngày)" dùng chung cho cả hai loại. Với chiến dịch sinh nhật, con số này là *số ngày voucher sống sau khi khách nhận* — khác hẳn nghĩa "thời gian chiến dịch chạy" mà người đọc dễ hiểu nhầm.

**Files:**
- Modify: `src/components/app/form/campaign-template-fields.tsx:281-305`
- Modify: `src/locales/{vi,en}/campaign.json`

**Interfaces:**
- Consumes: `hasCampaignEndDate` (đã có trong file, dòng 39)

- [ ] **Step 1: Thêm chuỗi i18n**

`src/locales/vi/campaign.json`, bên trong object `template`, sau `"duration"`:

```json
      "durationHintBirthday": "Số ngày voucher có hiệu lực kể từ khi khách nhận. Chiến dịch lặp lại hằng năm, mỗi khách nhận tối đa 1 lần/năm.",
      "durationHintNewUser": "Số ngày voucher có hiệu lực kể từ khi khách đăng ký.",
      "durationHintWithEndDate": "Voucher hiệu lực đến khi chiến dịch kết thúc.",
```

`src/locales/en/campaign.json`, cùng vị trí:

```json
      "durationHintBirthday": "How many days the voucher stays valid after a customer receives it. The campaign repeats every year; each customer receives it at most once a year.",
      "durationHintNewUser": "How many days the voucher stays valid after the customer registers.",
      "durationHintWithEndDate": "The voucher stays valid until the campaign ends.",
```

- [ ] **Step 2: Đọc loại chiến dịch từ form**

Trong `src/components/app/form/campaign-template-fields.tsx`, thêm sau dòng 38 (`const campaignEndDate = ...`):

```ts
  const campaignType = useWatch({ control, name: 'type' })
```

Và thêm import `CAMPAIGN_TYPE` vào dòng import constants:

```ts
import { CAMPAIGN_TYPE, VOUCHER_TYPE, VOUCHER_USAGE_FREQUENCY_UNIT } from '@/constants'
```

- [ ] **Step 3: Tính chú thích**

Ngay sau `calculatedDuration` (sau dòng 47):

```ts
  const durationHintKey = hasCampaignEndDate
    ? 'campaign.template.durationHintWithEndDate'
    : campaignType === CAMPAIGN_TYPE.BIRTHDAY
      ? 'campaign.template.durationHintBirthday'
      : 'campaign.template.durationHintNewUser'
```

- [ ] **Step 4: Hiển thị**

Thêm `FormDescription` vào import từ `@/components/ui`, rồi trong `FormItem` của `template.duration`, chèn ngay trước `<FormMessage />`:

```tsx
              <FormDescription className="text-xs">{t(durationHintKey)}</FormDescription>
```

- [ ] **Step 5: Kiểm tra bằng mắt**

Run: `npm run dev`

Mở sheet tạo chiến dịch:
- Loại "Sinh nhật", không có ngày kết thúc → chú thích nói về "kể từ khi khách nhận" và nhắc lặp lại hằng năm.
- Đổi sang "Người dùng mới" → chú thích đổi sang "kể từ khi khách đăng ký".
- Điền ngày kết thúc → ô Thời hạn bị disable, chú thích đổi sang "Voucher hiệu lực đến khi chiến dịch kết thúc."

- [ ] **Step 6: Commit**

```bash
git add src/components/app/form/campaign-template-fields.tsx src/locales/vi/campaign.json src/locales/en/campaign.json
git commit -m "TaskId: TRE-469 (10) Giải thích thời hạn voucher theo loại chiến dịch"
```

---

## Task 11: Chạy tay chiến dịch sinh nhật

Scheduler chạy cron 00:01 mỗi ngày. Không có nút này thì QA phải sửa `dob` của khách rồi chờ qua đêm mới kiểm tra được.

Endpoint làm **hai** việc: phát phần thưởng và gửi lời chúc. Nhãn phải phản ánh cả hai, nên là "Chạy chiến dịch sinh nhật hôm nay" chứ không phải "Gửi lời chúc".

**Files:**
- Modify: `src/api/user.ts`
- Modify: `src/hooks/use-user.ts`
- Create: `src/components/app/dialog/confirm-run-birthday-campaign-dialog.tsx`
- Modify: `src/components/app/dialog/index.tsx`
- Modify: `src/components/app/tabscontent/system-campaign-management.tabscontent.tsx:142-205`
- Modify: `src/locales/{vi,en}/customer.json`
- Test: `src/tests/api/user.test.ts`

**Interfaces:**
- Produces: `triggerBirthdayCampaign(): Promise<IApiResponse<null>>`; `useTriggerBirthdayCampaign()`; `ConfirmRunBirthdayCampaignDialog()` — không nhận prop, tự render trigger

- [ ] **Step 1: Viết test thất bại**

Trong `src/tests/api/user.test.ts`, thêm `triggerBirthdayCampaign` vào import từ `@/api`, rồi thêm describe mới:

```ts
  describe('triggerBirthdayCampaign', () => {
    it('should post to the birthday trigger endpoint with no body', async () => {
      ;(http.post as Mock).mockResolvedValue({ data: null })

      const result = await triggerBirthdayCampaign()

      expect(http.post).toHaveBeenCalledWith('/user/birthday/trigger')
      expect(result).toBeNull()
    })

    it('should handle server error', async () => {
      ;(http.post as Mock).mockRejectedValue(SERVER_ERROR)
      await expect(triggerBirthdayCampaign()).rejects.toEqual(SERVER_ERROR)
    })
  })
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `npx vitest run src/tests/api/user.test.ts`
Expected: FAIL — `triggerBirthdayCampaign` không tồn tại.

- [ ] **Step 3: Thêm hàm API**

Ở cuối `src/api/user.ts`:

```ts
/**
 * Chạy tay scheduler sinh nhật: phát phần thưởng và gửi lời chúc cho khách
 * có sinh nhật hôm nay theo giờ máy chủ. Quyền: Admin, SuperAdmin.
 */
export async function triggerBirthdayCampaign(): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>('/user/birthday/trigger')
  return response.data
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/api/user.test.ts`
Expected: PASS

- [ ] **Step 5: Thêm hook**

Ở cuối `src/hooks/use-user.ts` (nhớ import `triggerBirthdayCampaign` từ `@/api`):

```ts
export const useTriggerBirthdayCampaign = () => {
  return useMutation({
    mutationFn: () => triggerBirthdayCampaign(),
  })
}
```

Không invalidate query nào — backend không đổi dữ liệu mà màn hình này đang hiển thị.

- [ ] **Step 6: Thêm chuỗi i18n**

`src/locales/vi/customer.json`, bên trong object `birthday`:

```json
      "runCampaign": "Chạy chiến dịch sinh nhật hôm nay",
      "confirmRun": "Chạy chiến dịch sinh nhật hôm nay?",
      "confirmRunDescription": "Hệ thống phát phần thưởng và gửi lời chúc cho tất cả khách có sinh nhật hôm nay theo giờ máy chủ — không theo khoảng ngày đang lọc trên bảng.",
      "runNote1": "Lời chúc gửi qua Zalo OA, không được thì chuyển SMS, kèm email nếu khách có.",
      "runNote2": "Mỗi khách chỉ nhận một lần mỗi năm, nên chạy lại sẽ không gửi trùng.",
      "runNote3": "Đã gửi thì không thu hồi được.",
      "runConfirm": "Chạy ngay",
      "runSuccess": "Đã chạy chiến dịch sinh nhật. Hệ thống đang xử lý danh sách khách sinh nhật hôm nay."
```

`src/locales/en/customer.json`, cùng vị trí:

```json
      "runCampaign": "Run today's birthday campaign",
      "confirmRun": "Run today's birthday campaign?",
      "confirmRunDescription": "The system grants rewards and sends greetings to every customer whose birthday is today by server time — not the date range filtered in the table.",
      "runNote1": "Greetings go through Zalo OA, falling back to SMS, plus email when the customer has one.",
      "runNote2": "Each customer receives it once per year, so running again will not send duplicates.",
      "runNote3": "Once sent, it cannot be recalled.",
      "runConfirm": "Run now",
      "runSuccess": "Birthday campaign started. The system is processing today's birthday list."
```

- [ ] **Step 7: Tạo dialog**

Tạo `src/components/app/dialog/confirm-run-birthday-campaign-dialog.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarHeart } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'
import { useTriggerBirthdayCampaign } from '@/hooks'
import { showToast } from '@/utils'

export default function ConfirmRunBirthdayCampaignDialog() {
  const { t } = useTranslation('customer')
  const { t: tCommon } = useTranslation('common')
  const [isOpen, setIsOpen] = useState(false)
  const { mutate: runCampaign, isPending } = useTriggerBirthdayCampaign()

  const handleConfirm = () => {
    runCampaign(undefined, {
      onSuccess: () => {
        showToast(t('customer.birthday.runSuccess'))
        setIsOpen(false)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarHeart className="mr-2 w-4 h-4" />
          {t('customer.birthday.runCampaign')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[22rem] rounded-md px-6 sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="pb-4 border-b">
            <div className="flex gap-2 items-center text-primary">
              <CalendarHeart className="w-6 h-6" />
              {t('customer.birthday.confirmRun')}
            </div>
          </DialogTitle>
          <div className="flex flex-col gap-3 py-4 text-sm text-muted-foreground">
            <p>{t('customer.birthday.confirmRunDescription')}</p>
            <ul className="flex flex-col gap-1 pl-5 list-disc">
              <li>{t('customer.birthday.runNote1')}</li>
              <li>{t('customer.birthday.runNote2')}</li>
              <li>{t('customer.birthday.runNote3')}</li>
            </ul>
          </div>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {tCommon('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {t('customer.birthday.runConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Dialog bắt buộc vì đây là hành động gửi tin nhắn thật ra ngoài, không hoàn tác được.

- [ ] **Step 8: Export**

Trong `src/components/app/dialog/index.tsx`:

```ts
export { default as ConfirmRunBirthdayCampaignDialog } from './confirm-run-birthday-campaign-dialog'
```

- [ ] **Step 9: Gắn nút và gate quyền**

Trong `src/components/app/tabscontent/system-campaign-management.tabscontent.tsx`:

Thêm import:

```ts
import { ConfirmRunBirthdayCampaignDialog } from '@/components/app/dialog'
import { useUserStore } from '@/stores'
```

Trong `CustomerBirthdayView`, sau dòng `const columns = useUserListColumns()`:

```ts
  const { userInfo } = useUserStore()
  const canRunCampaign =
    userInfo?.role?.name === Role.SUPER_ADMIN || userInfo?.role?.name === Role.ADMIN
```

`Role` đã được import sẵn ở dòng 25.

Trong `BirthdayActionOptions`, thêm ngay sau nút Xuất Excel:

```tsx
          {canRunCampaign && <ConfirmRunBirthdayCampaignDialog />}
```

Và thêm `canRunCampaign` vào mảng dependency của `useMemo` bọc `BirthdayActionOptions`.

- [ ] **Step 10: Kiểm tra**

Run: `npx vitest run src/tests/api/user.test.ts`
Expected: PASS

Run: `npm run dev`

Vào tab Chiến dịch → chuyển sang view "Sinh nhật khách hàng". Với tài khoản Admin hoặc SuperAdmin, nút "Chạy chiến dịch sinh nhật hôm nay" hiện cạnh nút Xuất Excel. Bấm → dialog liệt kê ba lưu ý. Xác nhận → toast thành công.

Đăng nhập bằng tài khoản Manager → nút không hiện, khớp quyền backend.

- [ ] **Step 11: Commit**

```bash
git add src/api/user.ts src/hooks/use-user.ts src/components/app/dialog/confirm-run-birthday-campaign-dialog.tsx src/components/app/dialog/index.tsx src/components/app/tabscontent/system-campaign-management.tabscontent.tsx src/locales/vi/customer.json src/locales/en/customer.json src/tests/api/user.test.ts
git commit -m "TaskId: TRE-469 (11) Thêm nút chạy tay chiến dịch sinh nhật"
```

---

## Task 12: Xóa code chết

Ba file là dấu vết của thiết kế multi-template cũ, không nơi nào import. Xóa trước khi ai đó sửa nhầm chúng thay vì file đang chạy.

**Files:**
- Delete: `src/app/system/campaign/components/campaign-info-form.tsx`
- Delete: `src/app/system/campaign/components/voucher-template-table.tsx`
- Delete: `src/app/system/campaign/components/voucher-template-dialog.tsx`

- [ ] **Step 1: Xác nhận không ai import**

```bash
grep -rn "campaign-info-form\|voucher-template-table\|voucher-template-dialog\|CampaignInfoForm\|VoucherTemplateTable\|VoucherTemplateDialog" src/ --exclude-dir=node_modules
```

Expected: chỉ khớp bên trong chính ba file đó (`voucher-template-table.tsx` import `voucher-template-dialog.tsx`). Không có kết quả nào ở ngoài thư mục `src/app/system/campaign/components/`.

**DỪNG LẠI nếu** có consumer ngoài — khi đó ba file này không chết và không được xóa.

- [ ] **Step 2: Xóa**

```bash
git rm src/app/system/campaign/components/campaign-info-form.tsx \
       src/app/system/campaign/components/voucher-template-table.tsx \
       src/app/system/campaign/components/voucher-template-dialog.tsx
```

- [ ] **Step 3: Kiểm tra build**

Run: `npm run build`
Expected: PASS (lint + tsc + vite build đều sạch)

- [ ] **Step 4: Commit**

```bash
git commit -m "TaskId: TRE-469 (12) Xóa code chết của thiết kế multi-template cũ"
```

---

## Kiểm tra cuối

Sau task 12, chạy đủ bộ trước khi mở PR:

- [ ] `npm run lint` — sạch
- [ ] `npm run test` — xanh
- [ ] `npm run build` — thành công
- [ ] Đối chiếu §10 của spec, đi qua từng tiêu chí trên app đang chạy:
  - Tạo chiến dịch sinh nhật không ngày kết thúc, không giới hạn người nhận → backend trả 201
  - Bảng hiện `—` ở cột ngày kết thúc và "Không giới hạn" ở cột giới hạn
  - Đóng chiến dịch → badge chuyển "Đã đóng", mục Đóng biến mất khỏi menu
  - Xóa chiến dịch đã phát thưởng → toast tiếng Việt kèm hướng dẫn
  - Chạy tay với Admin → thành công; với Manager → không thấy nút
  - Đổi số dòng mỗi trang → có tác dụng thật
