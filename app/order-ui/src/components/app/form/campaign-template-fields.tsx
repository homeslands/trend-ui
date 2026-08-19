import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  DataTable,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Switch,
} from '@/components/ui'
import {
  VoucherApplicabilityRuleSelect,
  VoucherPaymentMethodSelect,
  VoucherTypeSelect,
  VoucherUsageFrequencyRuleSelect,
} from '@/components/app/select'
import { useProductColumns } from '@/app/system/voucher/DataTable/columns'
import { ProductFilterOptions } from '@/app/system/products/DataTable/actions'
import { TCampaignFormSchema } from '@/schemas/campaign.schema'
import { CAMPAIGN_TYPE, VOUCHER_TYPE, VOUCHER_USAGE_FREQUENCY_UNIT } from '@/constants'
import { useCatalogs, useProducts } from '@/hooks'
import { IProduct } from '@/types'

export function CampaignTemplateFields() {
  const { t } = useTranslation('campaign')
  const { t: tProduct } = useTranslation('product')
  const { t: tCommon } = useTranslation('common')
  const { control, setValue } = useFormContext<TCampaignFormSchema>()

  const voucherType = useWatch({ control, name: 'template.type' })
  const usageFrequencyUnit = useWatch({ control, name: 'template.usageFrequencyUnit' })
  const selectedProductSlugs = useWatch({ control, name: 'template.productSlugs' }) ?? []
  const campaignStartDate = useWatch({ control, name: 'startDate' })
  const campaignEndDate = useWatch({ control, name: 'endDate' })
  const hasCampaignEndDate = !!campaignEndDate
  const campaignType = useWatch({ control, name: 'type' })

  const calculatedDuration = useMemo(() => {
    if (!campaignEndDate || !campaignStartDate) return null
    const start = new Date(campaignStartDate.replace(' ', 'T'))
    const end = new Date(campaignEndDate.replace(' ', 'T'))
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000)
    return days > 0 ? days : null
  }, [campaignStartDate, campaignEndDate])

  const durationHintKey = hasCampaignEndDate
    ? 'campaign.template.durationHintWithEndDate'
    : campaignType === CAMPAIGN_TYPE.BIRTHDAY
      ? 'campaign.template.durationHintBirthday'
      : 'campaign.template.durationHintNewUser'

  const [isUsageFrequencyEnabled, setIsUsageFrequencyEnabled] = useState(
    usageFrequencyUnit !== 'unlimited',
  )
  const [catalog, setCatalog] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ pageIndex: 1, pageSize: 10 })
  const hasNavigatedToSelection = useRef(false)

  useEffect(() => {
    setIsUsageFrequencyEnabled(usageFrequencyUnit !== 'unlimited')
  }, [usageFrequencyUnit])

  useEffect(() => {
    if (hasCampaignEndDate) {
      setValue('template.duration', 0)
    }
  }, [hasCampaignEndDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: catalogsData } = useCatalogs()
  const catalogs = catalogsData?.result ?? []

  const { data: productsData, isLoading: isLoadingProducts } = useProducts(
    { page: pagination.pageIndex, size: pagination.pageSize, hasPaging: true, catalog: catalog || undefined },
    true,
  )

  // Fetch all products to resolve names for pre-selected slugs (cross-page visibility)
  const { data: allProductsData } = useProducts(
    { hasPaging: false },
    selectedProductSlugs.length > 0,
  )
  const allProducts: IProduct[] = allProductsData?.result?.items ?? []
  const selectedProductItems = allProducts.filter((p) => selectedProductSlugs.includes(p.slug))

  // Auto-navigate to the page containing the first pre-selected product
  useEffect(() => {
    if (hasNavigatedToSelection.current || allProducts.length === 0 || selectedProductSlugs.length === 0) return
    const firstIdx = allProducts.findIndex((p) => selectedProductSlugs.includes(p.slug))
    if (firstIdx >= 0) {
      const targetPage = Math.floor(firstIdx / pagination.pageSize) + 1
      if (targetPage !== pagination.pageIndex) {
        setPagination((prev) => ({ ...prev, pageIndex: targetPage }))
      }
      hasNavigatedToSelection.current = true
    }
  }, [allProducts.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectionChange = useCallback(
    (slugs: string[]) => {
      hasNavigatedToSelection.current = true
      setValue('template.productSlugs', slugs)
    },
    [setValue],
  )

  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: page }))
  }, [])

  const handlePageSizeChange = useCallback((size: number) => {
    setPagination({ pageIndex: 1, pageSize: size })
  }, [])

  const filterConfig = [
    {
      id: 'catalog',
      label: tProduct('product.catalog'),
      options: [
        { label: tCommon('dataTable.all'), value: 'all' },
        ...catalogs.map((c) => ({ label: c.name, value: c.slug })),
      ],
    },
  ]

  const handleFilterChange = (filterId: string, value: string) => {
    if (filterId === 'catalog') setCatalog(value === 'all' ? null : value)
  }

  const valueSuffix = voucherType === VOUCHER_TYPE.PERCENT_ORDER ? '%' : '₫'

  return (
    <>
      {/* Title + Description */}
      <div className="p-4 bg-white rounded-md border dark:bg-transparent">
        <div className="grid grid-cols-1 gap-3">
          <FormField
            control={control}
            name="template.title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex gap-1 items-center">
                  <span className="text-destructive">*</span>
                  {t('campaign.template.templateTitle')}
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('campaign.template.templateTitle')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Type + Value */}
      <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-md border dark:bg-transparent">
        <FormField
          control={control}
          name="template.type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex gap-1 items-center">
                <span className="text-destructive">*</span>
                {t('campaign.template.type')}
              </FormLabel>
              <FormControl>
                <VoucherTypeSelect defaultValue={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="template.value"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex gap-1 items-center">
                <span className="text-destructive">*</span>
                {t('campaign.template.value')}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type="number"
                    value={field.value?.toString() ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                    }
                    placeholder="0"
                    min={0}
                    max={voucherType === VOUCHER_TYPE.PERCENT_ORDER ? 100 : undefined}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    {valueSuffix}
                  </span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Usage limits */}
      <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-md border dark:bg-transparent">
        <FormField
          control={control}
          name="template.maxUsage"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex gap-1 items-center">
                <span className="text-destructive">*</span>
                {t('campaign.template.maxUsage')}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  value={field.value?.toString() ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="1"
                  min={0}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="template.minOrderValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex gap-1 items-center">
                <span className="text-destructive">*</span>
                {t('campaign.template.minOrderValue')}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type="number"
                    value={field.value?.toString() ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="0"
                    min={0}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    ₫
                  </span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="template.maxItems"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex gap-1 items-center">
                <span className="text-destructive">*</span>
                {t('campaign.template.maxItems')}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  value={field.value?.toString() ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="1"
                  min={1}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="template.duration"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex gap-1 items-center">
                {!hasCampaignEndDate && <span className="text-destructive">*</span>}
                {t('campaign.template.duration')}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  value={hasCampaignEndDate ? (calculatedDuration?.toString() ?? '') : (field.value?.toString() ?? '')}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="30"
                  min={0}
                  disabled={hasCampaignEndDate}
                />
              </FormControl>
              <FormDescription className="text-xs">{t(durationHintKey)}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Usage frequency */}
      <div className="p-4 bg-white rounded-md border dark:bg-transparent">
        <div className="grid grid-cols-1 gap-3">
          <FormField
            control={control}
            name="template.usageFrequencyUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center justify-between gap-2">
                  <div className="flex gap-1 items-center">
                    <span className="text-destructive">*</span>
                    {t('campaign.template.usageFrequencyUnit')}
                  </div>
                  <Switch
                    checked={isUsageFrequencyEnabled}
                    onCheckedChange={(checked) => {
                      setIsUsageFrequencyEnabled(checked)
                      if (checked) {
                        const current = field.value
                        const next =
                          current && current !== 'unlimited'
                            ? (current as VOUCHER_USAGE_FREQUENCY_UNIT)
                            : VOUCHER_USAGE_FREQUENCY_UNIT.DAY
                        field.onChange(next)
                        setValue('template.usageFrequencyValue', 1)
                      } else {
                        field.onChange('unlimited')
                        setValue('template.usageFrequencyValue', null)
                      }
                    }}
                  />
                </FormLabel>
                <FormControl>
                  {isUsageFrequencyEnabled && (
                    <VoucherUsageFrequencyRuleSelect
                      defaultValue={
                        field.value !== 'unlimited' ? (field.value as string) : undefined
                      }
                      onChange={field.onChange}
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {isUsageFrequencyEnabled && (
            <FormField
              control={control}
              name="template.usageFrequencyValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex gap-1 items-center">
                    <span className="text-destructive">*</span>
                    {t('campaign.template.usageFrequencyValue')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      value={field.value?.toString() ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="1"
                      min={1}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      </div>

      {/* Applicability rule */}
      <div className="p-4 bg-white rounded-md border dark:bg-transparent">
        <FormField
          control={control}
          name="template.applicabilityRule"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex gap-1 items-center">
                <span className="text-destructive">*</span>
                {t('campaign.template.applicabilityRule')}
              </FormLabel>
              <FormControl>
                <VoucherApplicabilityRuleSelect
                  defaultValue={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Payment methods — multi-select, at least 1 required */}
      <div className="p-4 bg-white rounded-md border dark:bg-transparent">
        <FormField
          control={control}
          name="template.paymentMethods"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex gap-1 items-center">
                <span className="text-destructive">*</span>
                {t('campaign.template.paymentMethods')}
              </FormLabel>
              <FormControl>
                <VoucherPaymentMethodSelect
                  initialValues={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Products */}
      <div className="p-4 bg-white rounded-md border dark:bg-transparent">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium">{t('campaign.template.products')}</span>
          {selectedProductSlugs.length > 0 && (
            <span className="px-2 py-1 text-xs rounded-full text-muted-foreground bg-primary/10">
              {selectedProductSlugs.length} {t('campaign.template.products').toLowerCase()}
            </span>
          )}
        </div>
        {selectedProductItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selectedProductItems.map((p) => (
              <span
                key={p.slug}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium"
              >
                {p.name}
              </span>
            ))}
          </div>
        )}
        <DataTable
          columns={useProductColumns({
            onSelectionChange: handleSelectionChange,
            selectedProducts: selectedProductSlugs,
          })}
          data={productsData?.result.items ?? []}
          isLoading={isLoadingProducts}
          pages={productsData?.result.totalPages ?? 1}
          filterOptions={ProductFilterOptions}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          filterConfig={filterConfig}
          onFilterChange={handleFilterChange}
        />
      </div>
    </>
  )
}
