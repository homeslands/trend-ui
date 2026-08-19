import moment from 'moment'
import { MoveRight, X } from 'lucide-react'

import { Button } from '@/components/ui'
import { SimpleDatePicker } from '@/components/app/picker'

interface CustomerDateRangeFilterProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

export default function CustomerDateRangeFilter({
  from,
  to,
  onChange,
}: CustomerDateRangeFilterProps) {
  return (
    <div className="flex gap-2 items-center">
      <SimpleDatePicker
        allowEmpty
        value={from}
        onChange={(value) => onChange(value, to)}
        disabledDates={
          to
            ? (date: Date) => date > moment(to, 'YYYY-MM-DD').startOf('day').toDate()
            : undefined
        }
        disableFutureDates
      />
      <MoveRight className="flex-shrink-0 w-4 h-4 text-muted-foreground" />
      <SimpleDatePicker
        allowEmpty
        value={to}
        onChange={(value) => onChange(from, value)}
        disabledDates={
          from
            ? (date: Date) => date < moment(from, 'YYYY-MM-DD').startOf('day').toDate()
            : undefined
        }
        disableFutureDates
      />
      {(from || to) && (
        <Button variant="ghost" size="icon" onClick={() => onChange('', '')}>
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}
