import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { BarChart3Icon } from 'lucide-react'

import { TrendBadge } from '@/components/app/badge'
import { TrendReadingGuide } from '@/components/app/accordion'

import { useTheme } from '@/components/app/theme-provider'
import { formatCurrency, isTrendVisible, trendOf, TrendResult } from '@/utils'
import { IPointTransactionStatistic, UserStatisticsGroupBy } from '@/types'

interface IPointTransactionChartProps {
  data: IPointTransactionStatistic[]
  isLoading?: boolean
  groupBy?: UserStatisticsGroupBy
  /** Chuỗi KỲ TRƯỚC, đã lấp bucket cùng độ dài với `data`; bỏ trống khi không so sánh. */
  compareData?: IPointTransactionStatistic[]
}

// Axis label format per bucket size, so a year-grouped chart doesn't render
// every bar as "01/01".
const AXIS_FORMAT: Record<UserStatisticsGroupBy, string> = {
  [UserStatisticsGroupBy.HOUR]: 'HH:mm',
  [UserStatisticsGroupBy.DAY]: 'DD/MM',
  [UserStatisticsGroupBy.WEEK]: 'DD/MM',
  [UserStatisticsGroupBy.MONTH]: 'MM/YYYY',
  [UserStatisticsGroupBy.YEAR]: 'YYYY',
}

// Validated CVD-safe pair (see dataviz palette): in = green, out = red.
// Cặp xanh/đỏ nằm trong vùng khó phân biệt với người mù màu đỏ-lục, nên KHÔNG dựa vào
// riêng màu: trong mỗi nhóm, cột "nhận" luôn đứng TRƯỚC cột "tiêu" (vị trí cố định), và
// tooltip ghi rõ tên từng chuỗi. Hai kênh đó thay cho mũi tên ▲/▼ trước đây trên legend.
const COLOR_IN = '#008300'
const COLOR_OUT_LIGHT = '#e34948'
const COLOR_OUT_DARK = '#e66767'

interface ITooltipParam {
  axisValue: string
  seriesName: string
  value: number
  marker: string
  dataIndex: number
}

/** Hai series ẩn dựng dải tin cậy 95% quanh đường trend bằng kỹ thuật "stack" của
 * ECharts: series `lower` vô hình rồi series `upper - lower` tô nền lên trên — công
 * thức của `upper`/`lower` xem `trend.ts`. `key` phải riêng cho từng đường trend trong
 * cùng canvas (earn/spend) để hai dải không lẫn stack với nhau. `z: 1` giữ dải NẰM DƯỚI
 * cột dữ liệu; `silent` + `tooltip.show = false` để dải không bắt hover/tooltip. Cố tình
 * KHÔNG đưa hai `name` này vào `legend.data` — chúng chỉ minh hoạ độ bất định, không
 * phải một chuỗi dữ liệu để bật/tắt.
 */
function confidenceBandSeries(
  trend: TrendResult,
  color: string,
  key: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const stack = `trend-ci-${key}`
  return [
    {
      name: `__trend-ci-lower-${key}`,
      type: 'line',
      stack,
      data: trend.lower,
      symbol: 'none',
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      tooltip: { show: false },
      silent: true,
      z: 1,
    },
    {
      name: `__trend-ci-band-${key}`,
      type: 'line',
      stack,
      data: trend.upper.map((u, i) => {
        const l = trend.lower[i]
        return u === null || l === null ? null : Number((u - l).toFixed(2))
      }),
      symbol: 'none',
      lineStyle: { opacity: 0 },
      areaStyle: { color, opacity: 0.12 },
      tooltip: { show: false },
      silent: true,
      z: 1,
    },
  ]
}

export function PointTransactionChart({
  data,
  isLoading,
  groupBy = UserStatisticsGroupBy.DAY,
  compareData,
}: IPointTransactionChartProps) {
  const { t } = useTranslation(['giftCard'])
  const { theme } = useTheme()
  const chartRef = useRef<HTMLDivElement>(null)

  // Tính ở cấp component vì phần render cần các chỉ số cho badge; effect tái dùng
  // `.values`/`.upper`/`.lower` để vẽ đường và dải tin cậy.
  // Bản `*Raw` là kết quả CHƯA lọc — badge + popover dùng bản này để giải thích được cả
  // xu hướng đã bị ẩn. Bản đã lọc qua `isTrendVisible` (p-value + số mốc tối thiểu, KHÔNG
  // phải ngưỡng R²) mới được dùng để VẼ: không để một xu hướng không có ý nghĩa thống kê
  // kẻ một đường trông chắc chắn xuyên qua chart.
  const earnTrendRaw = useMemo(() => trendOf(data.map((item) => item.earn)), [data])
  const spendTrendRaw = useMemo(() => trendOf(data.map((item) => item.spend)), [data])
  const earnTrend = isTrendVisible(earnTrendRaw) ? earnTrendRaw : null
  const spendTrend = isTrendVisible(spendTrendRaw) ? spendTrendRaw : null

  useEffect(() => {
    if (!chartRef.current || !data.length) return

    const isDark = theme === 'dark'
    const axisColor = isDark ? '#c3c2b7' : '#52514e'
    const gridColor = isDark ? '#2c2c2a' : '#ebe8e0'
    const colorOut = isDark ? COLOR_OUT_DARK : COLOR_OUT_LIGHT
    const nameEarned = t('giftCard.pointTransaction.chart.earned')
    const nameSpent = t('giftCard.pointTransaction.chart.spent')
    const nameTrend = t('giftCard.pointTransaction.chart.trend')
    const namePrev = t('giftCard.pointTransaction.chart.previous')
    const hasCompare = !!compareData?.length

    // `renderer: 'svg'`: renderer canvas rasterize theo devicePixelRatio nên chữ trong
    // chart trông mờ hơn text HTML xung quanh — SVG luôn nét ở mọi mật độ điểm ảnh.
    const chart = echarts.init(chartRef.current, undefined, { renderer: 'svg' })

    const option: echarts.EChartsOption = {
      // top 44: legend ở top:0 chiếm ~16px, phần còn lại là khoảng thở để nhãn
      // trên đỉnh cột không đè lên hàng legend (cùng lý do với chart thống kê khách).
      grid: { top: 44, right: 16, bottom: 28, left: 56 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: isDark ? '#1a1a19' : '#ffffff',
        borderColor: isDark ? '#2c2c2a' : '#e7e4dc',
        textStyle: { color: isDark ? '#f7f6f2' : '#17140f' },
        formatter: (params: unknown) => {
          const rows = params as ITooltipParam[]
          const earned = rows.find((r) => r.seriesName === t('giftCard.pointTransaction.chart.earned'))?.value ?? 0
          const spent = rows.find((r) => r.seriesName === t('giftCard.pointTransaction.chart.spent'))?.value ?? 0
          const net = earned - spent
          const netColor = net >= 0 ? COLOR_IN : colorOut
          return `
            <div style="font-weight:600;margin-bottom:4px">${rows[0]?.axisValue}</div>
            <div style="display:flex;justify-content:space-between;gap:14px">
              <span>${rows[0]?.marker}${t('giftCard.pointTransaction.chart.earned')}</span>
              <b style="color:${COLOR_IN}">+${formatCurrency(earned, '')}</b>
            </div>
            <div style="display:flex;justify-content:space-between;gap:14px">
              <span>${rows[1]?.marker}${t('giftCard.pointTransaction.chart.spent')}</span>
              <b style="color:${colorOut}">-${formatCurrency(spent, '')}</b>
            </div>
            <div style="display:flex;justify-content:space-between;gap:14px;margin-top:4px;padding-top:4px;border-top:1px solid ${gridColor}">
              <span>${t('giftCard.pointTransaction.chart.net')}</span>
              <b style="color:${netColor}">${net >= 0 ? '+' : '-'}${formatCurrency(Math.abs(net), '')}</b>
            </div>
            <div style="display:flex;justify-content:space-between;gap:14px;color:${axisColor}">
              <span>${t('giftCard.pointTransaction.chart.transactions')}</span>
              <b>${data[rows[0]?.dataIndex]?.count ?? 0}</b>
            </div>`
        },
      },
      // Legend căn giữa ở top:0 — cùng pattern với chart thống kê khách hàng.
      legend: {
        top: 0,
        itemGap: 14,
        itemWidth: 14,
        itemHeight: 10,
        textStyle: { color: axisColor, fontSize: 11 },
        // Legend chỉ liệt kê hai chuỗi DỮ LIỆU — hai đường trend cố tình không có mục
        // riêng để hàng legend không dài gấp đôi; nét đứt cùng màu đã đủ tự giải thích.
        data: hasCompare
          ? [nameEarned, nameSpent, `${nameEarned} · ${namePrev}`, `${nameSpent} · ${namePrev}`]
          : [nameEarned, nameSpent],
      },
      xAxis: {
        type: 'category',
        data: data.map((item) =>
          moment(item.time).format(AXIS_FORMAT[groupBy] ?? 'DD/MM'),
        ),
        axisLabel: { color: axisColor },
        axisLine: { lineStyle: { color: gridColor } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: axisColor,
          formatter: (value: number) =>
            value >= 1000 ? `${value / 1000}k` : `${value}`,
        },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      },
      series: [
        {
          name: t('giftCard.pointTransaction.chart.earned'),
          type: 'bar',
          barWidth: data.length === 1 ? 40 : '32%',
          barGap: '20%',
          itemStyle: { color: COLOR_IN, borderRadius: [4, 4, 0, 0] },
          data: data.map((item) => item.earn),
        },
        {
          name: t('giftCard.pointTransaction.chart.spent'),
          type: 'bar',
          barWidth: data.length === 1 ? 40 : '32%',
          itemStyle: { color: colorOut, borderRadius: [4, 4, 0, 0] },
          data: data.map((item) => item.spend),
        },
        // Kỳ trước: CÙNG màu chuỗi nhưng mờ (opacity 0.35). Mã hoá hai chiều — MÀU cho
        // biết chỉ số (nhận/tiêu), ĐỘ ĐẬM cho biết kỳ (này/trước). Nếu dùng một màu xám
        // chung cho cả hai như chart thống kê khách thì ở đây sẽ không phân biệt được
        // cột xám nào là "nhận kỳ trước", cột nào là "tiêu kỳ trước".
        ...(hasCompare
          ? [
            {
              name: `${nameEarned} · ${namePrev}`,
              type: 'bar' as const,
              barWidth: '32%',
              itemStyle: { color: COLOR_IN, opacity: 0.35, borderRadius: [4, 4, 0, 0] },
              data: compareData!.map((item) => item.earn),
            },
            {
              name: `${nameSpent} · ${namePrev}`,
              type: 'bar' as const,
              barWidth: '32%',
              itemStyle: { color: colorOut, opacity: 0.35, borderRadius: [4, 4, 0, 0] },
              data: compareData!.map((item) => item.spend),
            },
          ]
          : []),
        // Hai đường trend dùng CHÍNH màu của chuỗi tương ứng, khác chart thống kê khách
        // (ở đó chỉ có MỘT đường mỗi panel nên một màu xám dùng chung là đủ). Ở đây hai
        // đường nằm cùng một plot, xám sẽ không cho biết đường nào của chuỗi nào. Nét đứt
        // là thứ phân biệt trend với dữ liệu thật.
        ...(earnTrend
          ? [{
            name: `${nameEarned} · ${nameTrend}`,
            type: 'line' as const,
            data: earnTrend.values,
            symbol: 'circle', symbolSize: 5, smooth: false, connectNulls: false,
            lineStyle: { color: COLOR_IN, type: 'dashed' as const, width: 2 },
            itemStyle: { color: COLOR_IN }, z: 3,
            // Trend là đường hồi quy minh hoạ, không phải số liệu thật — loại khỏi
            // tooltip ngay tại nguồn.
            tooltip: { show: false },
          }, ...confidenceBandSeries(earnTrend, COLOR_IN, 'earn')]
          : []),
        ...(spendTrend
          ? [{
            name: `${nameSpent} · ${nameTrend}`,
            type: 'line' as const,
            data: spendTrend.values,
            symbol: 'circle', symbolSize: 5, smooth: false, connectNulls: false,
            lineStyle: { color: colorOut, type: 'dashed' as const, width: 2 },
            itemStyle: { color: colorOut }, z: 3,
            tooltip: { show: false },
          }, ...confidenceBandSeries(spendTrend, colorOut, 'spend')]
          : []),
      ],
    }

    chart.setOption(option)

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      chart.dispose()
      window.removeEventListener('resize', handleResize)
    }
  }, [data, theme, t, groupBy, earnTrend, spendTrend, compareData])

  return (
    <div className="rounded-xl border bg-white dark:border-gray-700 dark:bg-transparent">
      <div className="px-4 pt-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {t('giftCard.pointTransaction.chart.title')}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('giftCard.pointTransaction.chart.subtitle')}
        </p>
        {/* Badge dùng bản RAW (chưa lọc qua `isTrendVisible`) để popover "Chi tiết mô
            hình" giải thích được cả những trend đã bị ẩn khỏi chart — đường kẻ + dải tin
            cậy trong effect phía dưới vẫn dùng bản đã lọc (`earnTrend`/`spendTrend`). */}
        {!isLoading && data.length > 0 && (earnTrendRaw || spendTrendRaw) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 items-center mt-2">
            {earnTrendRaw && (
              <TrendBadge
                slope={earnTrendRaw.slope}
                intercept={earnTrendRaw.intercept}
                r2={earnTrendRaw.r2}
                pValue={earnTrendRaw.pValue}
                n={earnTrendRaw.n}
                groupBy={groupBy}
                label={t('giftCard.pointTransaction.chart.earned')}
                colorClassName="text-green-600 dark:text-green-400"
                formatValue={(value) => formatCurrency(value, '')}
              />
            )}
            {spendTrendRaw && (
              <TrendBadge
                slope={spendTrendRaw.slope}
                intercept={spendTrendRaw.intercept}
                r2={spendTrendRaw.r2}
                pValue={spendTrendRaw.pValue}
                n={spendTrendRaw.n}
                groupBy={groupBy}
                label={t('giftCard.pointTransaction.chart.spent')}
                colorClassName="text-red-600 dark:text-red-400"
                formatValue={(value) => formatCurrency(value, '')}
              />
            )}
          </div>
        )}
        <TrendReadingGuide />
      </div>

      {/* Container của ECharts phải LUÔN được render và KHÔNG BAO GIỜ có React children
          — ECharts tiêm <svg> vào trong nó, nếu React cũng quản lý con của cùng node thì
          hai bên tranh nhau DOM. Trước đây ba trạng thái (loading / có data / rỗng) nằm
          trong một ternary và đều render <div> ở CÙNG vị trí, nên React tái dùng đúng một
          DOM node cho cả ba: khi đổi nhánh nó cố chèn/xoá con trên cái div đang chứa <svg>
          của ECharts và ném `removeChild ... is not a child of this node`.
          Loading/empty vì thế phải là LỚP PHỦ anh em, không phải nhánh thay thế. */}
      <div className="relative h-[20rem] w-full">
        <div
          ref={chartRef}
          className={
            'h-full w-full px-2 pb-2 ' +
            (isLoading || !data.length ? 'invisible' : '')
          }
        />
        {isLoading && (
          <div className="flex absolute inset-0 justify-center items-center">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        )}
        {!isLoading && !data.length && (
          <div className="flex absolute inset-0 flex-col gap-2 justify-center items-center text-muted-foreground">
            <BarChart3Icon className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t('giftCard.pointTransaction.chart.empty')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
