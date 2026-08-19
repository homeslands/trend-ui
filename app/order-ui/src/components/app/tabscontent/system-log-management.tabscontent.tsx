import { DataTable } from '@/components/ui'
import { useLoggerColumns } from '@/app/system/logger/DataTable/columns'
import { useLogger, usePagination } from '@/hooks'
import { LoggerLevelFilter } from '@/app/system/logger/DataTable/filters'

export function SystemLogManagementTabsContent() {
  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()
  const { data: loggers, isLoading } = useLogger({
    order: 'DESC',
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
  })

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <DataTable
        columns={useLoggerColumns()}
        data={loggers?.result?.items || []}
        isLoading={isLoading}
        pages={loggers?.result?.totalPages || 0}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        filterOptions={LoggerLevelFilter}
      />
    </div>
  )
}

