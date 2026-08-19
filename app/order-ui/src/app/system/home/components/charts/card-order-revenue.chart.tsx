import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import moment from 'moment'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { formatCurrency } from '@/utils'
import { CardOrderRevenue } from '@/types/card-order-revenue.type'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/components/app/theme-provider'

interface CardOrderRevenueData {
  data: CardOrderRevenue[]
}

interface TooltipParams {
  name: string
  value: number
  seriesName: string
}

export default function CardOrderRevenueChart({
  data
}: CardOrderRevenueData) {
  const { theme } = useTheme();
  const { t } = useTranslation(['dashboard'])
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chartRef.current && data) {
      const chart = echarts.init(chartRef.current)

      const sortedData = data;

      const option = {
        tooltip: {
          trigger: 'axis' as const,
          formatter: function (params: TooltipParams[]) {
            const date = params[0].name
            const revenue = formatCurrency(params[0].value)
            const orders = params[1].value
            return `${date}<br/>${params[0].seriesName}: ${revenue}<br/>${params[1].seriesName}: ${orders}`
          },
        },
        legend: {
          data: ['Doanh thu', 'Đơn hàng'],
        },
        xAxis: {
          type: 'category',
          data: sortedData.map((item) => moment(item.date).format("DD/MM/YYYY")),
          axisLabel: {
            rotate: 45,
            color: theme === 'dark' ? '#fff' : '#333',
          },

        },
        yAxis: [
          {
            type: 'value',
            name: 'Doanh thu (đồng)',
            position: 'left',
            nameTextStyle: {
              padding: [0, -50, 0, 0], // Tăng padding bên trái,
              color: theme === 'dark' ? '#fff' : '#333',
            },
            axisLabel: {
              formatter: (value: number) => {
                return formatCurrency(value, 'đ')
              },
              color: theme === 'dark' ? '#fff' : '#333',
              margin: 4, // Tăng khoảng cách giữa nhãn và trục
              show: true,
            },
            axisLine: {
              show: true,
            },
            nameGap: 15, // Khoảng cách giữa tên trục và trục
            offset: 0, // Dịch chuyển trục
            splitLine: {
              show: true,
              lineStyle: {
                type: 'dashed',
              },
            },
          },
          {
            type: 'value',
            name: 'Đơn hàng',
            position: 'right',
            nameTextStyle: {
              color: theme === 'dark' ? '#fff' : '#333',
            },
            axisLabel: {
              show: true,
              margin: 4,
              color: theme === 'dark' ? '#fff' : '#333',
            },
            axisLine: {
              show: true,
            },
            nameGap: 15,
            offset: 0,
            splitLine: {
              show: false,
            },
          },
        ],
        series: [
          {
            name: 'Doanh thu',
            type: 'line',
            smooth: true,
            data: sortedData.map((item) => item.totalRevenue),
            itemStyle: {
              color: '#09c10c',
            },
          },
          {
            name: 'Đơn hàng',
            type: 'bar',
            yAxisIndex: 1,
            barWidth: sortedData.length === 1 ? 40 : '50%',
            data: sortedData.map((item) => item.totalCardOrders),
            itemStyle: {
              color: '#f89209',
              opacity: 0.5,
              borderRadius: [5, 5, 0, 0],
            },
          },
        ],
      }

      chart.setOption(option)

      const handleResize = () => {
        chart.resize()
      }

      window.addEventListener('resize', handleResize)

      return () => {
        chart.dispose()
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [data, theme])

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {t('dashboard.cardOrder.revenueChart')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center p-2">
        <div ref={chartRef} className="h-[26rem] w-full" />
      </CardContent>
    </Card>
  )
}
