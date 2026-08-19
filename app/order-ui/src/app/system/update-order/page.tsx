import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'

import { useIsMobile, useOrderBySlug } from '@/hooks'
import { OrderStatus, OrderTypeEnum } from '@/types'
import { SystemMenuInUpdateOrderTabs } from '@/components/app/tabs'
import { useOrderFlowStore } from '@/stores'
import { UpdateOrderContent } from './components'

export default function UpdateOrderPage() {
    const { t: tHelmet } = useTranslation('helmet')
    const isMobile = useIsMobile()
    const { slug } = useParams()
    const { data: order, refetch: refetchOrder } = useOrderBySlug(slug)
    const [isPolling, setIsPolling] = useState<boolean>(false)
    const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false) // Track if data is loaded to store
    const [shouldReinitialize, setShouldReinitialize] = useState<boolean>(false)
    const [isRefetching] = useState<boolean>(false)
    const {
        updatingData,
        initializeUpdating,
        clearUpdatingData,
        setDraftTable,
        setDraftType,
        addDraftPickupTime,
        setDraftDescription,
        setDraftVoucher,
        updateDraftItem
    } = useOrderFlowStore()

    // Initialize updating data
    useEffect(() => {
        if (order?.result && order.result.orderItems && (!isDataLoaded || shouldReinitialize) && !isRefetching) {
            // Đảm bảo order data đầy đủ trước khi initialize
            const orderData = order.result

            // Validate order data có đầy đủ không
            if (!orderData.slug || !orderData.orderItems || orderData.orderItems.length === 0) {
                return
            }
            // 
            if (shouldReinitialize) {
                // ✅ Preserve current draft values before reinitializing
                const currentDraft = updatingData?.updateDraft
                const preservedTimeLeftTakeOut = currentDraft?.timeLeftTakeOut
                const preservedType = orderData?.type
                const preservedDescription = currentDraft?.description || orderData.description
                // ✅ Preserve voucher: ưu tiên voucher từ draft (nếu có), nếu không thì lấy từ server
                // Điều này đảm bảo nếu user đã chọn/xóa voucher, nó sẽ được preserve
                const preservedVoucher = currentDraft?.voucher !== undefined
                    ? currentDraft.voucher
                    : orderData.voucher

                // ✅ Preserve non-optimistic item changes (quantity, notes)
                // Sử dụng ID (slug từ server) để match chính xác, vì mỗi item có ID duy nhất
                // Điều này quan trọng khi có nhiều items giống nhau (cùng product, variant) nhưng khác quantity/note
                const preservedItemChanges = currentDraft?.orderItems?.reduce((acc, draftItem) => {
                    // Chỉ preserve changes cho items có slug thật (không phải optimistic)
                    // Slug từ server là ID duy nhất của item
                    if (draftItem.slug && draftItem.slug !== draftItem.productSlug) {
                        // Tìm item trong orderData với cùng slug (ID)
                        const originalItem = orderData.orderItems.find(oi => oi.slug === draftItem.slug)

                        // Chỉ preserve nếu item còn tồn tại trong orderData (chưa bị remove)
                        if (originalItem) {
                            // So sánh với originalOrder để chỉ preserve khi có thay đổi thực sự
                            const originalOrderItem = updatingData?.originalOrder?.orderItems?.find(oi => oi.slug === draftItem.slug)

                            // Chỉ preserve nếu có thay đổi so với originalOrder
                            if (originalOrderItem) {
                                const quantityChanged = draftItem.quantity !== originalOrderItem.quantity
                                const noteChanged = draftItem.note !== (originalOrderItem.note || '')

                                if (quantityChanged || noteChanged) {
                                    // Sử dụng slug (ID) làm key để match chính xác
                                    // Đảm bảo chỉ preserve một lần cho mỗi item
                                    if (!acc[draftItem.slug]) {
                                        acc[draftItem.slug] = {
                                            slug: draftItem.slug,
                                            quantity: draftItem.quantity,
                                            note: draftItem.note || ''
                                        }
                                    }
                                }
                            }
                        }
                    }
                    return acc
                }, {} as Record<string, { slug: string; quantity: number; note: string }>)

                // ✅ Update order data with current draft table and name if available
                const exampleTable = {
                    ...orderData.table,
                    type: preservedType as OrderTypeEnum,
                    slug: preservedType === OrderTypeEnum.AT_TABLE ? currentDraft?.table || orderData.table?.slug || '' : orderData.table?.slug || '',
                    name: preservedType === OrderTypeEnum.AT_TABLE ? currentDraft?.tableName || orderData.table?.name || '' : orderData.table?.name || '',
                }

                // ✅ Reinitialize với data mới từ server (bao gồm món vừa add)
                initializeUpdating(orderData)

                // ✅ Restore preserved values after initialization
                if (preservedType && preservedType !== orderData.type) {
                    setDraftType(preservedType as OrderTypeEnum)
                }
                if (preservedTimeLeftTakeOut !== undefined && preservedType === OrderTypeEnum.TAKE_OUT) {
                    addDraftPickupTime(preservedTimeLeftTakeOut)
                }
                if (preservedDescription !== orderData.description) {
                    setDraftDescription(preservedDescription || '')
                }
                // ✅ Restore voucher: so sánh cả slug và null/undefined để đảm bảo restore đúng
                // Nếu preservedVoucher khác với orderData.voucher (cả về slug hoặc null/undefined)
                const currentVoucherSlug = preservedVoucher?.slug || null
                const serverVoucherSlug = orderData.voucher?.slug || null
                if (currentVoucherSlug !== serverVoucherSlug) {
                    setDraftVoucher(preservedVoucher)
                }

                // ✅ Restore preserved item changes (với delay để đảm bảo store đã update)
                setTimeout(() => {
                    const currentUpdatingData = useOrderFlowStore.getState().updatingData
                    if (!currentUpdatingData) return

                    // Track các items đã được restore để tránh duplicate
                    const restoredItemIds = new Set<string>()

                    // Restore dựa trên slug (ID) để match chính xác từng item
                    Object.entries(preservedItemChanges || {}).forEach(([itemSlug, changes]) => {
                        // Tìm TẤT CẢ items trong draft mới với cùng slug (ID) - có thể có nhiều items giống nhau
                        const matchingItems = currentUpdatingData.updateDraft?.orderItems?.filter(item => {
                            // Chỉ tìm items chưa được restore
                            if (restoredItemIds.has(item.id)) return false
                            // Match chính xác bằng slug (ID)
                            return item.slug === itemSlug
                        }) || []

                        // Chỉ restore cho item ĐẦU TIÊN tìm thấy với slug này (để tránh restore nhiều lần)
                        const item = matchingItems[0]

                        // Chỉ restore nếu item còn tồn tại trong draft mới và chưa được restore
                        if (item?.id && !restoredItemIds.has(item.id)) {
                            // Kiểm tra xem item có trong originalOrder không (để tránh restore cho items mới được add)
                            const isOriginalItem = currentUpdatingData.originalOrder?.orderItems?.some(oi => oi.slug === itemSlug)

                            // Chỉ restore cho items từ originalOrder (không restore cho items mới được add)
                            if (isOriginalItem) {
                                // Kiểm tra xem quantity hiện tại có khác với quantity cần restore không
                                // Để tránh restore không cần thiết
                                if (item.quantity !== changes.quantity || item.note !== changes.note) {
                                    // Chỉ restore quantity và note, không restore toàn bộ changes
                                    updateDraftItem(item.id, {
                                        quantity: changes.quantity,
                                        note: changes.note
                                    })

                                    // Đánh dấu item đã được restore
                                    restoredItemIds.add(item.id)
                                }
                            }
                        }
                    })
                }, 100)

                setDraftTable(exampleTable) // Set updated table in store
                setShouldReinitialize(false)
            } else {
                // ✅ Force initialize updating phase với original order (không check currentStep)
                try {
                    initializeUpdating(orderData)
                    setIsDataLoaded(true) // Mark data as loaded
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error('❌ Update Order: Failed to initialize updating data:', error)
                }
            }


        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order, isDataLoaded, shouldReinitialize, isRefetching, initializeUpdating])

    // Separate useEffect for polling control (currently disabled)
    useEffect(() => {
        if (order?.result && isDataLoaded) {
            const orderData = order.result
            // Start/stop polling based on order status
            if (orderData.status === OrderStatus.PENDING) {
                setIsPolling(true)
            } else {
                setIsPolling(false)
            }
        }
    }, [order, isDataLoaded])

    // Reset store when slug changes (navigating to different order)
    useEffect(() => {
        if (slug) {
            // Check if current updating data matches the slug
            const isDataMismatch = updatingData?.originalOrder?.slug &&
                updatingData.originalOrder.slug !== slug

            if (isDataMismatch || !updatingData) {
                clearUpdatingData()
                setIsDataLoaded(false) // Reset data loaded flag for new order
            }
        }
    }, [slug, updatingData, clearUpdatingData])

    // Get current order data from Order Flow Store for updates
    const currentOrder = updatingData?.updateDraft
    const orderType = currentOrder?.type as OrderTypeEnum
    const table = currentOrder?.table || ""

    // Fallback initialization nếu data không được load vào store sau 2 giây
    useEffect(() => {
        if (order?.result && isDataLoaded && !updatingData && slug) {
            const timeoutId = setTimeout(() => {
                try {
                    initializeUpdating(order.result)
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error('❌ Update Order: Retry initialization failed:', error)
                }
            }, 2000)

            return () => clearTimeout(timeoutId)
        }
    }, [order, isDataLoaded, updatingData, slug, initializeUpdating])

    // Polling for order status changes every 5 seconds
    useEffect(() => {
        let pollingInterval: NodeJS.Timeout | null = null

        if (isPolling) {
            pollingInterval = setInterval(async () => {
                const updatedOrder = await refetchOrder()
                const orderData = updatedOrder.data?.result

                if (orderData) {
                    // Stop polling if order status changed from PENDING
                    if (orderData.status !== OrderStatus.PENDING) {
                        setIsPolling(false)
                    }
                }
            }, 5000) // Poll every 5 seconds
        }

        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval)
            }
        }
    }, [isPolling, refetchOrder])

    const _handleRefetchAndReinitialize = useCallback(async () => {
        await refetchOrder()
        setShouldReinitialize(true)
    }, [refetchOrder])

    return (
        <div className='pb-4'>
            <Helmet>
                <meta charSet='utf-8' />
                <title>
                    {tHelmet('helmet.updateOrder.title')}
                </title>
                <meta name='description' content={tHelmet('helmet.updateOrder.title')} />
            </Helmet>

            {/* Order type selection */}
            {order?.result &&
                <div className={`flex gap-4 ${isMobile ? 'flex-col' : 'flex-row'}`}>
                    {/* Mobile: Content first (top), Desktop: Menu first (left) */}
                    {isMobile ? (
                        <>
                            {/* Content trên mobile */}
                            <div className="w-full">
                                <UpdateOrderContent
                                    orderType={orderType}
                                    table={table}
                                />
                            </div>

                            {/* Menu dưới mobile */}
                            <div className="flex flex-col gap-2 py-3 w-full">
                                {/* Menu & Table select */}
                                <div className="min-h-[50vh]">
                                    <SystemMenuInUpdateOrderTabs type={orderType} order={order.result} onSubmit={_handleRefetchAndReinitialize} />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className='flex flex-col w-full h-screen'>
                            {/* Desktop layout - Menu left */}
                            <div className={`flex ${isMobile ? 'w-full' : 'w-[75%] xl:w-[70%] pr-6 xl:pr-0'} flex-col gap-2`}>
                                {/* Menu & Table select */}
                                <SystemMenuInUpdateOrderTabs type={orderType} order={order.result} onSubmit={_handleRefetchAndReinitialize} />
                            </div>

                            {/* Desktop layout - Content right */}
                            <UpdateOrderContent
                                orderType={orderType}
                                table={table}
                            />
                        </div>
                    )}
                </div>
            }
        </div>
    )
}
