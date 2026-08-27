import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@/components/ui'
import { ICampaign, IUpdateCampaignRequest } from '@/types'
import { CAMPAIGN_STATUS } from '@/constants'
import { useUpdateCampaign } from '@/hooks'
import { showToast } from '@/utils'

/**
 * Mở lại chiến dịch đã đóng. Với chiến dịch tặng xu có ngân sách hữu hạn, cho phép
 * nạp thêm xu ngay trong dialog: gửi `totalCoinLimit` mới thì backend tính lại
 * remaining = limit mới − đã tiêu; backend từ chối mở lại (159915) khi số xu còn lại
 * không đủ cho một lượt tặng, nên nút xác nhận cũng bị chặn ở client theo cùng luật.
 */
export default function ConfirmReopenCampaignDialog({ campaign }: { campaign: ICampaign }) {
  const { t } = useTranslation('campaign')
  const [isOpen, setIsOpen] = useState(false)
  const { mutate: updateCampaign, isPending } = useUpdateCampaign()

  const coinTpl = campaign.coinCampaignTemplate
  const [newTotalCoinLimit, setNewTotalCoinLimit] = useState<number | ''>(
    coinTpl?.totalCoinLimit ?? '',
  )

  // Ngân sách hữu hạn: số xu đã tiêu = limit − remaining; muốn mở lại thì limit mới
  // phải đủ để remaining mới (= limit mới − đã tiêu) >= coinPerUser.
  const consumed =
    coinTpl && coinTpl.totalCoinLimit != null
      ? coinTpl.totalCoinLimit - (coinTpl.remainingCoin ?? 0)
      : 0
  const minLimit = coinTpl ? consumed + coinTpl.coinPerUser : 0
  const hasBoundedBudget = coinTpl != null && coinTpl.totalCoinLimit != null
  const effectiveLimit = newTotalCoinLimit === '' ? (coinTpl?.totalCoinLimit ?? null) : newTotalCoinLimit
  const coinBudgetTooLow = hasBoundedBudget && (effectiveLimit == null || effectiveLimit < minLimit)

  const handleConfirm = () => {
    // Backend validate trạng thái theo ngày: OPENING cần startDate <= now,
    // SCHEDULED cần startDate > now — chọn đúng đích để không bị 159907.
    const targetStatus =
      new Date(campaign.startDate).getTime() <= Date.now()
        ? CAMPAIGN_STATUS.OPENING
        : CAMPAIGN_STATUS.SCHEDULED

    const payload: IUpdateCampaignRequest = {
      slug: campaign.slug,
      status: targetStatus,
      ...(coinTpl && newTotalCoinLimit !== '' && newTotalCoinLimit !== coinTpl.totalCoinLimit
        ? { coinCampaignTemplate: { totalCoinLimit: newTotalCoinLimit } }
        : {}),
    }

    updateCampaign(payload, {
      onSuccess: () => {
        showToast(t('campaign.reopenSuccess'))
        setIsOpen(false)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="gap-1 justify-start px-2 w-full text-sm">
          <RotateCcw className="w-4 h-4" />
          {t('campaign.reopenCampaign')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[22rem] rounded-md px-6 sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="pb-4 border-b">
            <div className="flex gap-2 items-center text-primary">
              <RotateCcw className="w-6 h-6" />
              {t('campaign.confirmReopen')}
            </div>
          </DialogTitle>
          <div className="flex flex-col gap-3 py-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{campaign.name}</span> —{' '}
              {t('campaign.confirmReopenDescription')}
            </p>

            {coinTpl && (
              <div className="flex flex-col gap-2 p-3 rounded-md border bg-muted/30">
                <p className="text-xs">
                  {t('campaign.coinTemplate.remainingCoin')}:{' '}
                  <span className="font-medium text-foreground">
                    {coinTpl.remainingCoin == null
                      ? t('campaign.coinTemplate.unlimited')
                      : coinTpl.remainingCoin.toLocaleString()}
                  </span>
                  {' · '}
                  {t('campaign.coinTemplate.coinPerUser')}:{' '}
                  <span className="font-medium text-foreground">
                    {coinTpl.coinPerUser.toLocaleString()}
                  </span>
                </p>
                <Label htmlFor="reopen-total-coin-limit" className="text-xs">
                  {t('campaign.coinTemplate.totalCoinLimit')}
                </Label>
                <Input
                  id="reopen-total-coin-limit"
                  type="number"
                  min={1}
                  value={newTotalCoinLimit}
                  onChange={(e) =>
                    setNewTotalCoinLimit(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder={t('campaign.coinTemplate.unlimited')}
                />
                {hasBoundedBudget && (
                  <p className={`text-xs ${coinBudgetTooLow ? 'text-destructive' : ''}`}>
                    {t('campaign.reopenMinLimitHint', { minLimit: minLimit.toLocaleString() })}
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t('campaign.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || coinBudgetTooLow}>
            {t('campaign.reopenCampaign')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
