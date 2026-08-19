import * as React from 'react'
import { Clock, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

const pad = (n: number) => n.toString().padStart(2, '0')

const parseTime = (value: string | null | undefined): { hour: number; minute: number } | null => {
  if (!value) return null
  const [h, m] = value.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return { hour: h, minute: m }
}

interface TimeOnlyPickerProps {
  value?: string | null
  onSelect: (value: string | null) => void
  disabled?: boolean
  clearable?: boolean
  placeholder?: string
}

export default function TimeOnlyPicker({
  value,
  onSelect,
  disabled = false,
  clearable = false,
  placeholder,
}: TimeOnlyPickerProps) {
  const { t } = useTranslation(['voucher'])

  const parsed = React.useMemo(() => parseTime(value), [value])

  const [hour, setHour] = React.useState<number>(parsed?.hour ?? 8)
  const [minute, setMinute] = React.useState<number>(parsed?.minute ?? 0)

  React.useEffect(() => {
    if (parsed) {
      setHour(parsed.hour)
      setMinute(parsed.minute)
    }
  }, [parsed])

  const handleHourChange = (val: string) => {
    const h = parseInt(val)
    setHour(h)
    onSelect(`${pad(h)}:${pad(minute)}`)
  }

  const handleMinuteChange = (val: string) => {
    const m = parseInt(val)
    setMinute(m)
    onSelect(`${pad(hour)}:${pad(m)}`)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal dark:border-gray-300',
            !value && 'text-muted-foreground',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          disabled={disabled}
        >
          <Clock className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1">
            {parsed ? `${pad(parsed.hour)}:${pad(parsed.minute)}` : (placeholder ?? 'HH:MM')}
          </span>
          {clearable && value && !disabled && (
            <span
              role="button"
              className="ml-2 rounded p-0.5 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation()
                onSelect(null)
              }}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-4" align="start">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{t('voucher.hour')}</span>
            <Select value={hour.toString()} onValueChange={handleHourChange}>
              <SelectTrigger>
                <SelectValue placeholder="HH" />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={h.toString()}>
                    {pad(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{t('common.minute', { ns: 'common' })}</span>
            <Select value={minute.toString()} onValueChange={handleMinuteChange}>
              <SelectTrigger>
                <SelectValue placeholder="MM" />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((m) => (
                  <SelectItem key={m} value={m.toString()}>
                    {pad(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
