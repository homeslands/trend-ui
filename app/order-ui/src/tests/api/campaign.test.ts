import { httpMock } from '../__mocks__/httpMock'
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { http } from '@/utils'
import {
  getAllCampaigns,
  getAllCampaignTypeKeys,
  getCampaignBySlug,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from '@/api/campaign'
import { SERVER_ERROR } from '../constants'
import { APPLICABILITY_RULE, CAMPAIGN_REWARD_TYPE, CAMPAIGN_STATUS, CAMPAIGN_TYPE, VOUCHER_PAYMENT_METHOD, VOUCHER_TYPE } from '@/constants'

vi.mock('@/utils', () => ({
  http: httpMock,
}))

const mockCampaign = {
  slug: 'campaign-1',
  name: 'Chào mừng khách mới',
  type: CAMPAIGN_TYPE.NEW_USER,
  status: CAMPAIGN_STATUS.OPENING,
  recipientLimit: 100,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  voucherGroup: [],
  voucherCampaignTemplate: [],
}

describe('Campaign API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllCampaignTypeKeys', () => {
    it('should fetch campaign type keys', async () => {
      const mockResponse = { data: [{ key: 'new-user' }, { key: 'user-birthday' }] }
      ;(http.get as Mock).mockResolvedValue(mockResponse)

      const result = await getAllCampaignTypeKeys()
      expect(http.get).toHaveBeenCalledWith('/campaign/keys')
      expect(result).toEqual(mockResponse.data)
    })

    it('should throw on missing data', async () => {
      ;(http.get as Mock).mockResolvedValue(null)
      await expect(getAllCampaignTypeKeys()).rejects.toThrow('No data found')
    })
  })

  describe('getAllCampaigns', () => {
    it('should fetch campaigns with params', async () => {
      const mockResponse = { data: { items: [mockCampaign], total: 1 } }
      ;(http.get as Mock).mockResolvedValue(mockResponse)

      const params = { hasPaging: true, page: 1, limit: 10 }
      const result = await getAllCampaigns(params)
      expect(http.get).toHaveBeenCalledWith('/campaign/', { params })
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle server error', async () => {
      ;(http.get as Mock).mockRejectedValue(SERVER_ERROR)
      await expect(getAllCampaigns({})).rejects.toEqual(SERVER_ERROR)
    })
  })

  describe('getCampaignBySlug', () => {
    it('should fetch campaign by slug', async () => {
      const mockResponse = { data: mockCampaign }
      ;(http.get as Mock).mockResolvedValue(mockResponse)

      const result = await getCampaignBySlug('campaign-1')
      expect(http.get).toHaveBeenCalledWith('/campaign/campaign-1')
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('createCampaign', () => {
    const createData = {
      name: 'Chào mừng khách mới',
      type: CAMPAIGN_TYPE.NEW_USER,
      campaignType: CAMPAIGN_REWARD_TYPE.VOUCHER,
      recipientLimit: 100,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      voucherGroupSlug: 'group-1',
      voucherCampaignTemplate: {
        title: 'Template test',
        duration: 30,
        value: 50000,
        type: VOUCHER_TYPE.FIXED_VALUE,
        maxUsage: 1,
        minOrderValue: 0,
        applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
        usageFrequencyUnit: 'unlimited' as const,
        usageFrequencyValue: null,
        maxItems: 1,
        paymentMethods: [VOUCHER_PAYMENT_METHOD.CASH],
        productSlugs: [],
      },
    }

    it('should create campaign', async () => {
      const mockResponse = { data: { ...mockCampaign } }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const result = await createCampaign(createData)
      expect(http.post).toHaveBeenCalledWith('/campaign', createData)
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle validation error', async () => {
      const err = { response: { status: 400, data: { message: 'Invalid data' } } }
      ;(http.post as Mock).mockRejectedValue(err)
      await expect(createCampaign(createData)).rejects.toEqual(err)
    })

    it('should send campaignType so the backend knows which template to expect', async () => {
      ;(http.post as Mock).mockResolvedValue({ data: { ...mockCampaign } })

      await createCampaign(createData)

      const body = (http.post as Mock).mock.calls[0][1]
      expect(body.campaignType).toBe('voucher')
    })
  })

  describe('updateCampaign', () => {
    const updateData = {
      slug: 'campaign-1',
      name: 'Updated',
      recipientLimit: 200,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      voucherGroupSlug: 'group-1',
      voucherCampaignTemplate: {
        title: 'Template test',
        duration: 30,
        value: 50000,
        type: VOUCHER_TYPE.FIXED_VALUE,
        maxUsage: 1,
        minOrderValue: 0,
        applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
        usageFrequencyUnit: 'unlimited' as const,
        usageFrequencyValue: null,
        maxItems: 1,
        paymentMethods: [VOUCHER_PAYMENT_METHOD.CASH],
        productSlugs: [],
      },
    }

    it('should update campaign', async () => {
      const mockResponse = { data: { ...mockCampaign, name: 'Updated' } }
      ;(http.patch as Mock).mockResolvedValue(mockResponse)

      const result = await updateCampaign(updateData)
      expect(http.patch).toHaveBeenCalledWith('/campaign/campaign-1', updateData)
      expect(result).toEqual(mockResponse.data)
    })

    it('should forward a null recipientLimit so the backend clears the limit', async () => {
      ;(http.patch as Mock).mockResolvedValue({ data: { ...mockCampaign } })

      await updateCampaign({ ...updateData, recipientLimit: null })

      expect(http.patch).toHaveBeenCalledWith('/campaign/campaign-1', {
        ...updateData,
        recipientLimit: null,
      })
    })

    it('should accept a status-only payload for closing a campaign', async () => {
      ;(http.patch as Mock).mockResolvedValue({ data: { ...mockCampaign, status: CAMPAIGN_STATUS.CLOSED } })

      await updateCampaign({ slug: 'campaign-1', status: CAMPAIGN_STATUS.CLOSED })

      expect(http.patch).toHaveBeenCalledWith('/campaign/campaign-1', {
        slug: 'campaign-1',
        status: CAMPAIGN_STATUS.CLOSED,
      })
    })
  })

  describe('deleteCampaign', () => {
    it('should delete campaign', async () => {
      const mockResponse = { data: null }
      ;(http.delete as Mock).mockResolvedValue(mockResponse)

      const result = await deleteCampaign('campaign-1')
      expect(http.delete).toHaveBeenCalledWith('/campaign/campaign-1')
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle server error', async () => {
      ;(http.delete as Mock).mockRejectedValue(SERVER_ERROR)
      await expect(deleteCampaign('campaign-1')).rejects.toEqual(SERVER_ERROR)
    })
  })
})
