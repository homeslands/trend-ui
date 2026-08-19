import { useTranslation } from 'react-i18next'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import {
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from '@radix-ui/react-icons'

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

interface GridPaginationProps {
  page: number
  pageSize: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  pageSizeOptions?: number[]
}

export function GridPagination({
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 40, 50],
}: GridPaginationProps) {
  const { t } = useTranslation('common')
  const canPreviousPage = page > 1
  const canNextPage = page < totalPages

  return (
    <div className="flex flex-wrap justify-end items-center py-4">
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium sr-only">
            {t('dataTable.rowsPerPage')}
          </p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sr-only flex w-[100px] items-center justify-center text-sm font-medium">
          {t('dataTable.page')} {page} {t('dataTable.of')} {totalPages}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            className="hidden p-0 w-8 h-8 lg:flex"
            onClick={() => onPageChange(1)}
            disabled={!canPreviousPage}
          >
            <span className="sr-only">{t('dataTable.goToFirstPage')}</span>
            <DoubleArrowLeftIcon className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="p-0 w-8 h-8"
            onClick={() => onPageChange(page - 1)}
            disabled={!canPreviousPage}
          >
            <span className="sr-only">{t('dataTable.goToPreviousPage')}</span>
            <ChevronLeftIcon className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="p-0 w-8 h-8"
            onClick={() => onPageChange(page + 1)}
            disabled={!canNextPage}
          >
            <span className="sr-only">{t('dataTable.goToNextPage')}</span>
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="hidden p-0 w-8 h-8 lg:flex"
            onClick={() => onPageChange(totalPages)}
            disabled={!canNextPage}
          >
            <span className="sr-only">{t('dataTable.goToLastPage')}</span>
            <DoubleArrowRightIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
