import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PlusCircle } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
  Button, ScrollArea, Input, Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui'
import { CreateInvoicePrinterDialog } from '@/components/app/dialog'
import { PrinterDataTypeSelect, PrinterConnectorSelect } from '@/components/app/select'
import { createPrinterForInvoiceAreaSchema, TCreatePrinterForInvoiceAreaSchema } from '@/schemas'
import { ICreatePrinterForInvoiceAreaRequest } from '@/types'
import { PrinterDataType } from '@/constants'

interface CreateInvoicePrinterSheetProps {
  invoiceAreaSlug: string
  branchSlug: string
}

export default function CreateInvoicePrinterSheet({ invoiceAreaSlug, branchSlug }: CreateInvoicePrinterSheetProps) {
  const { t } = useTranslation(['chefArea', 'common'])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<ICreatePrinterForInvoiceAreaRequest | null>(null)

  const form = useForm<TCreatePrinterForInvoiceAreaSchema>({
    resolver: zodResolver(createPrinterForInvoiceAreaSchema),
    defaultValues: {
      slug: invoiceAreaSlug,
      name: '',
      ip: '',
      port: '',
      dataType: PrinterDataType.TSPL_ZPL,
      description: '',
      printerId: '',
    },
  })

  const handleSubmit = (values: TCreatePrinterForInvoiceAreaSchema) => {
    setFormData(values)
    setDialogOpen(true)
  }

  const resetForm = () => form.reset({
    slug: invoiceAreaSlug, name: '', ip: '', port: '',
    dataType: PrinterDataType.TSPL_ZPL, description: '', printerId: '',
  })

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button>
          <PlusCircle size={16} />
          {t('chefArea:printer.create')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('chefArea:printer.create')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] p-4">
            <Form {...form}>
              <form id="invoice-printer-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="p-4 bg-white rounded-md border dark:bg-transparent space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel><span className="text-destructive">*</span> {t('chefArea:printer.name')}</FormLabel>
                      <FormControl><Input placeholder={t('chefArea:printer.enterPrinterName')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('chefArea:printer.description')}</FormLabel>
                      <FormControl><Input placeholder={t('chefArea:printer.enterPrinterDescription')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-2 p-4 bg-white rounded-md border dark:bg-transparent">
                  <FormField control={form.control} name="ip" render={({ field }) => (
                    <FormItem>
                      <FormLabel><span className="text-destructive">*</span> {t('chefArea:printer.ip')}</FormLabel>
                      <FormControl><Input placeholder={t('chefArea:printer.enterPrinterIp')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="port" render={({ field }) => (
                    <FormItem>
                      <FormLabel><span className="text-destructive">*</span> {t('chefArea:printer.port')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder={t('chefArea:printer.enterPrinterPort')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="p-4 bg-white rounded-md border dark:bg-transparent space-y-4">
                  <FormField control={form.control} name="dataType" render={({ field }) => (
                    <FormItem>
                      <FormLabel><span className="text-destructive">*</span> {t('chefArea:printer.dataType')}</FormLabel>
                      <FormControl>
                        <PrinterDataTypeSelect value={field.value as PrinterDataType} onChange={field.onChange as (value: PrinterDataType) => void} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="printerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel><span className="text-destructive">*</span> {t('chefArea:printer.printerConnector')}</FormLabel>
                      <FormControl>
                        <PrinterConnectorSelect branchSlug={branchSlug} value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="submit" form="invoice-printer-form">{t('chefArea:printer.create')}</Button>
          </SheetFooter>
        </div>
        {dialogOpen && (
          <CreateInvoicePrinterDialog
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
            onCloseSheet={() => setSheetOpen(false)}
            data={formData}
            onSuccess={resetForm}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
