import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PenLine } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  Button,
  ScrollArea,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@/components/ui'
import { DateAndTimePicker } from '@/components/app/picker'
import { CampaignGiftTemplateFields, CampaignTemplateFields } from '@/components/app/form'
import { ConfirmUpdateCampaignDialog } from '@/components/app/dialog'
import { campaignFormSchema, TCampaignFormSchema } from '@/schemas/campaign.schema'
import {
  APPLICABILITY_RULE,
  CAMPAIGN_REWARD_TYPE,
  CAMPAIGN_STATUS,
  CAMPAIGN_TYPE,
  VOUCHER_PAYMENT_METHOD,
  VOUCHER_TYPE,
  VOUCHER_USAGE_FREQUENCY_UNIT,
} from '@/constants'
import { useGetCampaignBySlug, useVoucherGroups } from '@/hooks'
import { ICampaign, IUpdateCampaignRequest, IVoucherGroup } from '@/types'

interface UpdateCampaignSheetProps {
  campaign: ICampaign
}

export default function UpdateCampaignSheet({ campaign }: UpdateCampaignSheetProps) {
  const { t } = useTranslation('campaign')
  const [open, setOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [formData, setFormData] = useState<IUpdateCampaignRequest | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [selectedCampaignType, setSelectedCampaignType] = useState<CAMPAIGN_TYPE>(campaign.type)
  // Loại phần thưởng suy ra từ template nào có trong response, không đổi được sau khi tạo.
  const [selectedRewardType, setSelectedRewardType] = useState<CAMPAIGN_REWARD_TYPE>(
    campaign.giftCampaignTemplate ? CAMPAIGN_REWARD_TYPE.GIFT : CAMPAIGN_REWARD_TYPE.VOUCHER,
  )
  const [hasRecipientLimit, setHasRecipientLimit] = useState(campaign.recipientLimit != null)
  const lastRecipientLimit = useRef<number>(campaign.recipientLimit ?? 100)

  const { data: detailData, isFetching } = useGetCampaignBySlug(open ? campaign.slug : '')
  const { data: voucherGroupsData } = useVoucherGroups({ hasPaging: false }, open)
  const voucherGroups: IVoucherGroup[] = voucherGroupsData?.result?.items ?? []

  const form = useForm<TCampaignFormSchema>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: campaign.name,
      type: campaign.type,
      startDate: campaign.startDate,
      endDate: campaign.endDate ?? '',
      campaignType: campaign.giftCampaignTemplate
        ? CAMPAIGN_REWARD_TYPE.GIFT
        : CAMPAIGN_REWARD_TYPE.VOUCHER,
      recipientLimit: campaign.recipientLimit,
      voucherGroupSlug: campaign.voucherGroup?.slug ?? '',
      template: {
        title: '',
        description: '',
        type: VOUCHER_TYPE.FIXED_VALUE,
        value: 0,
        maxUsage: 1,
        minOrderValue: 0,
        maxItems: 1,
        duration: 30,
        usageFrequencyUnit: 'unlimited',
        usageFrequencyValue: null,
        applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
        paymentMethods: [VOUCHER_PAYMENT_METHOD.CASH],
        productSlugs: [],
      },
    },
  })

  useEffect(() => {
    if (!open || !detailData?.result || isFetching) return
    const detail = detailData.result
    const tpl = detail.voucherCampaignTemplate
    const giftTpl = detail.giftCampaignTemplate
    // Response không trả `campaignType`; suy ra bằng template nào tồn tại.
    const rewardType = giftTpl ? CAMPAIGN_REWARD_TYPE.GIFT : CAMPAIGN_REWARD_TYPE.VOUCHER
    setSelectedCampaignType(detail.type as CAMPAIGN_TYPE)
    setSelectedRewardType(rewardType)
    setHasRecipientLimit(detail.recipientLimit != null)
    lastRecipientLimit.current = detail.recipientLimit ?? 100
    form.reset({
      name: detail.name,
      type: detail.type,
      campaignType: rewardType,
      startDate: detail.startDate,
      endDate: detail.endDate ?? '',
      recipientLimit: detail.recipientLimit,
      voucherGroupSlug: detail.voucherGroup?.slug ?? '',
      template: tpl
        ? {
            title: tpl.title,
            description: tpl.description ?? '',
            type: tpl.type,
            value: tpl.value,
            maxUsage: tpl.maxUsage,
            minOrderValue: tpl.minOrderValue,
            maxItems: tpl.maxItems,
            duration: tpl.duration || 30,
            usageFrequencyUnit: tpl.usageFrequencyUnit as VOUCHER_USAGE_FREQUENCY_UNIT | 'unlimited',
            usageFrequencyValue: tpl.usageFrequencyValue,
            applicabilityRule: tpl.applicabilityRule as APPLICABILITY_RULE,
            paymentMethods: tpl.paymentMethods?.length ? tpl.paymentMethods : [VOUCHER_PAYMENT_METHOD.CASH],
            productSlugs: tpl.productSlugs?.map((p: unknown) =>
              typeof p === 'string' ? p : (p as { product?: { slug?: string }; slug?: string })?.product?.slug ?? (p as { slug?: string })?.slug ?? ''
            ).filter(Boolean) ?? [],
          }
        : undefined,
      giftTemplate: giftTpl
        ? {
            title: giftTpl.title,
            description: giftTpl.description ?? '',
            duration: giftTpl.duration ?? 0,
          }
        : undefined,
    })
    setResetKey((k) => k + 1)
  }, [open, detailData, isFetching]) // eslint-disable-line react-hooks/exhaustive-deps

  const parseFormDate = (s: string) => new Date(s.replace(' ', 'T'))

  // Backend chỉ phát thưởng khi chiến dịch vừa `opening` VỪA có `startDate <= now`
  // (campaign.service.ts:504-509), và scheduler chỉ nâng `scheduled -> opening`, không
  // bao giờ hạ ngược. Đẩy ngày bắt đầu của một chiến dịch đang mở sang tương lai sẽ
  // làm nó ngừng phát thưởng vĩnh viễn trong khi vẫn hiển thị "Đang mở".
  const isOpening = campaign.status === CAMPAIGN_STATUS.OPENING

  const disableStartDate = (date: Date) => {
    if (!isOpening) return false
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    return date > endOfToday
  }

  const disableEndDate = (date: Date) => {
    const start = form.getValues('startDate')
    if (!start) return false
    const startOnly = parseFormDate(start)
    startOnly.setHours(0, 0, 0, 0)
    const dateOnly = new Date(date)
    dateOnly.setHours(0, 0, 0, 0)
    return dateOnly < startOnly
  }

  const handleDateChange = (field: 'startDate' | 'endDate', value: string | null) => {
    form.setValue(field, value ?? '', { shouldValidate: true })
    if (field === 'startDate' && value) {
      const end = form.getValues('endDate')
      if (end && parseFormDate(end) < parseFormDate(value)) {
        form.setValue('endDate', '', { shouldValidate: true })
      }
    }
  }

  const isGiftReward = selectedRewardType === CAMPAIGN_REWARD_TYPE.GIFT

  const handleSubmit = (data: TCampaignFormSchema) => {
    // Picker bật `showTime` nên vẫn chọn được giờ chưa tới trong hôm nay — chặn nốt ở đây.
    if (isOpening && data.startDate && parseFormDate(data.startDate).getTime() > Date.now()) {
      form.setError('startDate', {
        message: t('campaign.startDateMustStayPastWhileOpening'),
      })
      return
    }

    setFormData({
      slug: campaign.slug,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate || null,
      // PATCH semantics: backend keeps the current value when the key is omitted, so an
      // empty field must send `null` explicitly to clear the limit — do NOT switch this
      // back to the "omit key when empty" pattern used in create-campaign-sheet.tsx.
      recipientLimit: data.recipientLimit ?? null,
      // Chiến dịch phát quà không gắn nhóm voucher.
      ...(isGiftReward ? {} : { voucherGroupSlug: data.voucherGroupSlug }),
      // `UpdateCampaignRequestDto` KHÔNG có `giftCampaignTemplate` — chiến dịch quà tặng
      // không sửa được nội dung quà. Gửi kèm `voucherCampaignTemplate` ở đây sẽ khiến
      // backend TẠO MỚI một template voucher cho chiến dịch gift (campaign.service.ts:252-287),
      // nên với gift phải bỏ hẳn key template.
      ...(isGiftReward || !data.template
        ? {}
        : {
            voucherCampaignTemplate: {
              ...data.template,
              duration: data.endDate ? null : data.template.duration,
            },
          }),
    })
    setIsConfirmOpen(true)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="gap-1 justify-start px-2 w-full">
          <PenLine className="h-4 w-4" />
          {t('campaign.editCampaign')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-4xl">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{campaign.name}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)]">
            <Form {...form}>
              <form
                id="update-campaign-form"
                onSubmit={form.handleSubmit(handleSubmit)}
                className="flex flex-col gap-3 p-4"
              >
                {/* Campaign info */}
                <div className="p-4 bg-white rounded-md border dark:bg-transparent">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">
                    {t('campaign.title')}
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <span className="text-destructive">*</span> {t('campaign.name')}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <span className="text-destructive">*</span> {t('campaign.type')}
                          </FormLabel>
                          <Select
                            value={selectedCampaignType}
                            onValueChange={(v) => {
                              setSelectedCampaignType(v as CAMPAIGN_TYPE)
                              field.onChange(v)
                            }}
                            disabled
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="--" />
                            </SelectTrigger>
                            <SelectContent>
                              {/* Select này chỉ để xem (disabled), loại chiến dịch không đổi được
                                  sau khi tạo. Render đúng một mục cho giá trị hiện tại thay vì
                                  duyệt enum: nhãn vẫn hiện đúng kể cả khi backend thêm loại mới. */}
                              {selectedCampaignType && (
                                <SelectItem value={selectedCampaignType}>
                                  {t(`campaign.types.${selectedCampaignType}`, {
                                    defaultValue: selectedCampaignType,
                                  })}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              <span className="text-destructive">*</span> {t('campaign.startDate')}
                            </FormLabel>
                            <FormControl>
                              <DateAndTimePicker
                                date={field.value}
                                onSelect={(v) => handleDateChange('startDate', v)}
                                disabledDates={disableStartDate}
                                showTime
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t('campaign.endDate')}
                            </FormLabel>
                            <FormControl>
                              <DateAndTimePicker
                                date={field.value}
                                onSelect={(v) => handleDateChange('endDate', v)}
                                disabledDates={disableEndDate}
                                showTime
                                clearable
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="recipientLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center justify-between gap-2">
                            {t('campaign.recipientLimit')}
                            <Switch
                              checked={hasRecipientLimit}
                              onCheckedChange={(checked) => {
                                setHasRecipientLimit(checked)
                                if (checked) {
                                  field.onChange(lastRecipientLimit.current)
                                } else {
                                  if (field.value) lastRecipientLimit.current = field.value
                                  field.onChange(undefined)
                                }
                              }}
                            />
                          </FormLabel>
                          <FormControl>
                            {hasRecipientLimit && (
                              <Input
                                type="number"
                                value={field.value ?? ''}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === '' ? undefined : Number(e.target.value),
                                  )
                                }
                                onBlur={() => {
                                  if (!field.value) setHasRecipientLimit(false)
                                }}
                                placeholder={t('campaign.recipientLimitPlaceholder')}
                              />
                            )}
                          </FormControl>
                          <FormDescription className="text-xs">
                            {t(
                              hasRecipientLimit
                                ? 'campaign.recipientLimitHintOn'
                                : 'campaign.recipientLimitHintOff',
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {!isGiftReward && (
                    <FormField
                      control={form.control}
                      name="voucherGroupSlug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <span className="text-destructive">*</span>{' '}
                            {t('campaign.voucherGroups')}
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="--" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {voucherGroups.map((g) => (
                                <SelectItem key={g.slug} value={g.slug}>
                                  {g.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    )}
                  </div>
                </div>

                {/* Phần thưởng — loại không đổi được sau khi tạo */}
                <p className="text-sm font-medium text-muted-foreground px-1">
                  {t(isGiftReward ? 'campaign.giftTemplate.sectionTitle' : 'campaign.template.title')}
                </p>
                {isGiftReward ? (
                  <>
                    <p className="px-1 text-xs text-muted-foreground">
                      {t('campaign.giftTemplate.readOnlyNote')}
                    </p>
                    <CampaignGiftTemplateFields key={resetKey} readOnly />
                  </>
                ) : (
                  <CampaignTemplateFields key={resetKey} />
                )}
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('campaign.cancel')}
            </Button>
            <Button type="submit" form="update-campaign-form">
              {t('campaign.save')}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
      {isConfirmOpen && (
        <ConfirmUpdateCampaignDialog
          isOpen={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          onCloseSheet={() => setOpen(false)}
          campaign={formData}
        />
      )}
    </Sheet>
  )
}
