import moment from 'moment'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui'

import { IOrderItem, IProductVariant, IMenuItem } from '@/types'
import { useOrderFlowStore, OrderFlowStep, useUserStore } from '@/stores'
import { publicFileURL } from '@/constants'
import { formatCurrency, showToast } from '@/utils'

interface AddToCartDialogProps {
  product: IMenuItem
  trigger?: React.ReactNode
}

export default function AddToCartDialog({
  product,
  trigger,
}: AddToCartDialogProps) {
  const { t } = useTranslation(['menu'])
  const { t: tCommon } = useTranslation(['common'])
  const { t: tToast } = useTranslation('toast')
  const [isOpen, setIsOpen] = useState(false)
  const [note, setNote] = useState<string>('')
  const [selectedVariant, setSelectedVariant] =
    useState<IProductVariant | null>(product.product.variants?.[0] || null)

  // 🔥 Sử dụng Order Flow Store
  const {
    currentStep,
    isHydrated,
    orderingData,
    initializeOrdering,
    addOrderingItem,
    setCurrentStep
  } = useOrderFlowStore()
  const { userInfo } = useUserStore()

  // 🚀 Đảm bảo đang ở ORDERING phase khi component mount
  useEffect(() => {
    if (isHydrated) {
      // Chuyển về ORDERING phase nếu đang ở phase khác
      if (currentStep !== OrderFlowStep.ORDERING) {
        setCurrentStep(OrderFlowStep.ORDERING)
      }

      // Khởi tạo ordering data nếu chưa có
      if (!orderingData) {
        initializeOrdering()
        return
      }

      // Chỉ re-initialize nếu user đã đăng nhập nhưng orderingData không có owner
      if (userInfo?.slug && !orderingData.owner?.trim()) {
        initializeOrdering()
      }
    }
  }, [isHydrated, currentStep, orderingData, userInfo?.slug, setCurrentStep, initializeOrdering])

  // 🎯 Handle Add to Cart - Workflow Chuẩn
  const handleAddToCart = () => {
    // ✅ Step 1: Pre-validation
    if (!isHydrated) {
      return
    }

    if (!selectedVariant) {
      return
    }

    // ✅ Step 2: Ensure ORDERING phase
    if (currentStep !== OrderFlowStep.ORDERING) {
      setCurrentStep(OrderFlowStep.ORDERING)

      // Khởi tạo ordering data nếu chưa có
      if (!orderingData) {
        initializeOrdering()
        return
      }

      // Chỉ re-initialize nếu user đã đăng nhập nhưng orderingData không có owner
      if (userInfo?.slug && !orderingData.owner?.trim()) {
        initializeOrdering()
      }
    }

    // ✅ Step 3: Create order item with proper structure
    const orderItem: IOrderItem = {
      id: `item_${moment().valueOf()}_${Math.random().toString(36).substr(2, 9)}`,
      slug: product?.product?.slug,
      image: product?.product?.image,
      name: product?.product?.name,
      quantity: 1,
      size: selectedVariant?.size?.name,
      allVariants: product?.product?.variants,
      variant: selectedVariant,
      originalPrice: selectedVariant?.price,
      description: product?.product?.description,
      isLimit: product?.product?.isLimit,
      isGift: product?.product?.isGift,
      promotion: product?.promotion ? product?.promotion : null,
      promotionValue: product?.promotion ? product?.promotion?.value : 0,
      note: note.trim(),
    }

    try {
      // ✅ Step 4: Add to ordering data
      addOrderingItem(orderItem)

      // ✅ Step 5: Success feedback
      showToast(tToast('toast.addSuccess'))

      // ✅ Step 6: Reset form state
      setNote('')
      setSelectedVariant(product?.product?.variants?.[0] || null)
      setIsOpen(false)

    } catch (error) {
      // ✅ Step 7: Error handling
      // eslint-disable-next-line no-console
      console.error('❌ Error adding item to cart:', error)
    }
  }

  // 🎨 Loading state
  if (!isHydrated) {
    return (
      <Button disabled className="flex gap-1 justify-center items-center px-4 w-full text-sm xl:text-sm text-white rounded-full shadow-none sm:text-[11px]">
        Đang tải...
      </Button>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex gap-1 justify-center items-center px-4 w-full text-sm xl:text-sm text-white rounded-full shadow-none sm:text-[11px]">
            {t('menu.addToCart')}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-[42rem] rounded-lg p-6 sm:max-w-[48rem]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {t('menu.confirmProduct')}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('menu.confirmProductDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Product Image */}
          <div className="flex justify-center items-center">
            {product?.product?.image ? (
              <img
                src={`${publicFileURL}/${product?.product?.image}`}
                alt={product?.product?.name}
                className="object-cover w-full h-64 rounded-md border"
              />
            ) : (
              <div className="w-full h-64 rounded-md bg-muted/50" />
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-col gap-4 justify-between">
            <div>
              <h3 className="text-lg font-semibold">{product?.product?.name}</h3>
              <p className="text-sm text-muted-foreground">
                {product?.product?.description}
              </p>
            </div>

            {/* Size Selection */}
            {product?.product?.variants?.length && product?.product?.variants?.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {t('menu.selectSize')}
                </label>
                <Select
                  value={selectedVariant?.slug}
                  onValueChange={(value) => {
                    const variant = product?.product?.variants?.find(
                      (v) => v.slug === value,
                    )
                    setSelectedVariant(variant || null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('menu.selectSize')} />
                  </SelectTrigger>
                  <SelectContent>
                    {product?.product?.variants
                      .sort((a, b) => a.price - b.price)
                      .map((variant) => (
                        <SelectItem key={variant.slug} value={variant.slug}>
                          {variant.size.name.toUpperCase()} –{' '}
                          {product?.promotion?.value > 0
                            ? formatCurrency(
                              variant?.price * (1 - product?.promotion?.value / 100),
                            )
                            : formatCurrency(variant?.price)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Note Input */}
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('menu.note')}</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('menu.enterNote')}
                className="resize-none"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <DialogFooter className="flex gap-2 justify-end pt-6">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {tCommon('common.cancel')}
          </Button>
          <Button
            onClick={handleAddToCart}
            disabled={!selectedVariant || !isHydrated}
          >
            {t('menu.addToCart')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
