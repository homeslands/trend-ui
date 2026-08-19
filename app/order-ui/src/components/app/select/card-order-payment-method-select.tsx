import { useTranslation } from 'react-i18next'
import { CardOrderPaymentMethod } from '@/constants'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

interface GiftCardStatusSelectProps {
  value?: string
  onChange: (value: string) => void
}

export default function CardOrderPaymentMethodSelect({
  value,
  onChange,
}: GiftCardStatusSelectProps) {
  const { t } = useTranslation('giftCard')

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-32">
        <SelectValue placeholder={t('giftCard.chooseStatus')} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem key={'all'} value={'all'}>
            <span >{t(`giftCard.cardOrder.choosePaymentMethod`)}</span>
          </SelectItem>
          {Object.values(CardOrderPaymentMethod).map((status) => (
            <SelectItem key={status} value={status}>
              <span>{t(`giftCard.cardOrder.${status.toLowerCase()}`)}</span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
