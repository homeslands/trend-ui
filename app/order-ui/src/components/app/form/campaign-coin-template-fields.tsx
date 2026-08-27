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

interface CampaignCoinTemplateFieldsProps {
  /** Số xu còn lại trong ngân sách (chỉ có khi chỉnh sửa chiến dịch đã tồn tại).
   *  `null` = ngân sách không giới hạn. */
  remainingCoin?: number | null
  /** Hiện hint "nâng tổng ngân sách = nạp thêm xu" khi chỉnh sửa. */
  isEditing?: boolean
}

export function CampaignCoinTemplateFields({
  remainingCoin,
  isEditing,
}: CampaignCoinTemplateFieldsProps) {
  const { t } = useTranslation('campaign')
  const { control } = useFormContext<TCampaignFormSchema>()

  const totalCoinLimit = useWatch({ control, name: 'coinTemplate.totalCoinLimit' })

  return (
    <div className="p-4 bg-white rounded-md border dark:bg-transparent">
      <div className="grid grid-cols-1 gap-3">
        <FormField
          control={control}
          name="coinTemplate.title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex gap-1 items-center">
                <span className="text-destructive">*</span>
                {t('campaign.coinTemplate.title')}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  placeholder={t('campaign.coinTemplate.titlePlaceholder')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="coinTemplate.description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('campaign.coinTemplate.description')}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={control}
            name="coinTemplate.coinPerUser"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <span className="text-destructive">*</span>
                  {t('campaign.coinTemplate.coinPerUser')}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                    placeholder="1000"
                    min={1}
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  {t('campaign.coinTemplate.coinPerUserHint')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="coinTemplate.totalCoinLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('campaign.coinTemplate.totalCoinLimit')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      // Xóa trống = không giới hạn (`null`); khi gửi backend sẽ bỏ hẳn key.
                      field.onChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                    placeholder={t('campaign.coinTemplate.unlimited')}
                    min={1}
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  {totalCoinLimit == null
                    ? // Khi chỉnh sửa, để trống nghĩa là BỎ key khỏi PATCH — backend giữ
                      // nguyên ngân sách cũ chứ không chuyển sang không giới hạn.
                      t(
                        isEditing
                          ? 'campaign.coinTemplate.totalCoinLimitHintKeepCurrent'
                          : 'campaign.coinTemplate.totalCoinLimitHintUnlimited',
                      )
                    : isEditing
                      ? t('campaign.coinTemplate.totalCoinLimitHintTopUp')
                      : t('campaign.coinTemplate.totalCoinLimitHint')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isEditing && remainingCoin !== undefined && (
          <p className="text-xs text-muted-foreground">
            {t('campaign.coinTemplate.remainingCoin')}:{' '}
            <span className="font-medium text-foreground">
              {remainingCoin == null
                ? t('campaign.coinTemplate.unlimited')
                : remainingCoin.toLocaleString()}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
