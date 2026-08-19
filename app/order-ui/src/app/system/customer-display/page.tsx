import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { User, Phone, MapPin, FileText, QrCode, AlertCircle } from "lucide-react"

import { Badge } from "@/components/ui"
import { calculateCartItemDisplay, calculateCartTotals, calculateOrderItemDisplay, calculatePlacedOrderTotals, formatCurrency, transformOrderItemToOrderDetail } from "@/utils"
import { OrderSuccess, Logo } from "@/assets/images"
import { useCartItemStore, useOrderFlowStore, usePaymentMethodStore, OrderFlowStep } from "@/stores"
import { PaymentMethod, paymentStatus, VOUCHER_TYPE } from "@/constants"
import { useOrderBySlug } from "@/hooks"
import { OrderStatus, OrderTypeEnum, IOrderItem, IOrderDetail } from "@/types"
import { IDisplayCartItem, IDisplayOrderItem } from "@/types/dish.type"
import { CustomerDisplayCountdown } from "@/components/app/countdown"

export default function CustomerDisplayPage() {
    const { t } = useTranslation("menu")
    const {
        orderingData,
        paymentData,
        updatingData,
        currentStep,
        isHydrated: orderFlowIsHydrated,
        clearUpdatingData,
        clearPaymentData,
        setOrderFromAPI,
        updateQrCode
    } = useOrderFlowStore()

    const cartIsHydrated = orderFlowIsHydrated
    // Get updating data from Order Flow Store
    const updateDraft = updatingData?.updateDraft
    const updateOrderIsHydrated = orderFlowIsHydrated && currentStep === OrderFlowStep.UPDATING

    // Get payment data from Order Flow Store
    // Lấy orderSlug và paymentMethod từ paymentData hoặc updatingData (nếu đang ở updating step)
    const orderSlug = paymentData?.orderSlug || updateDraft?.slug || ''
    const paymentMethod = paymentData?.paymentMethod || updateDraft?.paymentMethod || null
    const paymentQrCode = paymentData?.qrCode || ''
    const [isExpired, setIsExpired] = useState<boolean>(false)
    const [isPolling, setIsPolling] = useState<boolean>(false)
    const [showOrderSuccess, setShowOrderSuccess] = useState<boolean>(false)
    const successTimerRef = useRef<NodeJS.Timeout | null>(null) // Track timer để tránh bị clear
    const qrCodeSetRef = useRef<boolean>(false) // Track if QR code has been set to avoid repeated calls
    const timeDefaultExpired = "Sat Jan 01 2000 07:00:00 GMT+0700 (Indochina Time)" // Khi order không tồn tại

    // Fetch order từ API để polling (giống payment-page)
    // Sử dụng orderSlug từ paymentData hoặc updatingData để polling
    // Luôn fetch khi có orderSlug để đảm bảo polling có data
    const shouldFetchOrder = (currentStep === OrderFlowStep.PAYMENT || currentStep === OrderFlowStep.UPDATING) && 
        orderSlug && 
        orderSlug.trim() !== '' && 
        (paymentData || updatingData) // Fetch khi có payment data hoặc updating data
    const { data: order, refetch: refetchOrder, isLoading: isOrderLoading } = useOrderBySlug(shouldFetchOrder ? orderSlug : '')
    const orderDataFromAPI = shouldFetchOrder ? order?.result : null
    
    // Ưu tiên dùng orderData từ paymentData.orderData hoặc updatingData.originalOrder, fallback về API
    const paymentOrderData = paymentData?.orderData
    const updatingOrderData = updatingData?.originalOrder
    const orderData = paymentData 
        ? (paymentOrderData || orderDataFromAPI) 
        : updatingData 
        ? (updatingOrderData || orderDataFromAPI)
        : null

    const deliveryFee = orderData?.deliveryFee || 0
    const accumulatedPointsToUse = orderData?.accumulatedPointsToUse || 0

    // Transform order items cho update phase
    const transformedOrderItems = updateDraft ? transformOrderItemToOrderDetail(updateDraft.orderItems || []) : []

    // Computed values - Ưu tiên theo logic: payment store → update store → cart
    // Determine data source priority based on current step and available data
    const determineDataSource = () => {
        // Priority 1: Payment data (đang ở PAYMENT step và còn payment data)
        if (currentStep === OrderFlowStep.PAYMENT && 
            paymentData && // Chỉ khi còn payment data
            paymentData?.orderSlug && 
            paymentData.orderSlug.trim() !== '') {
            // Có orderData trong store hoặc từ API
            if (paymentOrderData || orderDataFromAPI) {
                return 'payment'
            }
        }

        // Priority 2: Update order data (đang ở UPDATING step)
        if (currentStep === OrderFlowStep.UPDATING && 
            updateOrderIsHydrated && 
            updateDraft && 
            updateDraft.orderItems && 
            Array.isArray(updateDraft.orderItems) && 
            updateDraft.orderItems.length > 0) {
            return 'updateOrderStore'
        }

        // Priority 3: Cart data (đang ở ORDERING step)
        if (currentStep === OrderFlowStep.ORDERING && 
            cartIsHydrated && 
            orderingData?.orderItems && 
            orderingData.orderItems.length > 0) {
            return 'cart'
        }

        return 'none'
    }

    const dataSource = determineDataSource()

    // Check if we're in payment flow but order data is still loading
    const isPaymentFlowLoading = dataSource === 'payment' && isOrderLoading && !paymentOrderData

    // Only show QR code when using payment as data source
    const rawQrCode = dataSource === 'payment' 
        ? (paymentQrCode || paymentData?.qrCode || orderData?.payment?.qrCode || '') 
        : ''

    // Get orderItems from dataSource - prioritize from store
    const currentOrderItems = (() => {
        switch (dataSource) {
            case 'payment':
                // Ưu tiên từ paymentData.orderData, fallback về orderData từ API
                return paymentOrderData?.orderItems || orderDataFromAPI?.orderItems || []
            case 'cart':
                return orderingData?.orderItems || []
            case 'updateOrderStore':
                return updateDraft?.orderItems || []
            default:
                return []
        }
    })()

    // Get voucher from dataSource
    const currentVoucher = (() => {
        switch (dataSource) {
            case 'payment':
                return paymentOrderData?.voucher || orderDataFromAPI?.voucher || null
            case 'cart':
                return orderingData?.voucher || null
            case 'updateOrderStore':
                return updateDraft?.voucher || null
            default:
                return null
        }
    })()

    // Get owner from dataSource
    const currentOwner = (() => {
        switch (dataSource) {
            case 'payment':
                return orderData?.owner || null
            case 'cart':
                return orderingData ? {
                    firstName: orderingData.ownerFullName?.split(' ')[0] || '',
                    lastName: orderingData.ownerFullName?.split(' ').slice(1).join(' ') || '',
                    phonenumber: orderingData.ownerPhoneNumber || ''
                } : null
            case 'updateOrderStore':
                return updateDraft ? {
                    firstName: updateDraft.ownerFullName?.split(' ')[0] || '',
                    lastName: updateDraft.ownerFullName?.split(' ').slice(1).join(' ') || '',
                    phonenumber: updateDraft.ownerPhoneNumber || ''
                } : null
            default:
                return null
        }
    })()

    // Get type from dataSource
    const currentType = (() => {
        switch (dataSource) {
            case 'payment':
                return orderData?.type || null
            case 'cart':
                return orderingData?.type || null
            case 'updateOrderStore':
                return updateDraft?.type || null
            default:
                return null
        }
    })()

    // Get table from dataSource
    const currentTable = (() => {
        switch (dataSource) {
            case 'payment':
                return orderData?.table || null
            case 'cart':
                return orderingData ? { name: orderingData.tableName } : null
            case 'updateOrderStore':
                return updateDraft ? { name: updateDraft.tableName } : null
            default:
                return null
        }
    })()

    // Get description from dataSource
    const currentDescription = (() => {
        switch (dataSource) {
            case 'payment':
                return orderData?.description || null
            case 'cart':
                return orderingData?.description || null
            case 'updateOrderStore':
                return updateDraft?.description || null
            default:
                return null
        }
    })()

    // Get delivery address from dataSource
    const currentDeliveryTo = (() => {
        switch (dataSource) {
            case 'payment':
                return orderData?.deliveryTo || null
            case 'cart':
                return orderingData?.deliveryAddress ? {
                    formattedAddress: orderingData.deliveryAddress
                } : null
            case 'updateOrderStore':
                return updateDraft?.deliveryAddress ? {
                    formattedAddress: updateDraft.deliveryAddress
                } : null
            default:
                return null
        }
    })()

    // Get delivery phone from dataSource
    const currentDeliveryPhone = (() => {
        switch (dataSource) {
            case 'payment':
                return orderData?.deliveryPhone || null
            case 'cart':
                return orderingData?.deliveryPhone || null
            case 'updateOrderStore':
                return updateDraft?.deliveryPhone || null
            default:
                return null
        }
    })()

    // Get delivery fee from dataSource
    const currentDeliveryFee = (() => {
        switch (dataSource) {
            case 'payment':
                return orderData?.deliveryFee || 0
            case 'cart':
                // orderingData không có deliveryFee, chỉ có trong orderData từ API
                return 0
            case 'updateOrderStore':
                // updateDraft không có deliveryFee, chỉ có trong orderData từ API
                return 0
            default:
                return 0
        }
    })()

    useEffect(() => {
        if (isExpired) {
            setIsPolling(false)
            // Clear Order Flow Store updating data when expired
            if (currentStep === OrderFlowStep.UPDATING && updatingData) {
                clearUpdatingData()
            }
        }
    }, [isExpired, currentStep, updatingData, clearUpdatingData])

    // Reset isExpired khi có orderData mới (để tránh bị expire do timeDefaultExpired)
    useEffect(() => {
        if (orderData?.createdAt && orderData.createdAt !== timeDefaultExpired) {
            // Reset isExpired nếu orderData có createdAt hợp lệ
            if (isExpired) {
                setIsExpired(false)
            }
        }
    }, [orderData?.createdAt, isExpired])

    // Start polling when QR code exists and payment is valid, or when payment method is selected (giống payment-page)
    useEffect(() => {
        if (!isExpired && 
            (paymentMethod === PaymentMethod.BANK_TRANSFER ||
             paymentMethod === PaymentMethod.CASH ||
             paymentMethod === PaymentMethod.CREDIT_CARD)) {
            // Nếu orderData chưa có, start polling ngay để fetch data
            if (!orderData) {
                setIsPolling(true)
                return
            }

            // Check if payment is valid and has QR code (for BANK_TRANSFER)
            const hasValidPaymentAndQr = orderData?.payment?.amount != null &&
                orderData.payment.amount === orderData.subtotal &&
                rawQrCode && rawQrCode.trim() !== ''

            if (hasValidPaymentAndQr) {
                // Case 1: Valid QR code - check if payment is completed
                if (orderData.payment.statusMessage === paymentStatus.COMPLETED) {
                    setIsPolling(false)
                } else {
                    setIsPolling(true)
                }
            } else if (orderData?.payment && orderData.payment.amount !== orderData.subtotal) {
                // Case 2: Payment exists but amount doesn't match - start polling for status updates
                setIsPolling(true)
            } else if (orderData?.payment && !rawQrCode && orderData.payment.amount === orderData.subtotal) {
                // Case 3: Payment exists but no QR code (amount < 2000) - start polling
                setIsPolling(true)
            } else if (!orderData?.payment) {
                // Case 4: No payment exists yet - start polling to wait for payment creation
                setIsPolling(true)
            } else {
                setIsPolling(false)
            }
        } else {
            setIsPolling(false)
        }
    }, [isExpired, orderData, paymentMethod, rawQrCode])

    // Stable polling function (giống payment-page)
    const handlePolling = useCallback(async () => {
        const updatedOrder = await refetchOrder()
        const orderStatus = updatedOrder.data?.result?.status
        const updatedOrderData = updatedOrder.data?.result

        // Sync order data với Order Flow Store (check từ paymentData hoặc updatingData)
        const currentOrderSlug = paymentData?.orderSlug || updateDraft?.slug || ''
        if (updatedOrderData && currentOrderSlug === updatedOrderData.slug) {
            // Chỉ sync vào paymentData nếu đang ở PAYMENT step
            if (currentStep === OrderFlowStep.PAYMENT && paymentData) {
                setOrderFromAPI(updatedOrderData)
            }
            // Nếu đang ở UPDATING step, không sync vào paymentData (vì paymentData = null)
        }

        // Only update QR code if it's not already set and becomes available during polling
        if (updatedOrderData?.payment?.qrCode &&
            updatedOrderData.payment.qrCode.trim() !== '' &&
            !qrCodeSetRef.current) {
            updateQrCode(updatedOrderData.payment.qrCode)
            qrCodeSetRef.current = true
        }

        if (orderStatus === OrderStatus.PAID) {
            // Sync orderData vào store TRƯỚC KHI hiển thị success để đảm bảo data được update
            const currentOrderSlug = paymentData?.orderSlug || updateDraft?.slug || ''
            if (updatedOrderData && currentOrderSlug === updatedOrderData.slug) {
                // Chỉ sync vào paymentData nếu đang ở PAYMENT step
                if (currentStep === OrderFlowStep.PAYMENT && paymentData) {
                    setOrderFromAPI(updatedOrderData)
                }
            }
            
            // Xử lý trực tiếp giống payment-page: hiển thị success ngay
            // Đảm bảo không set lại nếu đã có timer
            if (!successTimerRef.current) {
                setShowOrderSuccess(true)
                
                // Auto hide sau 5s và clear payment data để quay về logo Trend
                successTimerRef.current = setTimeout(() => {
                    setShowOrderSuccess(false)
                    clearPaymentData()
                    successTimerRef.current = null
                }, 5000)
            }
            
            return true // Signal to stop polling
        } else {
            return false // Continue polling
        }
    }, [refetchOrder, updateDraft?.slug, currentStep, paymentData, setOrderFromAPI, updateQrCode, clearPaymentData])

    // Polling order status every 2 seconds (giống payment-page)
    useEffect(() => {   
        let pollingInterval: NodeJS.Timeout | null = null

        if (isPolling) {
            pollingInterval = setInterval(async () => {
                const shouldStop = await handlePolling()
                if (shouldStop && pollingInterval) {
                    clearInterval(pollingInterval)
                }
            }, 2000)
        }

        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval)
            }
        }
    }, [isPolling, handlePolling])


    // Listen to storage changes for syncing Zustand persisted state
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {

            if (e.key === "cart-store") {
                useCartItemStore.persist.rehydrate()
            }
            if (e.key === "payment-storage") {
                usePaymentMethodStore.persist.rehydrate()
            }
            // Note: update-order-store is now part of order-flow-store
            if (e.key === "order-flow-store") {
                useOrderFlowStore.persist.rehydrate()
            }
        }

        // Listen to storage events on all routes containing 'customer-display'
        if (window.location.pathname.includes('customer-display')) {
            window.addEventListener("storage", handleStorage)
        }

        return () => {
            window.removeEventListener("storage", handleStorage)
        }
    }, [])

    // Tính toán displayItems và cartTotals dựa trên dataSource đã xác định
    const displayItems: (IDisplayCartItem | IDisplayOrderItem)[] | null = (() => {
        switch (dataSource) {
            case 'payment': {
                // Get orderItems from orderData (đã ưu tiên paymentData.orderData)
                // Ở payment phase, currentOrderItems là IOrderDetail[] từ API
                const orderItemsToDisplay = currentOrderItems as IOrderDetail[]
                return orderItemsToDisplay.length > 0 ? calculateOrderItemDisplay(orderItemsToDisplay, currentVoucher) : null
            }
            case 'cart':
                return orderingData ? calculateCartItemDisplay(orderingData, currentVoucher) : null
            case 'updateOrderStore':
                // Sử dụng calculateOrderItemDisplay thay vì calculateCartItemDisplay để đảm bảo consistency với update order page
                // transformedOrderItems đã là IOrderDetail[]
                return transformedOrderItems.length > 0 ? calculateOrderItemDisplay(transformedOrderItems, currentVoucher) : null
            case 'none':
            default:
                return null
        }
    })()

    const cartTotals = (() => {
        if (!displayItems) return null

        switch (dataSource) {
            case 'payment':
                return calculatePlacedOrderTotals(displayItems as IDisplayOrderItem[], currentVoucher, deliveryFee, accumulatedPointsToUse)
            case 'cart':
                return calculateCartTotals(displayItems as IDisplayCartItem[], currentVoucher)
            case 'updateOrderStore':
                // Sử dụng calculatePlacedOrderTotals vì đã dùng calculateOrderItemDisplay
                return calculatePlacedOrderTotals(displayItems as IDisplayOrderItem[], currentVoucher, deliveryFee, accumulatedPointsToUse)
            case 'none':
            default:
                return null
        }
    })()

    // Validate QR code - must be after cartTotals calculation
    // QR code chỉ hợp lệ khi payment amount = order total (tức là chưa bị thay đổi giá trị)
    let hasValidPaymentAndQr = false

    if (dataSource === 'payment' && orderData) {
        // Validate for payment source using orderData
        const paymentAmount = orderData?.payment?.amount
        const subtotal = orderData?.subtotal
        hasValidPaymentAndQr = paymentAmount != null &&
            subtotal != null &&
            paymentAmount === subtotal &&
            !!(rawQrCode && rawQrCode.trim() !== '')
    } else {
        // For other data sources, no QR validation
        hasValidPaymentAndQr = false
    }

    // Only display QR code if validation passes and payment method is not cash
    const qrCode = hasValidPaymentAndQr && paymentMethod !== PaymentMethod.CASH ? rawQrCode : ''

    const renderPaymentSummary = () => {
        return (
            <div className="sticky top-4 space-y-4">
                {/* QR Code Section - Only show if QR exists */}
                {(qrCode || orderSlug) && (
                    <div className="overflow-hidden relative bg-white rounded-2xl border-2 border-primary/20 dark:bg-gray-900">
                        {/* Header */}
                        <div className="p-3 text-center bg-gradient-to-r from-primary/10 to-primary/5">
                            <div className="flex gap-2 justify-center items-center mb-1">
                                <QrCode className="w-5 h-5 text-primary" />
                                <h3 className="text-lg font-bold text-primary">{t("paymentMethod.scanToPay")}</h3>
                            </div>
                        </div>

                        {/* QR Code */}
                        <div className="p-4">
                            <div className="overflow-hidden relative mx-auto bg-white rounded-xl w-fit dark:bg-transparent">
                                <img src={qrCode} alt="QR Code" className="w-full h-auto max-w-[240px] mx-auto" />
                                <div className="absolute inset-0 rounded-xl border-2 border-dashed border-primary/30"></div>
                            </div>
                        </div>

                        {/* Countdown */}
                        <div className="p-3 bg-gray-50 dark:bg-gray-800">
                            <CustomerDisplayCountdown
                                createdAt={orderData?.createdAt || timeDefaultExpired}
                                setIsExpired={handleExpire}
                            />
                        </div>

                        {/* Status Indicator */}
                        <div className="flex gap-2 justify-center items-center p-2 bg-amber-50 dark:bg-amber-900/20">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                {t("order.waitingForPayment")}
                            </span>
                        </div>
                    </div>
                )}

                {/* Order Summary - Always show */}
                <div className="overflow-hidden bg-white rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
                    <div className="p-2 bg-gray-50 dark:bg-gray-800">
                        <div className="space-y-2 text-sm">
                            {/* Subtotal */}
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-bold text-muted-foreground">{t('order.total')}</span>
                                <span className="font-bold text-muted-foreground">{formatCurrency(cartTotals?.subTotalBeforeDiscount || 0)}</span>
                            </div>

                            {/* Promotion Discount */}
                            {cartTotals && cartTotals?.promotionDiscount > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-primary">{t('order.promotionDiscount')}</span>
                                    <span className="font-medium italic text-primary">-{formatCurrency(cartTotals?.promotionDiscount || 0)}</span>
                                </div>
                            )}

                            {/* Voucher Discount - chỉ hiển thị khi có voucher và voucherDiscount > 0 */}
                            {currentVoucher && cartTotals && cartTotals?.voucherDiscount > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-green-600 dark:text-green-400">{t('order.voucherDiscount')}</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">-{formatCurrency(cartTotals?.voucherDiscount || 0)}</span>
                                </div>
                            )}

                            {/* Loyalty Points */}
                            {cartTotals && cartTotals.accumulatedPointsToUse > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-sm italic font-medium text-primary">{t('order.loyaltyPoint')}</span>
                                    <span className="text-sm italic font-semibold text-primary">-{formatCurrency(cartTotals.accumulatedPointsToUse)}</span>
                                </div>
                            )}

                            {/* Delivery Fee */}
                            {currentDeliveryFee > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-sm italic text-muted-foreground/70">{t('order.deliveryFee')}</span>
                                    <span className="text-sm italic text-muted-foreground/70">{formatCurrency(currentDeliveryFee)}</span>
                                </div>
                            )}

                            <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('order.totalPayment')}</span>
                                    <span className="text-2xl font-bold text-primary">
                                        {formatCurrency(cartTotals?.finalTotal || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const handleExpire = useCallback((value: boolean) => {
        setIsExpired(value)
    }, [])

    // Show order success overlay
    if (showOrderSuccess) {
        return (
            <div className="flex flex-col gap-4 justify-center items-center w-full h-screen">
                <img src={OrderSuccess} className="w-48 h-48 sm:object-fill" />
                <div className='text-xl font-semibold text-primary'>{t('order.orderSuccess')}</div>
            </div>
        )
    }

    // Show simple logo khi không có bất kỳ dữ liệu nào
    const hasAnyData =
        (currentOrderItems && currentOrderItems.length > 0) ||
        currentOwner ||
        currentTable ||
        currentDescription ||
        qrCode

    if (!hasAnyData && !isPaymentFlowLoading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen">
                <img src={Logo} className="w-48" />
            </div>
        )
    }

    return (
        <div className="min-h-screen">
            <div className="container px-3 py-4 mx-auto max-w-7xl min-h-80">
                <div className="grid gap-2 lg:grid-cols-3">
                    {/* Left: Order Details */}
                    <div className="space-y-2 lg:col-span-2">
                        {/* Customer Information Card - Only show if customer info exists */}
                        {(currentOwner || currentType || currentTable || currentDescription) && (
                            <div className="p-2 bg-white rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
                                <div className="flex gap-2 items-center mb-3">
                                    <div className="p-1.5 rounded-lg bg-primary/10">
                                        <User className="w-4 h-4 text-primary" />
                                    </div>
                                    <h2 className="font-semibold text-md">{t("menu.customerInformation")}</h2>
                                </div>

                                <div className="grid gap-3 text-sm sm:grid-cols-2">
                                    {currentOwner && currentOwner.firstName && (
                                        <div className="flex gap-2 items-start">
                                            <User className="w-3 h-3 text-muted-foreground" />
                                            <div>
                                                <div className="text-xs text-muted-foreground">{t("menu.customerName")}</div>
                                                <div className="font-medium">{currentOwner?.firstName} {currentOwner?.lastName}</div>
                                            </div>
                                        </div>
                                    )}

                                    {currentOwner && currentOwner.phonenumber && (
                                        <div className="flex gap-2 items-start">
                                            <Phone className="w-3 h-3 text-muted-foreground" />
                                            <div>
                                                <div className="text-xs text-muted-foreground">{t("order.phoneNumber")}</div>
                                                <div className="font-medium">{currentOwner?.phonenumber}</div>
                                            </div>
                                        </div>
                                    )}

                                    {currentType && (
                                        <div className="flex gap-2 items-start">
                                            <MapPin className="w-3 h-3 text-muted-foreground" />
                                            <div>
                                                <div className="text-xs text-muted-foreground">{t("menu.orderType")}</div>
                                                <div className="flex gap-2 items-center">
                                                    <span className="text-sm font-medium">
                                                        {currentType === OrderTypeEnum.AT_TABLE 
                                                            ? t("menu.dineIn") 
                                                            : currentType === OrderTypeEnum.DELIVERY 
                                                            ? t("menu.delivery") 
                                                            : t("menu.takeAway")}
                                                    </span>
                                                    {/* Chỉ hiển thị table khi order type là AT_TABLE */}
                                                    {currentType === OrderTypeEnum.AT_TABLE && currentTable && currentTable.name && (
                                                        <Badge className="px-1 py-0 text-xs">
                                                            {t("menu.tableNumber")} {currentTable?.name}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {currentType === OrderTypeEnum.DELIVERY && currentDeliveryTo && (
                                        <div className="flex gap-2 items-start sm:col-span-2">
                                            <MapPin className="mt-1 w-3 h-3 text-muted-foreground" />
                                            <div>
                                                <div className="text-xs text-muted-foreground">{t("order.deliveryAddress")}</div>
                                                <div className="font-medium">{currentDeliveryTo?.formattedAddress}</div>
                                            </div>
                                        </div>
                                    )}

                                    {currentType === OrderTypeEnum.DELIVERY && currentDeliveryPhone && (
                                        <div className="flex gap-2 items-start">
                                            <Phone className="w-3 h-3 text-muted-foreground" />
                                            <div>
                                                <div className="text-xs text-muted-foreground">{t("order.deliveryPhone")}</div>
                                                <div className="font-medium">{currentDeliveryPhone}</div>
                                            </div>
                                        </div>
                                    )}

                                    {currentDescription && (
                                        <div className="flex gap-2 items-start sm:col-span-2">
                                            <FileText className="mt-1 w-3 h-3 text-muted-foreground" />
                                            <div>
                                                <div className="text-xs text-muted-foreground">{t("menu.description")}</div>
                                                <div className="font-medium">{currentDescription}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Order Items Card - Compact Grid Layout */}
                        <div className="overflow-hidden bg-white rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
                            <div className="p-2 border-b border-gray-200 bg-primary/10 dark:border-gray-70 dark:bg-transparent0">
                                <h2 className="text-sm font-semibold">{t("order.orderItems")}</h2>
                            </div>

                            {/* Compact Items Display */}
                            <div className="overflow-y-auto">
                                <div className="p-2">
                                    {isPaymentFlowLoading ? (
                                        <div className="flex flex-col items-center justify-center min-h-[12rem] gap-2 text-muted-foreground">
                                            <div className="w-8 h-8 rounded-full border-b-2 animate-spin border-primary"></div>
                                            <div className="text-center">
                                                <p className="font-medium">Đang tải dữ liệu đơn hàng...</p>
                                            </div>
                                        </div>
                                    ) : !currentOrderItems || currentOrderItems.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
                                            <img src={OrderSuccess} className="w-32 h-32 opacity-20" />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-x-3">
                                            {currentOrderItems.map((item: IOrderItem | IOrderDetail, index: number) => {
                                                // Extract data based on different item structures
                                                let productName = ''
                                                // let productSize = ''
                                                let originalPrice = 0
                                                let itemSlug = ''
                                                let itemNote = ''
                                                let itemQuantity = 1

                                                if (dataSource === 'cart') {
                                                    // IOrderItem structure from Order Flow Store
                                                    const cartItem = item as IOrderItem
                                                    productName = cartItem.name || ''
                                                    // productSize = typeof cartItem.size === 'string' ? cartItem.size : (cartItem.size as ISize)?.name || ''
                                                    originalPrice = cartItem.originalPrice || 0
                                                    itemSlug = cartItem.slug || ''
                                                    itemNote = cartItem.note || ''
                                                    itemQuantity = cartItem.quantity || 1
                                                } else if (dataSource === 'updateOrderStore') {
                                                    // From update order store
                                                    const updateItem = item as IOrderItem
                                                    productName = updateItem.name || ''
                                                    // productSize = typeof updateItem.size === 'string' ? updateItem.size : (updateItem.size as ISize)?.name || ''
                                                    originalPrice = updateItem.originalPrice || 0
                                                    itemSlug = updateItem.productSlug || ''
                                                    itemNote = updateItem.note || ''
                                                    itemQuantity = updateItem.quantity || 1
                                                } else {
                                                    // IOrderDetail structure from API (payment/orderData)
                                                    const orderDetail = item as IOrderDetail
                                                    productName = orderDetail?.variant?.product?.name || ''
                                                    // productSize = orderDetail?.variant?.size?.name || ''
                                                    originalPrice = orderDetail?.variant?.price || 0
                                                    itemSlug = orderDetail?.variant?.product?.slug || ''
                                                    itemNote = orderDetail?.note || ''
                                                    itemQuantity = orderDetail?.quantity || 1
                                                }

                                                const displayItem = displayItems?.find((di: IDisplayCartItem | IDisplayOrderItem) => {
                                                    let displaySlug = ''

                                                    if (dataSource === 'updateOrderStore') {
                                                        displaySlug = (di as IDisplayOrderItem).productSlug
                                                    } else if (dataSource === 'cart') {
                                                        displaySlug = (di as IDisplayCartItem).slug
                                                    } else {
                                                        displaySlug = 'productSlug' in di ? di.productSlug : di.slug
                                                    }

                                                    return displaySlug === itemSlug
                                                })

                                                const priceAfterPromotion = displayItem?.priceAfterPromotion || 0
                                                const finalPrice = displayItem?.finalPrice || 0

                                                const isSamePriceVoucher =
                                                    currentVoucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT &&
                                                    currentVoucher?.voucherProducts?.some((vp) => {
                                                        const voucherProductSlug = vp?.product?.slug
                                                        return voucherProductSlug && itemSlug && voucherProductSlug === itemSlug
                                                    })

                                                const hasPromotionDiscount = (displayItem?.promotionDiscount || 0) > 0

                                                const displayPrice = isSamePriceVoucher
                                                    ? finalPrice
                                                    : hasPromotionDiscount
                                                        ? priceAfterPromotion
                                                        : originalPrice

                                                // const shouldShowLineThrough = isSamePriceVoucher || hasPromotionDiscount

                                                return (
                                                    <div key={item.id || index} className={`py-2 px-0.5 border-b border-dashed border-gray-300 min-h-[32px] ${index % 2 === 0 ? 'bg-gray-50/30' : ''} dark:border-gray-600`}>
                                                        {/* Grid layout: Product info + Unit price | Quantity | Total price */}
                                                        <div className="grid grid-cols-8 gap-3 items-start">
                                                            {/* Column 1: Product Name + Note + Size + Unit Price */}
                                                            <div className="flex flex-col gap-1.5 min-w-0 col-span-5">
                                                                <div className="flex flex-wrap gap-2 items-center w-full text-sm font-bold leading-tight truncate dark:text-gray-100">
                                                                    <span className="truncate">{productName}</span>
                                                                </div>
                                                                {itemNote && (
                                                                    <div className="text-sm leading-tight text-muted-foreground dark:text-gray-400">
                                                                        {itemNote}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Column 2: Price */}
                                                            <div className="col-span-1 flex justify-center pt-0.5">
                                                                <Badge variant='outline' className='text-xs w-fit border-muted-foreground/50 text-muted-foreground'>
                                                                    {formatCurrency(displayPrice)}
                                                                    {/* {shouldShowLineThrough && originalPrice !== displayPrice ? (
                                                                            <>
                                                                                <span className="mr-1 line-through text-muted-foreground">
                                                                                    {formatCurrency(originalPrice)}
                                                                                </span>
                                                                                {formatCurrency(displayPrice)}
                                                                            </>
                                                                        ) : (
                                                                            formatCurrency(displayPrice)
                                                                        )} */}
                                                                </Badge>
                                                            </div>

                                                            {/* Column 3: Quantity */}
                                                            <div className="col-span-1 flex justify-center pt-0.5">
                                                                <Badge className='text-xs w-fit'>
                                                                    x{itemQuantity}
                                                                </Badge>
                                                            </div>

                                                            {/* Column 4: Total Price (Unit Price * Quantity) */}
                                                            <div className="col-span-1 flex flex-shrink-0 justify-end pt-0.5">
                                                                <div className="text-right">
                                                                    <div className="leading-none text-md text-primary">
                                                                        {formatCurrency(displayPrice * itemQuantity)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: QR Code & Summary */}
                    <div className="lg:col-span-1">
                        {renderPaymentSummary()}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <div className="p-4 bg-white rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
                        <div className="mb-1 text-base font-medium text-primary">
                            {t('order.thankYouForOrdering')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
