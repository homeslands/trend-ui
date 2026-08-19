import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { Button } from '@/components/ui'
import { ROUTE } from '@/constants'
import { useOrderFlowStore } from '@/stores'

// Mã lỗi hiện cho khách/QA phải trung thực với điều thật sự xảy ra: đây là một lỗi
// ném ra trong lúc render cây con của trang giỏ hàng (bắt bởi error boundary), KHÔNG
// nhất thiết là lỗi hydrate dữ liệu localStorage — dù P0-3 (đọc `variant[0]` trên mảng
// rỗng) là nguyên nhân phổ biến nhất. Ghép thêm `error.name` (vd. `TypeError`) để phân
// biệt loại lỗi mà không lộ message/stack nội bộ cho khách.
const CART_RENDER_ERROR_CODE = 'CART_RENDER_ERROR'

interface CartErrorFallbackProps {
  errorName?: string
}

function CartErrorFallback({ errorName }: CartErrorFallbackProps) {
  const { t } = useTranslation('menu')
  const clearCart = useOrderFlowStore((state) => state.clearCart)

  return (
    <div className="flex flex-col gap-3 justify-center items-center px-5 py-16 text-center">
      <AlertTriangle className="w-10 h-10 text-destructive" />
      <h2 className="text-lg font-semibold">{t('menu.cartErrorTitle')}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{t('menu.cartErrorDescription')}</p>
      <div className="flex flex-wrap gap-2 justify-center mt-1">
        <Button
          onClick={() => {
            clearCart()
            window.location.reload()
          }}
        >
          {t('menu.cartErrorClear')}
        </Button>
        <NavLink to={ROUTE.CLIENT_MENU}>
          <Button variant="outline">{t('order.backToMenu')}</Button>
        </NavLink>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {errorName ? `${CART_RENDER_ERROR_CODE} · ${errorName}` : CART_RENDER_ERROR_CODE}
      </p>
    </div>
  )
}

interface CartErrorBoundaryProps {
  children: ReactNode
}

interface CartErrorBoundaryState {
  hasError: boolean
  errorName?: string
}

export default class CartErrorBoundary extends Component<
  CartErrorBoundaryProps,
  CartErrorBoundaryState
> {
  constructor(props: CartErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): CartErrorBoundaryState {
    return { hasError: true, errorName: error?.name }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // React đã tự log lỗi bắt bởi error boundary ra console, nhưng một handler tường
    // minh làm rõ ý định cho người đọc code và là chỗ để sau này nối vào service theo
    // dõi lỗi tập trung (vd. Sentry) mà không phải sửa lại chỗ khác.
    // eslint-disable-next-line no-console
    console.error(CART_RENDER_ERROR_CODE, error, errorInfo)
  }

  render() {
    if (this.state.hasError) return <CartErrorFallback errorName={this.state.errorName} />
    return this.props.children
  }
}
