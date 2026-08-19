import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Clock, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { zodResolver } from '@hookform/resolvers/zod'

import {
    Button,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
    ScrollArea,
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from '@/components/ui'

import { DateAndTimePicker } from '@/components/app/picker'
import { QUERYKEY } from '@/constants'
import { showToast } from '@/utils'
import { useUpdateVoucherGroupApplyTime } from '@/hooks'
import {
    updateVoucherGroupApplyTimeSchema,
    TUpdateVoucherGroupApplyTimeSchema,
} from '@/schemas'
import { IUpdateVoucherGroupApplyTimeRequest } from '@/types'

interface UpdateVoucherGroupApplyTimeSheetProps {
    voucherGroup: string
}

// Helper function to format date for form
const formatDateForForm = (date: Date): string => {
    return format(date, 'yyyy-MM-dd HH:mm:ss')
}

export default function UpdateVoucherGroupApplyTimeSheet({
    voucherGroup,
}: UpdateVoucherGroupApplyTimeSheetProps) {
    const queryClient = useQueryClient()
    const { t } = useTranslation(['voucher'])
    const { t: tCommon } = useTranslation(['common'])
    const { t: tToast } = useTranslation('toast')
    const [isOpen, setIsOpen] = useState(false)
    const { mutate: updateVoucherGroupApplyTime, isPending: isUpdatingVoucherGroupApplyTime } = useUpdateVoucherGroupApplyTime()

    const form = useForm<TUpdateVoucherGroupApplyTimeSchema>({
        resolver: zodResolver(updateVoucherGroupApplyTimeSchema),
        defaultValues: {
            voucherGroup: voucherGroup,
            startDate: formatDateForForm(new Date()),
            endDate: formatDateForForm(new Date()),
        }
    })

    // Reset form when sheet opens or voucherGroup changes
    useEffect(() => {
        if (isOpen && voucherGroup) {
            const now = new Date()

            form.reset({
                voucherGroup: voucherGroup,
                startDate: formatDateForForm(now),
                endDate: formatDateForForm(now),
            })
        }
    }, [isOpen, voucherGroup, form])

    // Validate start date - cannot be in the past
    const disableStartDate = (date: Date) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return date < today
    }

    // Validate end date - must be after start date
    const disableEndDate = (date: Date) => {
        const startDate = form.getValues('startDate')
        if (!startDate) return false

        const selectedStartDate = new Date(startDate)
        const dateOnly = new Date(date)
        dateOnly.setHours(0, 0, 0, 0)
        const startDateOnly = new Date(selectedStartDate)
        startDateOnly.setHours(0, 0, 0, 0)

        return dateOnly < startDateOnly
    }

    const handleDateChange = (
        fieldName: 'startDate' | 'endDate',
        date: string | null,
        onChange?: (value: string) => void
    ) => {
        const dateValue = date || ''

        // Gọi onChange callback để sync với react-hook-form field
        if (onChange) {
            onChange(dateValue)
        } else {
            form.setValue(fieldName, dateValue, { shouldValidate: true })
        }

        // Nếu thay đổi startDate, kiểm tra và cập nhật endDate nếu cần
        if (fieldName === 'startDate') {
            const currentEndDate = form.getValues('endDate')
            if (currentEndDate && new Date(currentEndDate) < new Date(dateValue)) {
                form.setValue('endDate', dateValue, { shouldValidate: true })
            }
        }

        // Nếu thay đổi endDate, kiểm tra với startDate
        if (fieldName === 'endDate' && date) {
            const currentStartDate = form.getValues('startDate')
            if (currentStartDate) {
                const startDateTime = new Date(currentStartDate)
                const endDateTime = new Date(dateValue)

                // Nếu endDate < startDate (cả ngày và giờ), set endDate = startDate
                if (endDateTime < startDateTime) {
                    form.setValue('endDate', currentStartDate, { shouldValidate: true })
                }
            }
        }
    }

    const handleSubmit = (data: TUpdateVoucherGroupApplyTimeSchema) => {
        const requestData: IUpdateVoucherGroupApplyTimeRequest = {
            voucherGroup: data.voucherGroup,
            startDate: data.startDate,
            endDate: data.endDate,
        }

        updateVoucherGroupApplyTime(requestData, {
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: [QUERYKEY.voucherGroups],
                    exact: false,
                    refetchType: 'all'
                })
                queryClient.invalidateQueries({
                    queryKey: [QUERYKEY.vouchers],
                    exact: false,
                    refetchType: 'all'
                })
                showToast(tToast('toast.updateVoucherGroupApplyTimeSuccess'))
                setIsOpen(false)
            }
        })
    }

    const formFields = {
        startDate: (
            <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex gap-1 items-center">
                            <span className="text-destructive">*</span>
                            {t('voucher.startDate')}
                        </FormLabel>
                        <FormControl>
                            <DateAndTimePicker
                                date={field.value}
                                onSelect={(date) => {
                                    handleDateChange('startDate', date, field.onChange)
                                }}
                                disabledDates={disableStartDate}
                                showTime={true}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        ),
        endDate: (
            <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex gap-1 items-center">
                            <span className="text-destructive">*</span>
                            {t('voucher.endDate')}
                        </FormLabel>
                        <FormControl>
                            <DateAndTimePicker
                                date={field.value}
                                onSelect={(date) => {
                                    handleDateChange('endDate', date, field.onChange)
                                }}
                                disabledDates={disableEndDate}
                                showTime={true}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        ),
    }

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant='outline' className="w-fit">
                    <Clock className="icon" />
                    {t('voucher.updateVoucherGroupApplyTime')}
                </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-2xl">
                <SheetHeader className="p-4">
                    <SheetTitle className="text-primary">
                        {t('voucher.updateVoucherGroupApplyTime')}
                    </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col h-full min-h-0 overflow-hidden bg-transparent backdrop-blur-md">
                    <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] gap-4 p-4">
                        <Form {...form}>
                            <form
                                id="update-voucher-group-apply-time-form"
                                onSubmit={form.handleSubmit(handleSubmit)}
                                className="space-y-4"
                            >
                                {/* Nhóm: Ngày bắt đầu và Kết thúc */}
                                <div className="grid grid-cols-2 gap-2 p-4 bg-white rounded-md border dark:bg-transparent">
                                    {formFields.startDate}
                                    {formFields.endDate}
                                </div>
                            </form>
                        </Form>
                    </ScrollArea>
                    <SheetFooter className="shrink-0 flex gap-2 justify-end p-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                        >
                            {tCommon('common.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            form="update-voucher-group-apply-time-form"
                            disabled={isUpdatingVoucherGroupApplyTime}
                        >
                            {isUpdatingVoucherGroupApplyTime ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                t('voucher.update')
                            )}
                        </Button>
                    </SheetFooter>
                </div>
            </SheetContent>
        </Sheet>
    )
}

