import { ShoppingCartIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { Button } from '@/components/ui'
import { ROUTE } from '@/constants'

export default function CartEmpty() {
  const { t } = useTranslation('menu')

  return (
    <div className="flex flex-col gap-4 justify-center items-center px-5 py-20 text-center">
      <ShoppingCartIcon className="w-16 h-16 text-primary" />
      <h2 className="text-lg font-semibold">{t('order.noOrders')}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{t('menu.cartEmptyDescription')}</p>
      <NavLink to={ROUTE.CLIENT_MENU}>
        <Button>{t('order.backToMenu')}</Button>
      </NavLink>
    </div>
  )
}
