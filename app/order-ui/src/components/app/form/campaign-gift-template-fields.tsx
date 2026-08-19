import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@/components/ui'
import { TCampaignFormSchema } from '@/schemas/campaign.schema'
import { CAMPAIGN_TYPE } from '@/constants'

interface CampaignGiftTemplateFieldsProps {
  /** Chiến dịch quà tặng không sửa được sau khi tạo — `UpdateCampaignRequestDto`
   *  phía backend không có `giftCampaignTemplate`. */
  readOnly?: boolean
}

export function CampaignGiftTemplateFields({ readOnly }: CampaignGiftTemplateFieldsProps) {
  const { t } = useTranslation('campaign')
  const { control } = useFormContext<TCampaignFormSchema>()

  const campaignType = useWatch({ control, name: 'type' })
  const campaignEndDate = useWatch({ control, name: 'endDate' })
  const hasCampaignEndDate = !!campaignEndDate

  const durationHintKey = hasCampaignEndDate
    ? 'campaign.template.durationHintWithEndDate'
    : campaignType === CAMPAIGN_TYPE.BIRTHDAY
      ? 'campaign.giftTemplate.durationHintBirthday'
      : 'campaign.giftTemplate.durationHintNewUser'

  return (
    <div className="p-4 bg-white rounded-md border dark:bg-transparent">
      <div className="grid grid-cols-1 gap-3">
        <FormField
          control={control}
          name="giftTemplate.title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex gap-1 items-center">
                <span className="text-destructive">*</span>
                {t('campaign.giftTemplate.title')}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  disabled={readOnly}
                  placeholder={t('campaign.giftTemplate.titlePlaceholder')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="giftTemplate.description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('campaign.giftTemplate.description')}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} disabled={readOnly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="giftTemplate.duration"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex gap-1 items-center">
                {!hasCampaignEndDate && <span className="text-destructive">*</span>}
                {t('campaign.template.duration')}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  placeholder="30"
                  min={0}
                  disabled={readOnly || hasCampaignEndDate}
                />
              </FormControl>
              <FormDescription className="text-xs">{t(durationHintKey)}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}
