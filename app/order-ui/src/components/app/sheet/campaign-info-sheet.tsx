import { useTranslation } from 'react-i18next'

import { Package } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  ScrollArea,
  Badge,
  Separator,
} from '@/components/ui'
import { ICampaign, IProduct } from '@/types'
import { CAMPAIGN_STATUS, VOUCHER_TYPE } from '@/constants'
import { useGetCampaignBySlug, useProducts } from '@/hooks'
import { formatCurrency } from '@/utils'

interface CampaignInfoSheetProps {
  campaign: ICampaign | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

const statusConfig: Record<CAMPAIGN_STATUS, { variant: 'default' | 'secondary' | 'outline'; className?: string }> = {
  [CAMPAIGN_STATUS.OPENING]: { variant: 'outline', className: 'bg-green-500 text-white border-green-500' },
  [CAMPAIGN_STATUS.SCHEDULED]: { variant: 'secondary' },
  [CAMPAIGN_STATUS.CLOSED]: { variant: 'outline', className: 'bg-destructive text-white border-destructive' },
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="block h-3.5 w-0.5 rounded-full bg-primary" />
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {children}
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      <span className="text-sm font-medium leading-snug">{children ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  )
}

export default function CampaignInfoSheet({ campaign, isOpen, onOpenChange }: CampaignInfoSheetProps) {
  const { t } = useTranslation('campaign')
  const { data: detailData, isFetching } = useGetCampaignBySlug(isOpen && campaign ? campaign.slug : '')
  const detail = (!isFetching && detailData?.result) ? detailData.result : campaign

  const productSlugs = detail?.voucherCampaignTemplate?.productSlugs ?? []
  const { data: allProductsData } = useProducts({ hasPaging: false }, isOpen && productSlugs.length > 0)
  const allProducts: IProduct[] = allProductsData?.result?.items ?? []

  if (!detail) return null

  const tpl = detail.voucherCampaignTemplate
  const giftTpl = detail.giftCampaignTemplate
  const coinTpl = detail.coinCampaignTemplate
  const applicableProducts = allProducts.filter((p) => productSlugs.includes(p.slug))
  const voucherGroup = detail.voucherGroup
  const { variant, className } = statusConfig[detail.status] ?? { variant: 'secondary' }

  const campaignTypeLabel = t(`campaign.types.${detail.type}`)

  const tplType = tpl?.type
  const tplFreqUnit = tpl?.usageFrequencyUnit
  const tplApplicability = tpl?.applicabilityRule

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-0 shrink-0">
          <SheetTitle className="text-lg font-bold leading-tight">{detail.name}</SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant={variant} className={className}>
              {t(`campaign.statuses.${detail.status}`)}
            </Badge>
            <span className="text-xs text-muted-foreground">{campaignTypeLabel}</span>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-5 px-6 py-5">

            {/* Campaign overview */}
            <section>
              <SectionTitle>{t('campaign.title')}</SectionTitle>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label={t('campaign.type')}>{campaignTypeLabel}</Field>
                <Field label={t('campaign.recipientLimit')}>
                  {detail.recipientLimit
                    ? detail.recipientLimit.toLocaleString()
                    : t('campaign.recipientLimitUnlimited')}
                </Field>
                <Field label={t('campaign.startDate')}>
                  {new Date(detail.startDate).toLocaleDateString('vi-VN')}
                </Field>
                <Field label={t('campaign.endDate')}>
                  {detail.endDate ? new Date(detail.endDate).toLocaleDateString('vi-VN') : '—'}
                </Field>
                {voucherGroup && (
                  <Field label={t('campaign.voucherGroups')}>
                    {voucherGroup.title}
                  </Field>
                )}
              </div>
            </section>

            {coinTpl && (
              <>
                <Separator />

                <section>
                  <SectionTitle>{t('campaign.coinTemplate.sectionTitle')}</SectionTitle>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Field label={t('campaign.coinTemplate.title')}>{coinTpl.title}</Field>
                    {coinTpl.description && (
                      <Field label={t('campaign.coinTemplate.description')}>
                        {coinTpl.description}
                      </Field>
                    )}
                    <Field label={t('campaign.coinTemplate.coinPerUser')}>
                      {coinTpl.coinPerUser.toLocaleString()}
                    </Field>
                    <Field label={t('campaign.coinTemplate.totalCoinLimit')}>
                      {coinTpl.totalCoinLimit != null
                        ? coinTpl.totalCoinLimit.toLocaleString()
                        : t('campaign.coinTemplate.unlimited')}
                    </Field>
                    <Field label={t('campaign.coinTemplate.remainingCoin')}>
                      {coinTpl.remainingCoin != null
                        ? coinTpl.remainingCoin.toLocaleString()
                        : t('campaign.coinTemplate.unlimited')}
                    </Field>
                  </div>
                </section>
              </>
            )}

            {giftTpl && (
              <>
                <Separator />

                <section>
                  <SectionTitle>{t('campaign.giftTemplate.sectionTitle')}</SectionTitle>
                  <div className="grid grid-cols-1 gap-2">
                    <Field label={t('campaign.giftTemplate.title')}>{giftTpl.title}</Field>
                    {giftTpl.description && (
                      <Field label={t('campaign.giftTemplate.description')}>
                        {giftTpl.description}
                      </Field>
                    )}
                    <Field label={t('campaign.template.duration')}>
                      {giftTpl.duration ?? '—'}
                    </Field>
                  </div>
                </section>
              </>
            )}

            {tpl && (
              <>
                <Separator />

                {/* Voucher template — basic */}
                <section>
                  <SectionTitle>{t('campaign.template.title')}</SectionTitle>
                  <div className="grid grid-cols-1 gap-y-4">
                    <Field label={t('campaign.template.templateTitle')}>{tpl.title}</Field>
                    {tpl.description && (
                      <Field label={t('campaign.template.description')}>{tpl.description}</Field>
                    )}
                  </div>
                </section>

                {/* Voucher type & value */}
                <section>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Field label={t('campaign.template.type')}>
                      {t(`campaign.template.voucherTypes.${tplType}`)}
                    </Field>
                    <Field label={t('campaign.template.value')}>
                      {tplType === VOUCHER_TYPE.PERCENT_ORDER ? `${tpl.value}%` : formatCurrency(tpl.value)}
                    </Field>
                    <Field label={t('campaign.template.minOrderValue')}>
                      {formatCurrency(tpl.minOrderValue)}
                    </Field>
                    <Field label={t('campaign.template.maxUsage')}>{tpl.maxUsage}</Field>
                    <Field label={t('campaign.template.maxItems')}>{tpl.maxItems}</Field>
                    <Field label={t('campaign.template.duration')}>
                      {tpl.duration} {t('campaign.template.frequencyUnits.day')}
                    </Field>
                  </div>
                </section>

                <Separator />

                {/* Usage frequency & rules */}
                <section>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Field label={t('campaign.template.usageFrequencyUnit')}>
                      {t(`campaign.template.frequencyUnits.${tplFreqUnit}`)}
                    </Field>
                    {tpl.usageFrequencyValue != null && tplFreqUnit !== 'unlimited' && (
                      <Field label={t('campaign.template.usageFrequencyValue')}>
                        {tpl.usageFrequencyValue}
                      </Field>
                    )}
                    <Field label={t('campaign.template.applicabilityRule')}>
                      {t(`campaign.template.applicabilityRules.${tplApplicability}`)}
                    </Field>
                    <Field label={t('campaign.template.paymentMethods')}>
                      <div className="flex flex-wrap gap-1">
                        {tpl.paymentMethods.map((m) => (
                          <span key={m} className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                            {t(`campaign.template.paymentMethodOptions.${m}`)}
                          </span>
                        ))}
                      </div>
                    </Field>
                  </div>
                </section>

                {/* Applicable products */}
                {applicableProducts.length > 0 && (
                  <>
                    <Separator />
                    <section>
                      <SectionTitle>
                        {t('campaign.template.products')} ({applicableProducts.length})
                      </SectionTitle>
                      <div className="space-y-2">
                        {applicableProducts.map((p) => (
                          <div key={p.slug} className="flex items-center gap-3 p-2 bg-muted/30 rounded border">
                            <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <p className="text-sm font-medium flex-1 min-w-0 truncate">{p.name}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
