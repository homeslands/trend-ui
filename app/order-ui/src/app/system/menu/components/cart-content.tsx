import _ from 'lodash'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2, ShoppingCart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'

import { Badge, Button, Input, ScrollArea } from '@/components/ui'
import { QuantitySelector } from '@/components/app/button'
import { CartNoteInput, CustomerSearchInput, OrderNoteInput } from '@/components/app/input'
import { useOrderFlowStore, useUserStore } from '@/stores'
import { CreateCustomerDialog, CreateOrderDialog } from '@/components/app/dialog'
import { calculateCartItemDisplay, calculateCartTotals, formatCurrency, parseKm, showErrorToast, showToast, showErrorToastMessage, useCalculateDeliveryFee } from '@/utils'
import { getValidatingFromCustomerChange } from '@/utils'
import { OrderTypeSelect, PickupTimeSelect } from '@/components/app/select'
import { OrderTypeEnum } from '@/types'
import { StaffVoucherListSheet } from '@/components/app/sheet'
import { APPLICABILITY_RULE, Role, VOUCHER_TYPE } from '@/constants'
import { useValidateVoucher } from '@/hooks'

function CustomPriceCartItem({
  item,
  onPriceChange,
  onRemove,
}: {
  item: Parameters<typeof CartNoteInput>[0]['cartItem']
  onPriceChange: (v: number) => void
  onRemove: () => void
}) {
  const { t } = useTranslation(['menu'])
  const [raw, setRaw] = useState((item.customPrice ?? 0) > 0 ? String(item.customPrice) : '')

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-lg border border-orange-400/60 bg-orange-300/10">
      {/* Row 1: name + total */}
      <div className="flex justify-between items-start gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[13px] xl:text-sm font-semibold truncate max-w-[9rem] xl:max-w-[12rem]">
            {item.name}
          </span>
        </div>
        <span className="text-[14px] font-semibold text-orange-600 shrink-0">
          {(item.customPrice ?? 0) > 0 ? formatCurrency(item.customPrice ?? 0) : '—'}
        </span>
      </div>

      {/* Row 2: price input + delete */}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          placeholder={t('menu.enterCustomPrice')}
          className="h-7 text-xs flex-1 border-orange-300 focus-visible:ring-orange-400"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value)
            const parsed = parseFloat(e.target.value)
            if (!isNaN(parsed) && parsed >= 0) onPriceChange(parsed)
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={16} className="text-destructive" />
        </Button>
      </div>

      <CartNoteInput cartItem={item} />
    </div>
  )
}

export function CartContent() {
  const { t } = useTranslation(['menu'])
  const { t: tCommon } = useTranslation(['common'])
  const { t: tToast } = useTranslation(['toast'])
  const { t: tVoucher } = useTranslation(['voucher'])
  const { userInfo } = useUserStore()
  const { removeVoucher, getCartItems, removeOrderingItem, removeOrderingCustomer, updateOrderingItemCustomPrice } = useOrderFlowStore()
  const { mutate: validateVoucher } = useValidateVoucher()

  const cartItems = getCartItems()
  const hasCustomPriceItems = useMemo(
    () => cartItems?.orderItems?.some((i) => i.isCustomPrice) ?? false,
    [cartItems?.orderItems]
  )
  const hasUnpricedCustomItems = useMemo(
    () => (cartItems?.orderItems ?? []).some((i) => i.isCustomPrice === true && !(i.customPrice != null && i.customPrice > 0)),
    [cartItems?.orderItems]
  )
  const orderItemsPayloadRef = useRef<{ quantity: number; variant: string }[]>([])

  useEffect(() => {
    orderItemsPayloadRef.current =
      cartItems?.orderItems?.map(item => ({
        quantity: item?.quantity,
        variant: item?.variant?.slug,
      })) || []
  }, [cartItems?.orderItems])

  const voucherSlug = useMemo(() => {
    return cartItems?.voucher?.slug
  }, [cartItems?.voucher])

  const voucherMaxItems = cartItems?.voucher?.maxItems || 0
  const nonGiftOrderItems = useMemo(() => {
    return (cartItems?.orderItems || []).filter(item => !(item as { isGift?: boolean }).isGift)
  }, [cartItems?.orderItems])
  const cartItemQuantity = useMemo(() => {
    return nonGiftOrderItems.reduce((total, item) => total + (item.quantity || 0), 0)
  }, [nonGiftOrderItems])

  const orderOwner = useMemo(() => {
    return cartItems?.owner
  }, [cartItems?.owner])

  const displayItems = calculateCartItemDisplay(
    cartItems,
    cartItems?.voucher || null
  )

  const cartTotals = calculateCartTotals(displayItems, cartItems?.voucher || null)
  // Chỉ tính phí giao hàng cho đơn DELIVERY. Giỏ hàng cũ lưu trong localStorage có thể
  // mang type khác kèm deliveryDistance còn sót lại (trước khi setOrderingType dọn dẹp
  // được thêm vào) — nếu không gate theo type, tổng tiền sẽ cộng nhầm phí ship vô hình
  // (P0-1). branchSlug rỗng ⇒ query bị disable, không gọi API thừa.
  const chargesDelivery = cartItems?.type === OrderTypeEnum.DELIVERY
  const rawDeliveryFee = useCalculateDeliveryFee(
    chargesDelivery ? parseKm(cartItems?.deliveryDistance) || 0 : 0,
    chargesDelivery ? userInfo?.branch?.slug || '' : '',
  )
  const deliveryFee = {
    ...rawDeliveryFee,
    deliveryFee: chargesDelivery ? rawDeliveryFee.deliveryFee : 0,
  }

  // Validate voucher
  useEffect(() => {
    // Skip nếu đang validate từ customer change để tránh duplicate toast
    if (voucherSlug && !getValidatingFromCustomerChange()) {
      validateVoucher({
        voucher: voucherSlug,
        user: orderOwner ?? '',
        orderItems: orderItemsPayloadRef.current
      }, {
        onError: () => {
          removeVoucher()
        }
      })
    }
  }, [voucherSlug, orderOwner, validateVoucher, removeVoucher])

  // Remove voucher if total quantity exceeds maxItems
  useEffect(() => {
    if (!voucherSlug || !voucherMaxItems) return
    if (cartItemQuantity > voucherMaxItems) {
      removeVoucher()
      showErrorToastMessage('toast.voucherMaxItemsExceeded')
    }
  }, [voucherSlug, voucherMaxItems, cartItemQuantity, removeVoucher])

  // Kiểm tra voucher validity cho SAME_PRICE_PRODUCT
  useEffect(() => {
    if (cartItems?.voucher && cartItems.voucher.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT) {
      const voucherProductSlugs = cartItems.voucher.voucherProducts?.map(vp => vp.product.slug) || []
      const hasValidProducts = cartItems.orderItems.some(item => voucherProductSlugs.includes(item.slug))

      if (!hasValidProducts) {
        showErrorToast(143422)
        removeVoucher()
      }
    }
  }, [cartItems, removeVoucher])

  // use useEffect to check if subtotal is less than minOrderValue of voucher
  useEffect(() => {
    if (cartItems && cartItems.voucher) {
      const { voucher, orderItems } = cartItems

      // Nếu không phải SAME_PRICE_PRODUCT thì mới cần check
      const shouldCheckMinOrderValue = voucher.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT

      if (shouldCheckMinOrderValue) {
        // Tính subtotal trực tiếp từ orderItems sau promotion, không sử dụng calculations để tránh circular dependency
        const subtotalAfterPromotion = orderItems.reduce((total, item) => {
          const original = item?.originalPrice
          const afterPromotion = (original || 0) - (item.promotionDiscount || 0)
          return total + afterPromotion * item.quantity
        }, 0)

        if (subtotalAfterPromotion < (voucher.minOrderValue || 0)) {
          removeVoucher()
          showErrorToast(1004)
        }
      }
    }
  }, [cartItems, removeVoucher])

  const handleRemoveCartItem = (id: string) => {
    const cartItems = getCartItems()
    if (cartItems) {
      const { orderItems } = cartItems
      if (orderItems.length === 1) {
        removeVoucher()
      }
    }
    removeOrderingItem(id)
  }

  // check if customer info is removed, then check if voucher.isVerificationIdentity is true, then show toast
  useEffect(() => {
    const hasNoCustomerInfo = !cartItems?.ownerFullName && !cartItems?.ownerPhoneNumber
    const isPrivateVoucher = cartItems?.voucher?.isVerificationIdentity === true

    if (hasNoCustomerInfo && isPrivateVoucher) {
      showToast(tToast('toast.voucherVerificationIdentity'))
      removeOrderingCustomer()
      removeVoucher()
    }
  }, [
    cartItems?.ownerFullName,
    cartItems?.ownerPhoneNumber,
    cartItems?.voucher?.isVerificationIdentity,
    tToast,
    removeVoucher,
    removeOrderingCustomer
  ])

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="flex flex-col z-30 fixed right-0 top-14 h-[calc(100vh-3.5rem)] w-full md:w-[26%] xl:w-[25%] shadow-lg overflow-hidden bg-background transition-all duration-300"
    >
      {/* Header */}
      <div className="flex flex-col gap-2 p-2 backdrop-blur-sm shrink-0 bg-background/95">
        <div className='flex items-center'>
          {(cartItems?.orderItems?.length ?? 0) > 0 &&
            (
              !cartItems?.ownerFullName ||
              !cartItems?.ownerPhoneNumber ||
              cartItems?.ownerRole !== Role.CUSTOMER
            ) && (
              <CreateCustomerDialog />
            )}
        </div>
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1 p-0 scrollbar-hidden">
        {/* Order type and customer selection */}
        <div className="grid grid-cols-1 gap-2 p-2 backdrop-blur-sm xl:pr-2 bg-background/95">
          <OrderTypeSelect />
          {cartItems?.type === OrderTypeEnum.TAKE_OUT && (
            <PickupTimeSelect />
          )}
          <CustomerSearchInput />
        </div>

        <div className="flex flex-col gap-2 p-2">
          <AnimatePresence>
            {cartItems && cartItems?.orderItems?.length && cartItems?.orderItems?.length > 0 ? (
              cartItems?.orderItems?.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-transparent border-0 p-0"
                >
                  {item.isCustomPrice ? (
                    <CustomPriceCartItem
                      item={item}
                      onPriceChange={(v) => updateOrderingItemCustomPrice(item.id, v)}
                      onRemove={() => handleRemoveCartItem(item.id)}
                    />
                  ) : (
                    <div className="flex flex-col gap-1 p-2 rounded-lg border transition-colors border-primary/80 group bg-primary/10">
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className='flex justify-between items-center'>
                          <span className="text-[13px] xl:text-sm font-semibold truncate max-w-[9rem] xl:max-w-[15rem]">{item.name}</span>
                          <span className="text-[14px]">
                            {formatCurrency((displayItems.find(di => di.slug === item.slug)?.finalPrice ?? 0) * item.quantity)}
                          </span>
                        </div>
                        <div className='flex justify-between items-center'>
                          <span className="text-[10px] text-muted-foreground">
                            ({item.size?.toUpperCase()})
                          </span>
                          <QuantitySelector cartItem={item} />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveCartItem(item.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 size={18} className='icon text-destructive' />
                          </Button>
                        </div>
                      </div>
                      <CartNoteInput cartItem={item} />
                    </div>
                  )}
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center min-h-[12rem] gap-2 text-muted-foreground"
              >
                <div className="p-2 rounded-full bg-muted/30">
                  <ShoppingCart className="w-10 h-10" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="font-medium">{tCommon('common.noData')}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Footer - Payment */}
      {cartItems && cartItems?.orderItems?.length && cartItems?.orderItems?.length > 0 ? (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="z-10 p-2 border-t backdrop-blur-sm shrink-0 bg-background/95"
        >
          <div className='space-y-1'>
            <div className="flex flex-col">
              <OrderNoteInput order={cartItems} />
              {!hasCustomPriceItems && <StaffVoucherListSheet />}
            </div>
            <div>
              {cartItems?.voucher && (
                <div className="flex justify-start w-full">
                  <div className="flex flex-col items-start">
                    <div className="flex gap-2 items-center mt-2">
                      <Badge variant='outline' className="text-[10px] px-1 border-primary text-primary">
                        {(() => {
                          const voucher = cartItems?.voucher
                          if (!voucher) return null

                          const { type, value, applicabilityRule: rule } = voucher

                          // Mô tả phần giá trị khuyến mãi
                          const discountValueText =
                            type === VOUCHER_TYPE.PERCENT_ORDER
                              ? tVoucher('voucher.percentDiscount', { value }) // "Giảm {value}%"
                              : type === VOUCHER_TYPE.FIXED_VALUE
                                ? tVoucher('voucher.fixedDiscount', { value: formatCurrency(value) }) // "Giảm {value}₫"
                                : type === VOUCHER_TYPE.SAME_PRICE_PRODUCT
                                  ? tVoucher('voucher.samePriceProduct', { value: formatCurrency(value) }) // "Đồng giá {value}₫"
                                  : ''

                          // Mô tả điều kiện áp dụng (rule)
                          const ruleText =
                            rule === APPLICABILITY_RULE.ALL_REQUIRED
                              ? tVoucher(
                                type === VOUCHER_TYPE.SAME_PRICE_PRODUCT
                                  ? 'voucher.requireAllSamePrice'
                                  : type === VOUCHER_TYPE.PERCENT_ORDER
                                    ? 'voucher.requireAllPercent'
                                    : 'voucher.requireAllFixed'
                              )
                              : rule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED
                                ? tVoucher(
                                  type === VOUCHER_TYPE.SAME_PRICE_PRODUCT
                                    ? 'voucher.requireAtLeastOneSamePrice'
                                    : type === VOUCHER_TYPE.PERCENT_ORDER
                                      ? 'voucher.requireAtLeastOnePercent'
                                      : 'voucher.requireAtLeastOneFixed'
                                )
                                : ''

                          return `${discountValueText} ${ruleText}`
                        })()}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex flex-col w-full text-sm text-muted-foreground">
                {hasCustomPriceItems ? (
                  <div className="flex justify-between items-center pt-2 mt-2 font-semibold border-t text-md">
                    <span>{t('order.totalPayment')}</span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(
                        (cartItems?.orderItems ?? []).reduce((sum, i) => sum + (i.customPrice ?? 0) * i.quantity, 0)
                      )}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span>{t('order.subtotalBeforeDiscount')}</span>
                      <span>{formatCurrency(cartTotals.subTotalBeforeDiscount)}</span>
                    </div>

                    {cartTotals.promotionDiscount > 0 && (
                      <div className="flex justify-between text-[10px] italic text-yellow-600">
                        <span>{t('order.promotionDiscount')}</span>
                        <span>-{formatCurrency(cartTotals.promotionDiscount)}</span>
                      </div>
                    )}

                    {cartTotals.voucherDiscount > 0 && (
                      <div className="flex justify-between text-[10px] italic text-green-600">
                        <span>{t('order.voucherDiscount')}</span>
                        <span>-{formatCurrency(cartTotals.voucherDiscount)}</span>
                      </div>
                    )}

                    {cartItems?.type === OrderTypeEnum.DELIVERY && (
                      <div className="flex justify-between text-xs italic text-muted-foreground/80">
                        <span>{t('order.deliveryFee')}</span>
                        <span>{formatCurrency(deliveryFee.deliveryFee)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 mt-2 font-semibold border-t text-md">
                      <span>{t('order.totalPayment')}</span>
                      <span className="text-xl font-bold text-primary">{formatCurrency(cartTotals.finalTotal + deliveryFee.deliveryFee)}</span>
                    </div>
                  </>
                )}
              </div>
              <div className='flex justify-end items-center'>
                <CreateOrderDialog
                  disabled={!cartItems || hasUnpricedCustomItems || (cartItems.type === OrderTypeEnum.AT_TABLE && !cartItems.table) || (cartItems.type === OrderTypeEnum.DELIVERY && !cartItems.deliveryAddress) || (cartItems.type === OrderTypeEnum.DELIVERY && !cartItems.deliveryPhone) || (cartItems.type === OrderTypeEnum.DELIVERY && !cartItems.deliveryPlaceId)}
                  disabledText={hasUnpricedCustomItems ? t('menu.enterCustomPriceFirst') : undefined}
                  totalAmount={cartTotals.finalTotal + deliveryFee.deliveryFee}
                  deliveryFee={deliveryFee.deliveryFee}
                />
              </div>
            </div>
          </div>
        </motion.div>
      ) : (<></>)}
    </motion.div>
  )
}