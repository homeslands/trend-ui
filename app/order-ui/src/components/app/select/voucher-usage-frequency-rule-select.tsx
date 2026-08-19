import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useThemeStore } from '@/stores'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { VOUCHER_USAGE_FREQUENCY_UNIT } from '@/constants'

export default function VoucherUsageFrequencyRuleSelect({
  onChange,
  defaultValue,
}: {
  onChange: (value: string) => void
  defaultValue?: string
}) {
  const { getTheme } = useThemeStore()
  const { t } = useTranslation('voucher')
  const [selectedVoucherUsageFrequencyUnit, setSelectedVoucherUsageFrequencyUnit] = useState<string>(defaultValue || '')

  useEffect(() => {
    if (defaultValue) {
      setSelectedVoucherUsageFrequencyUnit(defaultValue)
    }
  }, [defaultValue])

  const options = useMemo(
    () => [
      { label: t('voucher.hour'), value: VOUCHER_USAGE_FREQUENCY_UNIT.HOUR },
      { label: t('voucher.day'), value: VOUCHER_USAGE_FREQUENCY_UNIT.DAY },
      { label: t('voucher.week'), value: VOUCHER_USAGE_FREQUENCY_UNIT.WEEK },
      { label: t('voucher.month'), value: VOUCHER_USAGE_FREQUENCY_UNIT.MONTH },
      { label: t('voucher.year'), value: VOUCHER_USAGE_FREQUENCY_UNIT.YEAR },
    ],
    [t]
  )

  const handleChange = (val: string) => {
    setSelectedVoucherUsageFrequencyUnit(val)
    if (onChange) {
      onChange(val)
    }
  }

  return (
    <Select value={selectedVoucherUsageFrequencyUnit} onValueChange={handleChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t('voucher.selectUsageFrequencyUnit')} />
      </SelectTrigger>
      <SelectContent className={getTheme() === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
