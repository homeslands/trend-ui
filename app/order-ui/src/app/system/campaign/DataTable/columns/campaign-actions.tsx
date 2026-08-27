import { MoreHorizontal } from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui'
import { UpdateCampaignSheet } from '@/components/app/sheet'
import {
  ConfirmCloseCampaignDialog,
  ConfirmDeleteCampaignDialog,
  ConfirmReopenCampaignDialog,
} from '@/components/app/dialog'
import { CAMPAIGN_STATUS } from '@/constants'
import { ICampaign } from '@/types'

export function CampaignActions({ campaign }: { campaign: ICampaign }) {
  const isClosed = campaign.status === CAMPAIGN_STATUS.CLOSED

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="flex flex-col gap-1 w-fit">
          <UpdateCampaignSheet campaign={campaign} />
          {isClosed ? (
            // Mở lại chiến dịch đã đóng; với chiến dịch xu có thể nạp thêm ngân sách
            // ngay trong dialog (backend chặn mở lại khi xu còn lại không đủ một lượt).
            <ConfirmReopenCampaignDialog campaign={campaign} />
          ) : (
            <ConfirmCloseCampaignDialog campaign={campaign} />
          )}
          <ConfirmDeleteCampaignDialog campaign={campaign} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
