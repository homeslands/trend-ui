import { OrderSearchByVoucherCodeInput } from '@/components/app/input'

interface CustomerOrderHistoryActionProps {
  onVoucherChange?: (voucherSlug: string | null) => void
  voucherCode?: string
  onVoucherCodeChange?: (code: string) => void
}

export default function CustomerOrderHistoryAction({
  onVoucherChange
}: CustomerOrderHistoryActionProps) {
  return (
    <div className="flex gap-2">
      <OrderSearchByVoucherCodeInput
        onVoucherChange={onVoucherChange}
      />
    </div>
  )
}
