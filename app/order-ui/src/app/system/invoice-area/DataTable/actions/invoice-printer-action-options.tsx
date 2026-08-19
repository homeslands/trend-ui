import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button, DropdownMenu, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { IPrinter } from '@/types'
import { DeleteInvoicePrinterDialog } from '@/components/app/dialog'
import { UpdateInvoicePrinterSheet } from '@/components/app/sheet'

interface PrinterActionsProps { printer: IPrinter; invoiceAreaSlug: string }

export default function PrinterActions({ printer, invoiceAreaSlug }: PrinterActionsProps) {
  const { t } = useTranslation(['common'])
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-8 h-8 p-0">
            <span className="sr-only">{t('common:common.action')}</span>
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="flex flex-col gap-1">
          <DropdownMenuLabel>{t('common:common.action')}</DropdownMenuLabel>
          <UpdateInvoicePrinterSheet printer={printer} invoiceAreaSlug={invoiceAreaSlug} />
          <Button
            variant="ghost"
            className="gap-1 px-2 text-sm text-destructive bg-destructive/10 hover:bg-destructive/10 hover:text-destructive justify-start w-full"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size="icon"/>
            {t('common:common.delete')}
          </Button>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteInvoicePrinterDialog
        isOpen={deleteOpen}
        onOpenChange={setDeleteOpen}
        invoiceAreaSlug={invoiceAreaSlug}
        printerSlug={printer.slug}
      />
    </>
  )
}
