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
import { VOUCHER_CUSTOMER_TYPE } from '@/constants'

interface VoucherCustomerTypeSelectProps {
  onChange: (value: string) => void
  value?: string
  defaultValue?: string
  disabled?: boolean
}

export default function VoucherCustomerTypeSelect({
  onChange,
  value,
  defaultValue,
  disabled,
  ...props
}: VoucherCustomerTypeSelectProps) {
  const { getTheme } = useThemeStore()
  const { t } = useTranslation('voucher')
  const [selectedCustomerType, setSelectedCustomerType] = useState<string>(value || defaultValue || VOUCHER_CUSTOMER_TYPE.ALL)

  useEffect(() => {
    if (value !== undefined) {
      setSelectedCustomerType(value)
    } else if (defaultValue) {
      setSelectedCustomerType(defaultValue)
    } else {
      setSelectedCustomerType(VOUCHER_CUSTOMER_TYPE.ALL)
    }
  }, [value, defaultValue])

  const options = useMemo(
    () => [
      { label: t('voucher.allCustomers'), value: VOUCHER_CUSTOMER_TYPE.ALL },
      { label: t('voucher.userGroup'), value: VOUCHER_CUSTOMER_TYPE.GROUP },
      { label: t('voucher.singleUser'), value: VOUCHER_CUSTOMER_TYPE.PERSON },
    ],
    [t]
  )

  const handleChange = (val: string) => {
    setSelectedCustomerType(val)
    if (onChange) {
      onChange(val)
    }
  }

  return (
    <Select {...props} value={selectedCustomerType} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t('voucher.selectCustomerType')} />
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

