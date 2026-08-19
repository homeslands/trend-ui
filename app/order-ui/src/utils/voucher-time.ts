import moment, { Moment } from 'moment'
import { IVoucher } from '@/types/voucher.type'

const GRACE_PERIOD_MINUTES = 30

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const isVoucherExpired = (voucher: IVoucher, now: Moment = moment()): boolean => {
  const endWithGrace = moment.utc(voucher.endDate).add(GRACE_PERIOD_MINUTES, 'minutes')
  return endWithGrace.isBefore(now)
}

export const isVoucherInActiveTimeWindow = (
  voucher: IVoucher,
  now: Moment = moment(),
): boolean => {
  const { activeStartTime, activeEndTime } = voucher
  if (!activeStartTime || !activeEndTime) return true

  const nowMinutes = now.hours() * 60 + now.minutes()
  const startMinutes = toMinutes(activeStartTime)
  const endWithGrace = toMinutes(activeEndTime) + GRACE_PERIOD_MINUTES

  if (endWithGrace > 1439) {
    // Grace wraps past midnight — valid if >= start OR <= wrapped end
    const wrappedEnd = endWithGrace - 1440
    return nowMinutes >= startMinutes || nowMinutes <= wrappedEnd
  }

  return nowMinutes >= startMinutes && nowMinutes <= endWithGrace
}
