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

// Response shape cho chiến dịch tặng xu (campaignType = coin)
export interface ICampaignCoinTemplateResponse extends IBase {
  title: string
  description: string | null
  coinPerUser: number
  /** `null` = ngân sách không giới hạn */
  totalCoinLimit: number | null
  /** Số xu còn lại trong ngân sách; `null` = không giới hạn (theo totalCoinLimit) */
  remainingCoin: number | null
}

// Request body cho coin template khi tạo mới (CreateCoinCampaignTemplateDto)
export interface ICampaignCoinTemplate {
  title: string
  description?: string
  coinPerUser: number
  /** Bỏ hẳn key = ngân sách không giới hạn */
  totalCoinLimit?: number
}

// UpdateCoinCampaignTemplateDto: mọi field optional. Gửi `totalCoinLimit` mới sẽ khiến
// backend tính lại remaining = limit mới − đã tiêu — đây chính là cách "nạp thêm xu"
// để mở lại chiến dịch đã đóng vì cạn ngân sách.
export interface ICampaignCoinTemplateUpdate {
  title?: string
  description?: string
  coinPerUser?: number
  totalCoinLimit?: number
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
  // `voucherCampaignTemplate` -> voucher, `giftCampaignTemplate` -> gift,
  // `coinCampaignTemplate` -> coin.
  voucherCampaignTemplate?: ICampaignVoucherTemplateResponse
  giftCampaignTemplate?: ICampaignGiftTemplateResponse
  coinCampaignTemplate?: ICampaignCoinTemplateResponse
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
  // Đúng một template khớp với `campaignType`. Backend validate bằng
  // `@MatchTemplateToCampaignType()` — gửi lẫn hoặc thiếu đều bị 159910/159911.
  // Lưu ý: coin chỉ hợp lệ với type new-user (backend trả 159905 nếu khác).
  voucherCampaignTemplate?: ICampaignVoucherTemplate
  giftCampaignTemplate?: ICampaignGiftTemplate
  coinCampaignTemplate?: ICampaignCoinTemplate
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
  coinCampaignTemplate?: ICampaignCoinTemplateUpdate
}
