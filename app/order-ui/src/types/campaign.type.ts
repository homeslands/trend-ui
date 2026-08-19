import { IBase } from "./base.type"
import { APPLICABILITY_RULE, VOUCHER_PAYMENT_METHOD, VOUCHER_USAGE_FREQUENCY_UNIT, CAMPAIGN_TYPE, CAMPAIGN_STATUS, CAMPAIGN_REWARD_TYPE } from "@/constants"

export interface ICampaignTypeKey {
  key: string
}

export interface ICampaignVoucherGroup {
  slug: string
  title: string
}

// Response shape returned by GET /campaigns and GET /campaigns/:slug
export interface ICampaignVoucherTemplateResponse extends IBase {
  title: string
  description: string
  duration: number | null
  value: number
  valueType: string
  type: string
  maxUsage: number
  minOrderValue: number
  applicabilityRule: string
  usageFrequencyUnit: string
  usageFrequencyValue: number
  maxItems: number
  paymentMethods: (typeof VOUCHER_PAYMENT_METHOD)[keyof typeof VOUCHER_PAYMENT_METHOD][]
  productSlugs: string[]
}

// Response shape cho chiến dịch phát quà (campaignType = gift)
export interface ICampaignGiftTemplateResponse extends IBase {
  title: string
  description: string | null
  duration: number | null
}

// Request body cho gift template. `UpdateCampaignRequestDto` phía backend KHÔNG có
// `giftCampaignTemplate`, nên type này chỉ dùng khi tạo mới.
export interface ICampaignGiftTemplate {
  title: string
  description?: string
  duration: number | null
}

// Request body shape used in POST /campaigns and PUT /campaigns/:slug
export interface ICampaignVoucherTemplate {
  title: string
  description?: string
  duration: number | null
  value: number
  type: string
  maxUsage: number
  minOrderValue: number
  applicabilityRule: APPLICABILITY_RULE
  usageFrequencyUnit: VOUCHER_USAGE_FREQUENCY_UNIT | 'unlimited'
  usageFrequencyValue: number | null
  maxItems: number
  paymentMethods: (typeof VOUCHER_PAYMENT_METHOD)[keyof typeof VOUCHER_PAYMENT_METHOD][]
  productSlugs: string[]
}

export interface ICampaign extends IBase {
  name: string
  type: CAMPAIGN_TYPE
  status: CAMPAIGN_STATUS
  recipientLimit?: number
  startDate: string
  endDate: string | null
  voucherGroup: ICampaignVoucherGroup
  // Response không trả `campaignType`. Suy ra loại phần thưởng bằng template nào tồn tại:
  // có `voucherCampaignTemplate` -> voucher, có `giftCampaignTemplate` -> gift.
  voucherCampaignTemplate?: ICampaignVoucherTemplateResponse
  giftCampaignTemplate?: ICampaignGiftTemplateResponse
}

export interface IGetCampaignRequestParams {
  hasPaging?: boolean
  page?: number
  size?: number
  sort?: string[]
  status?: CAMPAIGN_STATUS
  type?: CAMPAIGN_TYPE
}

export interface ICreateCampaignRequest {
  name: string
  type: CAMPAIGN_TYPE
  campaignType: CAMPAIGN_REWARD_TYPE
  recipientLimit?: number
  startDate: string
  endDate: string | null
  /** Chỉ gửi khi `campaignType = voucher`. Chiến dịch phát quà không gắn nhóm voucher. */
  voucherGroupSlug?: string
  // Đúng một trong hai, khớp với `campaignType`. Backend validate bằng
  // `@MatchTemplateToCampaignType()` — gửi lẫn hoặc thiếu đều bị 159910/159911.
  voucherCampaignTemplate?: ICampaignVoucherTemplate
  giftCampaignTemplate?: ICampaignGiftTemplate
}

// Mọi field optional theo UpdateCampaignRequestDto. Không có `type` —
// loại chiến dịch không đổi được sau khi tạo.
export interface IUpdateCampaignRequest {
  slug: string
  name?: string
  status?: CAMPAIGN_STATUS
  /** `null` = xóa giới hạn. Bỏ hẳn key = giữ nguyên giá trị cũ. */
  recipientLimit?: number | null
  startDate?: string
  endDate?: string | null
  voucherGroupSlug?: string
  voucherCampaignTemplate?: ICampaignVoucherTemplate
}
