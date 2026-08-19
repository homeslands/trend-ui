import { ConfirmExportVoucherDialog } from '@/components/app/dialog'
import { UpdateVoucherGroupApplyTimeSheet } from '@/components/app/sheet'
import { SelectUserGroupDropdown, SelectCustomerTypeDropdown, VoucherToolDropdown } from '@/components/app/dropdown'
import { IVoucher } from '@/types'
import { useParams } from 'react-router-dom'

export default function VoucherAction({ onSuccess, selectedVouchers, onOpenChange, isConfirmExportVoucherDialogOpen }: { onSuccess: () => void, selectedVouchers: IVoucher[], onOpenChange: (isOpen: boolean) => void, isConfirmExportVoucherDialogOpen: boolean }) {
  const { slug } = useParams<{ slug: string }>()
  return (
    <div className="flex gap-2">
      <UpdateVoucherGroupApplyTimeSheet voucherGroup={slug || ''} />
      <SelectCustomerTypeDropdown />
      <SelectUserGroupDropdown />
      <ConfirmExportVoucherDialog
        disabled={selectedVouchers && selectedVouchers.length === 0}
        isOpen={isConfirmExportVoucherDialogOpen}
        onOpenChange={onOpenChange}
        selectedVouchers={selectedVouchers}
        onSuccess={onSuccess}
      />
      <VoucherToolDropdown onSuccess={onSuccess} />
    </div>
  )
}


