# TRE-469 — Chiến dịch sinh nhật · Design

**Ngày:** 2026-08-11
**Nhánh:** `feature/TRE-469-FE-Add-Birthday-Campaign-Type-to-Campaign-Creation-Flow`
**Phạm vi:** `app/order-ui`
**Demo UI:** https://claude.ai/code/artifact/bd24ee5a-f030-48d4-bc72-97c136d115ee

---

## 1. Bối cảnh

Backend đã merge TRE-465, đổi contract campaign: thêm trục `campaignType` (voucher/gift) bên cạnh trục `type` (new-user/user-birthday) đã có. Chi tiết contract nằm ở `app/order-ui/src/docs/TRE-465-campaign-optional-settings.md`.

Đối chiếu với FE cho thấy chọn loại "Sinh nhật" **đã có sẵn** trong dropdown tạo campaign, nhưng luồng không chạy được end-to-end vì ba nhóm vấn đề:

1. **Contract lệch.** FE chưa gửi `campaignType` (backend bắt buộc), và một số field gửi thừa hoặc sai tên.
2. **Không dừng được.** Chiến dịch sinh nhật đặc trưng là không có `endDate` nên không bao giờ tự đóng. UI hiện chỉ có "Sửa" — không có nút xóa (dù API, hook và i18n đã sẵn) và không có cách đổi trạng thái. Tạo nhầm là kẹt vĩnh viễn.
3. **Không kiểm chứng được.** Scheduler chạy cron 00:01 mỗi ngày. Không có nút chạy tay thì QA phải chờ qua đêm.

Ngoài ra vài lỗi hiển thị rơi đúng vào loại sinh nhật: cột "Ngày kết thúc" không guard null nên hiện `Invalid Date`, và `recipientLimit` bị ép bắt buộc dù backend cho phép trống.

## 2. Mục tiêu

Admin tạo được chiến dịch sinh nhật hoạt động thật, dừng được nó, và QA kiểm chứng được luồng ngay trong ngày.

## 3. Ngoài phạm vi

Ba việc bị chặn bởi backend, không phải bởi thời gian làm:

| Việc | Lý do |
|---|---|
| `giftCampaignTemplate` và UI chọn loại phần thưởng | Backend trả `159912` — chưa migrate schema. `UpdateCampaignRequestDto` cũng chưa có `giftCampaignTemplate` nên tạo xong không sửa được. |
| Màn hình xem ai đã nhận thưởng / đã được chúc | Không có endpoint nào đọc `CampaignRecipient` hay `greetedAt`. |
| Ẩn nút Xóa khi chiến dịch đã phát thưởng | `CampaignResponseDto` không trả số người nhận. Xem §6.3. |

Không đụng tới trong lần này (nợ có sẵn, không phát sinh thêm): đăng ký `ROUTE.STAFF_CAMPAIGN*` vào router, tách `CAMPAIGN_MANAGEMENT` khỏi `VOUCHER_MANAGEMENT`, i18n hóa message lỗi Zod đang hardcode tiếng Việt.

## 4. Giả định và rủi ro

**Giả định chặn:** môi trường dev/staging mà FE đang trỏ tới đã deploy backend nhánh TRE-465.

Nếu chưa, việc thêm `campaignType` sẽ làm POST fail. Đây là rủi ro chặn duy nhất của cả spec. **Bước đầu tiên khi thực thi là smoke-test một lệnh POST kèm `campaignType` để xác nhận**, trước khi làm bất cứ việc gì khác.

**Rủi ro nhỏ:** đổi `hasPrevious` → `hasPrevios` trong `IPaginationResponse` đụng type dùng chung toàn app. Xem §5.4.

---

## 5. Thiết kế — tầng dữ liệu

### 5.1. `src/constants/voucher.ts`

```ts
export enum CAMPAIGN_REWARD_TYPE {
  VOUCHER = 'voucher',
  GIFT = 'gift',
}
```

Khai cả `GIFT` dù chưa dùng — enum phản ánh contract backend, không phản ánh UI. Khi backend migrate xong chỉ cần render thêm một option.

**Không** thêm `UNLIMITED` vào `VOUCHER_USAGE_FREQUENCY_UNIT`. Bản nháp spec có mục này, nhưng kiểm tra cho thấy `'unlimited'` đang được cast thủ công (`as unknown as VOUCHER_USAGE_FREQUENCY_UNIT`) ở ba sheet của tính năng voucher — `create-voucher-sheet`, `update-voucher-sheet`, `create-multiple-voucher-sheet`. Dọn nó là đụng vào code voucher đang chạy, không phục vụ mục tiêu của TRE-469. Để lại làm nợ riêng.

### 5.2. `src/types/campaign.type.ts`

| Thay đổi | Lý do |
|---|---|
| `ICreateCampaignRequest` thêm `campaignType: CAMPAIGN_REWARD_TYPE` | Backend bắt buộc |
| `ICreateCampaignRequest.recipientLimit?: number` | Optional = không giới hạn |
| `IUpdateCampaignRequest` → `{ slug: string } & Partial<...>`, thêm `status?: CAMPAIGN_STATUS`, **bỏ `type`** | Khớp `UpdateCampaignRequestDto`; cho phép gửi payload tối thiểu khi chỉ đổi trạng thái |
| `ICampaign.recipientLimit?: number` | Response optional |
| `ICampaign.voucherCampaignTemplate?: ICampaignVoucherTemplateResponse` | Response optional — chiến dịch gift sẽ không có field này |
| `ICampaignVoucherTemplate` bỏ `startDate` / `endDate` | Không có trong `CreateVoucherCampaignTemplateDto` |
| `IGetCampaignRequestParams`: `limit` → `size`, bỏ `startDate` / `endDate`, `sort?: string[]` | Khớp `GetAllCampaignQueryRequestDto` |

Việc chuyển `voucherCampaignTemplate` sang optional sẽ làm TypeScript báo lỗi ở `campaign-info-sheet.tsx` và `update-campaign-sheet.tsx`. **Đó là kết quả mong muốn** — nó chỉ đúng chỗ cần guard. Xử lý bằng optional chaining và giá trị mặc định, không dùng `!` để bịt.

### 5.3. `src/api/campaign.ts`

Giữ nguyên 6 hàm, chỉ kiểu request thay đổi. `updateCampaign` vẫn gửi cả `slug` trong body — vô hại, không sửa.

### 5.4. `src/types/base.type.ts`

Backend trả `hasPrevios` (thiếu chữ `u`), FE khai `hasPrevious` nên field này luôn `undefined`.

Vì đây là type dùng chung toàn app, **không đổi tên cứng**. Thêm `hasPrevios: boolean` và giữ `hasPrevious?: boolean` với chú thích deprecated. Grep các consumer hiện tại; nếu không có ai đọc `hasPrevious` thì xóa luôn trong cùng commit.

### 5.5. Birthday trigger

`src/api/user.ts`:

```ts
export async function triggerBirthdayCampaign(): Promise<IApiResponse<null>>
// POST /user/birthday/trigger — không body
```

`src/hooks/use-user.ts`: `useTriggerBirthdayCampaign()` — mutation, không invalidate query nào (backend không đổi dữ liệu FE đang hiển thị).

### 5.6. `src/schemas/campaign.schema.ts`

- `recipientLimit`: `z.number().int().positive().optional()`. Ô trống trong form phải được chuyển thành `undefined` ngay ở `onChange` — lưu ý `Number('')` bằng `0`, không phải `NaN`, nên ô trống sẽ trượt validate `positive` nếu chuyển kiểu thẳng.
- Thêm `campaignCreateFormSchema` = `campaignFormSchema` + refine `startDate` phải **lớn hơn thời điểm hiện tại**, so cả giờ chứ không chỉ ngày. Chỉ create sheet dùng bản này; update sheet giữ `campaignFormSchema` (xem §6.2).
- `duration`: giữ `.int().min(0)`. Giá trị `0` là cần thiết cho trạng thái trung gian khi `campaign-template-fields` tự tính và disable ô lúc có `endDate`; refine sẵn có đã đảm bảo `> 0` khi không có `endDate`.
- Bỏ `startDate` / `endDate` khỏi `campaignVoucherTemplateSchema`.

---

## 6. Thiết kế — tầng giao diện

### 6.1. Tạo chiến dịch — `create-campaign-sheet.tsx`

- `recipientLimit`: bỏ dấu `*`, bỏ giá trị mặc định `100`, placeholder "Không giới hạn".
- Payload thêm `campaignType: CAMPAIGN_REWARD_TYPE.VOUCHER` (hằng số, không render selector). Bỏ hẳn key `recipientLimit` khi ô trống, không gửi `null`.
- `disableStartDate` hiện chỉ so theo ngày. Picker bật `showTime` nên vẫn chọn được giờ đã qua trong hôm nay → thêm chặn theo giờ.

### 6.2. Sửa chiến dịch — `update-campaign-sheet.tsx`

- Bỏ `type` khỏi payload. Select vẫn hiển thị và vẫn `disabled` — chỉ để xem.
- Guard `voucherCampaignTemplate` optional khi đổ dữ liệu vào form.

**Không** áp luật "ngày bắt đầu phải ở tương lai" cho màn hình sửa. Bản nháp spec có mục này và nó sai: chiến dịch đang chạy luôn có `startDate` trong quá khứ, chặn ngày quá khứ sẽ làm không lưu được bất kỳ thay đổi nào. Backend cũng chỉ kiểm luật này ở `POST`. Vì hai sheet dùng chung `campaignFormSchema`, luật phải nằm ở một schema riêng chỉ create sheet dùng — xem §5.6.

### 6.3. Bảng danh sách — `DataTable/columns/index.tsx`

- Cột `endDate`: null → `—`, dùng lại đúng cách `campaign-info-sheet.tsx` đang làm.
- Cột `recipientLimit`: null/undefined → "Không giới hạn".

### 6.4. Hành động trên từng dòng — `DataTable/columns/campaign-actions.tsx`

| Hành động | Điều kiện hiện | Gọi |
|---|---|---|
| Sửa (đã có) | luôn | `UpdateCampaignSheet` |
| **Đóng chiến dịch** | `status !== 'closed'` | PATCH `{ slug, status: 'closed' }` |
| **Xóa** | luôn | DELETE, bắt `159909` |

Đặt tên là **"Đóng chiến dịch"** chứ không phải "Kết thúc", để cặp động từ/trạng thái khớp nhau: *Đóng* dẫn tới *Đã đóng*, dùng lại đúng nhãn `statuses.closed` đã có.

Hai dialog mới theo convention sẵn có (`confirm-*-campaign-dialog.tsx`):
- `confirm-close-campaign-dialog.tsx`
- `confirm-delete-campaign-dialog.tsx`

**Vì sao nút Xóa luôn hiện.** Doc TRE-465 mục 6.6 khuyên ẩn hoặc disable nút xóa khi chiến dịch đã có người nhận. Không làm được: `CampaignResponseDto` không trả số recipient, FE không có cách nào biết trước. Nên thiết kế là luôn hiện nút, gọi API, và bắt `159909` để báo lỗi tử tế kèm hướng dẫn dùng "Đóng chiến dịch" thay thế. Nếu muốn đúng như doc thì cần backend thêm `recipientCount` vào response.

### 6.5. Chú thích Thời hạn — `campaign-template-fields.tsx`

Đọc `type` từ form context, đổi chú thích dưới ô `duration`:

| Trạng thái | Nội dung |
|---|---|
| `user-birthday` | Số ngày voucher có hiệu lực kể từ khi khách nhận. Chiến dịch lặp lại hằng năm, mỗi khách nhận tối đa 1 lần/năm. |
| `new-user` | Số ngày voucher có hiệu lực kể từ khi khách đăng ký. |
| Có `endDate` (ô disabled) | Voucher hiệu lực đến khi chiến dịch kết thúc. |

Giữ nguyên ô `endDate` cho cả hai loại — backend chấp nhận, không ép luật chặt hơn backend.

### 6.6. Chạy tay chiến dịch sinh nhật

Đặt trong `BirthdayActionOptions` của `CustomerBirthdayView` (`system-campaign-management.tabscontent.tsx`), cạnh nút Xuất Excel.

Gate theo `userInfo?.role?.name ∈ { SUPER_ADMIN, ADMIN }`, khớp quyền backend — Manager không thấy nút.

Nhãn: **"Gửi lời chúc sinh nhật hôm nay"**.

> **Đính chính.** Bản nháp spec khẳng định endpoint làm hai việc — phát thưởng *và* gửi lời chúc — và vì thế đặt nhãn là "Chạy chiến dịch sinh nhật hôm nay". **Sai.** Review tổng thể cuối cùng đã đối chiếu source và chứng minh ngược lại:
> - `user.controller.ts:54-58` — endpoint gọi `UserScheduler.BirthdayStrategyScheduler()`; chính `@ApiOperation` của nó ghi *"Manually run the birthday **greeting** scheduler"*.
> - `user.scheduler.ts:240-251` — scheduler này gọi `findBirthdayRecipient(campaign, user, year)` và **bỏ qua** mọi khách chưa có `CampaignRecipient` của năm nay.
> - Việc phát thưởng nằm ở `campaign.scheduler.ts:53` — `@Cron(EVERY_DAY_AT_1AM) handleBirthdayCampaigns()`, **không có endpoint nào gọi được**.
>
> Hệ quả cho mục tiêu §2: QA **không** kiểm chứng được luồng phát thưởng trong ngày từ giao diện. Chỉ luồng gửi lời chúc là kiểm chứng được, và chỉ với khách đã được phát thưởng từ trước. Xem §11 mục 5.

Dialog xác nhận bắt buộc, vì đây là hành động gửi tin nhắn thật ra ngoài. Nội dung phải nói rõ bốn điều:
- Chạy theo **ngày hôm nay ở máy chủ**, không theo khoảng ngày đang lọc trên bảng.
- Gửi qua Zalo OA, không được thì chuyển SMS; kèm email nếu khách có.
- Mỗi khách chỉ được chúc một lần mỗi năm nên chạy lại không gửi trùng; đã gửi thì không thu hồi.
- **Khách chưa được phát thưởng trong năm nay sẽ bị bỏ qua** — phát thưởng là việc của lịch 1h sáng, không chạy tay được.

### 6.7. Dọn code chết

Xóa ba file không nơi nào import, là dấu vết của thiết kế multi-template cũ (~950 dòng):

- `app/system/campaign/components/campaign-info-form.tsx`
- `app/system/campaign/components/voucher-template-table.tsx`
- `app/system/campaign/components/voucher-template-dialog.tsx`

Xác nhận bằng grep trước khi xóa.

---

## 7. Xử lý lỗi

`src/utils/toast.ts` đã map sẵn `159908`. Bổ sung phần còn lại của dải theo đúng pattern đó, kèm bản dịch vi/en trong `toast.json`:

| Mã | Nội dung tiếng Việt |
|---|---|
| 159901 | Không tìm thấy chiến dịch |
| 159902 | Không tìm thấy nhóm voucher |
| 159903 | Không tìm thấy sản phẩm áp dụng |
| 159906 | Ngày kết thúc phải sau ngày bắt đầu |
| 159907 | Trạng thái không khớp với mốc thời gian của chiến dịch |
| 159909 | Chiến dịch đã phát phần thưởng cho khách nên không xóa được. Dùng "Đóng chiến dịch" để ngừng phát thưởng. |
| 159910 | Thiếu mẫu phần thưởng cho loại chiến dịch này |
| 159911 | Mẫu phần thưởng không khớp loại chiến dịch |
| 159912 | Chiến dịch quà tặng chưa khả dụng |

Bỏ qua `159904` và `159905` — lỗi nội bộ của scheduler, admin không gây ra được từ giao diện.

Riêng `159909` phải hiển thị được ở dạng có hướng dẫn thay thế, không chỉ một câu mô tả lỗi.

## 8. Chuỗi hiển thị

`campaign.json` (vi + en): `closeCampaign`, `confirmClose`, `confirmCloseDescription`, `closeNote1`, `closeNote2`, `closeSuccess`, `recipientLimitUnlimited`, `template.durationHintBirthday`, `template.durationHintNewUser`, `template.durationHintWithEndDate`.

`customer.json` (vi + en): `birthday.runCampaign`, `birthday.confirmRun`, `birthday.confirmRunDescription`, `birthday.runNote1`, `birthday.runNote2`, `birthday.runNote3`, `birthday.runConfirm`, `birthday.runSuccess`.

Khóa xóa chiến dịch (`deleteCampaign`, `confirmDelete`, `deleteSuccess`) đã có sẵn từ trước, không cần thêm.

## 9. Kiểm thử

`src/tests/api/campaign.test.ts` assert chính xác path và payload nên **sẽ vỡ** khi đổi contract. Cập nhật trong cùng commit với thay đổi tương ứng, không để dồn.

Bổ sung:
- Test API cho `triggerBirthdayCampaign` — đúng path, không body.
- Test schema: `recipientLimit` trống hợp lệ; `startDate` trong quá khứ (kể cả cùng ngày nhưng giờ đã qua) bị chặn.
- Test build payload create: có `campaignType`, không có key `recipientLimit` khi ô trống.

## 10. Tiêu chí hoàn thành

- Tạo được chiến dịch sinh nhật không `endDate`, không `recipientLimit` → backend trả 201.
- Chiến dịch đó hiện trong bảng với cột "Ngày kết thúc" là `—` và cột giới hạn là "Không giới hạn".
- Bấm "Đóng chiến dịch" → trạng thái chuyển sang "Đã đóng".
- Bấm "Xóa" trên chiến dịch đã phát thưởng → toast tiếng Việt kèm hướng dẫn, không phải message tiếng Anh thô.
- Bấm "Chạy chiến dịch sinh nhật hôm nay" với vai trò Admin → backend nhận; với vai trò Manager → không thấy nút.
- Đổi số dòng mỗi trang ở danh sách → có tác dụng thật.
- `npm run build` và `npm run test` xanh.

## 11. Cần backend làm rõ

1. Xác nhận môi trường dev/staging đã deploy TRE-465 (§4). *Đã tự xác minh từ source `app/order-api` — contract khớp.*
2. `recipientCount` trong `CampaignResponseDto` — cần để ẩn nút Xóa đúng như doc mục 6.6 khuyến nghị.
3. Endpoint đọc `CampaignRecipient` / `greetedAt` — cần để làm màn hình theo dõi kết quả chiến dịch.
4. Khi nào gift campaign migrate xong, để mở nhánh `campaignType = gift`.
5. **Endpoint chạy tay `CampaignScheduler.handleBirthdayCampaigns` — ưu tiên cao nhất.** Không có nó thì mục tiêu "QA kiểm chứng được trong ngày" của §2 không đạt cho luồng phát thưởng: QA vẫn phải chờ cron 1h sáng. Endpoint `/user/birthday/trigger` hiện có chỉ gửi lời chúc cho khách đã được phát thưởng từ trước (§6.6).
