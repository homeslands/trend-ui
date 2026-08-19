import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PenLine } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
  Button, ScrollArea, Input, Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
  Switch,
} from '@/components/ui'
import { UpdateInvoicePrinterDialog } from '@/components/app/dialog'
import { PrinterDataTypeSelect } from '@/components/app/select'
import { updatePrinterForInvoiceAreaSchema, TUpdatePrinterForInvoiceAreaSchema } from '@/schemas'
import { IPrinter, IUpdatePrinterForInvoiceAreaRequest } from '@/types'
import { PrinterDataType } from '@/constants'

interface Props {
  printer: IPrinter
  invoiceAreaSlug: string
}

export default function UpdateInvoicePrinterSheet({ printer, invoiceAreaSlug }: Props) {
  const { t } = useTranslation(['chefArea', 'common'])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<IUpdatePrinterForInvoiceAreaRequest | null>(null)

  const form = useForm<TUpdatePrinterForInvoiceAreaSchema>({
    resolver: zodResolver(updatePrinterForInvoiceAreaSchema),
    defaultValues: {
      slug: invoiceAreaSlug,
      printerSlug: printer.slug,
      name: printer.name,
      ip: printer.ip,
      port: printer.port,
      dataType: printer.dataType,
      description: printer.description ?? '',
      printerId: printer.printerId,
      isActive: printer.isActive,
    },
  })

  useEffect(() => {
    form.reset({
      slug: invoiceAreaSlug,
      printerSlug: printer.slug,
      name: printer.name,
      ip: printer.ip,
      port: printer.port,
      dataType: printer.dataType,
      description: printer.description ?? '',
      printerId: printer.printerId,
      isActive: printer.isActive,
    })
  }, [printer.slug, printer.name, printer.ip, printer.port, printer.dataType, printer.isActive, invoiceAreaSlug, form, printer.description, printer.printerId])

  const handleSubmit = (values: TUpdatePrinterForInvoiceAreaSchema) => {
    setFormData(values)
    setDialogOpen(true)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSheetOpen(true)
  }

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="justify-start w-full gap-1 px-2" onClick={handleClick}>
          <PenLine className="icon" />
          {t('printer.update')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('chefArea:printer.update')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] p-4">
            <Form {...form}>
              <form id="update-invoice-printer-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                      <FormLabel><span className="text-destructive">*</span> {t('chefArea:printer.printerId')}</FormLabel>
                      <FormControl><Input placeholder={t('chefArea:printer.enterPrinterId')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="isActive" render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>{t('chefArea:printer.status')}</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="submit" form="update-invoice-printer-form">{t('printer.confirm')}</Button>
          </SheetFooter>
        </div>
        {dialogOpen && (
          <UpdateInvoicePrinterDialog
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
            onCloseSheet={() => setSheetOpen(false)}
            data={formData}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
