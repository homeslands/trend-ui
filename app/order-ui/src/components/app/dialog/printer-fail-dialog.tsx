import moment from 'moment'
import { useState, useMemo, useEffect } from 'react'
import { Printer, Loader2, DownloadIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
    Button,
    Badge,
    Checkbox,
} from '@/components/ui'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { PrinterFailNotificationItem } from '@/types'
import { 
    useReprintFailedInvoicePrinterJobs,
    useReprintFailedChefOrderPrinterJobs,
    useReprintFailedLabelPrinterJobs,
} from '@/hooks'
import { NotificationMessageCode } from '@/constants'
import { showToast } from '@/utils'

interface PrinterFailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    printerDialogList: PrinterFailNotificationItem[]
    onGoToOrderManagement: (orderSlug?: string) => void
    buildNotificationTitle: (message: string, type: string) => string
    onReprintSuccess?: (slugs: string[]) => void
}

export default function PrinterFailDialog({
    open,
    onOpenChange,
    printerDialogList,
    onGoToOrderManagement,
    buildNotificationTitle,
    onReprintSuccess,
}: PrinterFailDialogProps) {
    const { t } = useTranslation(['notification'])
    const { t: tToast } = useTranslation('toast')
    const { t: tChefArea } = useTranslation('chefArea')
    const { mutateAsync: reprintFailedInvoiceJobsAsync, isPending: isReprintingInvoice } = useReprintFailedInvoicePrinterJobs()
    const { mutateAsync: reprintFailedChefOrderJobsAsync, isPending: isReprintingChefOrder } = useReprintFailedChefOrderPrinterJobs()
    const { mutateAsync: reprintFailedLabelJobsAsync, isPending: isReprintingLabel } = useReprintFailedLabelPrinterJobs()
    
    // State để track các items được chọn
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
    // State để track các items đang được in lại
    const [reprintingItems, setReprintingItems] = useState<Set<string>>(new Set())

    // Reset selected items khi dialog đóng
    useEffect(() => {
        if (!open) {
            setSelectedItems(new Set())
            setReprintingItems(new Set())
        }
    }, [open])

    const handleClose = (open: boolean) => {
        onOpenChange(open)
        if (!open) {
            setSelectedItems(new Set())
            setReprintingItems(new Set())
        }
    }

    const handleToggleSelect = (slug: string, checked: boolean) => {
        setSelectedItems((prev) => {
            const newSet = new Set(prev)
            if (checked) {
                newSet.add(slug)
            } else {
                newSet.delete(slug)
            }
            return newSet
        })
    }

    const selectedItemsList = useMemo(() => {
        return printerDialogList.filter((item, index) => {
            const itemId = `${item.slug}-${index}`
            return selectedItems.has(itemId)
        })
    }, [printerDialogList, selectedItems])

    const handleReprintMultiple = () => {
        if (selectedItemsList.length === 0) return

        // Group items theo message type
        const invoiceItems = selectedItemsList.filter(
            (item) => item.message === NotificationMessageCode.ORDER_BILL_FAILED_PRINTING && item.metadata.order
        )
        const chefOrderItems = selectedItemsList.filter(
            (item) => item.message === NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING && item.metadata.chefOrder
        )
        const labelItems = selectedItemsList.filter(
            (item) => item.message === NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING && item.metadata.chefOrder
        )

        // In lại từng loại - track item tương ứng với mỗi promise
        const promisesWithItems: Array<{ promise: Promise<boolean>, item: PrinterFailNotificationItem }> = []

        invoiceItems.forEach((item) => {
            const slug = item.metadata.order
            if (!slug) return
            promisesWithItems.push({
                promise: reprintFailedInvoiceJobsAsync(slug)
                    .then(() => true)
                    .catch(() => false),
                item,
            })
        })

        chefOrderItems.forEach((item) => {
            const slug = item.metadata.chefOrder
            if (!slug) return
            promisesWithItems.push({
                promise: reprintFailedChefOrderJobsAsync(slug)
                    .then(() => true)
                    .catch(() => false),
                item,
            })
        })

        labelItems.forEach((item) => {
            const slug = item.metadata.chefOrder
            if (!slug) return
            promisesWithItems.push({
                promise: reprintFailedLabelJobsAsync(slug)
                    .then(() => true)
                    .catch(() => false),
                item,
            })
        })

        Promise.allSettled(promisesWithItems.map((p) => p.promise)).then((results) => {
            const successCount = results.filter((result) => result.status === 'fulfilled' && result.value === true).length
            const totalCount = results.length
            
            // Lấy slugs của các items đã in thành công (map đúng với promise)
            const successSlugs: string[] = []
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value === true) {
                    const item = promisesWithItems[index]?.item
                    if (item) {
                        successSlugs.push(item.slug)
                    }
                }
            })
            
            if (successCount === totalCount && successCount > 0) {
                // Tất cả đều thành công
                if (totalCount === 1) {
                    showToast(tToast('toast.reprintFailedOrderPrinterJobsSuccess'))
                } else {
                    showToast(tToast('toast.reprintFailedOrderPrinterJobsSuccessBatch', { count: successCount }))
                }
                // Ẩn các items đã in thành công
                if (onReprintSuccess && successSlugs.length > 0) {
                    onReprintSuccess(successSlugs)
                }
            } else if (successCount > 0) {
                // Một số thành công, một số thất bại
                showToast(tToast('toast.reprintFailedOrderPrinterJobsPartialSuccess', { success: successCount, total: totalCount }))
                // Ẩn các items đã in thành công
                if (onReprintSuccess && successSlugs.length > 0) {
                    onReprintSuccess(successSlugs)
                }
            } else {
                // Tất cả đều thất bại
                showToast(tToast('toast.reprintFailedOrderPrinterJobsError'))
            }
            setSelectedItems(new Set())
        }).catch(() => {
            showToast(tToast('toast.reprintFailedOrderPrinterJobsError'))
            setSelectedItems(new Set())
        })
    }

    const isReprintingMultiple = isReprintingInvoice || isReprintingChefOrder || isReprintingLabel

    const handleGoToOrderManagement = (item: PrinterFailNotificationItem) => {
        const { metadata } = item
        // Chỉ navigate, không update status
        onGoToOrderManagement(metadata.order)
    }

    const handleReprint = (item: PrinterFailNotificationItem, itemId: string) => {
        const { message, metadata } = item
        const targetSlug =
            message === NotificationMessageCode.ORDER_BILL_FAILED_PRINTING
                ? metadata.order
                : metadata.chefOrder

        if (!targetSlug) return

        // Thêm item vào danh sách đang in lại
        setReprintingItems((prev) => new Set(prev).add(itemId))

        if (message === NotificationMessageCode.ORDER_BILL_FAILED_PRINTING) {
            reprintFailedInvoiceJobsAsync(targetSlug)
                .then(() => {
                    showToast(tToast('toast.reprintFailedOrderPrinterJobsSuccess'))
                    setReprintingItems((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete(itemId)
                        return newSet
                    })
                    // Ẩn item đã in thành công
                    if (onReprintSuccess) {
                        onReprintSuccess([item.slug])
                    }
                })
                .catch(() => {
                    setReprintingItems((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete(itemId)
                        return newSet
                    })
                })
        } else if (message === NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING) {
            reprintFailedChefOrderJobsAsync(targetSlug)
                .then(() => {
                    showToast(tToast('toast.reprintFailedChefOrderSuccess'))
                    setReprintingItems((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete(itemId)
                        return newSet
                    })
                    // Ẩn item đã in thành công
                    if (onReprintSuccess) {
                        onReprintSuccess([item.slug])
                    }
                })
                .catch(() => {
                    setReprintingItems((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete(itemId)
                        return newSet
                    })
                })
        } else if (message === NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING) {
            reprintFailedLabelJobsAsync(targetSlug)
                .then(() => {
                    showToast(tToast('toast.reprintFailedLabelJobsSuccess'))
                    setReprintingItems((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete(itemId)
                        return newSet
                    })
                    // Ẩn item đã in thành công
                    if (onReprintSuccess) {
                        onReprintSuccess([item.slug])
                    }
                })
                .catch(() => {
                    setReprintingItems((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete(itemId)
                        return newSet
                    })
                })
        }
    }

    const getReprintLoadingState = (itemId: string) => {
        return reprintingItems.has(itemId)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <Printer className="w-5 h-5" />
                        {printerDialogList.length > 1
                            ? t('notification.printerFailDialog.titleMultiple', { count: printerDialogList.length })
                            : t('notification.printerFailDialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {printerDialogList.length > 1
                            ? t('notification.printerFailDialog.descriptionMultiple', { count: printerDialogList.length })
                            : t('notification.printerFailDialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 rounded-md bg-muted/40 py-4 text-sm max-h-[400px] overflow-y-auto">
                    {printerDialogList.length === 1 ? (
                        // Hiển thị single item (giữ UI cũ cho 1 đơn)
                        <div className="space-y-3">
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                    {t('notification.printerFailDialog.order')}
                                </span>
                                <span className="font-semibold text-foreground break-all text-right">
                                    {printerDialogList[0]?.metadata.referenceNumber || '—'}
                                </span>
                            </div>
                            {printerDialogList[0]?.metadata.tableName && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        {t('notification.printerFailDialog.table')}
                                    </span>
                                    <span className="font-semibold text-foreground break-all text-right">
                                        {printerDialogList[0].metadata.tableName}
                                    </span>
                                </div>
                            )}
                            {printerDialogList[0]?.metadata.createdAt && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">
                                        {t('notification.printerFailDialog.orderTime')}
                                    </span>
                                    <span className="font-semibold text-foreground break-all text-right">
                                        {moment(printerDialogList[0].metadata.createdAt).format('DD/MM/YYYY HH:mm')}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Hiển thị danh sách (nhiều đơn)
                        <div className="space-y-2">
                            {printerDialogList.map((item, index) => {
                                const itemId = `${item.slug}-${index}`
                                return (
                                <div
                                    key={itemId}
                                    className="p-3 rounded-md bg-background border border-muted-foreground/20 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <Checkbox
                                                checked={selectedItems.has(itemId)}
                                                onCheckedChange={(checked) => {
                                                    handleToggleSelect(itemId, !!checked)
                                                }}
                                                className="mt-1"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        {index + 1}
                                                    </Badge>
                                                    <span className="text-xs font-medium text-muted-foreground">
                                                        {buildNotificationTitle(item.message, 'order')}
                                                    </span>
                                                </div>
                                            <div className="space-y-1 text-xs">
                                                <div className="flex justify-between gap-2">
                                                    <span className="text-muted-foreground">
                                                        {t('notification.printerFailDialog.order')}:
                                                    </span>
                                                    <span className="font-semibold text-foreground break-all text-right">
                                                        {item.metadata.referenceNumber || '—'}
                                                    </span>
                                                </div>
                                                {item.metadata.tableName && (
                                                    <div className="flex justify-between gap-2">
                                                        <span className="text-muted-foreground">
                                                            {t('notification.printerFailDialog.table')}:
                                                        </span>
                                                        <span className="font-semibold text-foreground break-all text-right">
                                                            {item.metadata.tableName}
                                                        </span>
                                                    </div>
                                                )}
                                                {item.metadata.createdAt && (
                                                    <div className="flex justify-between gap-2">
                                                        <span className="text-muted-foreground">
                                                            {t('notification.printerFailDialog.orderTime')}:
                                                        </span>
                                                        <span className="font-semibold text-foreground break-all text-right">
                                                            {moment(item.metadata.createdAt).format('DD/MM/YYYY HH:mm')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 flex-shrink-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                onClick={() => handleGoToOrderManagement(item)}
                                            >
                                                {t('notification.printerFailDialog.viewDetail')}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                disabled={
                                                    getReprintLoadingState(itemId) ||
                                                    (item.message === NotificationMessageCode.ORDER_BILL_FAILED_PRINTING
                                                        ? !item.metadata.order
                                                        : !item.metadata.chefOrder)
                                                }
                                                onClick={() => handleReprint(item, itemId)}
                                            >
                                                {getReprintLoadingState(itemId) && <Loader2 className="mr-2 animate-spin w-4 h-4" />}
                                                {!getReprintLoadingState(itemId) && <DownloadIcon className="mr-2 w-4 h-4" />}
                                                {item.message === NotificationMessageCode.ORDER_BILL_FAILED_PRINTING
                                                    ? tChefArea('chefOrder.reprintFailedOrderJobs', { defaultValue: 'In lại hóa đơn' })
                                                    : item.message === NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING
                                                    ? tChefArea('chefOrder.reprintFailedChefOrderJobs')
                                                    : tChefArea('chefOrder.reprintFailedLabelJobs')}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    {printerDialogList.length === 1 && (() => {
                        const singleItem = printerDialogList[0]
                        const singleItemId = `${singleItem.slug}-0`
                        const singleItemSlug =
                            singleItem.message === NotificationMessageCode.ORDER_BILL_FAILED_PRINTING
                                ? singleItem.metadata.order
                                : singleItem.metadata.chefOrder
                        if (!singleItemSlug) return null
                        return (
                            <Button
                                variant="outline"
                                disabled={getReprintLoadingState(singleItemId)}
                                onClick={() => handleReprint(singleItem, singleItemId)}
                            >
                                {getReprintLoadingState(singleItemId) && <Loader2 className="mr-2 animate-spin w-4 h-4" />}
                                {!getReprintLoadingState(singleItemId) && <DownloadIcon className="mr-2 w-4 h-4" />}
                                {singleItem.message === NotificationMessageCode.ORDER_BILL_FAILED_PRINTING
                                    ? tChefArea('chefOrder.reprintFailedOrderJobs', { defaultValue: 'In lại hóa đơn' })
                                    : singleItem.message === NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING
                                    ? tChefArea('chefOrder.reprintFailedChefOrderJobs')
                                    : tChefArea('chefOrder.reprintFailedLabelJobs')}
                            </Button>
                        )
                    })()}
                    {printerDialogList.length > 1 && selectedItemsList.length > 0 && (
                        <Button
                            variant="default"
                            disabled={isReprintingMultiple}
                            onClick={handleReprintMultiple}
                        >
                            {isReprintingMultiple && <Loader2 className="mr-2 animate-spin w-4 h-4" />}
                            {!isReprintingMultiple && <DownloadIcon className="mr-2 w-4 h-4" />}
                            {tChefArea('chefOrder.reprintFailedJobs', { defaultValue: 'In lại' })} ({selectedItemsList.length})
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => handleClose(false)}>
                        {t('notification.printerFailDialog.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

