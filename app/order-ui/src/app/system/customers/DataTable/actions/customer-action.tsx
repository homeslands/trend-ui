import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui'
import { CreateCustomerDialog, CreateMemberAndAssignMembershipCardDialog } from '@/components/app/dialog'
import RFIDFilter from './rfid-filter'

type ScanMode = 'rfid' | 'qr'

interface CustomerActionProps {
  onRFIDScan?: (code: string, mode: ScanMode) => void
  onRFIDClear?: () => void
  onReset?: () => void
  scannedCode?: string
  hasActiveFilter?: boolean
}

export default function CustomerAction({
  onRFIDScan,
  onRFIDClear: _onRFIDClear,
  onReset,
  scannedCode,
  hasActiveFilter = false
}: CustomerActionProps) {
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="flex gap-2">
      <RFIDFilter
        onScan={onRFIDScan || (() => { })}
        scannedCode={scannedCode}
      />
      {hasActiveFilter && (
        <Button
          variant="outline"
          onClick={onReset}
          title={tCommon('common.reset')}
        >
          <RotateCcw className="mr-2 w-4 h-4" />
          {tCommon('common.reset')}
        </Button>
      )}
      <CreateCustomerDialog />
      <CreateMemberAndAssignMembershipCardDialog />
    </div>
  )
}
