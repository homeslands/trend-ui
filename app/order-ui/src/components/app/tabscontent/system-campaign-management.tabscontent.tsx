import { useCallback, useMemo, useState } from 'react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarHeart, Download, MoveRight } from 'lucide-react'

import { CampaignPage } from '@/app/system/campaign/page'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  DataTable,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { timeChange } from '@/components/ui/utils/data-table.utils'
import { SimpleDatePicker } from '@/components/app/picker'
import { ConfirmRunBirthdayCampaignDialog } from '@/components/app/dialog'
import { useExportExcelUsers, useUsers } from '@/hooks'
import { useUserListColumns } from '@/app/system/customers/DataTable/columns'
import { Role, ROUTE } from '@/constants'
import { useUserStore } from '@/stores'
import { IUserInfo } from '@/types'

const DATE = 'YYYY-MM-DD'
const today = () => moment().format(DATE)

// 'tomorrow' không có trong PeriodTimeEnum của DataTable nên xử lý riêng;
// các giá trị còn lại dùng chung timeChange ('all' trả về chuỗi rỗng = bỏ lọc).
const BIRTHDAY_PERIODS = [
  'all',
  'today',
  'yesterday',
  'tomorrow',
  'inWeek',
  'inMonth',
  'inYear',
] as const

// Chuyển 'YYYY-MM-DD' → 'DD/MM'; trả undefined khi ngày rỗng/không hợp lệ
// (chọn "Tất cả") để request BỎ HẲN param sinh nhật thay vì gửi "Invalid date".
const toDayMonthParam = (date: string): string | undefined => {
  const parsed = moment(date, DATE, true)
  return parsed.isValid() ? parsed.format('DD/MM') : undefined
}

/**
 * Danh sách khách có SINH NHẬT trong khoảng ngày đang chọn (mặc định HÔM NAY).
 * Nằm TRONG tab Chiến dịch vì phục vụ trực tiếp campaign loại "user-birthday":
 * xem trước ai sắp nhận ưu đãi sinh nhật.
 *
 * Backend (`GET /user`, `birthdayFromDate`/`birthdayToDate`) so khớp theo NGÀY/THÁNG
 * và BỎ QUA NĂM (format dd/MM) — nên state giữ full ngày `YYYY-MM-DD`,
 * nhưng chỉ phần dd/MM được gửi đi.
 */
function CustomerBirthdayView() {
  const { t } = useTranslation('customer')
  const { t: tCommon } = useTranslation('common')
  const navigate = useNavigate()
  const columns = useUserListColumns()
  const { userInfo } = useUserStore()
  const canRunCampaign =
    userInfo?.role?.name === Role.SUPER_ADMIN || userInfo?.role?.name === Role.ADMIN

  const [fromDate, setFromDate] = useState<string>(today)
  const [toDate, setToDate] = useState<string>(today)
  const [period, setPeriod] = useState<string>('today')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const fromDayMonth = toDayMonthParam(fromDate)
  const toDayMonth = toDayMonthParam(toDate)

  // Chọn tay 1 ngày → khoảng không còn khớp preset nào, xoá chọn ở dropdown
  const handleFromDateChange = useCallback((date: string) => {
    setFromDate(date)
    setPeriod('')
    setPage(1)
  }, [])

  const handleToDateChange = useCallback((date: string) => {
    setToDate(date)
    setPeriod('')
    setPage(1)
  }, [])

  const handlePeriodChange = useCallback((value: string) => {
    setPeriod(value)
    if (value === 'tomorrow') {
      const tomorrow = moment().add(1, 'day').format(DATE)
      setFromDate(tomorrow)
      setToDate(tomorrow)
    } else {
      const { startDate, endDate } = timeChange(value, new Date())
      setFromDate(startDate)
      setToDate(endDate)
    }
    setPage(1)
  }, [])

  const { data, isLoading } = useUsers(
    {
      page,
      size,
      order: 'DESC',
      hasPaging: true,
      role: Role.CUSTOMER,
      birthdayFromDate: fromDayMonth,
      birthdayToDate: toDayMonth,
    },
    true,
  )

  const handlePaginationChange = useCallback(
    (pageIndex0: number, pageSize: number) => {
      if (pageSize !== size) setSize(pageSize)
      else setPage(pageIndex0 + 1)
    },
    [size],
  )

  const handleRowClick = (row: IUserInfo) => {
    navigate(`${ROUTE.STAFF_CUSTOMER_MANAGEMENT}/${row.slug}`)
  }

  // Xuất Excel danh sách khách hàng (tên, SĐT, ngày sinh) — file theo ĐÚNG khoảng
  // sinh nhật đang lọc trên bảng (dobStartDate/dobEndDate, format dd/MM như GET /user);
  // "Tất cả" thì bỏ bộ lọc sinh nhật, xuất toàn bộ khách hàng.
  const { mutate: exportUsers, isPending: isExporting } = useExportExcelUsers()
  const hasBirthdayFilter = !!fromDayMonth && !!toDayMonth
  const handleExportExcel = useCallback(() => {
    exportUsers({
      role: Role.CUSTOMER,
      ...(hasBirthdayFilter && {
        dobFilterType: 'day_month',
        dobStartDate: fromDayMonth,
        dobEndDate: toDayMonth,
      }),
    })
  }, [exportUsers, hasBirthdayFilter, fromDayMonth, toDayMonth])

  const BirthdayActionOptions = useMemo(() => {
    return function ActionOptions() {
      return (
        <div className="flex gap-2 items-center">
          <SimpleDatePicker
            value={fromDate}
            onChange={handleFromDateChange}
            allowEmpty
            disabledDates={
              toDate
                ? (date: Date) =>
                    date > moment(toDate, DATE).endOf('day').toDate()
                : undefined
            }
          />
          <MoveRight className="icon w-16 h-16" />
          <SimpleDatePicker
            value={toDate}
            onChange={handleToDateChange}
            allowEmpty
            disabledDates={
              fromDate
                ? (date: Date) =>
                    date < moment(fromDate, DATE).startOf('day').toDate()
                : undefined
            }
          />
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="gap-1 w-36 outline-none bg-background">
              <SelectValue placeholder={tCommon('dayOfWeek.selectTimeRange')} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {BIRTHDAY_PERIODS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tCommon(`dayOfWeek.${value}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={isExporting}
          >
            <Download className="mr-2 w-4 h-4" />
            {t('customer.analytics.exportExcel')}
          </Button>
          {canRunCampaign && <ConfirmRunBirthdayCampaignDialog />}
        </div>
      )
    }
  }, [
    fromDate,
    toDate,
    period,
    handleFromDateChange,
    handleToDateChange,
    handlePeriodChange,
    handleExportExcel,
    isExporting,
    canRunCampaign,
    t,
    tCommon,
  ])

  return (
    <div className="grid grid-cols-1 gap-2 pb-2 h-full">
      <Card className="shadow-none">
        <CardHeader className="flex flex-row gap-2 items-center py-3">
          <CalendarHeart className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">
            {!hasBirthdayFilter
              ? t('customer.birthday.tabTitle')
              : fromDayMonth === toDayMonth
                ? t('customer.birthday.title', { date: fromDayMonth })
                : t('customer.birthday.titleRange', {
                    from: fromDayMonth,
                    to: toDayMonth,
                  })}
          </CardTitle>
        </CardHeader>
      </Card>

      <DataTable
        columns={columns}
        data={data?.result?.items || []}
        isLoading={isLoading}
        pages={data?.result?.totalPages || 0}
        pageIndex={page - 1}
        pageSize={size}
        onPaginationChange={handlePaginationChange}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        hiddenDatePicker={true}
        actionOptions={BirthdayActionOptions}
        onRowClick={handleRowClick}
      />
    </div>
  )
}

export function SystemCampaignManagementTabsContent() {
  const { t } = useTranslation('customer')
  const { t: tCampaign } = useTranslation('campaign')
  const [view, setView] = useState<'campaign' | 'birthday'>('campaign')

  const segButton = (value: 'campaign' | 'birthday', label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setView(value)}
      className={
        'px-3 h-full text-xs font-medium rounded transition-colors ' +
        (view === value
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground')
      }
    >
      {label}
    </button>
  )

  return (
    <div className="grid grid-cols-1 gap-2 pb-2 h-full">
      <Card className="shadow-none">
        <CardHeader className="flex flex-row justify-between items-center py-3">
          <CardTitle className="text-base">{tCampaign('campaign.title')}</CardTitle>
          <div className="inline-flex p-1 h-9 rounded-md border border-input bg-background">
            {segButton('campaign', tCampaign('campaign.title'))}
            {segButton('birthday', t('customer.birthday.tabTitle'))}
          </div>
        </CardHeader>
      </Card>

      {view === 'campaign' ? <CampaignPage /> : <CustomerBirthdayView />}
    </div>
  )
}
