import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserCircle } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { VOUCHER_CUSTOMER_TYPE } from '@/constants'

export default function SelectCustomerTypeDropdown() {
  const { t } = useTranslation('voucher')
  const [searchParams, setSearchParams] = useSearchParams()
  const customerType = searchParams.get('customerType') || VOUCHER_CUSTOMER_TYPE.ALL

  const handleSelectChange = (value: string) => {
    if (value === customerType) return
    const next = new URLSearchParams(searchParams)
    if (value !== VOUCHER_CUSTOMER_TYPE.ALL) {
      next.set('customerType', value)
    } else {
      next.delete('customerType')
    }
    // Reset về page 1 khi thay đổi filter
    next.set('page', '1')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex gap-2 items-center">
      <Select
        value={customerType}
        onValueChange={(value) => handleSelectChange(value)}
      >
        <SelectTrigger className="gap-2 h-8 w-fit">
          <UserCircle className="w-4 h-4 shrink-0" />
          <SelectValue
            className="text-xs"
            placeholder={t('voucher.customerType')}
          />
        </SelectTrigger>
        <SelectContent className="w-56">
          <SelectItem value={VOUCHER_CUSTOMER_TYPE.ALL}>
            <span className="text-xs">{t('voucher.allCustomers')}</span>
          </SelectItem>
          <SelectItem value={VOUCHER_CUSTOMER_TYPE.GROUP}>
            <span className="text-xs">{t('voucher.userGroup')}</span>
          </SelectItem>
          <SelectItem value={VOUCHER_CUSTOMER_TYPE.PERSON}>
            <span className="text-xs">{t('voucher.singleUser')}</span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
