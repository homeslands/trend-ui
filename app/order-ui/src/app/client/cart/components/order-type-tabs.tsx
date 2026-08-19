import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib'
import { useOrderFlowStore, useUserStore } from '@/stores'
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

  const userInfo = useUserStore((state) => state.userInfo)

  // Điều kiện của bản cũ chỉ đọc GIỎ HÀNG (`ownerRole`), không đọc trạng thái đăng nhập
  // thật. Khách đăng xuất rồi quay lại /cart vẫn thấy tab "Giao hàng" vì giỏ cũ còn ghi
  // `ownerRole = CUSTOMER` — nhưng `useGetBranchInfoForDelivery` lại có
  // `enabled: !!userInfo?.slug`, nên phí ship im lặng bằng 0 suốt cả đơn.
  // Thêm `!!userInfo?.slug` để hai nơi cùng nhìn một sự thật.
  const isCustomerLoggedIn =
    !!userInfo?.slug &&
    cart?.ownerRole === Role.CUSTOMER &&
    cart?.ownerPhoneNumber !== 'default-customer'

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
    return <div className="h-10 w-full animate-pulse rounded-full bg-muted" />
  }

  if (availableTypes.length === 1) {
    return <p className="text-sm font-medium">{availableTypes[0].label}</p>
  }

  return (
    <div
      role="group"
      aria-label={t('menu.selectOrderType')}
      className="grid gap-0.5 rounded-full border bg-muted p-[3px]"
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
