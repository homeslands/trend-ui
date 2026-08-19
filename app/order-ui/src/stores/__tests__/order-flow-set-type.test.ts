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
    store.setDeliveryPhone('0901234567')

    store.setOrderingType(OrderTypeEnum.TAKE_OUT)

    const data = useOrderFlowStore.getState().orderingData
    expect(data?.deliveryAddress).toBe('')
    expect(data?.deliveryDistance).toBe(0)
    expect(data?.deliveryDuration).toBe(0)
    expect(data?.deliveryLat).toBeUndefined()
    expect(data?.deliveryLng).toBeUndefined()
    expect(data?.deliveryPlaceId).toBe('')
    expect(data?.deliveryPhone).toBe('')
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

  it('khởi tạo giỏ rồi đặt loại đơn khi orderingData chưa tồn tại', () => {
    useOrderFlowStore.getState().clearOrderingData()
    expect(useOrderFlowStore.getState().orderingData).toBeNull()

    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.TAKE_OUT)

    const data = useOrderFlowStore.getState().orderingData
    expect(data).not.toBeNull()
    expect(data?.type).toBe(OrderTypeEnum.TAKE_OUT)
  })
})
