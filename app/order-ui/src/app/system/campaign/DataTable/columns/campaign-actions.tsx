import { MoreHorizontal } from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui'
import { UpdateCampaignSheet } from '@/components/app/sheet'
import { ConfirmCloseCampaignDialog, ConfirmDeleteCampaignDialog } from '@/components/app/dialog'
import { CAMPAIGN_STATUS } from '@/constants'
import { ICampaign } from '@/types'

export function CampaignActions({ campaign }: { campaign: ICampaign }) {
  const canClose = campaign.status !== CAMPAIGN_STATUS.CLOSED

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
          {canClose && <ConfirmCloseCampaignDialog campaign={campaign} />}
          <ConfirmDeleteCampaignDialog campaign={campaign} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
