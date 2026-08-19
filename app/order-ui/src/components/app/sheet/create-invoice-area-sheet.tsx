import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PlusCircle } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
  Button, ScrollArea, Input, Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui'
import { CreateInvoiceAreaDialog } from '@/components/app/dialog'
import { createInvoiceAreaSchema, TCreateInvoiceAreaSchema } from '@/schemas'
import { ICreateInvoiceAreaRequest } from '@/types'

interface CreateInvoiceAreaSheetProps {
  branchSlug: string
}

export default function CreateInvoiceAreaSheet({ branchSlug }: CreateInvoiceAreaSheetProps) {
  const { t } = useTranslation(['chefArea', 'common'])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<ICreateInvoiceAreaRequest | null>(null)

  const form = useForm<TCreateInvoiceAreaSchema>({
    resolver: zodResolver(createInvoiceAreaSchema),
    defaultValues: { branch: branchSlug, name: '', description: '' },
  })

  const handleSubmit = (values: TCreateInvoiceAreaSchema) => {
    setFormData(values)
    setDialogOpen(true)
  }

  const resetForm = () => form.reset({ branch: branchSlug, name: '', description: '' })

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button>
          <PlusCircle size={16} />
          {t('chefArea:invoiceArea.create')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('chefArea:invoiceArea.create')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] p-4">
            <Form {...form}>
              <form id="invoice-area-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="p-4 bg-white rounded-md border dark:bg-transparent space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel><span className="text-destructive">*</span> {t('chefArea:invoiceArea.name')}</FormLabel>
                        <FormControl><Input placeholder={t('chefArea:invoiceArea.enterName')} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('chefArea:invoiceArea.description')}</FormLabel>
                        <FormControl><Input placeholder={t('chefArea:invoiceArea.enterDescription')} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="submit" form="invoice-area-form">{t('chefArea:invoiceArea.create')}</Button>
          </SheetFooter>
        </div>
        {dialogOpen && (
          <CreateInvoiceAreaDialog
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
