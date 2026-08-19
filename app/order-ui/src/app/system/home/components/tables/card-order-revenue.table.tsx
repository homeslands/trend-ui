import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Card, CardContent, CardHeader, CardTitle, DataTable } from "@/components/ui"
import { CardOrderRevenue } from "@/types/card-order-revenue.type"
import { CardOrderRevenueColumn } from "./columns/card-order-revenue.column"

interface CardOrderRevenueData {
  data: CardOrderRevenue[],
  type: string;
}

export default function CardOrderRevenueTable({ data, type }: CardOrderRevenueData) {
  const { t } = useTranslation('revenue')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const getPaginatedData = (data: CardOrderRevenue[], page: number, pageSize: number) => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return data.slice(start, end);
  };

  const paginatedData = getPaginatedData(data, page, pageSize);

  // Thêm hàm này để kiểm tra giới hạn
  const isPageValid = (page: number, pageSize: number, totalItems: number) => {
    const totalPages = Math.ceil(totalItems / pageSize);
    return page >= 1 && page <= totalPages;
  };

  const onPageChange = (newPage: number) => {
    if (isPageValid(newPage, pageSize, data.length)) {
      setPage(newPage);
    }
  };

  const onPageSizeChange = (newPageSize: number) => {
    if (isPageValid(page, newPageSize, data.length)) {
      setPageSize(newPageSize);
    }
  };

  return (
    <Card className='mt-4 shadow-none'>
      <CardHeader >
        <CardTitle className='flex justify-between items-center'>
          {t('revenue.tableRevenue')}
        </CardTitle>
      </CardHeader>
      <CardContent className='grid grid-cols-1 h-full'>
        <DataTable
          isLoading={false}
          columns={CardOrderRevenueColumn({ type })}
          data={paginatedData || []}
          pages={Math.ceil(data.length / pageSize)}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          hiddenDatePicker={true}
          periodOfTime="inWeek"
        />
      </CardContent>
    </Card>
  )
}


