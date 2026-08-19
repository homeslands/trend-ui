import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import moment from 'moment';

import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';

import { IProductVariant, IMenuItem, IOrderItem } from '@/types';
import { useOrderFlowStore, OrderFlowStep, useUserStore } from '@/stores';
import { publicFileURL } from '@/constants';
import { formatCurrency, showToast } from '@/utils';

interface AddToCartDialogProps {
  product: IMenuItem;
  onSuccess?: () => void;
  isUpdateOrder?: boolean;
}

export default function SystemAddToCartDrawer({ product }: AddToCartDialogProps) {
  const { t } = useTranslation(['menu']);
  const { t: tCommon } = useTranslation(['common']);
  const { t: tToast } = useTranslation(['toast'])
  const [note, setNote] = useState('');
  const [selectedVariant, setSelectedVariant] =
    useState<IProductVariant | null>(product?.product?.variants?.[0] || null);
  const isCustomPrice = product?.product?.isCustomPrice
  const [customPrice, setCustomPrice] = useState('')

  // Order Flow Store cho updating mode  
  const {
    currentStep,
    isHydrated,
    orderingData,
    initializeOrdering,
    addOrderingItem,
    setCurrentStep
  } = useOrderFlowStore()
  const [isOpen, setIsOpen] = useState(false);
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

  const handleAddToCart = () => {
    if (!isHydrated) return

    if (isCustomPrice) {
      const price = parseFloat(customPrice)
      if (!customPrice || isNaN(price) || price <= 0) {
        showToast(tToast('toast.customPriceRequired'))
        return
      }
    } else if (!selectedVariant) {
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
        const firstVariant = product?.product?.variants?.[0]
    const parsedCustomPrice = isCustomPrice ? parseFloat(customPrice) : undefined
    const orderItem: IOrderItem = {
      id: `item_${moment().valueOf()}_${Math.random().toString(36).substr(2, 9)}`,
      slug: product?.product?.slug,
      image: product?.product?.image,
      name: product?.product?.name,
      quantity: 1,
      size: firstVariant?.size.name || '',
      allVariants: product?.product?.variants,
      variant: firstVariant,
      originalPrice: isCustomPrice ? parsedCustomPrice : selectedVariant?.price,
      description: product?.product?.description,
      isLimit: product?.product?.isLimit,
      isGift: product?.product?.isGift,
      isCustomPrice: isCustomPrice || false,
      customPrice: parsedCustomPrice,
      promotion: null,
      promotionValue: 0,
      note: note.trim(),
    }

    try {
      // ✅ Step 4: Add to ordering data
      const added = addOrderingItem(orderItem)
      if (!added) return

      // ✅ Step 5: Success feedback
      showToast(tToast('toast.addSuccess'))

      // ✅ Step 6: Reset form state
      setNote('')
      setCustomPrice('')
      setSelectedVariant(product?.product?.variants?.[0] || null)
      setIsOpen(false)

    } catch (error) {
      // ✅ Step 7: Error handling
      // eslint-disable-next-line no-console
      console.error('❌ Error adding item to cart:', error)
    }
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button
          className="flex [&_svg]:size-4 flex-row items-center justify-center gap-1 text-white rounded-full w-full shadow-none"
          disabled={!product?.product?.variants || product.product.variants.length === 0}
        >
          {t('menu.addToCart')}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[90%]">
        <DrawerHeader>
          <DrawerTitle>{t('menu.confirmProduct')}</DrawerTitle>
          <DrawerDescription>{t('menu.confirmProductDescription')}</DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="flex-1 max-h-[calc(100%-8rem)]">
          <div className="grid overflow-y-auto grid-cols-1 gap-4 justify-center p-4 w-full sm:grid-cols-4">
            <div className="sm:col-span-2">
              {product.product.image ? (
                <img
                  src={`${publicFileURL}/${product.product.image}`}
                  alt={product.product.name}
                  className="object-cover w-full h-48 rounded-md sm:h-64 lg:h-72"
                />
              ) : (
                <div className="w-full rounded-md bg-muted/50" />
              )}
            </div>

            <div className="flex flex-col gap-6 sm:col-span-2">
              <div>
                <h3 className="text-lg font-semibold">{product.product.name}</h3>
                <p className="text-sm text-muted-foreground">{product.product.description}</p>
              </div>

              {isCustomPrice ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t('menu.customPrice')}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    placeholder={t('menu.enterCustomPrice')}
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                  />
                </div>
              ) : product.product.variants.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t('menu.selectSize')}
                  </label>
                  <Select
                    value={selectedVariant?.slug}
                    onValueChange={(value) => {
                      const variant = product.product.variants.find(
                        (v) => v.slug === value
                      );
                      setSelectedVariant(variant || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('menu.selectSize')} />
                    </SelectTrigger>
                    <SelectContent>
                      {product.product.variants
                        .sort((a, b) => a.price - b.price)
                        .map((variant) => (
                          <SelectItem key={variant.slug} value={variant.slug}>
                            {variant.size.name.toUpperCase()} -{' '}
                            {product.promotion && product?.promotion?.value > 0 ? formatCurrency((variant.price) * (1 - (product?.promotion?.value) / 100)) : formatCurrency(variant.price)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col items-start space-y-2">
                <span className="text-sm">{t('menu.note')}</span>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('menu.enterNote')}
                />
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <DrawerClose asChild>
                  <Button variant="outline">{tCommon('common.cancel')}</Button>
                </DrawerClose>
                <Button onClick={handleAddToCart} disabled={isCustomPrice ? !customPrice : !selectedVariant}>
                  {t('menu.addToCart')}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}