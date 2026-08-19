import { Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { UserStatisticsGroupBy } from '@/types'

interface UserStatisticsGroupBySelectProps {
  value: UserStatisticsGroupBy
  onChange: (value: UserStatisticsGroupBy) => void
  /** Optional "<label>: " prefix rendered before the selected value (e.g. "Theo: Ngày").
   * Omit to keep the original unprefixed display — existing callers are unaffected. */
  labelPrefix?: string
}

export default function UserStatisticsGroupBySelect({
  value,
  onChange,
  labelPrefix,
}: UserStatisticsGroupBySelectProps) {
  const { t } = useTranslation(['common'])

  const GROUP_BY_LABELS: Record<UserStatisticsGroupBy, string> = {
    [UserStatisticsGroupBy.HOUR]: t('dayOfWeek.hour'),
    [UserStatisticsGroupBy.DAY]: t('dayOfWeek.day'),
    [UserStatisticsGroupBy.WEEK]: t('dayOfWeek.week'),
    [UserStatisticsGroupBy.MONTH]: t('dayOfWeek.month'),
    [UserStatisticsGroupBy.YEAR]: t('dayOfWeek.year'),
  }

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as UserStatisticsGroupBy)}
    >
      <SelectTrigger className="w-[12rem] flex gap-1 shadow-none font-normal">
        <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <SelectValue placeholder={t('dayOfWeek.selectTimeRange')}>
          {labelPrefix ? `${labelPrefix}: ${GROUP_BY_LABELS[value]}` : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={UserStatisticsGroupBy.HOUR}>
            {t('dayOfWeek.hour')}
          </SelectItem>
          <SelectItem value={UserStatisticsGroupBy.DAY}>
            {t('dayOfWeek.day')}
          </SelectItem>
          <SelectItem value={UserStatisticsGroupBy.WEEK}>
            {t('dayOfWeek.week')}
          </SelectItem>
          <SelectItem value={UserStatisticsGroupBy.MONTH}>
            {t('dayOfWeek.month')}
          </SelectItem>
          <SelectItem value={UserStatisticsGroupBy.YEAR}>
            {t('dayOfWeek.year')}
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
