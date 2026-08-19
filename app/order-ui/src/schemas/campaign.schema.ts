import { z } from 'zod'
import {
  APPLICABILITY_RULE,
  CAMPAIGN_REWARD_TYPE,
  CAMPAIGN_TYPE,
  VOUCHER_PAYMENT_METHOD,
  VOUCHER_TYPE,
  VOUCHER_USAGE_FREQUENCY_UNIT,
} from '@/constants'

export const campaignVoucherTemplateSchema = z
  .object({
    title: z.string().min(1, 'Tên template là bắt buộc'),
    description: z.string().optional(),
    type: z.enum([
      VOUCHER_TYPE.PERCENT_ORDER,
      VOUCHER_TYPE.FIXED_VALUE,
      VOUCHER_TYPE.SAME_PRICE_PRODUCT,
    ] as [string, ...string[]]),
    value: z
      .number({ invalid_type_error: 'Giá trị phải là số' })
      .positive('Giá trị phải lớn hơn 0'),
    maxUsage: z
      .number({ invalid_type_error: 'Số lần sử dụng phải là số' })
      .int()
      .positive('Số lần sử dụng phải lớn hơn 0'),
    minOrderValue: z
      .number({ invalid_type_error: 'Giá trị đơn tối thiểu phải là số' })
      .min(0, 'Giá trị đơn tối thiểu không được âm'),
    maxItems: z
      .number({ invalid_type_error: 'Số items phải là số' })
      .int()
      .positive('Số items phải lớn hơn 0'),
    duration: z
      .number({ invalid_type_error: 'Thời hạn phải là số' })
      .int()
      .min(0, 'Thời hạn không được âm'),
    usageFrequencyUnit: z.union([
      z.enum([
        VOUCHER_USAGE_FREQUENCY_UNIT.HOUR,
        VOUCHER_USAGE_FREQUENCY_UNIT.DAY,
        VOUCHER_USAGE_FREQUENCY_UNIT.WEEK,
        VOUCHER_USAGE_FREQUENCY_UNIT.MONTH,
        VOUCHER_USAGE_FREQUENCY_UNIT.YEAR,
      ]),
      z.literal('unlimited'),
    ]),
    usageFrequencyValue: z.number().int().positive().nullable(),
    applicabilityRule: z.enum([
      APPLICABILITY_RULE.ALL_REQUIRED,
      APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
    ]),
    paymentMethods: z
      .array(z.enum([VOUCHER_PAYMENT_METHOD.CASH, VOUCHER_PAYMENT_METHOD.POINT, VOUCHER_PAYMENT_METHOD.BANK_TRANSFER, VOUCHER_PAYMENT_METHOD.CREDIT_CARD]))
      .min(1, 'Chọn ít nhất 1 phương thức thanh toán'),
    productSlugs: z.array(z.string()).optional().default([]),
  })
  .refine(
    (data) => {
      if (data.type === VOUCHER_TYPE.PERCENT_ORDER) return data.value <= 100
      return true
    },
    { message: 'Giá trị phần trăm không được vượt quá 100', path: ['value'] },
  )
  .refine(
    (data) => {
      if (data.usageFrequencyUnit !== 'unlimited') {
        return data.usageFrequencyValue !== null && data.usageFrequencyValue > 0
      }
      return true
    },
    { message: 'Tần suất sử dụng là bắt buộc', path: ['usageFrequencyValue'] },
  )

export type TCampaignVoucherTemplateSchema = z.infer<typeof campaignVoucherTemplateSchema>

export const campaignGiftTemplateSchema = z.object({
  title: z.string().min(1, 'Tên quà tặng là bắt buộc'),
  description: z.string().optional(),
  duration: z
    .number({ invalid_type_error: 'Thời hạn phải là số' })
    .int()
    .min(0, 'Thời hạn không được âm'),
})

export type TCampaignGiftTemplateSchema = z.infer<typeof campaignGiftTemplateSchema>

export const campaignFormSchema = z
  .object({
    name: z.string().min(1, 'Tên chiến dịch là bắt buộc'),
    type: z.enum([CAMPAIGN_TYPE.NEW_USER, CAMPAIGN_TYPE.BIRTHDAY]),
    campaignType: z.enum([CAMPAIGN_REWARD_TYPE.VOUCHER, CAMPAIGN_REWARD_TYPE.GIFT]),
    startDate: z.string().min(1, 'Ngày bắt đầu là bắt buộc'),
    endDate: z.string().default(''),
    recipientLimit: z
      .number({ invalid_type_error: 'Giới hạn người nhận phải là số' })
      .int()
      .positive('Giới hạn người nhận phải lớn hơn 0')
      .optional(),
    // Chỉ bắt buộc với phần thưởng voucher — chiến dịch phát quà không gắn nhóm voucher.
    voucherGroupSlug: z.string().default(''),
    // Chỉ một trong hai tồn tại tại một thời điểm. Khi người dùng đổi loại phần thưởng,
    // form phải xoá hẳn nhánh còn lại về `undefined` — để nguyên object rỗng sẽ khiến
    // `.optional()` vẫn chạy validate và báo lỗi ở nhánh không được chọn.
    template: campaignVoucherTemplateSchema.optional(),
    giftTemplate: campaignGiftTemplateSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate && data.endDate <= data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ngày kết thúc phải sau ngày bắt đầu',
        path: ['endDate'],
      })
    }

    if (data.campaignType === CAMPAIGN_REWARD_TYPE.GIFT) {
      if (!data.giftTemplate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cần điền thông tin quà tặng',
          path: ['giftTemplate', 'title'],
        })
        return
      }
      if (!data.endDate && data.giftTemplate.duration <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cần điền thời hạn quà tặng nếu không có ngày kết thúc chiến dịch',
          path: ['giftTemplate', 'duration'],
        })
      }
      return
    }

    if (!data.voucherGroupSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Chọn nhóm voucher',
        path: ['voucherGroupSlug'],
      })
    }

    if (!data.template) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cần điền thông tin voucher',
        path: ['template', 'title'],
      })
      return
    }
    if (!data.endDate && data.template.duration <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cần điền thời hạn voucher nếu không có ngày kết thúc chiến dịch',
        path: ['template', 'duration'],
      })
    }
  })

export type TCampaignFormSchema = z.infer<typeof campaignFormSchema>

// Chỉ dùng khi TẠO MỚI. Backend chỉ kiểm startDate > now ở POST, không kiểm ở PATCH —
// chiến dịch đang chạy luôn có startDate trong quá khứ nên bản dùng chung không được có luật này.
export const campaignCreateFormSchema = campaignFormSchema.refine(
  (data) => {
    if (!data.startDate) return true
    const start = new Date(data.startDate.replace(' ', 'T'))
    if (Number.isNaN(start.getTime())) return false
    return start.getTime() > Date.now()
  },
  { message: 'Ngày bắt đầu phải sau thời điểm hiện tại', path: ['startDate'] },
)

export type TCampaignCreateFormSchema = z.infer<typeof campaignCreateFormSchema>
