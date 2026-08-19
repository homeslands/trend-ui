import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PlusCircle } from 'lucide-react'

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
import { ConfirmCreateCampaignDialog } from '@/components/app/dialog'
import {
  campaignCreateFormSchema,
  TCampaignFormSchema,
  TCampaignVoucherTemplateSchema,
} from '@/schemas/campaign.schema'
import { APPLICABILITY_RULE, CAMPAIGN_REWARD_TYPE, CAMPAIGN_TYPE, VOUCHER_PAYMENT_METHOD, VOUCHER_TYPE } from '@/constants'
import { useGetAllCampaignTypeKeys, useVoucherGroups } from '@/hooks'
import { ICreateCampaignRequest, IVoucherGroup } from '@/types'

const DEFAULT_VOUCHER_TEMPLATE = {
  title: '',
  description: '',
  type: VOUCHER_TYPE.FIXED_VALUE,
  value: 0,
  maxUsage: 1,
  minOrderValue: 0,
  maxItems: 1,
  duration: 30,
  usageFrequencyUnit: 'unlimited' as const,
  usageFrequencyValue: null,
  applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
  paymentMethods: [VOUCHER_PAYMENT_METHOD.CASH],
  productSlugs: [],
}

export default function CreateCampaignSheet() {
  const { t } = useTranslation('campaign')
  const [open, setOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [formData, setFormData] = useState<ICreateCampaignRequest | null>(null)
  const [hasRecipientLimit, setHasRecipientLimit] = useState(false)
  const lastRecipientLimit = useRef<number>(100)

  // Component này chứa chính cái nút mở sheet nên nó mount cùng trang danh sách.
  // Không chặn theo `open` thì mỗi lần vào danh sách đều gọi API cho một form
  // mà admin có thể không bao giờ mở.
  const { data: voucherGroupsData } = useVoucherGroups({ hasPaging: false }, open)
  const voucherGroups: IVoucherGroup[] = voucherGroupsData?.result?.items ?? []

  // Doc mục 4.1: `/campaign/keys` là nguồn chuẩn cho dropdown loại chiến dịch, để backend
  // thêm loại mới thì FE không phải sửa. Vẫn giữ enum làm phương án dự phòng — endpoint
  // lỗi mà bỏ trống dropdown thì không tạo được chiến dịch nào.
  const { data: campaignTypeKeysData } = useGetAllCampaignTypeKeys(open)
  const campaignTypeKeys = campaignTypeKeysData?.result?.map((item) => item.key) ?? []
  const campaignTypeOptions: string[] = campaignTypeKeys.length
    ? campaignTypeKeys
    : Object.values(CAMPAIGN_TYPE)

  const form = useForm<TCampaignFormSchema>({
    resolver: zodResolver(campaignCreateFormSchema),
    defaultValues: {
      name: '',
      type: CAMPAIGN_TYPE.NEW_USER,
      campaignType: CAMPAIGN_REWARD_TYPE.VOUCHER,
      startDate: '',
      endDate: '',
      recipientLimit: undefined,
      voucherGroupSlug: '',
      giftTemplate: undefined,
      template: DEFAULT_VOUCHER_TEMPLATE,
    },
  })

  const selectedCampaignType = useWatch({ control: form.control, name: 'type' })
  const selectedRewardType = useWatch({ control: form.control, name: 'campaignType' })
  // Chỉ chiến dịch sinh nhật mới được chọn phần thưởng là quà tặng.
  const canChooseReward = selectedCampaignType === CAMPAIGN_TYPE.BIRTHDAY
  const isGiftReward = selectedRewardType === CAMPAIGN_REWARD_TYPE.GIFT

  const disableStartDate = (date: Date) => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    return date < startOfToday
  }

  const parseFormDate = (s: string) => new Date(s.replace(' ', 'T'))

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

  // Hai nhánh template loại trừ nhau. Nhánh không được chọn phải xoá hẳn về `undefined`:
  // để lại object rỗng thì zod vẫn chạy validate nhánh đó và báo lỗi ở form người dùng
  // không nhìn thấy, khiến nút Tạo bấm không ăn mà không rõ vì sao.
  const handleRewardTypeChange = (value: string) => {
    const rewardType = value as CAMPAIGN_REWARD_TYPE
    form.setValue('campaignType', rewardType, { shouldValidate: false })

    if (rewardType === CAMPAIGN_REWARD_TYPE.GIFT) {
      form.setValue('template', undefined)
      form.setValue('giftTemplate', { title: '', description: '', duration: 30 })
    } else {
      form.setValue('giftTemplate', undefined)
      form.setValue('template', DEFAULT_VOUCHER_TEMPLATE)
    }
    form.clearErrors(['template', 'giftTemplate'])
  }

  // Rời khỏi loại Sinh nhật thì selector phần thưởng biến mất, nên phải ép `campaignType`
  // về voucher — nếu không, form vẫn giữ `gift` và gửi payload quà tặng cho chiến dịch
  // người dùng mới, trong khi người dùng không còn thấy ô nào để sửa.
  const handleCampaignTypeChange = (value: string) => {
    form.setValue('type', value as CAMPAIGN_TYPE, { shouldValidate: false })
    if (value !== CAMPAIGN_TYPE.BIRTHDAY) {
      handleRewardTypeChange(CAMPAIGN_REWARD_TYPE.VOUCHER)
    }
  }

  const handleSubmit = (data: TCampaignFormSchema) => {
    const isGift = data.campaignType === CAMPAIGN_REWARD_TYPE.GIFT

    setFormData({
      name: data.name,
      type: data.type,
      campaignType: data.campaignType,
      startDate: data.startDate,
      endDate: data.endDate || null,
      ...(data.recipientLimit ? { recipientLimit: data.recipientLimit } : {}),
      // Chiến dịch phát quà không gắn nhóm voucher.
      ...(isGift ? {} : { voucherGroupSlug: data.voucherGroupSlug }),
      // Gửi đúng một template khớp `campaignType`. Backend validate bằng
      // `@MatchTemplateToCampaignType()` — gửi cả hai hoặc gửi lẫn đều bị 159910/159911.
      ...(isGift
        ? {
            giftCampaignTemplate: {
              title: data.giftTemplate?.title ?? '',
              description: data.giftTemplate?.description,
              duration: data.endDate ? null : (data.giftTemplate?.duration ?? null),
            },
          }
        : {
            voucherCampaignTemplate: {
              ...(data.template as TCampaignVoucherTemplateSchema),
              duration: data.endDate ? null : (data.template?.duration ?? null),
            },
          }),
    })
    setIsConfirmOpen(true)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <PlusCircle size={16} />
          {t('campaign.createCampaign')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-4xl">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('campaign.createCampaign')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)]">
            <Form {...form}>
              <form
                id="create-campaign-form"
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
                          <Select onValueChange={handleCampaignTypeChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="--">
                                  {field.value ? t(`campaign.types.${field.value}`) : undefined}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {campaignTypeOptions.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {t(`campaign.types.${type}`, { defaultValue: type })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {canChooseReward && (
                    <FormField
                      control={form.control}
                      name="campaignType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <span className="text-destructive">*</span>{' '}
                            {t('campaign.rewardType')}
                          </FormLabel>
                          <Select onValueChange={handleRewardTypeChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="--" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={CAMPAIGN_REWARD_TYPE.VOUCHER}>
                                {t('campaign.rewardTypes.voucher')}
                              </SelectItem>
                              <SelectItem value={CAMPAIGN_REWARD_TYPE.GIFT}>
                                {t('campaign.rewardTypes.gift')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            {t(
                              isGiftReward
                                ? 'campaign.rewardTypeHintGift'
                                : 'campaign.rewardTypeHintVoucher',
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    )}
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
                            <span className="text-destructive">*</span> {t('campaign.voucherGroups')}
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

                {/* Phần thưởng — render đúng một nhánh theo `campaignType` */}
                <p className="text-sm font-medium text-muted-foreground px-1">
                  {t(isGiftReward ? 'campaign.giftTemplate.sectionTitle' : 'campaign.template.title')}
                </p>
                {isGiftReward ? <CampaignGiftTemplateFields /> : <CampaignTemplateFields />}
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('campaign.cancel')}
            </Button>
            <Button type="submit" form="create-campaign-form">
              {t('campaign.createCampaign')}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
      {isConfirmOpen && (
        <ConfirmCreateCampaignDialog
          isOpen={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          onCloseSheet={() => {
            form.reset()
            setOpen(false)
          }}
          campaign={formData}
        />
      )}
    </Sheet>
  )
}
