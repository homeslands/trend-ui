# Thiết kế lại trang giỏ hàng `/cart` — TRE-466

Ngày: 2026-08-03
Branch: `feature/TRE-466-FE-Optimize-Web-Shopping-Cart-UX-and-Performance`
UI tham chiếu (chốt): https://claude.ai/code/artifact/8440caa7-8bf2-49b2-9b26-c62a9cc5537d

## 1. Bối cảnh

`src/app/client/cart/page.tsx` dài 723 dòng, chứa hai nhánh JSX gần như trùng nhau cho mobile và desktop, rẽ nhánh bằng `useIsMobile()`. Đợt rà soát ngày 2026-08-03 tìm ra 4 lỗi P0 (sai tiền hoặc sai dữ liệu đơn), 7 lỗi P1 và 8 vấn đề P2. Phần lớn bắt nguồn từ chính việc nhân đôi nhánh: logic hiển thị giá và điều kiện chặn đặt hàng đã trôi lệch nhau giữa hai nhánh.

Mục tiêu: sửa dứt điểm nhóm lỗi tiền bạc, gộp về một cây responsive duy nhất, và áp bản UI đã chốt.

## 2. Phạm vi

**Trong phạm vi**

- `src/app/client/cart/` — viết lại `page.tsx` thành các component con.
- `src/utils/cart.ts` — sửa cách tra cứu giá theo dòng.
- `src/stores/order-flow.store.ts` — `setOrderingType`, `addOrderingProductVariant`, guard rehydrate.
- `src/components/app/select/product-variant-select.tsx`, `order-type-select.tsx`, `table-select.tsx`.
- `src/components/app/button/quantity-selector.tsx`, `src/components/app/input/cart-note-input.tsx`.
- `src/components/app/dialog/create-order-dialog.tsx` — chỉ phần tính tiền và spinner.
- `src/app/layouts/client/ClientLayout.tsx`, `client-layout-public.tsx`, `client-detail-layout.tsx` — chỉ dòng ghi bàn từ query param.

**Ngoài phạm vi**

- Trang `/payment` và luồng thanh toán.
- Màn cập nhật đơn của nhân viên (`updatingData`).
- Thay đổi hợp đồng API. Mọi sửa đổi là client-side.
- Bỏ store cũ `cart.store.ts` (chỉ sửa đúng chỗ ghi bàn, không migrate toàn bộ).

## 3. Kiến trúc component

Thay một file 723 dòng bằng:

```
src/app/client/cart/
├── page.tsx                    # ~120 dòng: bố cục + ghép các phần
├── components/
│   ├── order-type-tabs.tsx     # tab chọn hình thức nhận hàng
│   ├── fulfillment-fields.tsx  # bàn / giờ lấy / địa chỉ + SĐT theo loại đơn
│   ├── cart-item-row.tsx       # một dòng sản phẩm
│   ├── cart-voucher.tsx        # ô ưu đãi
│   ├── cart-summary.tsx        # khối tổng thanh toán
│   ├── cart-actions.tsx        # nút đặt hàng + danh sách "còn thiếu"
│   ├── cart-empty.tsx          # trạng thái rỗng
│   ├── cart-error.tsx          # error boundary nội bộ trang
│   └── map-address-selector.tsx # giữ nguyên, chỉ chỉnh phần nhập liệu
└── hooks/
    ├── use-cart-pricing.ts     # memo hoá giá theo dòng + tổng
    └── use-cart-blockers.ts    # danh sách điều kiện còn thiếu
```

Nguyên tắc: `page.tsx` không chứa biểu thức tính giá nào. Mọi con số đến từ `useCartPricing()`.

## 4. Logic

### 4.1 Giá tra theo `item.id`

`calculateCartItemDisplay` giữ nguyên đầu ra nhưng bổ sung một hàm mới:

```ts
export function buildDisplayItemMap(displayItems: IDisplayCartItem[]): Map<string, IDisplayCartItem>
```

Khoá là `item.id` (định danh dòng), không phải `item.slug` (định danh sản phẩm). Mọi chỗ đang dùng `displayItems.find(di => di.slug === item.slug)` chuyển sang `map.get(item.id)`.

Điều kiện tiên quyết: `calculateCartItemDisplay` phải giữ nguyên `id` khi map — hiện đã có qua spread `...item`.

### 4.2 Phí giao hàng

- `setOrderingType` xoá **toàn bộ 7 field** dưới nhóm `// Delivery info` của `IOrderingData` khi loại đơn mới khác `DELIVERY`: `deliveryAddress`, `deliveryDistance`, `deliveryDuration`, `deliveryPhone`, `deliveryLat`, `deliveryLng`, `deliveryPlaceId`. Xoá `table`/`tableName` khi khác `AT_TABLE`.
- `deliveryPhone` phải nằm trong danh sách: `create-order-dialog.tsx` gửi `deliveryPhone` lên API không phụ thuộc loại đơn, nên số cũ sót lại sẽ đi kèm cả đơn tại bàn. Khi khách quay lại đơn giao hàng, `MapAddressSelector` tự điền lại từ `userInfo.phonenumber`.
- `useCartPricing` chỉ cộng `deliveryFee` khi `type === DELIVERY` **và** có `deliveryAddress`. Không có ngoại lệ nào khác.
- Bất biến cần giữ: mọi số hạng cộng vào tổng đều có một dòng hiển thị tương ứng.

### 4.3 Đổi size trong giỏ

`addOrderingProductVariant` đổi chữ ký thành `(itemId: string, variantSlug: string)` và thực sự cập nhật:

```ts
item.id === itemId
  ? { ...item, variant: nextVariant, size: nextVariant.size.name, originalPrice: nextVariant.price }
  : item
```

`ProductVariantSelect` nhận `value` là variant slug đang chọn của dòng đó (không phải `variant[0].slug`), và trả về `Select` rỗng an toàn khi `allVariants` thiếu hoặc rỗng — không truy cập `variant[0]` khi chưa kiểm tra độ dài.

### 4.4 Điều kiện chặn đặt hàng

`useCartBlockers()` trả về `Array<{ code, label, target }>` dùng chung cho mọi khổ màn hình và cho cả `CreateOrderDialog`:

| Điều kiện | Khi nào |
| --- | --- |
| `SOLD_OUT` | có món `soldOut` sau khi kiểm tra lại tồn kho |
| `NO_TABLE` | `type === AT_TABLE` và chưa có `table` |
| `NO_ADDRESS` | `type === DELIVERY` và chưa có `deliveryAddress` |
| `BAD_PHONE` | `type === DELIVERY` và `deliveryPhone` không khớp `PHONE_NUMBER_REGEX` |
| `UNPRICED_CUSTOM` | có món giá tùy chỉnh chưa nhập giá |

Nút đặt hàng `disabled` khi mảng khác rỗng. Mỗi phần tử render thành một nút; bấm vào thì `scrollIntoView` + `focus` đúng ô nhập.

### 4.5 Kiểm tra lại giỏ khi mở trang

Khi vào `/cart`, đối chiếu giỏ với menu của hôm nay tại chi nhánh đang chọn. Món hết hàng được đánh dấu `soldOut`, hiện dải cảnh báo ngay tại dòng đó kèm nút "Xoá khỏi giỏ", và chặn nút đặt hàng.

Quy tắc hết hàng lấy đúng theo `client-menu-item.tsx:179`: món khả dụng khi `!menuItem.isLocked && (menuItem.currentStock > 0 || !menuItem.product.isLimit)`. Món không có trong menu hôm nay thì bỏ qua, để server quyết định.

Đồng bộ lại **giá** khi giá đổi nằm ngoài phạm vi đợt này — server tính lại giá ở bước tạo đơn, nên rủi ro chỉ là hiển thị lệch chứ không sai tiền thực thu.

## 5. UI

Bám design token sẵn có trong `src/index.css` (`--primary: 35 93% 55%`, `--radius: 0.5rem`, neutral ấm). Không thêm màu mới ngoài hai token ngữ nghĩa: `success` cho tiền tiết kiệm (dùng `text-green-600` hiện có) và `warning` cho dải hết hàng (`amber-700`).

### 5.1 Bố cục

Một cây JSX duy nhất, chuyển bố cục bằng Tailwind breakpoint `lg` (1024px):

- `< lg`: một cột, thanh đặt hàng `sticky bottom-0` trong luồng nội dung, có `env(safe-area-inset-bottom)`. Layout cha đã chừa `pb-[calc(5rem+safe-area)]` cho bottom-nav; thanh này nằm trong luồng nên không cần chừa thêm.
- `>= lg`: hai cột `grid-cols-[minmax(0,1fr)_21rem]`, cột phải `sticky top-*` chứa khối tổng tiền và nút đặt hàng. Nút **không** có nền, viền hay bóng riêng — nó nằm trần dưới thẻ tổng tiền.

Xoá `useIsMobile()` khỏi trang.

### 5.2 Tab hình thức nhận hàng

Segmented control dạng pill: một hàng, các ô chia đều, viền `border`, nền `bg-muted`, ô đang chọn nền `primary` chữ `primary-foreground`. Chỉ có nhãn, không có dòng mô tả phụ.

- `orderTypes.length === 1` → hiện text tĩnh thay cho tab.
- `orderTypes.length >= 2` → segmented.
- Auto-switch loại đơn chỉ chạy **sau khi** feature flags load xong (`!isLoading`), tránh đổi ngầm khỏi Giao hàng.

Bên dưới tab là đúng một nhóm field theo loại đơn: bàn (Tại bàn) / giờ lấy (Mang đi) / địa chỉ + SĐT (Giao hàng).

### 5.3 Dòng sản phẩm

Lưới `64px | 1fr` (mobile), `80px | 1fr` (từ 620px). Trong cột phải, xếp dọc:

1. Tên món + nút xoá ở góc phải.
2. Dải cảnh báo hết hàng (nếu có).
3. Nhãn giảm giá bằng chữ: `Giảm 20%` (nền primary nhạt) hoặc `Đồng giá 25.000₫` (nền xanh). Bỏ hoàn toàn ký hiệu `(*)` / `(**)` và khối chú thích ở cuối trang.
4. Hàng điều khiển: select size → stepper số lượng → giá đơn vị (gạch giá gốc nếu có giảm) → thành tiền căn phải.
5. Ô ghi chú viền nét đứt.

Stepper: nút `−` khi số lượng bằng 1 đổi thành icon thùng rác và `aria-label="Xoá món"`. Trần số lượng 20, chạm trần thì nút `+` disabled.

### 5.4 Khối tổng thanh toán

Thứ tự dòng: Tạm tính → Khuyến mãi sản phẩm → Ưu đãi `<mã>` → Phí giao hàng (chỉ khi giao hàng, kèm dòng phụ `x km × y₫/km`) → Tổng cộng. Dưới cùng là dải "Bạn đã tiết kiệm N₫" khi tổng giảm > 0.

Mọi con số dùng `tabular-nums`.

### 5.5 Xoá món

Bỏ dialog xác nhận. Xoá ngay, hiện toast "Đã xoá {tên món}" kèm nút **Hoàn tác**, tự đóng sau 5 giây. `DeleteCartItemDialog` không còn dùng ở trang giỏ hàng. `DeleteAllCartDialog` giữ nguyên dialog vì thao tác nặng hơn.

### 5.6 Trạng thái rỗng và lỗi

- Rỗng: icon, tiêu đề "Giỏ hàng đang trống", một dòng mô tả, nút "Xem thực đơn". Không gợi ý món.
- Lỗi: error boundary riêng cho `/cart` với tiêu đề "Không mở được giỏ hàng", giải thích ngắn, nút "Xoá giỏ hàng & tải lại" và "Về thực đơn", kèm mã lỗi. Thay cho màn hình trắng hiện tại.

## 6. Hiệu năng

- `useCartPricing` bọc `useMemo` theo `[orderItems, voucher, type, deliveryDistance]`, trả về cả `Map` theo `id` và tổng. Không tính giá trong thân JSX.
- Ghi chú món và ghi chú đơn giữ state cục bộ, debounce 300ms trước khi ghi vào store; giới hạn 120 ký tự.
- `useCalculateDeliveryFee` chỉ gọi khi `type === DELIVERY`. `CreateOrderDialog` nhận tổng tiền qua props thay vì tự tính lại.
- Ảnh có `loading="lazy"`, `width`/`height`, và `onError` fallback về `ProductImage`.

## 7. Lỗi được sửa

| # | Lỗi | Chỗ sửa |
| --- | --- | --- |
| P0-1 | Phí ship cộng vào tổng ở mọi loại đơn | `setOrderingType`, `useCartPricing` |
| P0-2 | Hai dòng cùng sản phẩm hiển thị sai giá | `buildDisplayItemMap` |
| P0-3 | Đổi size không tác dụng, crash khi thiếu variant | `addOrderingProductVariant`, `ProductVariantSelect` |
| P0-4 | Bàn từ mã QR ghi nhầm store | 3 file layout client |
| P1-5 | Mobile cho đặt đơn giao hàng thiếu thông tin | `useCartBlockers` |
| P1-6 | Loại đơn tự đổi do race feature flags | `OrderTypeSelect` |
| P1-7 | `isHydrated` kẹt false khi rehydrate lỗi | `onRehydrateStorage` |
| P1-8 | Số lượng có nguồn sự thật kép, không trần | `QuantitySelector` |
| P1-9 | Không kiểm tra lại tồn kho/giá | `useCartRevalidation` |
| P1-10 | Logic voucher trùng, toast kép | gom về một effect |
| P1-11 | Spinner không hiện do độ ưu tiên toán tử | `CreateOrderDialog` |
| P2-12..19 | Debounce, memo, lazy image, a11y, gọi API thừa | rải theo mục 6 |

## 8. Rủi ro

- **Đổi chữ ký `addOrderingProductVariant`** ảnh hưởng nơi khác đang gọi. Phải grep toàn repo trước khi đổi.
- **Xoá dữ liệu giao hàng khi đổi loại đơn** là hành vi mới; khách đang nhập dở mà bấm nhầm tab sẽ mất địa chỉ. Chấp nhận đánh đổi vì bug tính tiền nghiêm trọng hơn; bù lại bằng việc `MapAddressSelector` vẫn khôi phục địa chỉ từ hồ sơ người dùng.
- **Store cũ `cart.store.ts`** vẫn tồn tại song song. Chỉ sửa đúng đường ghi bàn, không refactor rộng để giữ diff kiểm soát được.

## 9. Nghiệm thu

Mỗi mục dưới đây phải kiểm chứng được bằng test hoặc thao tác tay:

1. Chọn Giao hàng, nhập địa chỉ, đổi sang Mang đi → tổng tiền giảm đúng bằng phí ship và không còn dòng phí ship.
2. Thêm cùng một sản phẩm với hai size khác giá → hai dòng hiện đúng giá riêng, tổng bằng tổng hai dòng.
3. Đổi size ở một dòng → chỉ dòng đó đổi giá; `variant.slug` gửi lên API khớp size mới.
4. Cart item không có `allVariants` → trang vẫn render, không trắng.
5. Mở `/cart?table=A01&branch=x` → bàn A01 được chọn sẵn.
6. Trên khổ 390px, đơn giao hàng thiếu SĐT → nút đặt hàng disabled và hiện đúng lý do.
7. Xoá món rồi bấm Hoàn tác → món quay lại đúng vị trí cũ với đúng số lượng và ghi chú.
8. Gõ 20 ký tự vào ô ghi chú → store chỉ được ghi một lần sau khi ngừng gõ.
