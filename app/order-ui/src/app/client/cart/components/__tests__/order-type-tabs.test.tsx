import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { SystemLockFeatureChild, SystemLockFeatureType } from '@/constants'
import OrderTypeTabs from '../order-type-tabs'

// i18next chưa được khởi tạo trong môi trường test: `useTranslation` thật trả về một
// hàm `t` MỚI mỗi render (phá vỡ các assertion phụ thuộc tham chiếu ổn định) và
// `t('menu.takeAway')` trả thẳng chuỗi khoá thay vì bản dịch tiếng Việt. Mock `t` ở
// PHẠM VI MODULE để có tham chiếu ổn định (convention từ
// customer-analytics-panel.test.tsx), và để `t` trả thẳng khoá — vì vậy assertion tìm
// nút bằng bản dịch tiếng Việt trong brief gốc (`/mang đi|take away/i`) không dùng được
// ở đây; tìm theo khoá `menu.takeAway` mà `t` trả về thay thế.
const t = (key: string) => key
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
}))

// `useGetSystemFeatureFlagsByGroup` là react-query thật, trả cả `isLoading` VÀ
// `isSuccess`. Mock đủ cả hai vì Finding 1 (review round 1) chỉ ra guard chặn theo
// `isLoading` là chưa đủ: khi query LỖI, `isLoading` về `false` nhưng `data` vẫn
// `undefined` — phải phân biệt được "đang tải" với "tải xong nhưng lỗi" bằng `isSuccess`.
const flagsState = { data: undefined as unknown, isLoading: true, isSuccess: false }

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
    flagsState.isSuccess = false
  })

  it('không tự đổi loại đơn khi feature flags còn đang tải', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.DELIVERY)

    render(<OrderTypeTabs />)

    expect(useOrderFlowStore.getState().orderingData?.type).toBe(OrderTypeEnum.DELIVERY)
  })

  // Finding 1 (Critical, review round 1): guard chỉ chặn theo `isLoading` không đủ.
  // Khi query LỖI (mạng chập chờn, backend lỗi, hết retry), react-query trả
  // `isLoading: false` NHƯNG `data` vẫn `undefined` — `isSuccess` mới phân biệt được
  // "tải xong" với "tải xong nhưng lỗi". Không phân biệt sẽ khiến `availableTypes` rơi
  // về [AT_TABLE, TAKE_OUT] và đơn giao hàng đã lưu bị đổi ngầm — đúng lỗi P1-6, chỉ
  // khác nguyên nhân kích hoạt. Test này phải FAIL trước khi sửa guard sang `isSuccess`.
  it('không tự đổi loại đơn khi feature flags tải lỗi (isLoading=false nhưng isSuccess=false)', () => {
    flagsState.isLoading = false
    flagsState.isSuccess = false
    flagsState.data = undefined
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.DELIVERY)

    render(<OrderTypeTabs />)

    expect(useOrderFlowStore.getState().orderingData?.type).toBe(OrderTypeEnum.DELIVERY)
  })

  // Chứng minh effect auto-switch VẪN hoạt động sau khi siết guard sang `isSuccess` —
  // nếu không có test này, việc thắt chặt guard ở Finding 1 có thể vô tình vô hiệu hoá
  // luôn auto-switch hợp lệ (flags tải THÀNH CÔNG nhưng loại đơn đã lưu không còn khả dụng).
  it('tự đổi sang loại khả dụng đầu tiên khi flags tải xong và loại đã lưu không còn khả dụng', () => {
    flagsState.isLoading = false
    flagsState.isSuccess = true
    flagsState.data = { result: [] }
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.DELIVERY)

    render(<OrderTypeTabs />)

    expect(useOrderFlowStore.getState().orderingData?.type).toBe(OrderTypeEnum.AT_TABLE)
  })

  it('bấm tab đổi loại đơn trong store', async () => {
    flagsState.isLoading = false
    flagsState.isSuccess = true
    flagsState.data = { result: [] }
    render(<OrderTypeTabs />)

    await userEvent.click(screen.getByRole('button', { name: 'menu.takeAway' }))

    expect(useOrderFlowStore.getState().orderingData?.type).toBe(OrderTypeEnum.TAKE_OUT)
  })

  it('chỉ còn 1 loại khả dụng thì hiển thị text tĩnh, không phải nhóm nút', () => {
    flagsState.isLoading = false
    flagsState.isSuccess = true
    flagsState.data = {
      result: [
        {
          name: SystemLockFeatureType.CREATE_PUBLIC,
          children: [
            { name: SystemLockFeatureChild.AT_TABLE, isLocked: true },
            { name: SystemLockFeatureChild.TAKE_OUT, isLocked: false },
          ],
        },
      ],
    }

    render(<OrderTypeTabs />)

    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.getByText('menu.takeAway')).toBeTruthy()
  })
})
