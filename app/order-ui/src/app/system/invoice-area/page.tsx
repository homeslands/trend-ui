import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import { SquareMenu } from 'lucide-react'

import { DataTable } from '@/components/ui'
import { CreateInvoiceAreaSheet } from '@/components/app/sheet'
import { DeleteInvoiceAreaDialog } from '@/components/app/dialog'
import { useGetInvoiceAreasByBranch } from '@/hooks'
import { ROUTE } from '@/constants'
import { useBranchStore } from '@/stores'
import { useInvoiceAreaColumns } from './DataTable/columns/invoice-area-columns'

export default function InvoiceAreaPage() {
  const { t } = useTranslation('chefArea')
  const { t: tHelmet } = useTranslation('helmet')
  const navigate = useNavigate()
  const branch = useBranchStore((s) => s.branch)
  const branchSlug = branch?.slug ?? ''
  const { data, isLoading } = useGetInvoiceAreasByBranch(branchSlug)
  const areas = Array.isArray(data?.result) ? data.result : []

  const [deleteSlug, setDeleteSlug] = useState<string | null>(null)

  const columns = useInvoiceAreaColumns(setDeleteSlug)

  return (
    <div className="flex flex-col flex-1 w-full pb-2">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.invoiceArea.title')}</title>
        <meta name="description" content={tHelmet('helmet.invoiceArea.title')} />
      </Helmet>
      <div className="flex items-center justify-between mb-4">
        <span className="flex items-center gap-2 text-lg">
          <SquareMenu />
          {t('chefArea:invoiceArea.title')}
        </span>
        <CreateInvoiceAreaSheet branchSlug={branchSlug} />
      </div>
      <DataTable
        columns={columns}
        data={areas}
        isLoading={isLoading}
        pages={1}
        onPageChange={() => { }}
        onPageSizeChange={() => { }}
        onRowClick={(area) => navigate(`${ROUTE.STAFF_INVOICE_AREA_MANAGEMENT}/${area.slug}`, { state: { name: area.name } })}
      />
      {deleteSlug && (
        <DeleteInvoiceAreaDialog
          isOpen={!!deleteSlug}
          onOpenChange={(open) => { if (!open) setDeleteSlug(null) }}
          slug={deleteSlug}
        />
      )}
    </div>
  )
}
