import { useState } from 'react'
import { ColumnFiltersState } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import {
  DataTableFilterOptionsProps,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { ICampaign } from '@/types'

export default function CampaignFilterOptions({
  setFilterOption,
  filterConfig,
  onFilterChange,
}: DataTableFilterOptionsProps<ICampaign>) {
  const { t } = useTranslation('common')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})

  const handleChange = (filterId: string, value: string) => {
    const next = { ...filterValues, [filterId]: value }
    setFilterValues(next)

    onFilterChange?.(filterId, value)

    const conditions: ColumnFiltersState = Object.entries(next)
      .filter(([, v]) => v !== 'all')
      .map(([id, v]) => ({ id, value: v }))
    setFilterOption(conditions)
  }

  if (!filterConfig?.length) return null

  return (
    <div className="flex gap-2">
      {filterConfig.map((filter) => (
        <Select
          key={filter.id}
          value={filterValues[filter.id] || 'all'}
          onValueChange={(value) => handleChange(filter.id, value)}
        >
          <SelectTrigger className="h-10 text-xs w-fit">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectGroup>
              <SelectLabel className="text-xs">{t('dataTable.filter')}</SelectLabel>
              {filter.options.map((option) => (
                <SelectItem
                  key={String(option.value)}
                  value={String(option.value)}
                  className="text-xs"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ))}
    </div>
  )
}
