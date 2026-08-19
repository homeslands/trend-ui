import { useState } from 'react'
import moment from 'moment'
import { CalendarDays, Check, ChevronDown, MoveRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/app/picker'
import {
  DateFilterValue,
  Preset,
  PRESETS,
  fmt,
  presetToValue,
  defaultDateFilter,
  suggestPrevious,
  groupByForSpan,
} from '@/constants/date-range.constants'

const dmy = (v: string) => (v ? moment(v).format('DD/MM/YYYY') : '')
const rangeText = (from: string, to: string) =>
  from && to ? `${dmy(from)} - ${dmy(to)}` : '—'
/** `DatePicker` speaks "dd/MM/yyyy"; the draft speaks ISO datetime — convert at the edges. */
const toPickerDate = (v: string) => (v ? moment(v).format('DD/MM/YYYY') : null)

const chipClass = (active: boolean) =>
  cn(
    'flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
    active
      ? 'border-primary bg-primary font-semibold text-primary-foreground ring-1 ring-primary ring-offset-1'
      : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
  )

interface DateRangeCompareFieldProps {
  startDate: string
  endDate: string
  onSelectStart: (value: string | null) => void
  onSelectEnd: (value: string | null) => void
}

/** Two `DatePicker`s side by side — the popover (`w-[24rem]`) is too narrow for a full
 * two-month calendar the way the Sheet had room for; this mirrors the reference
 * `TimeRangeDatePicker` popover instead of cramming a calendar in. */
function DateRangeCompareField({
  startDate,
  endDate,
  onSelectStart,
  onSelectEnd,
}: DateRangeCompareFieldProps) {
  return (
    <div className="grid grid-cols-11 items-center gap-2">
      <div className="col-span-5">
        <DatePicker
          date={toPickerDate(startDate)}
          onSelect={onSelectStart}
          disableFutureDate
        />
      </div>
      <MoveRight className="col-span-1 flex w-full justify-center text-muted-foreground" />
      <div className="col-span-5">
        <DatePicker
          date={toPickerDate(endDate)}
          onSelect={onSelectEnd}
          disableFutureDate
        />
      </div>
    </div>
  )
}

interface DateRangeComparePopoverProps {
  value: DateFilterValue
  onApply: (value: DateFilterValue) => void
  /** Ẩn khối "So sánh với kỳ trước" cho những màn chưa có logic compare
   * (ví dụ lịch sử xu) — mặc định bật để giữ nguyên hành vi cũ. */
  showCompare?: boolean
}

export default function DateRangeComparePopover({
  value,
  onApply,
  showCompare = true,
}: DateRangeComparePopoverProps) {
  const { t } = useTranslation('customer')

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateFilterValue>(value)
  const [showComparePicker, setShowComparePicker] = useState(false)
  /** Presets and DatePickers are mutually exclusive — this Switch is the single control
   * that decides which one is in charge (product owner's complaint: showing both at once
   * made it ambiguous). OFF = preset chips; ON = DatePickers, chips hidden. */
  const [customMode, setCustomMode] = useState(false)
  /** The preset to snap back to when the user flips `customMode` OFF — kept in sync with
   * whichever chip was last active (seeded from the incoming value, updated on every chip
   * click) so leaving-then-returning-from custom mode is a no-op, not a jump to some
   * unrelated default. */
  const [lastPreset, setLastPreset] = useState<Preset>('last30Days')

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(value)
      setShowComparePicker(false)
      // `activePreset === null` means the incoming range is custom → seed the switch ON.
      setCustomMode(value.activePreset === null)
      setLastPreset(value.activePreset ?? 'last30Days')
    }
    setOpen(next)
  }

  const handlePreset = (preset: Preset) => {
    setDraft((d) => ({ ...d, ...presetToValue(preset) }))
    setLastPreset(preset)
  }

  const handleToggleCustomMode = (next: boolean) => {
    if (next) {
      // Keep the current range as the starting point — do not blank the pickers.
      setDraft((d) => ({
        ...d,
        activePreset: null,
        groupBy: groupByForSpan(d.startDate, d.endDate),
      }))
    } else {
      // Snap to a valid preset rather than leaving the mode with no valid range.
      setDraft((d) => ({ ...d, ...presetToValue(lastPreset) }))
    }
    setCustomMode(next)
  }

  const handleSelectStart = (picked: string | null) => {
    if (!picked) return
    const parsed = moment(picked, 'DD/MM/YYYY')
    const start = fmt(parsed.clone().startOf('day'))
    setDraft((d) => {
      const currentEnd = d.endDate ? moment(d.endDate) : null
      const endDate =
        currentEnd && currentEnd.isSameOrAfter(parsed, 'day')
          ? d.endDate
          : fmt(parsed.clone().endOf('day'))
      return {
        ...d,
        startDate: start,
        endDate,
        activePreset: null,
        groupBy: groupByForSpan(start, endDate),
      }
    })
  }

  const handleSelectEnd = (picked: string | null) => {
    if (!picked) return
    const parsed = moment(picked, 'DD/MM/YYYY')
    const endDate = fmt(parsed.clone().endOf('day'))
    setDraft((d) => {
      const currentStart = d.startDate ? moment(d.startDate) : null
      const startDate =
        currentStart && currentStart.isSameOrBefore(parsed, 'day')
          ? d.startDate
          : fmt(parsed.clone().startOf('day'))
      return {
        ...d,
        startDate,
        endDate,
        activePreset: null,
        groupBy: groupByForSpan(startDate, endDate),
      }
    })
  }

  const handleToggleCompare = (next: boolean) => {
    setDraft((d) => {
      if (next && !d.compareStart) {
        const s = suggestPrevious(d.startDate, d.endDate)
        return { ...d, compareEnabled: true, compareStart: s.start, compareEnd: s.end }
      }
      return { ...d, compareEnabled: next }
    })
  }

  const handleUseSamePeriod = () => {
    setDraft((d) => {
      const s = suggestPrevious(d.startDate, d.endDate)
      return { ...d, compareStart: s.start, compareEnd: s.end }
    })
    setShowComparePicker(false)
  }

  const handleSelectCompareStart = (picked: string | null) => {
    if (!picked) return
    const parsed = moment(picked, 'DD/MM/YYYY')
    const compareStart = fmt(parsed.clone().startOf('day'))
    setDraft((d) => {
      const currentEnd = d.compareEnd ? moment(d.compareEnd) : null
      const compareEnd =
        currentEnd && currentEnd.isSameOrAfter(parsed, 'day')
          ? d.compareEnd
          : fmt(parsed.clone().endOf('day'))
      return { ...d, compareStart, compareEnd }
    })
  }

  const handleSelectCompareEnd = (picked: string | null) => {
    if (!picked) return
    const parsed = moment(picked, 'DD/MM/YYYY')
    const compareEnd = fmt(parsed.clone().endOf('day'))
    setDraft((d) => {
      const currentStart = d.compareStart ? moment(d.compareStart) : null
      const compareStart =
        currentStart && currentStart.isSameOrBefore(parsed, 'day')
          ? d.compareStart
          : fmt(parsed.clone().startOf('day'))
      return { ...d, compareStart, compareEnd }
    })
  }

  const handleReset = () => {
    setDraft(defaultDateFilter())
    setShowComparePicker(false)
    setCustomMode(false)
    setLastPreset('last30Days')
  }

  const handleApply = () => {
    onApply(draft)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {/* Trigger giờ chỉ nêu control này MỞ RA CÁI GÌ ("Khoảng thời gian") — không còn
            tóm tắt khoảng ngày/so sánh trên nút nữa, vì hàng badge "Lọc:" trong
            `CustomerAnalyticsPanel` đã là nơi đọc lại đầy đủ trạng thái đó. Vẫn giữ icon
            lịch + chevron để trông vẫn là một control có thể mở ra. */}
        <Button variant="outline" className="gap-2 justify-between whitespace-nowrap">
          <CalendarDays className="flex-shrink-0 w-4 h-4" />
          <span className="flex-1 text-left truncate">
            {t('customer.registrationDashboard.filterTitle')}
          </span>
          <ChevronDown className="flex-shrink-0 w-4 h-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[24rem] max-h-[85vh] overflow-y-auto" align="start">
        <div className="flex flex-col gap-3 w-full">
          <h4 className="font-medium leading-none">
            {t('customer.registrationDashboard.filterTitle')}
          </h4>

          {/* The single mode switch: presets and DatePickers are mutually exclusive, so
              exactly one of the two blocks below is visible at a time — no more ambiguity
              about which control is "in charge" of the range. groupBy is no longer a
              separate control; it's derived (PRESET_GROUPBY in preset mode, `groupByForSpan`
              in custom mode) since it's implied by whichever range is active. */}
          <label
            htmlFor="custom-date-mode-switch"
            className="flex gap-2 justify-between items-center text-sm font-medium cursor-pointer"
          >
            {t('customer.registrationDashboard.selectSpecificDate')}
            <Switch
              id="custom-date-mode-switch"
              checked={customMode}
              onCheckedChange={handleToggleCustomMode}
            />
          </label>

          {!customMode && (
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((p) => {
                const active = draft.activePreset === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handlePreset(p.key)}
                    className={chipClass(active)}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {t(p.i18n)}
                  </button>
                )
              })}
            </div>
          )}

          {/* The range readout stays visible in BOTH modes — it's how the user confirms
              what a preset resolved to (a previous bug hid it and presets looked broken).
              Only the DatePickers themselves are mode-gated. */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold">
                {t('customer.registrationDashboard.dateRange')}
              </span>
              <span className="text-xs text-muted-foreground">
                {rangeText(draft.startDate, draft.endDate)}
              </span>
            </div>
            {customMode && (
              <DateRangeCompareField
                startDate={draft.startDate}
                endDate={draft.endDate}
                onSelectStart={handleSelectStart}
                onSelectEnd={handleSelectEnd}
              />
            )}
          </div>

          {showCompare && <div className="border-t" />}

          {/* Bug fix: compare is now a prominent `Switch` at the top of its own section,
              not a checkbox buried below the fold. */}
          <div className={`flex-col gap-2 ${showCompare ? 'flex' : 'hidden'}`}>
            <label
              htmlFor="compare-with-previous-switch"
              className="flex gap-2 justify-between items-center text-sm font-medium cursor-pointer"
            >
              {t('customer.registrationDashboard.compareWithPrevious')}
              <Switch
                id="compare-with-previous-switch"
                checked={draft.compareEnabled}
                onCheckedChange={handleToggleCompare}
              />
            </label>

            {draft.compareEnabled && (
              <div className="flex flex-col gap-2 p-2 rounded-md border bg-muted/30">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold">
                    {t('customer.registrationDashboard.previousPeriod')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {rangeText(draft.compareStart, draft.compareEnd)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    aria-pressed={!showComparePicker}
                    onClick={handleUseSamePeriod}
                    className={chipClass(!showComparePicker)}
                  >
                    {t('customer.registrationDashboard.samePeriod')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={showComparePicker}
                    onClick={() => setShowComparePicker(true)}
                    className={chipClass(showComparePicker)}
                  >
                    {t('customer.registrationDashboard.selectOtherRange')}
                  </button>
                </div>
                {showComparePicker && (
                  <DateRangeCompareField
                    startDate={draft.compareStart}
                    endDate={draft.compareEnd}
                    onSelectStart={handleSelectCompareStart}
                    onSelectEnd={handleSelectCompareEnd}
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleReset}>
              {t('customer.registrationDashboard.reset')}
            </Button>
            <Button className="flex-1" onClick={handleApply}>
              {t('customer.registrationDashboard.apply')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
