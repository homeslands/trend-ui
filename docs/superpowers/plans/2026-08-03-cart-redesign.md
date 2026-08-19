# Thiết kế lại giỏ hàng `/cart` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa dứt điểm 4 lỗi tính tiền/dữ liệu nghiêm trọng ở trang giỏ hàng và thay hai nhánh JSX mobile/desktop bằng một cây responsive duy nhất theo bản UI đã chốt.

**Architecture:** Đẩy toàn bộ phép tính ra hai hook thuần (`useCartPricing`, `useCartBlockers`) có test đơn vị, rồi dựng lại `page.tsx` thành các component con chỉ đọc kết quả từ hook. Bố cục chuyển 1 cột ↔ 2 cột bằng breakpoint `lg` của Tailwind thay vì rẽ nhánh `useIsMobile()`.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind + shadcn/ui, Zustand (persist localStorage), TanStack Query, i18next, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-03-cart-redesign-design.md`
**UI tham chiếu:** https://claude.ai/code/artifact/8440caa7-8bf2-49b2-9b26-c62a9cc5537d

## Global Constraints

- Thư mục làm việc: `app/order-ui`. Mọi lệnh chạy từ đó.
- Lệnh test: `npx vitest run <path>`. Lệnh kiểm tra toàn bộ: `npm run lint && npx tsc -b`.
- Test đặt trong `__tests__/` cạnh file nguồn, đuôi `.test.ts` / `.test.tsx`, import `{ describe, it, expect }` từ `vitest`.
- Đường dẫn import dùng alias `@/`.
- Chuỗi hiển thị cho người dùng phải qua i18next, thêm khoá mới vào **cả** `src/locales/vi/*.json` và `src/locales/en/*.json`. Đây là các file được `src/i18n.ts` import trực tiếp làm JSON module — **không phải** `public/locales/`, thư mục đó chỉ còn `campaign.json` nạp qua HTTP backend (mô tả trong CLAUDE.md đã lỗi thời).
- Không đổi hợp đồng API. Mọi thay đổi là client-side.
- Design token lấy từ `src/index.css`, không thêm màu hardcode ngoài `text-green-600` (tiết kiệm) và `amber-700` (hết hàng) đã có sẵn trong codebase.
- Không sửa `src/app/system/**` và luồng `/payment`.
- Commit sau mỗi task, tiền tố `TaskId: TRE-466-FE(<n>)-Optimize-cart` theo quy ước branch hiện tại.

---

## Cấu trúc file

**Tạo mới**

| File | Trách nhiệm |
| --- | --- |
| `src/app/client/cart/hooks/use-cart-pricing.ts` | Memo hoá giá theo dòng + tổng tiền + phí ship |
| `src/app/client/cart/hooks/use-cart-blockers.ts` | Danh sách điều kiện còn thiếu để đặt hàng |
| `src/app/client/cart/hooks/use-cart-revalidation.ts` | Đối chiếu giỏ với menu hôm nay, đánh dấu hết hàng |
| `src/app/client/cart/components/order-type-tabs.tsx` | Tab hình thức nhận hàng |
| `src/app/client/cart/components/fulfillment-fields.tsx` | Field theo loại đơn (bàn / giờ / địa chỉ + SĐT) |
| `src/app/client/cart/components/cart-item-row.tsx` | Một dòng sản phẩm |
| `src/app/client/cart/components/cart-summary.tsx` | Khối tổng thanh toán |
| `src/app/client/cart/components/cart-actions.tsx` | Nút đặt hàng + danh sách "còn thiếu" |
| `src/app/client/cart/components/cart-empty.tsx` | Trạng thái giỏ rỗng |
| `src/app/client/cart/components/cart-error.tsx` | Error boundary riêng của trang |
| `src/hooks/use-sync-table-from-url.ts` | Đồng bộ bàn từ query param vào order-flow store |

**Sửa**

| File | Thay đổi |
| --- | --- |
| `src/utils/cart.ts` | Thêm `buildDisplayItemMap` |
| `src/stores/order-flow.store.ts` | `setOrderingType`, `addOrderingProductVariant`, `onRehydrateStorage` |
| `src/components/app/select/product-variant-select.tsx` | Controlled đúng dòng, an toàn khi thiếu variant |
| `src/components/app/select/order-type-select.tsx` | Chuyển thành tab, chờ feature flags |
| `src/components/app/button/quantity-selector.tsx` | Đồng bộ với store, trần 20, nút xoá khi qty = 1 |
| `src/components/app/input/cart-note-input.tsx` | Debounce 300ms, giới hạn 120 ký tự |
| `src/components/app/dialog/create-order-dialog.tsx` | Nhận tổng tiền qua props, sửa spinner |
| `src/app/client/cart/page.tsx` | Viết lại thành khung lắp ráp |
| `src/app/layouts/client/ClientLayout.tsx` + `client-layout-public.tsx` + `client-detail-layout.tsx` | Dùng `useSyncTableFromUrl` |

**Xoá khỏi trang giỏ hàng** (giữ file, chỉ bỏ chỗ dùng): `DeleteCartItemDialog`, `useIsMobile`.

---

# Giai đoạn A — Sửa lỗi tiền và dữ liệu

## Task 1: Tra cứu giá theo `item.id`

**Files:**
- Modify: `src/utils/cart.ts`
- Modify: `src/components/app/dialog/create-order-dialog.tsx:278`
- Test: `src/utils/__tests__/cart-display-map.test.ts`

**Interfaces:**
- Produces: `buildDisplayItemMap(displayItems: IDisplayCartItem[]): Map<string, IDisplayCartItem>` — khoá là `item.id`.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/utils/__tests__/cart-display-map.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildDisplayItemMap, calculateCartItemDisplay } from '../cart'
import { ICartItem, IOrderItem } from '@/types'

// Hai dòng cùng product slug nhưng khác size là ca gây lỗi P0-2:
// tra cứu theo slug luôn trả về dòng đầu tiên nên dòng thứ hai hiện sai giá.
function makeItem(id: string, price: number): IOrderItem {
  return {
    id,
    slug: 'tra-sua-tran-chau',
    image: '',
    name: 'Trà sữa trân châu',
    quantity: 1,
    size: id === 'it_1' ? 'M' : 'L',
    allVariants: [],
    variant: { slug: `variant-${id}`, price } as IOrderItem['variant'],
    originalPrice: price,
    description: '',
    isLimit: false,
    isGift: false,
  }
}

describe('buildDisplayItemMap', () => {
  it('giữ riêng từng dòng khi hai dòng cùng một sản phẩm', () => {
    const cart = {
      orderItems: [makeItem('it_1', 45000), makeItem('it_2', 55000)],
    } as unknown as ICartItem

    const map = buildDisplayItemMap(calculateCartItemDisplay(cart, null))

    expect(map.size).toBe(2)
    expect(map.get('it_1')?.finalPrice).toBe(45000)
    expect(map.get('it_2')?.finalPrice).toBe(55000)
  })

  it('trả về map rỗng khi không có dòng nào', () => {
    expect(buildDisplayItemMap([]).size).toBe(0)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/utils/__tests__/cart-display-map.test.ts`
Expected: FAIL — `buildDisplayItemMap is not a function`.

- [ ] **Step 3: Cài đặt tối thiểu**

Thêm vào cuối `src/utils/cart.ts`:

```ts
/**
 * Khoá theo item.id (định danh DÒNG), không phải item.slug (định danh SẢN PHẨM).
 * Giỏ hàng cho phép hai dòng cùng sản phẩm khác size — tra theo slug sẽ trả về
 * dòng đầu tiên và hiển thị sai giá cho các dòng còn lại.
 */
export function buildDisplayItemMap(
  displayItems: IDisplayCartItem[],
): Map<string, IDisplayCartItem> {
  const map = new Map<string, IDisplayCartItem>()
  displayItems.forEach((item) => {
    if (item.id) map.set(item.id, item)
  })
  return map
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/utils/__tests__/cart-display-map.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Áp dụng vào CreateOrderDialog**

Trong `src/components/app/dialog/create-order-dialog.tsx`, thêm `buildDisplayItemMap` vào import từ `@/utils`, rồi sau dòng tính `displayItems`:

```tsx
  const displayMap = useMemo(() => buildDisplayItemMap(displayItems), [displayItems])
```

Thêm `useMemo` vào import từ `react`. Đổi dòng 278 từ:

```tsx
const finalPrice = (displayItems.find(di => di.slug === item.slug)?.finalPrice ?? 0) * item.quantity
```

thành:

```tsx
const finalPrice = (displayMap.get(item.id)?.finalPrice ?? 0) * item.quantity
```

- [ ] **Step 6: Kiểm tra biên dịch**

Run: `npx tsc -b`
Expected: không lỗi.

- [ ] **Step 7: Commit**

```bash
git add src/utils/cart.ts src/utils/__tests__/cart-display-map.test.ts src/components/app/dialog/create-order-dialog.tsx
git commit -m "TaskId: TRE-466-FE(1)-Optimize-cart: tra cuu gia theo item.id"
```

---

## Task 2: Đổi loại đơn dọn sạch dữ liệu không còn thuộc về loại đó

**Files:**
- Modify: `src/stores/order-flow.store.ts:600-641`
- Test: `src/stores/__tests__/order-flow-set-type.test.ts`

**Interfaces:**
- Consumes: không.
- Produces: sau `setOrderingType(type)`, các trường không thuộc loại đơn mới bị reset.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/stores/__tests__/order-flow-set-type.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'

describe('setOrderingType', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().initializeOrdering()
  })

  it('xoá dữ liệu giao hàng khi rời khỏi loại đơn giao hàng', () => {
    const store = useOrderFlowStore.getState()
    store.setOrderingType(OrderTypeEnum.DELIVERY)
    store.setDeliveryAddress('12 Nguyễn Huệ')
    store.setDeliveryDistanceDuration(3.2, 20)
    store.setDeliveryCoords(10.77, 106.7, 'place_1')

    store.setOrderingType(OrderTypeEnum.TAKE_OUT)

    const data = useOrderFlowStore.getState().orderingData
    expect(data?.deliveryAddress).toBe('')
    expect(data?.deliveryDistance).toBe(0)
    expect(data?.deliveryDuration).toBe(0)
    expect(data?.deliveryLat).toBeUndefined()
    expect(data?.deliveryLng).toBeUndefined()
    expect(data?.deliveryPlaceId).toBe('')
  })

  it('xoá bàn khi rời khỏi loại đơn tại bàn', () => {
    const store = useOrderFlowStore.getState()
    store.setOrderingTable({ slug: 'ban-a01', name: 'A01' } as never)

    store.setOrderingType(OrderTypeEnum.TAKE_OUT)

    const data = useOrderFlowStore.getState().orderingData
    expect(data?.table).toBe('')
    expect(data?.tableName).toBe('')
  })

  it('giữ nguyên dữ liệu giao hàng khi vẫn là đơn giao hàng', () => {
    const store = useOrderFlowStore.getState()
    store.setOrderingType(OrderTypeEnum.DELIVERY)
    store.setDeliveryAddress('12 Nguyễn Huệ')

    store.setOrderingType(OrderTypeEnum.DELIVERY)

    expect(useOrderFlowStore.getState().orderingData?.deliveryAddress).toBe('12 Nguyễn Huệ')
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/stores/__tests__/order-flow-set-type.test.ts`
Expected: FAIL ở test 1 — `deliveryAddress` vẫn là `'12 Nguyễn Huệ'`.

- [ ] **Step 3: Cài đặt**

Trong `src/stores/order-flow.store.ts`, thay toàn bộ thân `setOrderingType` bằng:

```ts
      setOrderingType: (type: OrderTypeEnum) => {
        if (!get().orderingData) {
          get().initializeOrdering()
        }
        const { orderingData } = get()
        if (!orderingData) return

        // Dữ liệu chỉ có nghĩa với đúng một loại đơn. Giữ lại sẽ khiến tổng tiền
        // cộng phí giao hàng của một địa chỉ không còn hiển thị ở đâu (P0-1).
        const clearedDelivery =
          type === OrderTypeEnum.DELIVERY
            ? {}
            : {
                // Toàn bộ 7 field dưới nhóm `// Delivery info` của IOrderingData.
                deliveryAddress: '',
                deliveryDistance: 0,
                deliveryDuration: 0,
                deliveryPhone: '',
                deliveryLat: undefined,
                deliveryLng: undefined,
                deliveryPlaceId: '',
              }

        const clearedTable =
          type === OrderTypeEnum.AT_TABLE ? {} : { table: '', tableName: '' }

        set({
          orderingData: {
            ...orderingData,
            type,
            ...clearedDelivery,
            ...clearedTable,
          },
          lastModified: moment().valueOf(),
        })
      },
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/stores/__tests__/order-flow-set-type.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add src/stores/order-flow.store.ts src/stores/__tests__/order-flow-set-type.test.ts
git commit -m "TaskId: TRE-466-FE(2)-Optimize-cart: doi loai don xoa du lieu khong con dung"
```

---

## Task 3: Đổi size trong giỏ có tác dụng thật

**Files:**
- Modify: `src/stores/order-flow.store.ts:97` (khai báo type) và `:386-401` (cài đặt)
- Test: `src/stores/__tests__/order-flow-variant.test.ts`

**Interfaces:**
- Produces: `changeOrderingItemVariant(itemId: string, variantSlug: string): void` — thay cho `addOrderingProductVariant(id: string)`.

- [ ] **Step 1: Tìm mọi nơi đang gọi hàm cũ**

Run: `grep -rn "addOrderingProductVariant" src/`
Ghi lại danh sách. Tại thời điểm viết plan chỉ có 2 chỗ: khai báo trong store và `src/app/client/cart/page.tsx:56`. Nếu grep ra thêm chỗ khác, sửa luôn trong task này.

- [ ] **Step 2: Viết test thất bại**

Tạo `src/stores/__tests__/order-flow-variant.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useOrderFlowStore } from '@/stores'
import { IOrderItem, IProductVariant } from '@/types'

const variantM = { slug: 'v-m', price: 45000, size: { slug: 's-m', name: 'm' } } as IProductVariant
const variantL = { slug: 'v-l', price: 55000, size: { slug: 's-l', name: 'l' } } as IProductVariant

function seedCart() {
  useOrderFlowStore.getState().initializeOrdering()
  useOrderFlowStore.getState().addOrderingItem({
    id: 'ignored',
    slug: 'tra-sua',
    image: '',
    name: 'Trà sữa',
    quantity: 1,
    size: 'm',
    allVariants: [variantM, variantL],
    variant: variantM,
    originalPrice: 45000,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
  return useOrderFlowStore.getState().orderingData!.orderItems[0].id
}

describe('changeOrderingItemVariant', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().clearOrderingData()
  })

  it('đổi variant, size và giá gốc của đúng dòng', () => {
    const id = seedCart()

    useOrderFlowStore.getState().changeOrderingItemVariant(id, 'v-l')

    const item = useOrderFlowStore.getState().orderingData!.orderItems[0]
    expect(item.variant.slug).toBe('v-l')
    expect(item.size).toBe('l')
    expect(item.originalPrice).toBe(55000)
  })

  it('bỏ qua khi variant slug không có trong allVariants', () => {
    const id = seedCart()

    useOrderFlowStore.getState().changeOrderingItemVariant(id, 'khong-ton-tai')

    expect(useOrderFlowStore.getState().orderingData!.orderItems[0].variant.slug).toBe('v-m')
  })

  it('không đụng tới dòng khác', () => {
    const id = seedCart()

    useOrderFlowStore.getState().changeOrderingItemVariant('id-khong-ton-tai', 'v-l')

    expect(useOrderFlowStore.getState().orderingData!.orderItems[0].variant.slug).toBe('v-m')
  })
})
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/stores/__tests__/order-flow-variant.test.ts`
Expected: FAIL — `changeOrderingItemVariant is not a function`.

- [ ] **Step 4: Cài đặt**

Trong interface của store, thay dòng `addOrderingProductVariant: (id: string) => void` bằng:

```ts
  changeOrderingItemVariant: (itemId: string, variantSlug: string) => void
```

Thay toàn bộ cài đặt `addOrderingProductVariant` bằng:

```ts
      changeOrderingItemVariant: (itemId: string, variantSlug: string) => {
        const { orderingData } = get()
        if (!orderingData) return

        const updatedItems = orderingData.orderItems.map((item) => {
          if (item.id !== itemId) return item
          const nextVariant = item.allVariants?.find((v) => v.slug === variantSlug)
          if (!nextVariant) return item
          return {
            ...item,
            variant: nextVariant,
            size: nextVariant.size?.name ?? item.size,
            originalPrice: nextVariant.price,
          }
        })

        set({
          orderingData: { ...orderingData, orderItems: updatedItems },
          lastModified: moment().valueOf(),
        })
      },
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npx vitest run src/stores/__tests__/order-flow-variant.test.ts`
Expected: PASS (3 test).

- [ ] **Step 6: Gỡ chỗ gọi cũ**

Trong `src/app/client/cart/page.tsx`, xoá `addOrderingProductVariant` khỏi destructuring của `useOrderFlowStore` và xoá hàm `handleChangeVariant`. Tạm thời đổi prop của `ProductVariantSelect` thành:

```tsx
<ProductVariantSelect
  variants={item.allVariants}
  value={item.variant?.slug}
  onChange={(slug) => changeOrderingItemVariant(item.id, slug)}
/>
```

(prop `variants` sẽ được đổi tên ở Task 4; nếu chạy tsc ngay lúc này sẽ báo lỗi prop — đó là dự kiến, Task 4 khép lại.)

- [ ] **Step 7: Commit**

```bash
git add src/stores/order-flow.store.ts src/stores/__tests__/order-flow-variant.test.ts src/app/client/cart/page.tsx
git commit -m "TaskId: TRE-466-FE(3)-Optimize-cart: doi variant trong gio hang co tac dung"
```

---

## Task 4: `ProductVariantSelect` an toàn và controlled đúng dòng

**Files:**
- Modify: `src/components/app/select/product-variant-select.tsx`
- Test: `src/components/app/select/__tests__/product-variant-select.test.tsx`

**Interfaces:**
- Consumes: `changeOrderingItemVariant` (Task 3).
- Produces: props `{ variants: IProductVariant[] | undefined; value?: string; onChange: (variantSlug: string) => void }`.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/components/app/select/__tests__/product-variant-select.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProductVariantSelect from '../product-variant-select'
import { IProductVariant } from '@/types'

const variants = [
  { slug: 'v-m', price: 45000, size: { slug: 's-m', name: 'm' } },
  { slug: 'v-l', price: 55000, size: { slug: 's-l', name: 'l' } },
] as IProductVariant[]

describe('ProductVariantSelect', () => {
  it('hiển thị variant đang được chọn của dòng, không phải variant đầu tiên', () => {
    render(<ProductVariantSelect variants={variants} value="v-l" onChange={vi.fn()} />)
    expect(screen.getByText(/L/i)).toBeInTheDocument()
  })

  it('không crash khi thiếu danh sách variant', () => {
    expect(() =>
      render(<ProductVariantSelect variants={undefined} value={undefined} onChange={vi.fn()} />),
    ).not.toThrow()
  })

  it('không crash khi danh sách variant rỗng', () => {
    expect(() =>
      render(<ProductVariantSelect variants={[]} value={undefined} onChange={vi.fn()} />),
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/components/app/select/__tests__/product-variant-select.test.tsx`
Expected: FAIL — test 2 và 3 ném `Cannot read properties of undefined (reading 'slug')`.

- [ ] **Step 3: Viết lại component**

Thay toàn bộ `src/components/app/select/product-variant-select.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IProductVariant } from '@/types'

interface ProductVariantSelectProps {
  variants?: IProductVariant[]
  value?: string
  /** Size đã lưu trong giỏ (`item.size`), dùng khi món không còn danh sách variant. */
  fallbackLabel?: string
  onChange: (variantSlug: string) => void
}

function SizeBadge({ label }: { label: string }) {
  return (
    <span className="px-2 py-1 text-xs rounded-full border text-muted-foreground border-muted-foreground/40">
      {`Size ${label.toUpperCase()}`}
    </span>
  )
}

export default function ProductVariantSelect({
  variants,
  value,
  fallbackLabel,
  onChange,
}: ProductVariantSelectProps) {
  const { t } = useTranslation(['product'])
  const list = variants ?? []

  // Món cũ trong localStorage có thể không có allVariants; không được truy cập list[0].
  // Vẫn hiển thị size đã lưu để khách biết mình đang đặt gì, chỉ là không đổi được.
  if (list.length === 0) {
    return fallbackLabel ? <SizeBadge label={fallbackLabel} /> : null
  }

  if (list.length === 1) {
    return <SizeBadge label={list[0].size?.name ?? fallbackLabel ?? ''} />
  }

  return (
    <Select value={value ?? list[0].slug} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs rounded-full w-fit min-w-24 dark:border-muted-foreground/60">
        <SelectValue placeholder={t('product.selectProductVariant')} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {list.map((item) => (
            <SelectItem key={item.slug} value={item.slug}>
              {`Size ${item.size?.name?.toUpperCase() ?? ''}`}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/components/app/select/__tests__/product-variant-select.test.tsx`
Expected: PASS (3 test).

- [ ] **Step 5: Kiểm tra biên dịch toàn dự án**

Run: `npx tsc -b`
Expected: không lỗi. Nếu còn chỗ nào truyền prop `variant` (số ít) thì sửa sang `variants`.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/select/product-variant-select.tsx src/components/app/select/__tests__/product-variant-select.test.tsx
git commit -m "TaskId: TRE-466-FE(4)-Optimize-cart: product variant select an toan va controlled"
```

---

## Task 5: Không kẹt `isHydrated` khi rehydrate lỗi

**Files:**
- Modify: `src/stores/order-flow.store.ts:1786-1793`
- Test: `src/stores/__tests__/order-flow-hydration.test.ts`

**Interfaces:**
- Produces: `isHydrated` luôn thành `true` sau khi persist chạy xong, kể cả khi đọc storage lỗi.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/stores/__tests__/order-flow-hydration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { useOrderFlowStore } from '@/stores'

describe('order flow hydration', () => {
  it('đặt isHydrated = true kể cả khi rehydrate trả về lỗi', async () => {
    useOrderFlowStore.setState({ isHydrated: false })

    // Mô phỏng nhánh lỗi của persist: state = undefined, error khác undefined.
    const callback = useOrderFlowStore.persist.getOptions().onRehydrateStorage?.(
      useOrderFlowStore.getState(),
    )
    callback?.(undefined, new Error('localStorage hỏng'))

    await new Promise((resolve) => queueMicrotask(() => resolve(null)))
    expect(useOrderFlowStore.getState().isHydrated).toBe(true)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/stores/__tests__/order-flow-hydration.test.ts`
Expected: FAIL — `isHydrated` vẫn `false`.

- [ ] **Step 3: Cài đặt**

Thay khối `onRehydrateStorage` bằng:

```ts
      onRehydrateStorage: () => () => {
        // Không kiểm tra `state`: khi đọc storage lỗi persist gọi callback với
        // state = undefined, cờ sẽ kẹt false và MapAddressSelector không bao giờ
        // khôi phục địa chỉ đã lưu (P1-7).
        queueMicrotask(() => {
          useOrderFlowStore.setState({ isHydrated: true })
        })
      },
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/stores/__tests__/order-flow-hydration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/order-flow.store.ts src/stores/__tests__/order-flow-hydration.test.ts
git commit -m "TaskId: TRE-466-FE(5)-Optimize-cart: khong ket isHydrated khi rehydrate loi"
```

---

## Task 6: Bàn từ mã QR ghi đúng store

**Files:**
- Create: `src/hooks/use-sync-table-from-url.ts`
- Create: `src/hooks/__tests__/use-sync-table-from-url.test.tsx`
- Modify: `src/app/layouts/client/ClientLayout.tsx:13,20-29`
- Modify: `src/app/layouts/client/client-layout-public.tsx`
- Modify: `src/app/layouts/client/client-detail-layout.tsx`

**Interfaces:**
- Produces: `useSyncTableFromUrl(): void` — đọc `?branch=` và `?table=` rồi gọi `useOrderFlowStore().addTable(table)`.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/hooks/__tests__/use-sync-table-from-url.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useOrderFlowStore } from '@/stores'
import { useSyncTableFromUrl } from '../use-sync-table-from-url'

vi.mock('@/hooks/use-table', () => ({
  useTables: () => ({
    data: { result: [{ slug: 'ban-a01', name: 'A01', status: 'available' }] },
  }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter initialEntries={['/cart?branch=chi-nhanh-1&table=ban-a01']}>{children}</MemoryRouter>
}

describe('useSyncTableFromUrl', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().initializeOrdering()
  })

  it('ghi bàn từ query param vào order-flow store', () => {
    renderHook(() => useSyncTableFromUrl(), { wrapper })

    const data = useOrderFlowStore.getState().orderingData
    expect(data?.table).toBe('ban-a01')
    expect(data?.tableName).toBe('A01')
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/hooks/__tests__/use-sync-table-from-url.test.tsx`
Expected: FAIL — không tìm thấy module `../use-sync-table-from-url`.

- [ ] **Step 3: Cài đặt hook**

Tạo `src/hooks/use-sync-table-from-url.ts`:

```ts
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useOrderFlowStore } from '@/stores'
import { useTables } from '@/hooks/use-table'

/**
 * Quét mã QR tại bàn mở /cart?branch=...&table=... Trước đây bàn được ghi vào
 * useCartItemStore (store cũ) trong khi trang giỏ hàng đọc từ useOrderFlowStore,
 * nên bàn không bao giờ được chọn (P0-4).
 */
export function useSyncTableFromUrl() {
  const [searchParams] = useSearchParams()
  const branchSlug = searchParams.get('branch') || undefined
  const tableSlug = searchParams.get('table')
  const { data: tableRes } = useTables(branchSlug)
  const addTable = useOrderFlowStore((state) => state.addTable)

  useEffect(() => {
    if (!tableSlug || !tableRes?.result) return
    const table = tableRes.result.find((item) => item.slug === tableSlug)
    if (!table) return

    // `setOrderingTable` no-op khi chưa có orderingData. Khách quét QR lúc giỏ còn
    // trống là ca phổ biến nhất, nên phải khởi tạo giỏ trước, nếu không bàn bị mất
    // đúng vào tình huống P0-4 định sửa.
    if (!useOrderFlowStore.getState().orderingData) {
      useOrderFlowStore.getState().initializeOrdering()
    }
    // Quét QR tại bàn cũng chuyển đơn sang loại "tại bàn" — đây là ý đồ sản phẩm,
    // không phải tác dụng phụ: khách đang ngồi tại bàn đó.
    addTable(table)
  }, [tableSlug, tableRes, addTable])
}
```

`useTables` nằm ở `src/hooks/use-table.ts` (đã kiểm chứng); import trong hook và `vi.mock` trong test đều trỏ tới `@/hooks/use-table`.

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/hooks/__tests__/use-sync-table-from-url.test.tsx`
Expected: PASS.

- [ ] **Step 5: Thay ở cả ba layout**

Trong `ClientLayout.tsx`, `client-layout-public.tsx`, `client-detail-layout.tsx`: xoá `useCartItemStore` khỏi import và khỏi destructuring, xoá `tableSlug` / `branchSlug` / `useTables` / `useEffect` đồng bộ bàn, thay bằng một dòng trong thân component:

```tsx
  useSyncTableFromUrl()
```

Thêm import: `import { useSyncTableFromUrl } from '@/hooks/use-sync-table-from-url'`.

- [ ] **Step 6: Xuất hook từ barrel**

Thêm vào `src/hooks/index.ts`:

```ts
export * from './use-sync-table-from-url'
```

- [ ] **Step 7: Kiểm tra biên dịch và lint**

Run: `npx tsc -b && npm run lint`
Expected: không lỗi, không còn cảnh báo biến `useCartItemStore` không dùng.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/use-sync-table-from-url.ts src/hooks/__tests__/use-sync-table-from-url.test.tsx src/hooks/index.ts src/app/layouts/client/
git commit -m "TaskId: TRE-466-FE(6)-Optimize-cart: ban tu ma QR ghi dung store"
```

---

# Giai đoạn B — Hook nền

## Task 7: `useCartPricing`

**Files:**
- Create: `src/app/client/cart/hooks/use-cart-pricing.ts`
- Create: `src/app/client/cart/hooks/__tests__/use-cart-pricing.test.tsx`

**Interfaces:**
- Consumes: `buildDisplayItemMap` (Task 1).
- Produces:

```ts
export interface ICartPricing {
  displayMap: Map<string, IDisplayCartItem>
  subTotalBeforeDiscount: number
  promotionDiscount: number
  voucherDiscount: number
  deliveryFee: number
  finalTotal: number
  savedTotal: number
}
export function useCartPricing(): ICartPricing
```

- [ ] **Step 1: Viết test thất bại**

Tạo `src/app/client/cart/hooks/__tests__/use-cart-pricing.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum, IOrderItem, IProductVariant } from '@/types'
import { useCartPricing } from '../use-cart-pricing'

vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils')>()
  return {
    ...actual,
    // 3.2km x 5.000đ/km
    useCalculateDeliveryFee: (distance: number) => ({
      deliveryFee: distance * 5000,
      isLoading: false,
      error: null,
    }),
  }
})

const variant = { slug: 'v-m', price: 50000, size: { slug: 's-m', name: 'm' } } as IProductVariant

function seed() {
  const store = useOrderFlowStore.getState()
  store.initializeOrdering()
  store.addOrderingItem({
    id: 'x',
    slug: 'tra-sua',
    image: '',
    name: 'Trà sữa',
    quantity: 2,
    size: 'm',
    allVariants: [variant],
    variant,
    originalPrice: 50000,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
}

describe('useCartPricing', () => {
  beforeEach(() => {
    seed()
  })

  it('không cộng phí giao hàng cho đơn tại bàn dù còn khoảng cách cũ', () => {
    const store = useOrderFlowStore.getState()
    store.setOrderingType(OrderTypeEnum.DELIVERY)
    store.setDeliveryAddress('12 Nguyễn Huệ')
    store.setDeliveryDistanceDuration(3.2, 20)
    store.setOrderingType(OrderTypeEnum.AT_TABLE)

    const { result } = renderHook(() => useCartPricing())

    expect(result.current.deliveryFee).toBe(0)
    expect(result.current.finalTotal).toBe(100000)
  })

  it('cộng phí giao hàng khi là đơn giao hàng và đã có địa chỉ', () => {
    const store = useOrderFlowStore.getState()
    store.setOrderingType(OrderTypeEnum.DELIVERY)
    store.setDeliveryAddress('12 Nguyễn Huệ')
    store.setDeliveryDistanceDuration(3.2, 20)

    const { result } = renderHook(() => useCartPricing())

    expect(result.current.deliveryFee).toBe(16000)
    expect(result.current.finalTotal).toBe(116000)
  })

  it('chưa có địa chỉ thì phí giao hàng bằng 0', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.DELIVERY)

    const { result } = renderHook(() => useCartPricing())

    expect(result.current.deliveryFee).toBe(0)
  })

  it('trả về map tra cứu theo id của dòng', () => {
    const id = useOrderFlowStore.getState().orderingData!.orderItems[0].id
    const { result } = renderHook(() => useCartPricing())

    expect(result.current.displayMap.get(id)?.finalPrice).toBe(50000)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/app/client/cart/hooks/__tests__/use-cart-pricing.test.tsx`
Expected: FAIL — không tìm thấy module `../use-cart-pricing`.

- [ ] **Step 3: Cài đặt**

Tạo `src/app/client/cart/hooks/use-cart-pricing.ts`:

```ts
import { useMemo } from 'react'

import { useBranchStore, useOrderFlowStore } from '@/stores'
import { IDisplayCartItem, OrderTypeEnum } from '@/types'
import {
  buildDisplayItemMap,
  calculateCartItemDisplay,
  calculateCartTotals,
  parseKm,
  useCalculateDeliveryFee,
} from '@/utils'

export interface ICartPricing {
  displayMap: Map<string, IDisplayCartItem>
  subTotalBeforeDiscount: number
  promotionDiscount: number
  voucherDiscount: number
  deliveryFee: number
  finalTotal: number
  savedTotal: number
}

export function useCartPricing(): ICartPricing {
  const { branch } = useBranchStore()
  const cart = useOrderFlowStore((state) => state.orderingData)

  const isDelivery = cart?.type === OrderTypeEnum.DELIVERY
  const hasAddress = !!cart?.deliveryAddress
  const chargesDelivery = isDelivery && hasAddress

  // branchSlug rỗng ⇒ query bị disable, không gọi API thừa cho đơn tại bàn/mang đi.
  const { deliveryFee: rawDeliveryFee } = useCalculateDeliveryFee(
    chargesDelivery ? parseKm(cart?.deliveryDistance) || 0 : 0,
    chargesDelivery ? branch?.slug || '' : '',
  )
  const deliveryFee = chargesDelivery ? Math.round(rawDeliveryFee || 0) : 0

  const displayItems = useMemo(
    () => calculateCartItemDisplay(cart, cart?.voucher || null),
    [cart],
  )
  const displayMap = useMemo(() => buildDisplayItemMap(displayItems), [displayItems])
  const totals = useMemo(
    () => calculateCartTotals(displayItems, cart?.voucher || null),
    [displayItems, cart?.voucher],
  )

  return useMemo(
    () => ({
      displayMap,
      subTotalBeforeDiscount: totals.subTotalBeforeDiscount,
      promotionDiscount: totals.promotionDiscount,
      voucherDiscount: totals.voucherDiscount,
      deliveryFee,
      finalTotal: totals.finalTotal + deliveryFee,
      savedTotal: totals.promotionDiscount + totals.voucherDiscount,
    }),
    [displayMap, totals, deliveryFee],
  )
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/app/client/cart/hooks/__tests__/use-cart-pricing.test.tsx`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add src/app/client/cart/hooks/
git commit -m "TaskId: TRE-466-FE(7)-Optimize-cart: hook useCartPricing"
```

---

## Task 8: `useCartBlockers`

**Files:**
- Create: `src/app/client/cart/hooks/use-cart-blockers.ts`
- Create: `src/app/client/cart/hooks/__tests__/use-cart-blockers.test.tsx`
- Modify: `src/locales/vi/menu.json`, `src/locales/en/menu.json`

**Interfaces:**
- Produces:

```ts
export type TBlockerCode = 'SOLD_OUT' | 'NO_TABLE' | 'NO_ADDRESS' | 'BAD_PHONE' | 'UNPRICED_CUSTOM'
export interface ICartBlocker { code: TBlockerCode; label: string; targetId: string }
export function useCartBlockers(soldOutItemIds: string[]): ICartBlocker[]
```

`targetId` là `id` của phần tử DOM cần cuộn tới: `cart-field-table`, `cart-field-address`, `cart-field-phone`, hoặc `cart-row-<itemId>`.

- [ ] **Step 1: Thêm khoá i18n**

Thêm vào `src/locales/vi/menu.json` trong nhóm `menu`:

```json
"blockerSoldOut": "Xoá món đã hết hàng khỏi giỏ",
"blockerNoTable": "Chọn bàn",
"blockerNoAddress": "Nhập địa chỉ giao hàng",
"blockerBadPhone": "Nhập số điện thoại hợp lệ",
"blockerUnpricedCustom": "Nhập giá cho món giá tùy chỉnh",
"blockerPrefix": "Còn thiếu"
```

Thêm bản tiếng Anh tương ứng vào `src/locales/en/menu.json`:

```json
"blockerSoldOut": "Remove sold-out items from cart",
"blockerNoTable": "Select a table",
"blockerNoAddress": "Enter a delivery address",
"blockerBadPhone": "Enter a valid phone number",
"blockerUnpricedCustom": "Enter a price for custom-priced items",
"blockerPrefix": "Missing"
```

- [ ] **Step 2: Viết test thất bại**

Tạo `src/app/client/cart/hooks/__tests__/use-cart-blockers.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum, IOrderItem, IProductVariant } from '@/types'
import { useCartBlockers } from '../use-cart-blockers'

const variant = { slug: 'v-m', price: 50000, size: { slug: 's-m', name: 'm' } } as IProductVariant

function seed() {
  const store = useOrderFlowStore.getState()
  store.initializeOrdering()
  store.addOrderingItem({
    id: 'x',
    slug: 'tra-sua',
    image: '',
    name: 'Trà sữa',
    quantity: 1,
    size: 'm',
    allVariants: [variant],
    variant,
    originalPrice: 50000,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
  return useOrderFlowStore.getState().orderingData!.orderItems[0].id
}

describe('useCartBlockers', () => {
  beforeEach(() => {
    seed()
  })

  it('đơn tại bàn chưa chọn bàn thì báo thiếu bàn', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.AT_TABLE)

    const { result } = renderHook(() => useCartBlockers([]))

    expect(result.current.map((b) => b.code)).toEqual(['NO_TABLE'])
    expect(result.current[0].targetId).toBe('cart-field-table')
  })

  it('đơn giao hàng thiếu địa chỉ và sai số điện thoại thì báo cả hai', () => {
    const store = useOrderFlowStore.getState()
    store.setOrderingType(OrderTypeEnum.DELIVERY)
    store.setDeliveryPhone('123')

    const { result } = renderHook(() => useCartBlockers([]))

    expect(result.current.map((b) => b.code)).toEqual(['NO_ADDRESS', 'BAD_PHONE'])
  })

  it('đơn giao hàng đủ thông tin thì không còn điều kiện chặn', () => {
    const store = useOrderFlowStore.getState()
    store.setOrderingType(OrderTypeEnum.DELIVERY)
    store.setDeliveryAddress('12 Nguyễn Huệ')
    store.setDeliveryPhone('0901234567')

    const { result } = renderHook(() => useCartBlockers([]))

    expect(result.current).toHaveLength(0)
  })

  it('có món hết hàng thì chặn và trỏ tới đúng dòng', () => {
    const id = useOrderFlowStore.getState().orderingData!.orderItems[0].id
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.TAKE_OUT)

    const { result } = renderHook(() => useCartBlockers([id]))

    expect(result.current[0].code).toBe('SOLD_OUT')
    expect(result.current[0].targetId).toBe(`cart-row-${id}`)
  })
})
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/app/client/cart/hooks/__tests__/use-cart-blockers.test.tsx`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 4: Cài đặt**

Tạo `src/app/client/cart/hooks/use-cart-blockers.ts`:

```ts
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { PHONE_NUMBER_REGEX } from '@/constants'

export type TBlockerCode =
  | 'SOLD_OUT'
  | 'NO_TABLE'
  | 'NO_ADDRESS'
  | 'BAD_PHONE'
  | 'UNPRICED_CUSTOM'

export interface ICartBlocker {
  code: TBlockerCode
  label: string
  targetId: string
}

/**
 * Nguồn duy nhất quyết định nút đặt hàng có bị chặn hay không. Trước đây điều kiện
 * này được viết lại ở nhánh mobile, nhánh desktop và trong dialog nên đã trôi lệch
 * nhau, khiến mobile mở được dialog cho đơn giao hàng thiếu địa chỉ (P1-5).
 *
 * Hook KHÔNG chặn khi giỏ rỗng hoặc `orderingData` null — trang tự render màn hình
 * giỏ trống trước khi tới nút đặt hàng. Người gọi phải giữ nguyên guard đó.
 *
 * Hook cũng KHÔNG thay thế guard `!branchSlug` trong `handleSubmit` của
 * `CreateOrderDialog` — đó là kiểm tra lúc submit, không phải điều kiện disable.
 */
export function useCartBlockers(soldOutItemIds: string[]): ICartBlocker[] {
  const { t } = useTranslation('menu')
  const cart = useOrderFlowStore((state) => state.orderingData)
  // So sánh theo nội dung: người gọi thường truyền mảng literal mới mỗi render,
  // đưa thẳng mảng vào dependency sẽ làm memo mất tác dụng.
  const soldOutKey = soldOutItemIds.join(',')

  return useMemo(() => {
    const blockers: ICartBlocker[] = []
    if (!cart) return blockers

    const firstSoldOut = cart.orderItems.find((item) => soldOutItemIds.includes(item.id))
    if (firstSoldOut) {
      blockers.push({
        code: 'SOLD_OUT',
        label: t('menu.blockerSoldOut'),
        targetId: `cart-row-${firstSoldOut.id}`,
      })
    }

    const unpriced = cart.orderItems.find(
      (item) => item.isCustomPrice === true && !(item.customPrice != null && item.customPrice > 0),
    )
    if (unpriced) {
      blockers.push({
        code: 'UNPRICED_CUSTOM',
        label: t('menu.blockerUnpricedCustom'),
        targetId: `cart-row-${unpriced.id}`,
      })
    }

    if (cart.type === OrderTypeEnum.AT_TABLE && !cart.table) {
      blockers.push({
        code: 'NO_TABLE',
        label: t('menu.blockerNoTable'),
        targetId: 'cart-field-table',
      })
    }

    if (cart.type === OrderTypeEnum.DELIVERY) {
      if (!cart.deliveryAddress) {
        blockers.push({
          code: 'NO_ADDRESS',
          label: t('menu.blockerNoAddress'),
          targetId: 'cart-field-address',
        })
      }
      if (!cart.deliveryPhone || !PHONE_NUMBER_REGEX.test(cart.deliveryPhone)) {
        blockers.push({
          code: 'BAD_PHONE',
          label: t('menu.blockerBadPhone'),
          targetId: 'cart-field-phone',
        })
      }
    }

    return blockers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, soldOutKey, t])
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npx vitest run src/app/client/cart/hooks/__tests__/use-cart-blockers.test.tsx`
Expected: PASS (4 test).

- [ ] **Step 6: Commit**

```bash
git add src/app/client/cart/hooks/ src/locales/
git commit -m "TaskId: TRE-466-FE(8)-Optimize-cart: hook useCartBlockers"
```

---

## Task 9: `useCartRevalidation`

**Files:**
- Create: `src/app/client/cart/hooks/use-cart-revalidation.ts`
- Create: `src/app/client/cart/hooks/__tests__/use-cart-revalidation.test.tsx`
- Modify: `src/locales/vi/menu.json`, `src/locales/en/menu.json`

**Interfaces:**
- Produces: `useCartRevalidation(): { soldOutItemIds: string[]; isChecking: boolean }`
- Quy tắc hết hàng lấy đúng theo `client-menu-item.tsx:179`: món khả dụng khi `!menuItem.isLocked && (menuItem.currentStock > 0 || !menuItem.product.isLimit)`.

- [ ] **Step 1: Thêm khoá i18n**

`src/locales/vi/menu.json` nhóm `menu`:

```json
"soldOutInCart": "Hết hàng hôm nay",
"removeSoldOut": "Xoá khỏi giỏ"
```

`src/locales/en/menu.json`:

```json
"soldOutInCart": "Sold out today",
"removeSoldOut": "Remove from cart"
```

- [ ] **Step 2: Viết test thất bại**

Tạo `src/app/client/cart/hooks/__tests__/use-cart-revalidation.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOrderFlowStore } from '@/stores'
import { IOrderItem, IProductVariant } from '@/types'
import { useCartRevalidation } from '../use-cart-revalidation'

const menuItems = [
  { isLocked: false, currentStock: 0, product: { slug: 'banh-mi', isLimit: true } },
  { isLocked: false, currentStock: 99, product: { slug: 'tra-sua', isLimit: true } },
]

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>()
  return {
    ...actual,
    useSpecificMenu: () => ({ data: { result: { menuItems } }, isLoading: false }),
  }
})

const variant = { slug: 'v-m', price: 35000, size: { slug: 's-m', name: 'm' } } as IProductVariant

function addItem(slug: string) {
  useOrderFlowStore.getState().addOrderingItem({
    id: 'seed',
    slug,
    image: '',
    name: slug,
    quantity: 1,
    size: 'm',
    allVariants: [variant],
    variant,
    originalPrice: 35000,
    description: '',
    isLimit: true,
    isGift: false,
  } as IOrderItem)
}

describe('useCartRevalidation', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().initializeOrdering()
  })

  it('đánh dấu món hết hàng theo menu hôm nay', () => {
    addItem('banh-mi')
    addItem('tra-sua')
    const items = useOrderFlowStore.getState().orderingData!.orderItems

    const { result } = renderHook(() => useCartRevalidation())

    expect(result.current.soldOutItemIds).toEqual([items[0].id])
  })

  it('giỏ toàn món còn hàng thì danh sách rỗng', () => {
    addItem('tra-sua')

    const { result } = renderHook(() => useCartRevalidation())

    expect(result.current.soldOutItemIds).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/app/client/cart/hooks/__tests__/use-cart-revalidation.test.tsx`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 4: Cài đặt**

Tạo `src/app/client/cart/hooks/use-cart-revalidation.ts`:

```ts
import { useMemo } from 'react'
import moment from 'moment'

import { useSpecificMenu } from '@/hooks'
import { useBranchStore, useOrderFlowStore } from '@/stores'

/**
 * Giỏ hàng nằm trong localStorage nhiều ngày. Đối chiếu với menu hôm nay để báo
 * hết hàng ngay tại giỏ thay vì để đơn thất bại ở bước tạo đơn (P1-9).
 */
export function useCartRevalidation(): { soldOutItemIds: string[]; isChecking: boolean } {
  const { branch } = useBranchStore()
  const cart = useOrderFlowStore((state) => state.orderingData)
  const branchSlug = branch?.slug || ''

  const { data, isLoading } = useSpecificMenu(
    { branch: branchSlug, date: moment().format('YYYY-MM-DD') },
    !!branchSlug && !!cart?.orderItems?.length,
  )

  const soldOutItemIds = useMemo(() => {
    // `getSpecificMenu` trả IApiResponse<IPaginationResponse<ISpecificMenu>>:
    // menu nằm trong `result.items[0]`, không phải `result` trực tiếp. Đọc sai chỗ
    // thì hook luôn trả mảng rỗng và tính năng chết âm thầm dù test vẫn xanh.
    const menuItems = data?.result?.items?.[0]?.menuItems
    if (!menuItems || !cart?.orderItems?.length) return []

    return cart.orderItems
      .filter((item) => {
        const menuItem = menuItems.find((mi) => mi.product?.slug === item.slug)
        if (!menuItem) return false // không có trong menu hôm nay ⇒ để server quyết định
        const available =
          !menuItem.isLocked && (menuItem.currentStock > 0 || !menuItem.product?.isLimit)
        return !available
      })
      .map((item) => item.id)
  }, [data, cart])

  return { soldOutItemIds, isChecking: isLoading }
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npx vitest run src/app/client/cart/hooks/__tests__/use-cart-revalidation.test.tsx`
Expected: PASS (2 test). `useSpecificMenu` được xuất qua barrel `@/hooks` (`export * from './use-menu'`), đã kiểm chứng.

- [ ] **Step 6: Commit**

```bash
git add src/app/client/cart/hooks/ src/locales/
git commit -m "TaskId: TRE-466-FE(9)-Optimize-cart: kiem tra lai ton kho khi mo gio hang"
```

---

# Giai đoạn C — Component UI

## Task 10: Tab hình thức nhận hàng

**Files:**
- Create: `src/app/client/cart/components/order-type-tabs.tsx`
- Create: `src/app/client/cart/components/__tests__/order-type-tabs.test.tsx`
- Modify: `src/hooks/use-feature-lock.ts:32-39` (chỉ nếu chưa trả `isLoading` — `useQuery` đã trả sẵn, không cần sửa)

**Interfaces:**
- Consumes: `setOrderingType` (Task 2).
- Produces: component `<OrderTypeTabs />` không nhận prop, tự đọc store.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/app/client/cart/components/__tests__/order-type-tabs.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import OrderTypeTabs from '../order-type-tabs'

const flagsState = { data: undefined as unknown, isLoading: true }

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>()
  return {
    ...actual,
    useGetSystemFeatureFlagsByGroup: () => flagsState,
  }
})

describe('OrderTypeTabs', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().initializeOrdering()
    flagsState.data = undefined
    flagsState.isLoading = true
  })

  it('không tự đổi loại đơn khi feature flags còn đang tải', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.DELIVERY)

    render(<OrderTypeTabs />)

    expect(useOrderFlowStore.getState().orderingData?.type).toBe(OrderTypeEnum.DELIVERY)
  })

  it('bấm tab đổi loại đơn trong store', async () => {
    flagsState.isLoading = false
    flagsState.data = { result: [] }
    render(<OrderTypeTabs />)

    await userEvent.click(screen.getByRole('button', { name: /mang đi|take away/i }))

    expect(useOrderFlowStore.getState().orderingData?.type).toBe(OrderTypeEnum.TAKE_OUT)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/app/client/cart/components/__tests__/order-type-tabs.test.tsx`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Cài đặt**

Tạo `src/app/client/cart/components/order-type-tabs.tsx`:

```tsx
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { useGetSystemFeatureFlagsByGroup } from '@/hooks'
import {
  Role,
  SystemLockFeatureChild,
  SystemLockFeatureGroup,
  SystemLockFeatureType,
} from '@/constants'

const FEATURE_BY_TYPE: Record<string, string> = {
  [OrderTypeEnum.AT_TABLE]: SystemLockFeatureChild.AT_TABLE,
  [OrderTypeEnum.TAKE_OUT]: SystemLockFeatureChild.TAKE_OUT,
  [OrderTypeEnum.DELIVERY]: SystemLockFeatureChild.DELIVERY,
}

export default function OrderTypeTabs() {
  const { t } = useTranslation('menu')
  const cart = useOrderFlowStore((state) => state.orderingData)
  const setOrderingType = useOrderFlowStore((state) => state.setOrderingType)
  const { data: flagsResponse, isLoading, isSuccess } = useGetSystemFeatureFlagsByGroup(
    SystemLockFeatureGroup.ORDER,
  )

  const isCustomerLoggedIn =
    cart?.ownerRole === Role.CUSTOMER && cart?.ownerPhoneNumber !== 'default-customer'

  const availableTypes = useMemo(() => {
    const flags = flagsResponse?.result || []
    const parent = flags.find((p) =>
      isCustomerLoggedIn
        ? p.name === SystemLockFeatureType.CREATE_PRIVATE
        : p.name === SystemLockFeatureType.CREATE_PUBLIC,
    )
    const lockStatus: Record<string, boolean> = {}
    ;(parent?.children || []).forEach((child) => {
      lockStatus[child.name] = child.isLocked
    })

    const all = [
      { value: OrderTypeEnum.AT_TABLE, label: t('menu.dineIn') },
      { value: OrderTypeEnum.TAKE_OUT, label: t('menu.takeAway') },
    ]
    const hasDelivery = (parent?.children || []).some(
      (child) => child.name === SystemLockFeatureChild.DELIVERY,
    )
    if (isCustomerLoggedIn && hasDelivery) {
      all.push({ value: OrderTypeEnum.DELIVERY, label: t('menu.delivery') })
    }

    return all.filter((type) => lockStatus[FEATURE_BY_TYPE[type.value]] !== true)
  }, [flagsResponse, isCustomerLoggedIn, t])

  // Chỉ auto-switch khi flags đã tải THÀNH CÔNG. Chặn mỗi `isLoading` là chưa đủ:
  // khi query lỗi, `isLoading` về false trong khi `data` vẫn undefined, danh sách
  // rơi về [AT_TABLE, TAKE_OUT] và đơn giao hàng đã lưu lại bị đổi ngầm — đúng lỗi
  // P1-6, chỉ khác nguyên nhân kích hoạt. Dữ liệu không đầy đủ thì không được tự ý
  // đổi lựa chọn của khách.
  useEffect(() => {
    if (!isSuccess || availableTypes.length === 0) return
    const stillAvailable = availableTypes.some((type) => type.value === cart?.type)
    if (!stillAvailable) setOrderingType(availableTypes[0].value)
  }, [isSuccess, availableTypes, cart?.type, setOrderingType])

  if (isLoading || availableTypes.length === 0) {
    return <div className="w-full h-10 rounded-full animate-pulse bg-muted" />
  }

  if (availableTypes.length === 1) {
    return <p className="text-sm font-medium">{availableTypes[0].label}</p>
  }

  return (
    <div
      role="group"
      aria-label={t('menu.selectOrderType')}
      className="grid gap-0.5 p-[3px] rounded-full border bg-muted"
      style={{ gridTemplateColumns: `repeat(${availableTypes.length}, minmax(0, 1fr))` }}
    >
      {availableTypes.map((type) => {
        const active = cart?.type === type.value
        return (
          <button
            key={type.value}
            type="button"
            aria-pressed={active}
            onClick={() => setOrderingType(type.value)}
            className={cn(
              'rounded-full px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-primary font-semibold text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {type.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/app/client/cart/components/__tests__/order-type-tabs.test.tsx`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add src/app/client/cart/components/
git commit -m "TaskId: TRE-466-FE(10)-Optimize-cart: tab hinh thuc nhan hang"
```

---

## Task 11: Field theo loại đơn

**Files:**
- Create: `src/app/client/cart/components/fulfillment-fields.tsx`
- Modify: `src/components/app/select/table-select.tsx` (thêm `id="cart-field-table"` cho trigger)
- Modify: `src/app/client/cart/components/map-address-selector.tsx` (thêm `id="cart-field-address"` cho ô địa chỉ và `id="cart-field-phone"` cho ô SĐT)

**Interfaces:**
- Consumes: `TableInCartSelect`, `PickupTimeSelect`, `MapAddressSelector`.
- Produces: `<FulfillmentFields />` render đúng một nhóm field theo `cart.type`.

- [ ] **Step 1: Gắn id cho các ô nhập**

Trong `src/components/app/select/table-select.tsx`, thêm `id="cart-field-table"` vào `SelectTrigger`.

Trong `src/app/client/cart/components/map-address-selector.tsx`, thêm `id="cart-field-address"` vào `Input` địa chỉ (dòng ~296) và `id="cart-field-phone"` vào `Input` số điện thoại (dòng ~388).

- [ ] **Step 2: Viết component**

Tạo `src/app/client/cart/components/fulfillment-fields.tsx`:

```tsx
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { PickupTimeSelect, TableInCartSelect } from '@/components/app/select'

import MapAddressSelector from './map-address-selector'

export default function FulfillmentFields() {
  const type = useOrderFlowStore((state) => state.orderingData?.type)

  if (type === OrderTypeEnum.DELIVERY) return <MapAddressSelector />
  if (type === OrderTypeEnum.TAKE_OUT) return <PickupTimeSelect />
  return <TableInCartSelect />
}
```

- [ ] **Step 3: Kiểm tra biên dịch**

Run: `npx tsc -b`
Expected: không lỗi. Nếu `MapAddressSelector` được export mặc định dưới tên khác, chỉnh import theo `src/app/client/cart/components/index.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/app/client/cart/components/ src/components/app/select/table-select.tsx
git commit -m "TaskId: TRE-466-FE(11)-Optimize-cart: nhom field theo loai don"
```

---

## Task 12: Số lượng và ghi chú

**Files:**
- Modify: `src/components/app/button/quantity-selector.tsx`
- Modify: `src/components/app/input/cart-note-input.tsx`
- Test: `src/components/app/button/__tests__/quantity-selector.test.tsx`

**Interfaces:**
- Produces: `QuantitySelector` nhận thêm `onRequestRemove?: () => void`. Khi `quantity === 1` **và** callback được truyền, nút giảm chuyển thành icon thùng rác và gọi callback. Không truyền callback thì giữ nguyên hành vi cũ (icon `Minus`, dừng ở 1) — bốn nơi đang dùng component này đều đã có nút xoá riêng bên cạnh, đổi icon vô điều kiện sẽ tạo ra một nút xoá giả bấm không có tác dụng.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/components/app/button/__tests__/quantity-selector.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOrderFlowStore } from '@/stores'
import { IOrderItem, IProductVariant } from '@/types'
import QuantitySelector from '../quantity-selector'

const variant = { slug: 'v-m', price: 50000, size: { slug: 's-m', name: 'm' } } as IProductVariant

function seed(quantity: number): IOrderItem {
  const store = useOrderFlowStore.getState()
  store.initializeOrdering()
  store.addOrderingItem({
    id: 'seed',
    slug: 'tra-sua',
    image: '',
    name: 'Trà sữa',
    quantity,
    size: 'm',
    allVariants: [variant],
    variant,
    originalPrice: 50000,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
  return useOrderFlowStore.getState().orderingData!.orderItems[0]
}

describe('QuantitySelector', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().clearOrderingData()
  })

  it('tăng số lượng và ghi vào store', async () => {
    const item = seed(1)
    render(<QuantitySelector cartItem={item} onRequestRemove={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /tăng|increase/i }))

    expect(useOrderFlowStore.getState().orderingData!.orderItems[0].quantity).toBe(2)
  })

  it('ở số lượng 1 thì nút giảm gọi onRequestRemove thay vì giảm tiếp', async () => {
    const item = seed(1)
    const onRequestRemove = vi.fn()
    render(<QuantitySelector cartItem={item} onRequestRemove={onRequestRemove} />)

    await userEvent.click(screen.getByRole('button', { name: /xoá|remove/i }))

    expect(onRequestRemove).toHaveBeenCalledTimes(1)
    expect(useOrderFlowStore.getState().orderingData!.orderItems[0].quantity).toBe(1)
  })

  it('chặn ở trần 20', async () => {
    const item = seed(20)
    render(<QuantitySelector cartItem={item} onRequestRemove={vi.fn()} />)

    expect(screen.getByRole('button', { name: /tăng|increase/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/components/app/button/__tests__/quantity-selector.test.tsx`
Expected: FAIL — không có nút tên "xoá", nút tăng chưa bị disable.

- [ ] **Step 3: Viết lại QuantitySelector**

Thay toàn bộ `src/components/app/button/quantity-selector.tsx`:

```tsx
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui'
import { useOrderFlowStore } from '@/stores'
import { IOrderDetail, IOrderItem } from '@/types'

export const MAX_ITEM_QUANTITY = 20

interface QuantitySelectorProps {
  cartItem: IOrderDetail | IOrderItem
  onRequestRemove?: () => void
}

export default function QuantitySelector({ cartItem, onRequestRemove }: QuantitySelectorProps) {
  const { t } = useTranslation('menu')
  // Đọc thẳng từ store: giữ state cục bộ sẽ lệch khi giỏ bị đổi từ nơi khác.
  const quantity = cartItem.quantity
  const updateOrderingItemQuantity = useOrderFlowStore(
    (state) => state.updateOrderingItemQuantity,
  )

  const handleDecrement = () => {
    if (quantity <= 1) {
      onRequestRemove?.()
      return
    }
    updateOrderingItemQuantity(cartItem.id!, quantity - 1)
  }

  const handleIncrement = () => {
    if (quantity >= MAX_ITEM_QUANTITY) return
    updateOrderingItemQuantity(cartItem.id!, quantity + 1)
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border p-0.5">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDecrement}
        aria-label={quantity <= 1 ? t('menu.removeItem') : t('menu.decreaseQuantity')}
        className="rounded-full h-7 w-7 hover:bg-muted"
      >
        {quantity <= 1 ? <Trash2 size={12} /> : <Minus size={12} />}
      </Button>
      <span className="w-5 text-xs font-semibold text-center tabular-nums">{quantity}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleIncrement}
        disabled={quantity >= MAX_ITEM_QUANTITY}
        aria-label={t('menu.increaseQuantity')}
        className="rounded-full h-7 w-7 hover:bg-muted"
      >
        <Plus size={12} />
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Thêm khoá i18n**

`src/locales/vi/menu.json` nhóm `menu`:

```json
"increaseQuantity": "Tăng số lượng",
"decreaseQuantity": "Giảm số lượng",
"removeItem": "Xoá món"
```

`src/locales/en/menu.json`:

```json
"increaseQuantity": "Increase quantity",
"decreaseQuantity": "Decrease quantity",
"removeItem": "Remove item"
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npx vitest run src/components/app/button/__tests__/quantity-selector.test.tsx`
Expected: PASS (3 test).

- [ ] **Step 6: Debounce ghi chú**

Thay thân `src/components/app/input/cart-note-input.tsx`:

```tsx
import { NotepadText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChangeEvent, useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui'
import { useOrderFlowStore } from '@/stores'
import { IOrderItem } from '@/types'

const NOTE_MAX_LENGTH = 120
const DEBOUNCE_MS = 300

interface CartNoteInputProps {
  cartItem: IOrderItem
}

export default function CartNoteInput({ cartItem }: CartNoteInputProps) {
  const { t } = useTranslation('menu')
  const addNote = useOrderFlowStore((state) => state.addNote)
  const [value, setValue] = useState(cartItem?.note || '')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Ghi thẳng vào store mỗi ký tự sẽ render lại toàn trang và ghi localStorage
  // mỗi lần gõ; debounce để chỉ ghi khi khách dừng nhập.
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleNoteChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setValue(next)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => addNote(cartItem.id, next), DEBOUNCE_MS)
  }

  return (
    <div className="flex w-full flex-row items-center justify-center gap-2.5">
      <div className="flex flex-row flex-1 gap-2 justify-between items-center w-full">
        <NotepadText className="text-muted-foreground" size={16} />
        <Input
          value={value}
          maxLength={NOTE_MAX_LENGTH}
          type="text"
          className="h-7 text-[11px] xl:text-sm shadow-none dark:border-muted-foreground/60"
          placeholder={t('order.enterNote')}
          onChange={handleNoteChange}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/app/button/ src/components/app/input/cart-note-input.tsx src/locales/
git commit -m "TaskId: TRE-466-FE(12)-Optimize-cart: so luong dong bo store va ghi chu debounce"
```

---

## Task 13: Dòng sản phẩm

**Files:**
- Create: `src/app/client/cart/components/cart-item-row.tsx`
- Create: `src/app/client/cart/components/__tests__/cart-item-row.test.tsx`

**Interfaces:**
- Consumes: `ICartPricing['displayMap']` (Task 7), `ProductVariantSelect` (Task 4), `QuantitySelector` (Task 12).
- Produces:

```tsx
interface CartItemRowProps {
  item: IOrderItem
  display?: IDisplayCartItem
  isSoldOut: boolean
  onRemove: (item: IOrderItem) => void
}
```

- [ ] **Step 1: Viết test thất bại**

Tạo `src/app/client/cart/components/__tests__/cart-item-row.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IDisplayCartItem, IOrderItem, IProductVariant } from '@/types'
import CartItemRow from '../cart-item-row'

const variant = { slug: 'v-l', price: 55000, size: { slug: 's-l', name: 'l' } } as IProductVariant

const item = {
  id: 'it_2',
  slug: 'tra-sua',
  image: '',
  name: 'Trà sữa trân châu',
  quantity: 1,
  size: 'l',
  allVariants: [variant],
  variant,
  originalPrice: 55000,
  description: '',
  isLimit: false,
  isGift: false,
} as IOrderItem

const display = {
  ...item,
  finalPrice: 44000,
  priceAfterPromotion: 44000,
  promotionDiscount: 11000,
  voucherDiscount: 0,
} as IDisplayCartItem

describe('CartItemRow', () => {
  it('hiển thị giá của chính dòng đó và nhãn giảm giá bằng chữ', () => {
    render(<CartItemRow item={item} display={display} isSoldOut={false} onRemove={vi.fn()} />)

    expect(screen.getByText('44.000₫')).toBeInTheDocument()
    expect(screen.getByText('55.000₫')).toBeInTheDocument()
    expect(screen.getByText(/Giảm 20%/)).toBeInTheDocument()
  })

  it('gắn id để cuộn tới khi bị chặn đặt hàng', () => {
    const { container } = render(
      <CartItemRow item={item} display={display} isSoldOut={false} onRemove={vi.fn()} />,
    )

    expect(container.querySelector('#cart-row-it_2')).not.toBeNull()
  })

  it('hiện dải hết hàng khi món không còn bán', () => {
    render(<CartItemRow item={item} display={display} isSoldOut onRemove={vi.fn()} />)

    expect(screen.getByText(/Hết hàng hôm nay|Sold out today/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/app/client/cart/components/__tests__/cart-item-row.test.tsx`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Cài đặt**

Tạo `src/app/client/cart/components/cart-item-row.tsx`:

```tsx
import { AlertTriangle, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ProductImage } from '@/assets/images'
import { QuantitySelector } from '@/components/app/button'
import { CartNoteInput } from '@/components/app/input'
import { ProductVariantSelect } from '@/components/app/select'
import { Button } from '@/components/ui'
import { publicFileURL, VOUCHER_TYPE } from '@/constants'
import { cn } from '@/lib'
import { useOrderFlowStore } from '@/stores'
import { IDisplayCartItem, IOrderItem } from '@/types'
import { formatCurrency } from '@/utils'

interface CartItemRowProps {
  item: IOrderItem
  display?: IDisplayCartItem
  isSoldOut: boolean
  onRemove: (item: IOrderItem) => void
}

export default function CartItemRow({ item, display, isSoldOut, onRemove }: CartItemRowProps) {
  const { t } = useTranslation('menu')
  const voucher = useOrderFlowStore((state) => state.orderingData?.voucher)
  const changeOrderingItemVariant = useOrderFlowStore((state) => state.changeOrderingItemVariant)

  const original = item.originalPrice || 0
  const unitPrice = display?.finalPrice ?? original
  const hasDiscount = unitPrice < original
  const isSamePriceVoucher =
    voucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT &&
    (display?.voucherDiscount ?? 0) > 0
  const promotionPercent =
    original > 0 ? Math.round(((display?.promotionDiscount ?? 0) / original) * 100) : 0

  return (
    <article
      id={`cart-row-${item.id}`}
      className={cn(
        'grid grid-cols-[64px_minmax(0,1fr)] items-start gap-3 rounded-md border bg-white p-3 dark:bg-transparent sm:grid-cols-[80px_minmax(0,1fr)]',
        isSoldOut && 'border-amber-600 bg-amber-50 dark:bg-amber-950/20',
      )}
    >
      <img
        src={item.image ? `${publicFileURL}/${item.image}` : ProductImage}
        alt={item.name}
        width={80}
        height={80}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.src = ProductImage
        }}
        className="object-cover w-full rounded-md aspect-square"
      />

      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex gap-2 items-start">
          <h3 className="text-sm font-semibold truncate">{item.name}</h3>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${t('menu.removeItem')} ${item.name}`}
            onClick={() => onRemove(item)}
            className="ml-auto w-7 h-7 text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={14} />
          </Button>
        </div>

        {isSoldOut && (
          <div className="flex gap-2 items-center px-2 py-1.5 text-xs rounded-md text-amber-700 bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle size={14} />
            <span>{t('menu.soldOutInCart')}</span>
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="ml-auto underline whitespace-nowrap"
            >
              {t('menu.removeSoldOut')}
            </button>
          </div>
        )}

        {(isSamePriceVoucher || promotionPercent > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {isSamePriceVoucher ? (
              <span className="px-2 py-0.5 text-[11px] rounded-full border border-green-600 text-green-600 bg-green-600/10">
                {t('menu.samePriceBadge', { value: formatCurrency(unitPrice) })}
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[11px] rounded-full border border-primary text-primary bg-primary/10">
                {t('menu.promotionBadge', { value: promotionPercent })}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          {item.isCustomPrice ? (
            <span className="text-xs text-muted-foreground">x1</span>
          ) : (
            <>
              <ProductVariantSelect
                variants={item.allVariants}
                value={item.variant?.slug}
                fallbackLabel={item.size}
                onChange={(slug) => changeOrderingItemVariant(item.id, slug)}
              />
              <QuantitySelector cartItem={item} onRequestRemove={() => onRemove(item)} />
            </>
          )}

          <div className="flex gap-1.5 items-baseline">
            {hasDiscount && (
              <span className="text-xs line-through text-muted-foreground tabular-nums">
                {formatCurrency(original)}
              </span>
            )}
            <span className="text-sm font-bold text-primary tabular-nums">
              {formatCurrency(unitPrice)}
            </span>
          </div>

          <span className="ml-auto text-sm font-bold tabular-nums">
            {formatCurrency(unitPrice * item.quantity)}
          </span>
        </div>

        <CartNoteInput cartItem={item} />
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Thêm khoá i18n**

`src/locales/vi/menu.json` nhóm `menu`:

```json
"promotionBadge": "Giảm {{value}}%",
"samePriceBadge": "Đồng giá {{value}}"
```

`src/locales/en/menu.json`:

```json
"promotionBadge": "{{value}}% off",
"samePriceBadge": "Flat {{value}}"
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npx vitest run src/app/client/cart/components/__tests__/cart-item-row.test.tsx`
Expected: PASS (3 test).

- [ ] **Step 6: Commit**

```bash
git add src/app/client/cart/components/ src/locales/
git commit -m "TaskId: TRE-466-FE(13)-Optimize-cart: dong san pham trong gio hang"
```

---

## Task 14: Khối tổng thanh toán

**Files:**
- Create: `src/app/client/cart/components/cart-summary.tsx`
- Create: `src/app/client/cart/components/__tests__/cart-summary.test.tsx`

**Interfaces:**
- Consumes: `ICartPricing` (Task 7).
- Produces: `<CartSummary pricing={pricing} />`.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/app/client/cart/components/__tests__/cart-summary.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import CartSummary from '../cart-summary'
import { ICartPricing } from '../../hooks/use-cart-pricing'

const pricing: ICartPricing = {
  displayMap: new Map(),
  subTotalBeforeDiscount: 174000,
  promotionDiscount: 29000,
  voucherDiscount: 4000,
  deliveryFee: 0,
  finalTotal: 141000,
  savedTotal: 33000,
}

describe('CartSummary', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().initializeOrdering()
  })

  it('không hiện dòng phí giao hàng cho đơn tại bàn', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.AT_TABLE)

    render(<CartSummary pricing={pricing} />)

    expect(screen.queryByText(/phí giao hàng|delivery fee/i)).toBeNull()
    // `formatCurrency` dùng dấu phẩy + ' đ' (xem src/utils/formatCurrency.ts),
    // không phải dấu chấm + '₫'.
    expect(screen.getByText('141,000 đ')).toBeInTheDocument()
  })

  it('hiện dòng phí giao hàng cho đơn giao hàng', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.DELIVERY)

    render(<CartSummary pricing={{ ...pricing, deliveryFee: 16000, finalTotal: 157000 }} />)

    expect(screen.getByText(/phí giao hàng|delivery fee/i)).toBeInTheDocument()
    expect(screen.getByText('157,000 đ')).toBeInTheDocument()
  })

  it('hiện số tiền tiết kiệm khi có giảm giá', () => {
    render(<CartSummary pricing={pricing} />)

    expect(screen.getByText(/33,000 đ/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/app/client/cart/components/__tests__/cart-summary.test.tsx`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Cài đặt**

Tạo `src/app/client/cart/components/cart-summary.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { formatCurrency } from '@/utils'

import { ICartPricing } from '../hooks/use-cart-pricing'

interface CartSummaryProps {
  pricing: ICartPricing
}

export default function CartSummary({ pricing }: CartSummaryProps) {
  const { t } = useTranslation('menu')
  const cart = useOrderFlowStore((state) => state.orderingData)
  const isDelivery = cart?.type === OrderTypeEnum.DELIVERY

  return (
    <section className="p-4 bg-white rounded-md border dark:bg-transparent">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
        {t('order.totalPayment')}
      </h2>

      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <span>{t('order.subtotalBeforeDiscount')}</span>
          <span className="tabular-nums">{formatCurrency(pricing.subTotalBeforeDiscount)}</span>
        </div>

        {pricing.promotionDiscount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>{t('order.promotionDiscount')}</span>
            <span className="tabular-nums">−{formatCurrency(pricing.promotionDiscount)}</span>
          </div>
        )}

        {pricing.voucherDiscount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>
              {t('order.voucherDiscount')} {cart?.voucher?.code ? `· ${cart.voucher.code}` : ''}
            </span>
            <span className="tabular-nums">−{formatCurrency(pricing.voucherDiscount)}</span>
          </div>
        )}

        {/* Neo dòng hiển thị vào CHÍNH con số được cộng vào tổng, không neo vào
            `cart.type` — hai nguồn khác nhau trôi lệch nhau đúng là cách P0-1 sinh ra.
            `isDelivery` chỉ thêm vào để đơn giao hàng chưa có địa chỉ vẫn thấy dòng
            gợi ý nhập địa chỉ. Bất biến: fee > 0 thì LUÔN có dòng, không ngoại lệ. */}
        {(isDelivery || pricing.deliveryFee > 0) && (
          <div className="flex justify-between">
            <span>{t('order.deliveryFee')}</span>
            <span className="tabular-nums">
              {pricing.deliveryFee > 0 ? formatCurrency(pricing.deliveryFee) : '—'}
            </span>
          </div>
        )}

        <div className="flex justify-between items-baseline pt-3 mt-1 font-semibold border-t text-foreground">
          <span>{t('order.totalPayment')}</span>
          <span className="text-xl font-bold text-primary tabular-nums">
            {formatCurrency(pricing.finalTotal)}
          </span>
        </div>
      </div>

      {pricing.savedTotal > 0 && (
        <p className="px-3 py-2 mt-3 text-xs text-center text-green-600 rounded-md bg-green-600/10">
          {t('order.youSaved')}{' '}
          <b className="tabular-nums">{formatCurrency(pricing.savedTotal)}</b>
        </p>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Thêm khoá i18n**

`src/locales/vi/menu.json` nhóm `order`: `"youSaved": "Bạn đã tiết kiệm"`
`src/locales/en/menu.json` nhóm `order`: `"youSaved": "You saved"`

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npx vitest run src/app/client/cart/components/__tests__/cart-summary.test.tsx`
Expected: PASS (3 test).

- [ ] **Step 6: Commit**

```bash
git add src/app/client/cart/components/ src/locales/
git commit -m "TaskId: TRE-466-FE(14)-Optimize-cart: khoi tong thanh toan minh bach"
```

---

## Task 15: Nút đặt hàng và danh sách còn thiếu

**Files:**
- Create: `src/app/client/cart/components/cart-actions.tsx`
- Create: `src/app/client/cart/components/__tests__/cart-actions.test.tsx`

**Interfaces:**
- Consumes: `ICartBlocker` (Task 8), `ICartPricing` (Task 7), `CreateOrderDialog`.
- Produces: `<CartActions pricing={pricing} blockers={blockers} />`.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/app/client/cart/components/__tests__/cart-actions.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CartActions from '../cart-actions'
import { ICartPricing } from '../../hooks/use-cart-pricing'

vi.mock('@/components/app/dialog', () => ({
  CreateOrderDialog: ({ disabled }: { disabled?: boolean }) => (
    <button type="button" disabled={disabled}>
      Đặt hàng
    </button>
  ),
}))

const pricing: ICartPricing = {
  displayMap: new Map(),
  subTotalBeforeDiscount: 100000,
  promotionDiscount: 0,
  voucherDiscount: 0,
  deliveryFee: 0,
  finalTotal: 100000,
  savedTotal: 0,
}

describe('CartActions', () => {
  it('disable nút đặt hàng khi còn điều kiện chặn', () => {
    render(
      <CartActions
        pricing={pricing}
        blockers={[{ code: 'NO_TABLE', label: 'Chọn bàn', targetId: 'cart-field-table' }]}
      />,
    )

    expect(screen.getByRole('button', { name: /đặt hàng/i })).toBeDisabled()
    expect(screen.getByText(/Chọn bàn/)).toBeInTheDocument()
  })

  it('bấm vào điều kiện chặn thì cuộn tới đúng phần tử', async () => {
    const target = document.createElement('div')
    target.id = 'cart-field-table'
    target.scrollIntoView = vi.fn()
    document.body.appendChild(target)

    render(
      <CartActions
        pricing={pricing}
        blockers={[{ code: 'NO_TABLE', label: 'Chọn bàn', targetId: 'cart-field-table' }]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Chọn bàn/ }))

    expect(target.scrollIntoView).toHaveBeenCalled()
    document.body.removeChild(target)
  })

  it('bật nút đặt hàng khi không còn điều kiện chặn', () => {
    render(<CartActions pricing={pricing} blockers={[]} />)

    expect(screen.getByRole('button', { name: /đặt hàng/i })).toBeEnabled()
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/app/client/cart/components/__tests__/cart-actions.test.tsx`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Cài đặt**

Tạo `src/app/client/cart/components/cart-actions.tsx`:

```tsx
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CreateOrderDialog } from '@/components/app/dialog'
import { formatCurrency } from '@/utils'

import { ICartBlocker } from '../hooks/use-cart-blockers'
import { ICartPricing } from '../hooks/use-cart-pricing'

interface CartActionsProps {
  pricing: ICartPricing
  blockers: ICartBlocker[]
}

export default function CartActions({ pricing, blockers }: CartActionsProps) {
  const { t } = useTranslation('menu')

  const focusTarget = (targetId: string) => {
    const el = document.getElementById(targetId)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    if (el instanceof HTMLElement) el.focus({ preventScroll: true })
  }

  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-2 -mx-4 border-t bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 dark:bg-background lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:pt-0 dark:lg:bg-transparent">
      {blockers.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {blockers.map((blocker) => (
            <li key={blocker.code}>
              <button
                type="button"
                onClick={() => focusTarget(blocker.targetId)}
                className="flex gap-2 items-center px-3 py-2 w-full text-xs text-left rounded-md border border-transparent text-destructive bg-destructive/10 hover:border-destructive"
              >
                <span>
                  {t('menu.blockerPrefix')}: {blocker.label}
                </span>
                <ChevronRight size={14} className="ml-auto opacity-70" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-between items-baseline text-sm text-muted-foreground lg:hidden">
        <span>{t('order.totalPayment')}</span>
        <b className="text-lg text-primary tabular-nums">{formatCurrency(pricing.finalTotal)}</b>
      </div>

      <CreateOrderDialog
        disabled={blockers.length > 0}
        disabledText={blockers.length > 0 ? blockers[0].label : undefined}
      />
    </div>
  )
}
```

Prop `totalAmount` / `deliveryFee` sẽ được thêm ở Task 17 khi `CreateOrderDialog` đổi chữ ký; ở task này component vẫn tự tính như cũ nên `tsc` sạch.

- [ ] **Step 4: Chạy test và kiểm tra biên dịch**

Run: `npx vitest run src/app/client/cart/components/__tests__/cart-actions.test.tsx && npx tsc -b`
Expected: PASS (3 test), không lỗi biên dịch.

- [ ] **Step 5: Commit**

```bash
git add src/app/client/cart/components/
git commit -m "TaskId: TRE-466-FE(15)-Optimize-cart: nut dat hang va danh sach con thieu"
```

---

## Task 16: Trạng thái rỗng và error boundary

**Files:**
- Create: `src/app/client/cart/components/cart-empty.tsx`
- Create: `src/app/client/cart/components/cart-error.tsx`
- Create: `src/app/client/cart/components/__tests__/cart-error.test.tsx`

**Interfaces:**
- Produces: `<CartEmpty />`; `<CartErrorBoundary>{children}</CartErrorBoundary>`.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/app/client/cart/components/__tests__/cart-error.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CartErrorBoundary from '../cart-error'

function Boom(): JSX.Element {
  throw new Error("Cannot read properties of undefined (reading 'slug')")
}

describe('CartErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hiện lối thoát thay vì màn hình trắng khi cây con ném lỗi', () => {
    render(
      <MemoryRouter>
        <CartErrorBoundary>
          <Boom />
        </CartErrorBoundary>
      </MemoryRouter>,
    )

    expect(screen.getByText(/CART_HYDRATE_FAILED/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /xoá giỏ hàng|clear cart/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/app/client/cart/components/__tests__/cart-error.test.tsx`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Cài đặt error boundary**

Tạo `src/app/client/cart/components/cart-error.tsx`:

```tsx
import { Component, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { Button } from '@/components/ui'
import { ROUTE } from '@/constants'
import { useOrderFlowStore } from '@/stores'

function CartErrorFallback() {
  const { t } = useTranslation('menu')
  const clearCart = useOrderFlowStore((state) => state.clearCart)

  return (
    <div className="flex flex-col gap-3 justify-center items-center px-5 py-16 text-center">
      <AlertTriangle className="w-10 h-10 text-destructive" />
      <h2 className="text-lg font-semibold">{t('menu.cartErrorTitle')}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{t('menu.cartErrorDescription')}</p>
      <div className="flex flex-wrap gap-2 justify-center mt-1">
        <Button
          onClick={() => {
            clearCart()
            window.location.reload()
          }}
        >
          {t('menu.cartErrorClear')}
        </Button>
        <NavLink to={ROUTE.CLIENT_MENU}>
          <Button variant="outline">{t('order.backToMenu')}</Button>
        </NavLink>
      </div>
      <p className="text-[11px] text-muted-foreground">CART_HYDRATE_FAILED</p>
    </div>
  )
}

interface CartErrorBoundaryProps {
  children: ReactNode
}

export default class CartErrorBoundary extends Component<
  CartErrorBoundaryProps,
  { hasError: boolean }
> {
  constructor(props: CartErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return <CartErrorFallback />
    return this.props.children
  }
}
```

- [ ] **Step 4: Cài đặt trạng thái rỗng**

Tạo `src/app/client/cart/components/cart-empty.tsx`:

```tsx
import { ShoppingCartIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { Button } from '@/components/ui'
import { ROUTE } from '@/constants'

export default function CartEmpty() {
  const { t } = useTranslation('menu')

  return (
    <div className="flex flex-col gap-4 justify-center items-center px-5 py-20 text-center">
      <ShoppingCartIcon className="w-16 h-16 text-primary" />
      <h2 className="text-lg font-semibold">{t('order.noOrders')}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{t('menu.cartEmptyDescription')}</p>
      <NavLink to={ROUTE.CLIENT_MENU}>
        <Button>{t('order.backToMenu')}</Button>
      </NavLink>
    </div>
  )
}
```

- [ ] **Step 5: Thêm khoá i18n**

`src/locales/vi/menu.json` nhóm `menu`:

```json
"cartEmptyDescription": "Chọn món từ thực đơn để bắt đầu đặt hàng.",
"cartErrorTitle": "Không mở được giỏ hàng",
"cartErrorDescription": "Dữ liệu giỏ hàng lưu trên máy đã hỏng hoặc thuộc phiên bản cũ. Xoá giỏ hàng sẽ khắc phục, các món cần đặt lại.",
"cartErrorClear": "Xoá giỏ hàng & tải lại"
```

`src/locales/en/menu.json`:

```json
"cartEmptyDescription": "Pick something from the menu to start your order.",
"cartErrorTitle": "Can't open your cart",
"cartErrorDescription": "The cart data saved on this device is corrupted or from an older version. Clearing it fixes the problem; you'll need to add the items again.",
"cartErrorClear": "Clear cart & reload"
```

- [ ] **Step 6: Chạy test để xác nhận pass**

Run: `npx vitest run src/app/client/cart/components/__tests__/cart-error.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/client/cart/components/ src/locales/
git commit -m "TaskId: TRE-466-FE(16)-Optimize-cart: trang thai rong va error boundary"
```

---

# Giai đoạn D — Lắp ráp

## Task 17: `CreateOrderDialog` nhận tổng tiền qua props

**Files:**
- Modify: `src/components/app/dialog/create-order-dialog.tsx`

**Interfaces:**
- Consumes: `pricing.finalTotal`, `pricing.deliveryFee` (Task 7).
- Produces: props mới `totalAmount: number`, `deliveryFee: number`; bỏ `useCalculateDeliveryFee` khỏi dialog.

- [ ] **Step 1: Đổi chữ ký props**

```tsx
interface IPlaceOrderDialogProps {
  onSuccess?: () => void
  disabled?: boolean | undefined
  disabledText?: string
  onSuccessfulOrder?: () => void
  totalAmount: number
  deliveryFee: number
}
```

Xoá dòng `const deliveryFee = useCalculateDeliveryFee(...)` và bỏ `useCalculateDeliveryFee`, `parseKm` khỏi import.

- [ ] **Step 2: Dùng props trong phần hiển thị**

Thay dòng phí giao hàng:

```tsx
{order?.type === OrderTypeEnum.DELIVERY && (
  <div className="flex gap-2 justify-between items-center w-full text-sm text-muted-foreground">
    <span className="italic">{t('order.deliveryFee')}:&nbsp;</span>
    <span className="italic tabular-nums">{formatCurrency(deliveryFee)}</span>
  </div>
)}
```

Thay dòng tổng:

```tsx
<span className="text-2xl font-extrabold text-primary tabular-nums">
  {formatCurrency(totalAmount)}
</span>
```

- [ ] **Step 3: Sửa spinner**

Hai chỗ (dòng ~149 và ~366) đang là `{isPending || isPendingWithoutLogin && <Loader2 />}`. `&&` có độ ưu tiên cao hơn `||` nên khi `isPending === true` biểu thức trả về `true` và React không render gì. Thay bằng:

```tsx
{(isPending || isPendingWithoutLogin) && <Loader2 className="w-4 h-4 animate-spin" />}
```

- [ ] **Step 4: Kiểm tra biên dịch**

Run: `npx tsc -b`
Expected: báo lỗi thiếu prop ở mọi nơi dùng `CreateOrderDialog`. Chạy `grep -rn "CreateOrderDialog" src/` và truyền `totalAmount` / `deliveryFee` cho từng chỗ. Với các trang ngoài `/cart`, dùng giá trị đang tính sẵn tại chỗ đó.

- [ ] **Step 5: Chạy toàn bộ test**

Run: `npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/dialog/create-order-dialog.tsx src/
git commit -m "TaskId: TRE-466-FE(17)-Optimize-cart: dialog nhan tong tien qua props"
```

---

## Task 18: Viết lại `page.tsx`

**Files:**
- Modify: `src/app/client/cart/page.tsx` (viết lại toàn bộ)
- Modify: `src/app/client/cart/components/index.tsx` (export các component mới)

**Interfaces:**
- Consumes: tất cả hook và component từ Task 7–16.

- [ ] **Step 1: Cập nhật barrel**

`src/app/client/cart/components/index.tsx`:

```ts
export { default as MapAddressSelector } from './map-address-selector'
export { default as OrderTypeTabs } from './order-type-tabs'
export { default as FulfillmentFields } from './fulfillment-fields'
export { default as CartItemRow } from './cart-item-row'
export { default as CartSummary } from './cart-summary'
export { default as CartActions } from './cart-actions'
export { default as CartEmpty } from './cart-empty'
export { default as CartErrorBoundary } from './cart-error'
```

- [ ] **Step 2: Viết lại page**

Thay toàn bộ `src/app/client/cart/page.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import _ from 'lodash'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'

import { DeleteAllCartDialog } from '@/components/app/dialog'
import { OrderNoteInput } from '@/components/app/input'
import { VoucherListSheet } from '@/components/app/sheet'
import { Button } from '@/components/ui'
import { useOrderFlowStore } from '@/stores'
import { IOrderItem } from '@/types'
import { showToast } from '@/utils'

import {
  CartActions,
  CartEmpty,
  CartErrorBoundary,
  CartItemRow,
  CartSummary,
  FulfillmentFields,
  OrderTypeTabs,
} from './components'
import { useCartBlockers } from './hooks/use-cart-blockers'
import { useCartPricing } from './hooks/use-cart-pricing'
import { useCartRevalidation } from './hooks/use-cart-revalidation'

const UNDO_WINDOW_MS = 5000

function CartPageContent() {
  const { t } = useTranslation('menu')
  const { t: tHelmet } = useTranslation('helmet')

  const cart = useOrderFlowStore((state) => state.orderingData)
  const removeCartItem = useOrderFlowStore((state) => state.removeCartItem)
  const setOrderingData = useOrderFlowStore((state) => state.setOrderingData)

  const { soldOutItemIds } = useCartRevalidation()
  const pricing = useCartPricing()
  const blockers = useCartBlockers(soldOutItemIds)

  const [pendingUndo, setPendingUndo] = useState<{ item: IOrderItem; index: number } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => () => clearTimeout(undoTimer.current), [])

  const handleRemove = useCallback(
    (item: IOrderItem) => {
      const index = cart?.orderItems.findIndex((i) => i.id === item.id) ?? -1
      removeCartItem(item.id)
      setPendingUndo({ item, index: index < 0 ? 0 : index })
      clearTimeout(undoTimer.current)
      undoTimer.current = setTimeout(() => setPendingUndo(null), UNDO_WINDOW_MS)
    },
    [cart, removeCartItem],
  )

  const handleUndo = useCallback(() => {
    const current = useOrderFlowStore.getState().orderingData
    if (!pendingUndo || !current) return
    const items = [...current.orderItems]
    items.splice(pendingUndo.index, 0, pendingUndo.item)
    setOrderingData({ ...current, orderItems: items })
    setPendingUndo(null)
    clearTimeout(undoTimer.current)
  }, [pendingUndo, setOrderingData])

  if (_.isEmpty(cart?.orderItems)) return <CartEmpty />

  return (
    <div className="container py-6 lg:py-10">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.cart.title')}</title>
        <meta name="description" content={tHelmet('helmet.cart.title')} />
      </Helmet>

      <div className="grid gap-4 items-start lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-5">
        <div className="flex flex-col gap-3 min-w-0">
          <section className="p-4 bg-white rounded-md border dark:bg-transparent">
            <div className="flex gap-2 justify-between items-center mb-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                {t('menu.fulfillmentTitle')}
              </h2>
              <DeleteAllCartDialog />
            </div>
            <OrderTypeTabs />
            <div className="mt-3">
              <FulfillmentFields />
            </div>
          </section>

          <div className="flex flex-col gap-2.5">
            {cart?.orderItems.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                display={pricing.displayMap.get(item.id)}
                isSoldOut={soldOutItemIds.includes(item.id)}
                onRemove={handleRemove}
              />
            ))}
          </div>

          <section className="p-4 bg-white rounded-md border dark:bg-transparent">
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              {t('order.note')}
            </h2>
            <OrderNoteInput order={cart} />
          </section>

          <section className="p-4 bg-white rounded-md border dark:bg-transparent">
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              {t('order.voucher')}
            </h2>
            <VoucherListSheet />
          </section>
        </div>

        <div className="flex flex-col gap-3 min-w-0 lg:sticky lg:top-20">
          <CartSummary pricing={pricing} />
          <CartActions pricing={pricing} blockers={blockers} />
        </div>
      </div>

      {pendingUndo && (
        <div className="fixed inset-x-0 bottom-24 z-50 px-4 mx-auto w-full max-w-sm">
          <div className="flex gap-3 items-center px-3 py-2.5 text-sm text-white rounded-lg shadow-lg bg-neutral-900">
            <span className="truncate">
              {t('menu.itemRemoved', { name: pendingUndo.item.name })}
            </span>
            <Button
              variant="ghost"
              onClick={handleUndo}
              className="px-2 ml-auto h-auto font-bold text-primary hover:bg-white/10"
            >
              {t('menu.undo')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ClientCartPage() {
  return (
    <CartErrorBoundary>
      <CartPageContent />
    </CartErrorBoundary>
  )
}
```

Ghi chú: `showToast` được import nhưng chưa dùng — xoá dòng import đó nếu lint báo.

- [ ] **Step 3: Thêm khoá i18n**

`src/locales/vi/menu.json` nhóm `menu`:

```json
"fulfillmentTitle": "Hình thức nhận hàng",
"itemRemoved": "Đã xoá {{name}}",
"undo": "Hoàn tác"
```

`src/locales/en/menu.json`:

```json
"fulfillmentTitle": "Fulfillment",
"itemRemoved": "Removed {{name}}",
"undo": "Undo"
```

- [ ] **Step 4: Kiểm tra biên dịch và lint**

Run: `npx tsc -b && npm run lint`
Expected: không lỗi. Xử lý mọi import không dùng còn sót.

- [ ] **Step 5: Kiểm tra bằng mắt**

Run: `npm run dev`
Mở `http://localhost:5173/cart` và đối chiếu với UI tham chiếu. Kiểm 8 mục nghiệm thu ở mục 9 của spec, đặc biệt:
- Thu hẹp cửa sổ xuống dưới 1024px → thanh đặt hàng dính đáy, không che nội dung.
- Mở rộng trên 1024px → hai cột, nút đặt hàng không có nền riêng.

- [ ] **Step 6: Commit**

```bash
git add src/app/client/cart/ src/locales/
git commit -m "TaskId: TRE-466-FE(18)-Optimize-cart: viet lai trang gio hang mot cay responsive"
```

---

## Task 19: Dọn dẹp

**Files:**
- Modify: `src/components/app/sheet/voucher-list-sheet.tsx` (gỡ effect kiểm tra trùng)
- Verify: toàn bộ dự án

- [ ] **Step 1: Gom logic gỡ voucher về một chỗ**

Trang mới không còn 3 useEffect kiểm tra voucher. `voucher-list-sheet.tsx` đã có effect kiểm tra `minOrderValue` và `maxItems` (dòng ~238–246) — giữ nguyên đó làm nguồn duy nhất.

Chạy `grep -rn "showErrorToast(1004)\|showErrorToast(143422)\|voucherMaxItemsExceeded" src/` và xác nhận mỗi thông báo chỉ còn đúng một chỗ phát ra.

- [ ] **Step 2: Xác nhận không còn tham chiếu chết**

Run:

```bash
grep -rn "useIsMobile" src/app/client/cart/
grep -rn "DeleteCartItemDialog" src/app/client/cart/
grep -rn "addOrderingProductVariant" src/
```

Expected: cả ba lệnh không ra kết quả.

- [ ] **Step 3: Chạy toàn bộ kiểm tra**

Run: `npm run lint && npx tsc -b && npx vitest run`
Expected: PASS toàn bộ, không cảnh báo mới.

- [ ] **Step 4: Kiểm tra bundle build được**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "TaskId: TRE-466-FE(19)-Optimize-cart: don dep sau refactor gio hang"
```

---

## Đối chiếu spec

| Mục spec | Task |
| --- | --- |
| 3. Kiến trúc component | 10–16, 18 |
| 4.1 Giá theo `item.id` | 1, 7 |
| 4.2 Phí giao hàng | 2, 7, 14 |
| 4.3 Đổi size | 3, 4 |
| 4.4 Điều kiện chặn | 8, 15 |
| 4.5 Kiểm tra lại giỏ | 9, 13 |
| 5.1 Bố cục | 18 |
| 5.2 Tab nhận hàng | 10, 11 |
| 5.3 Dòng sản phẩm | 12, 13 |
| 5.4 Tổng thanh toán | 14 |
| 5.5 Xoá món + hoàn tác | 12, 18 |
| 5.6 Rỗng và lỗi | 16 |
| 6. Hiệu năng | 7, 12, 13, 17 |
| 7. Bảng lỗi P0-1..P1-11 | 1–6, 8, 9, 12, 17 |
| 9. Nghiệm thu 1–8 | 18 Step 5 |
