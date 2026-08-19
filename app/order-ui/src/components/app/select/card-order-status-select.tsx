import { useTranslation } from 'react-i18next'
import { CardOrderStatus } from '@/constants'

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

export default function CardOrderStatusSelect({
  value,
  onChange,
}: GiftCardStatusSelectProps) {
  const { t } = useTranslation('giftCard')

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder={t('giftCard.chooseStatus')} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {Object.values(CardOrderStatus).map((status) => {
            const label = status === CardOrderStatus.ALL ? t(`giftCard.chooseStatus`) : t(`giftCard.cardOrder.${status.toLowerCase()}`)
            return (
              <SelectItem className='' key={status} value={status}>
                <span>{label}</span>
              </SelectItem>
            )
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
