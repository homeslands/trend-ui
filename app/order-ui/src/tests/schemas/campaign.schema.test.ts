import { describe, it, expect } from 'vitest'
import { campaignFormSchema, campaignCreateFormSchema } from '@/schemas/campaign.schema'
import {
  APPLICABILITY_RULE,
  CAMPAIGN_REWARD_TYPE,
  CAMPAIGN_TYPE,
  VOUCHER_PAYMENT_METHOD,
  VOUCHER_TYPE,
} from '@/constants'

const validTemplate = {
  title: 'Giảm 15% sinh nhật',
  description: '',
  type: VOUCHER_TYPE.PERCENT_ORDER,
  value: 15,
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

const validForm = {
  name: 'Quà sinh nhật 2026',
  type: CAMPAIGN_TYPE.BIRTHDAY,
  campaignType: CAMPAIGN_REWARD_TYPE.VOUCHER,
  startDate: '2027-09-01 08:00',
  endDate: '',
  voucherGroupSlug: 'vg-birthday',
  template: validTemplate,
  giftTemplate: undefined,
}

const validGiftForm = {
  ...validForm,
  campaignType: CAMPAIGN_REWARD_TYPE.GIFT,
  template: undefined,
  giftTemplate: { title: 'Quà tặng sinh nhật', description: '', duration: 30 },
}

describe('campaignFormSchema — recipientLimit', () => {
  it('accepts a campaign with no recipient limit', () => {
    const result = campaignFormSchema.safeParse({ ...validForm, recipientLimit: undefined })
    expect(result.success).toBe(true)
  })

  it('accepts a positive recipient limit', () => {
    const result = campaignFormSchema.safeParse({ ...validForm, recipientLimit: 500 })
    expect(result.success).toBe(true)
  })

  it('rejects a recipient limit of zero', () => {
    const result = campaignFormSchema.safeParse({ ...validForm, recipientLimit: 0 })
    expect(result.success).toBe(false)
  })
})

describe('campaignCreateFormSchema — startDate', () => {
  const past = new Date(Date.now() - 60 * 60 * 1000)
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  it('rejects a start time that has already passed today', () => {
    const result = campaignCreateFormSchema.safeParse({
      ...validForm,
      recipientLimit: undefined,
      startDate: fmt(past),
    })
    expect(result.success).toBe(false)
  })

  it('accepts a start time in the future', () => {
    const result = campaignCreateFormSchema.safeParse({
      ...validForm,
      recipientLimit: undefined,
      startDate: fmt(future),
    })
    expect(result.success).toBe(true)
  })

  it('lets the shared schema keep a past start date, so running campaigns stay editable', () => {
    const result = campaignFormSchema.safeParse({
      ...validForm,
      recipientLimit: undefined,
      startDate: fmt(past),
    })
    expect(result.success).toBe(true)
  })
})

describe('campaignFormSchema — nhánh phần thưởng', () => {
  it('accepts a gift campaign carrying only the gift template', () => {
    const result = campaignFormSchema.safeParse({ ...validGiftForm, recipientLimit: undefined })
    expect(result.success).toBe(true)
  })

  it('rejects a gift campaign with no gift template', () => {
    const result = campaignFormSchema.safeParse({
      ...validGiftForm,
      recipientLimit: undefined,
      giftTemplate: undefined,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a voucher campaign with no voucher template', () => {
    const result = campaignFormSchema.safeParse({
      ...validForm,
      recipientLimit: undefined,
      template: undefined,
    })
    expect(result.success).toBe(false)
  })

  // Nhánh không được chọn phải vắng mặt hoàn toàn. Nếu form để lại object rỗng ở nhánh kia,
  // zod sẽ validate nó và báo lỗi ở những field người dùng không nhìn thấy.
  it('ignores a leftover voucher template while gift is selected', () => {
    const result = campaignFormSchema.safeParse({
      ...validGiftForm,
      recipientLimit: undefined,
      template: undefined,
    })
    expect(result.success).toBe(true)
  })

  it('requires a gift duration when the campaign has no end date', () => {
    const result = campaignFormSchema.safeParse({
      ...validGiftForm,
      recipientLimit: undefined,
      giftTemplate: { title: 'Quà tặng', description: '', duration: 0 },
    })
    expect(result.success).toBe(false)
  })

  it('allows a zero gift duration when the campaign has an end date', () => {
    const result = campaignFormSchema.safeParse({
      ...validGiftForm,
      recipientLimit: undefined,
      endDate: '2027-12-31 23:59',
      giftTemplate: { title: 'Quà tặng', description: '', duration: 0 },
    })
    expect(result.success).toBe(true)
  })
})

describe('campaignFormSchema — nhóm voucher', () => {
  it('does not require a voucher group for a gift campaign', () => {
    const result = campaignFormSchema.safeParse({
      ...validGiftForm,
      recipientLimit: undefined,
      voucherGroupSlug: '',
    })
    expect(result.success).toBe(true)
  })

  it('still requires a voucher group for a voucher campaign', () => {
    const result = campaignFormSchema.safeParse({
      ...validForm,
      recipientLimit: undefined,
      voucherGroupSlug: '',
    })
    expect(result.success).toBe(false)
  })
})
