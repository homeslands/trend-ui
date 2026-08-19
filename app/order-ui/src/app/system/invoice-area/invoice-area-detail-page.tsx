import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { SquareMenu } from 'lucide-react'
import { DataTable } from '@/components/ui'
import { useGetInvoiceAreasByBranch, useGetPrintersForInvoiceArea } from '@/hooks'
import { useInvoicePrintersColumns } from './DataTable/columns/invoice-printers-columns'
import { CreateInvoicePrinterSheet } from '@/components/app/sheet'
import { useBranchStore } from '@/stores'

export default function InvoiceAreaDetailPage() {
  const { t: tHelmet } = useTranslation('helmet')
  const { slug } = useParams<{ slug: string }>()
  const branch = useBranchStore((s) => s.branch)
  const branchSlug = branch?.slug ?? ''

  const { data: areasData } = useGetInvoiceAreasByBranch(branchSlug)
  const invoiceArea = areasData?.result?.find((a) => a.slug === slug)

  const { data: printersData, isLoading } = useGetPrintersForInvoiceArea(slug ?? '')
  const printers = printersData?.result ?? []
  const columns = useInvoicePrintersColumns(slug ?? '')

  return (
    <div className="flex flex-col flex-1 w-full pb-2">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{invoiceArea?.name ?? tHelmet('helmet.invoiceArea.title')}</title>
        <meta name="description" content={invoiceArea?.name ?? tHelmet('helmet.invoiceArea.title')} />
      </Helmet>
      <div className="flex items-center justify-between mb-4">
        <span className="flex items-center gap-2 text-lg">
          <SquareMenu />
          {invoiceArea?.name ?? slug}
        </span>
        {slug && branchSlug && (
          <CreateInvoicePrinterSheet invoiceAreaSlug={slug} branchSlug={branchSlug} />
        )}
      </div>
      <DataTable
        columns={columns}
        data={printers}
        isLoading={isLoading}
        pages={1}
        onPageChange={() => { }}
        onPageSizeChange={() => { }}
      />
    </div>
  )
}
