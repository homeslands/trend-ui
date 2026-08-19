# TRE-465 — Optional Settings in Campaign · Tài liệu tích hợp UI

> Tài liệu mô tả logic backend của tính năng **Campaign (chiến dịch) với template phần thưởng linh hoạt** (voucher / gift) và luồng **chúc mừng sinh nhật đa kênh**. Dùng để FE tích hợp đúng theo hành vi backend.
>
> Nhánh: `features/TRE-465-Optional-setting-in-campaign`
> Base URL ví dụ: `/campaign`, `/user`

---

## 1. Tổng quan khái niệm

Một **Campaign** gồm 2 trục độc lập:

| Trục | Field | Ý nghĩa |
|------|-------|---------|
| **Khi nào chạy / đối tượng** | `type` (`CampaignType`) | Trigger của chiến dịch: khách mới hay sinh nhật |
| **Phần thưởng trao gì** | `campaignType` (`CampaignRewardType`) | Loại phần thưởng: voucher hay quà (gift) |

Mỗi loại phần thưởng **bắt buộc đi kèm đúng 1 template con** tương ứng, không được lẫn:
- `campaignType = voucher` → phải có `voucherCampaignTemplate`, **cấm** `giftCampaignTemplate`.
- `campaignType = gift` → phải có `giftCampaignTemplate`, **cấm** `voucherCampaignTemplate`.

### Enums

**`CampaignType`** (trigger):
| Value | Ý nghĩa |
|-------|---------|
| `new-user` | Kích hoạt khi khách mới được tạo (một lần / user) |
| `user-birthday` | Kích hoạt vào sinh nhật khách (mỗi năm 1 lần / user) |

**`CampaignRewardType`** (`campaignType` trong body):
| Value | Ý nghĩa |
|-------|---------|
| `voucher` | Trao voucher |
| `gift` | Trao quà tặng (⚠️ xem mục 6 — có giới hạn hiện tại) |

**`CampaignStatus`**:
| Value | Ý nghĩa |
|-------|---------|
| `scheduled` | Đã lên lịch, chưa tới `startDate` |
| `opening` | Đang chạy (đã qua `startDate`, chưa qua `endDate`) |
| `closed` | Đã kết thúc |

> Khi tạo mới, backend luôn ép `status = scheduled` (bỏ qua giá trị FE gửi).

**Enums voucher template** (dùng trong `voucherCampaignTemplate`):
- `VoucherType`: `percent_order`, `fixed_value`, `same_price_product`
- `VoucherApplicabilityRule`: `all_required`, `at_least_one_required`
- `VoucherUsageFrequencyUnit`: `hour`, `day`, `week`, `month`, `year`, `unlimited`
- `PaymentMethod` (mảng `paymentMethods`): `bank-transfer`, `cash`, `point`, `credit-card`

---

## 2. Response envelope chung

Mọi endpoint bọc kết quả trong envelope:

```json
{
  "message": "…",
  "statusCode": 200,
  "timestamp": "2026-08-11T10:00:00.000Z",
  "result": { }
}
```

Endpoint phân trang: `result` là:
```json
{
  "hasNext": true,
  "hasPrevios": false,
  "items": [ ],
  "total": 42,
  "page": 1,
  "pageSize": 10,
  "totalPages": 5
}
```
> Lưu ý field viết là `hasPrevios` (thiếu chữ `u`) — theo đúng backend.

Mọi response object đều kế thừa `BaseResponseDto`, tức luôn có thêm:
- `slug: string`
- `createdAt: string`

---

## 3. Danh sách Endpoints

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/campaign/keys` | Public | Lấy danh sách key của `CampaignType` |
| POST | `/campaign` | Manager, Admin, SuperAdmin | Tạo campaign |
| GET | `/campaign` | Manager, Admin, SuperAdmin | Danh sách campaign (filter + paging) |
| GET | `/campaign/:slug` | Manager, Admin, SuperAdmin | Chi tiết theo slug |
| PATCH | `/campaign/:slug` | Manager, Admin, SuperAdmin | Cập nhật |
| DELETE | `/campaign/:slug` | Manager, Admin, SuperAdmin | Xóa |
| POST | `/user/birthday/trigger` | Admin, SuperAdmin | Chạy tay scheduler chúc sinh nhật (dùng để test) |

Tất cả (trừ `/campaign/keys`) yêu cầu Bearer token.

---

## 4. Chi tiết từng endpoint

### 4.1. GET `/campaign/keys` — Public

Trả về danh sách `CampaignType` để đổ vào dropdown chọn loại trigger.

**Response `result`:**
```json
[
  { "key": "new-user" },
  { "key": "user-birthday" }
]
```

---

### 4.2. POST `/campaign` — Tạo campaign

**Request body (`CreateCampaignRequestDto`):**

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|:-------:|---------|
| `name` | string | ✅ | Tên campaign |
| `type` | `CampaignType` | ✅ | `new-user` \| `user-birthday` |
| `campaignType` | `CampaignRewardType` | ✅ | `voucher` \| `gift` — quyết định template nào bắt buộc |
| `voucherGroupSlug` | string | ⚠️ | Khai báo `IsOptional` nhưng backend **luôn tra cứu và bắt buộc tồn tại** → thực tế phải gửi |
| `startDate` | Date (ISO) | ✅ | **Phải > thời điểm hiện tại** |
| `endDate` | Date (ISO) | ❌ | Nếu có, **phải > `startDate`** |
| `recipientLimit` | number ≥ 1 | ❌ | Giới hạn tổng số người nhận. Bỏ trống = không giới hạn |
| `voucherCampaignTemplate` | object | Tùy `campaignType` | Bắt buộc khi `campaignType = voucher` |
| `giftCampaignTemplate` | object | Tùy `campaignType` | Bắt buộc khi `campaignType = gift` |

**`voucherCampaignTemplate` (`CreateVoucherCampaignTemplateDto`):**

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|:-------:|---------|
| `title` | string | ✅ | |
| `description` | string | ❌ | |
| `duration` | number ≥ 1 | Điều kiện | Số ngày hiệu lực voucher. **Bắt buộc khi campaign KHÔNG có `endDate`**; nếu có `endDate` backend tự ép `duration = null` |
| `value` | number | ✅ | Giá trị giảm |
| `type` | `VoucherType` | ❌ | |
| `maxUsage` | number ≥ 1 | ✅ | Số lần dùng tối đa |
| `minOrderValue` | number ≥ 0 | ❌ | |
| `applicabilityRule` | `VoucherApplicabilityRule` | ✅ | |
| `usageFrequencyUnit` | `VoucherUsageFrequencyUnit` | ✅ | |
| `usageFrequencyValue` | number ≥ 1 | ❌ | |
| `maxItems` | number ≥ 1 | ❌ | |
| `paymentMethods` | string[] | ❌ | Mỗi phần tử ∈ `PaymentMethod` |
| `productSlugs` | string[] | ❌ | Slug sản phẩm; backend validate tất cả phải tồn tại |

**`giftCampaignTemplate` (`CreateGiftCampaignTemplateDto`):**

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|:-------:|---------|
| `title` | string | ✅ | |
| `description` | string | ❌ | |
| `duration` | number ≥ 1 | Điều kiện | Cùng quy tắc `duration` như voucher (bắt buộc khi không có `endDate`) |

**Quy tắc validate (thứ tự backend kiểm tra):**
1. Template khớp `campaignType` (đúng template, không lẫn) — sai → `159910` hoặc `159911`.
2. `voucherGroupSlug` phải tồn tại — sai → `159902`.
3. `startDate` phải ở tương lai — sai → `159907`.
4. Nếu có `endDate`: `endDate > startDate` — sai → `159906`.
5. Nếu không có `endDate`: `duration` của template bắt buộc — thiếu → `159908`.
6. `productSlugs` (nếu có) phải tồn tại hết — sai → `159903`.

**Ví dụ — campaign sinh nhật trao voucher, không có endDate:**
```json
{
  "name": "Quà sinh nhật 2026",
  "type": "user-birthday",
  "campaignType": "voucher",
  "voucherGroupSlug": "vg-birthday-2026",
  "startDate": "2026-09-01 00:00:00",
  "recipientLimit": 1000,
  "voucherCampaignTemplate": {
    "title": "Giảm 15% sinh nhật",
    "duration": 30,
    "value": 15,
    "type": "percent_order",
    "maxUsage": 1,
    "minOrderValue": 0,
    "applicabilityRule": "all_required",
    "usageFrequencyUnit": "unlimited",
    "productSlugs": []
  }
}
```

**Response `result`:** `CampaignResponseDto` (xem mục 5), HTTP `201`.

---

### 4.3. GET `/campaign` — Danh sách

**Query params (`GetAllCampaignQueryRequestDto`):**

| Param | Kiểu | Default | Ghi chú |
|-------|------|---------|---------|
| `type` | `CampaignType` | — | Filter theo trigger |
| `status` | `CampaignStatus` | — | Filter theo trạng thái |
| `hasPaging` | boolean | `true` | `false` = trả toàn bộ, không phân trang |
| `page` | number ≥ 1 | 1 | |
| `size` | number ≥ 1 | 10 | |
| `sort` | string[] | `[]` | ví dụ `createdAt:desc` |

Sắp xếp mặc định: `createdAt DESC`.

**Response `result`:** object phân trang, `items` là mảng `CampaignResponseDto`.
> Khi `hasPaging=false`: `page=1`, `pageSize=total`.

---

### 4.4. GET `/campaign/:slug` — Chi tiết

Không tìm thấy → `159901`.
**Response `result`:** `CampaignResponseDto`.

---

### 4.5. PATCH `/campaign/:slug` — Cập nhật

**Request body (`UpdateCampaignRequestDto`)** — tất cả optional:

| Field | Kiểu | Ghi chú |
|-------|------|---------|
| `name` | string | |
| `status` | `CampaignStatus` | Có ràng buộc theo ngày (xem dưới) |
| `recipientLimit` | number ≥ 1 | |
| `startDate` | Date | |
| `endDate` | Date | |
| `voucherGroupSlug` | string | Nếu gửi, phải tồn tại → không thì `159902` |
| `voucherCampaignTemplate` | `UpdateVoucherCampaignTemplateDto` | Mọi field optional; merge vào template hiện có, hoặc tạo mới nếu chưa có |

> ⚠️ `UpdateCampaignRequestDto` **không có** `giftCampaignTemplate` — hiện chỉ cập nhật được template voucher.

**Quy tắc validate khi update:**
- Backend tính `effectiveStartDate`/`effectiveEndDate` = giá trị mới (nếu gửi) hoặc giá trị cũ.
- `effectiveEndDate <= effectiveStartDate` → `159906`.
- Chuyển `status = opening` nhưng `effectiveStartDate` còn ở tương lai → `159907`.
- Chuyển `status = scheduled` nhưng `effectiveStartDate` đã ở quá khứ → `159907`.
- Về `duration`:
  - Nếu có `endDate` (mới hoặc cũ) → `duration` bị ép `null`.
  - Nếu không có `endDate` mà `duration` (mới hoặc hiện có) rỗng → `159908`.
- `productSlugs` (nếu gửi) phải tồn tại hết → không thì `159903`.

**Response `result`:** `CampaignResponseDto`, HTTP `200`.

---

### 4.6. DELETE `/campaign/:slug` — Xóa

- Không tìm thấy → `159901`.
- **Nếu campaign đã có recipient (đã phát phần thưởng cho user)** → **không cho xóa** → `159909`.
- Nếu có `voucherCampaignTemplate` sẽ bị xóa kèm.

**Response:** envelope không có `result`, HTTP `200`.

---

### 4.7. POST `/user/birthday/trigger` — Chạy tay scheduler (test)

Không có body. Kích hoạt ngay job quét & gửi lời chúc sinh nhật (bình thường chạy tự động theo lịch). Quyền: Admin, SuperAdmin.

**Response:** envelope không có `result`, HTTP `200`.

---

## 5. `CampaignResponseDto` (shape trả về)

```jsonc
{
  "slug": "campaign-abc",          // từ BaseResponseDto
  "createdAt": "2026-08-11T...",   // từ BaseResponseDto
  "name": "Quà sinh nhật 2026",
  "type": "user-birthday",         // CampaignType
  "status": "scheduled",           // CampaignStatus
  "recipientLimit": 1000,          // optional
  "startDate": "2026-09-01T00:00:00.000Z",
  "endDate": null,                 // optional
  "voucherGroup": {                // optional
    "slug": "vg-birthday-2026",
    "title": "Nhóm voucher SN"
  },
  "voucherCampaignTemplate": {     // optional — chỉ khi campaignType=voucher
    "slug": "...", "createdAt": "...",
    "title": "Giảm 15% sinh nhật",
    "description": null,
    "duration": 30,
    "value": 15,
    "type": "percent_order",
    "maxUsage": 1,
    "minOrderValue": 0,
    "applicabilityRule": "all_required",
    "usageFrequencyUnit": "unlimited",
    "usageFrequencyValue": null,
    "maxItems": null,
    "paymentMethods": [],          // mặc định [] nếu null
    "productSlugs": []             // mặc định [] nếu null
  },
  "giftCampaignTemplate": {        // optional — chỉ khi campaignType=gift
    "slug": "...", "createdAt": "...",
    "title": "Quà tặng SN",
    "description": null,
    "duration": 30
  }
}
```

> **Cách FE suy ra loại phần thưởng:** response **không có** field `campaignType`. Xác định bằng template nào tồn tại:
> - có `voucherCampaignTemplate` → reward là voucher.
> - có `giftCampaignTemplate` → reward là gift.

---

## 6. Ràng buộc & lưu ý quan trọng cho UI

1. **Template ↔ campaignType phải khớp tuyệt đối.** Form nên ẩn/hiện block template theo `campaignType` đang chọn và chỉ gửi đúng 1 template.
2. **`voucherGroupSlug` thực tế bắt buộc** dù khai báo optional — luôn yêu cầu người dùng chọn voucher group.
3. **Mối quan hệ `endDate` ↔ `duration`:**
   - Có `endDate` → không cần nhập `duration` (backend tự set null). Nên disable/ẩn ô `duration`.
   - Không có `endDate` → **bắt buộc** nhập `duration` (số ngày voucher/gift hiệu lực).
4. **`startDate` phải ở tương lai** khi tạo mới. Validate phía FE để tránh `159907`.
5. **Chuyển status thủ công** (`opening`/`scheduled`) phải nhất quán với mốc thời gian, nếu không sẽ bị `159907`.
6. **Không xóa được campaign đã phát phần thưởng** (`159909`) — nên ẩn/disable nút xóa khi campaign đã có recipient.
7. **Update chưa hỗ trợ `giftCampaignTemplate`** — UI update gift template chưa khả dụng ở BE.
8. **Gift campaign có thể bị chặn ở runtime.** Có mã lỗi `159912` "Gift campaigns are not available yet (pending schema migration)". Nếu môi trường chưa migrate, luồng phát quà gift có thể chưa hoạt động — cần xác nhận với BE trước khi bật UI gift.

---

## 7. Luồng chạy tự động (context — FE không gọi trực tiếp)

Để FE hiểu hành vi hệ thống phía sau:

- **New user:** khi khách mới (role `Customer`) được tạo → hệ thống quét các campaign `new-user` đang `opening` và trong khoảng thời gian, kiểm tra eligibility (mỗi user 1 lần, chưa vượt `recipientLimit`) rồi phát phần thưởng.
- **Sinh nhật:** scheduler định kỳ (hoặc gọi tay qua `/user/birthday/trigger`) quét khách có sinh nhật hôm nay:
  - **Flow 1 (phát thưởng):** tạo `CampaignRecipient` cho user theo `year` hiện tại (unique theo `campaign + user + year` → mỗi năm 1 lần).
  - **Flow 2 (gửi lời chúc):** gửi tin nhắn đa kênh (**Zalo OA → fallback SMS**) và **email** (nếu user có email). Việc gửi được "claim" bằng `greetedAt` để đảm bảo **mỗi user chỉ được chúc 1 lần/năm** kể cả khi có race; nếu provider từ chối thì release để retry.
- **Eligibility:**
  - `user-birthday`: chặn nếu đã là recipient trong `year` hiện tại.
  - `new-user`: chặn nếu đã từng là recipient.
  - Cả hai: chặn nếu tổng recipient ≥ `recipientLimit`.

---

## 8. Bảng mã lỗi (`CampaignValidation`, dải 159901–159912)

| Code | Key | Message |
|------|-----|---------|
| 159901 | `CAMPAIGN_NOT_FOUND` | Campaign not found |
| 159902 | `CAMPAIGN_VOUCHER_GROUP_NOT_FOUND` | Voucher group not found |
| 159903 | `CAMPAIGN_PRODUCT_NOT_FOUND` | Product not found |
| 159904 | `CAMPAIGN_EXECUTION_ERROR` | Error executing campaign strategy |
| 159905 | `UNSUPPORTED_CAMPAIGN_TYPE` | Unsupported campaign type |
| 159906 | `CAMPAIGN_INVALID_DATE_RANGE` | endDate must be after startDate |
| 159907 | `CAMPAIGN_INVALID_STATUS_TRANSITION` | Campaign status does not match its date range |
| 159908 | `CAMPAIGN_DURATION_REQUIRED_WITHOUT_END_DATE` | duration is required when campaign has no endDate |
| 159909 | `CAMPAIGN_HAS_VOUCHERS` | Cannot delete campaign that already has vouchers created |
| 159910 | `CAMPAIGN_TEMPLATE_REQUIRED_FOR_TYPE` | The concrete template required by this campaignType is missing |
| 159911 | `CAMPAIGN_TEMPLATE_TYPE_MISMATCH` | The provided template does not match the campaignType |
| 159912 | `CAMPAIGN_GIFT_NOT_YET_SUPPORTED` | Gift campaigns are not available yet (pending schema migration) |
