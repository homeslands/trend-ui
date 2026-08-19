import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PenLine } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
  Button, ScrollArea, Input, Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui'
import { UpdateInvoiceAreaDialog } from '@/components/app/dialog'
import { updateInvoiceAreaSchema, TUpdateInvoiceAreaSchema } from '@/schemas'
import { IInvoiceArea, IUpdateInvoiceAreaRequest } from '@/types'

interface Props {
  area: IInvoiceArea
}

export default function UpdateInvoiceAreaSheet({ area }: Props) {
  const { t } = useTranslation(['chefArea', 'common'])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<IUpdateInvoiceAreaRequest | null>(null)

  const form = useForm<TUpdateInvoiceAreaSchema>({
    resolver: zodResolver(updateInvoiceAreaSchema),
    defaultValues: { slug: area.slug, branch: area.branch, name: area.name, description: area.description ?? '' },
  })

  useEffect(() => {
    form.reset({ slug: area.slug, branch: area.branch, name: area.name, description: area.description ?? '' })
  }, [area.slug, area.name, area.description, area.branch, form])

  const handleSubmit = (values: TUpdateInvoiceAreaSchema) => {
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
      <SheetContent className="sm:max-w-lg">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('chefArea:invoiceArea.update')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] p-4">
            <Form {...form}>
              <form id="update-invoice-area-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="p-4 bg-white rounded-md border dark:bg-transparent space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel><span className="text-destructive">*</span> {t('chefArea:invoiceArea.name')}</FormLabel>
                      <FormControl><Input placeholder={t('chefArea:invoiceArea.enterName')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('chefArea:invoiceArea.description')}</FormLabel>
                      <FormControl><Input placeholder={t('chefArea:invoiceArea.enterDescription')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="submit" form="update-invoice-area-form">{t('printer.confirm')}</Button>
          </SheetFooter>
        </div>
        {dialogOpen && (
          <UpdateInvoiceAreaDialog
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
