import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PlusCircle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  Button,
  ScrollArea,
  Input,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui'
import { CreatePrinterConnectorDialog } from '@/components/app/dialog'
import { createPrinterConnectorSchema, TCreatePrinterConnectorSchema } from '@/schemas'
import { ICreatePrinterConnectorRequest } from '@/types'

interface CreatePrinterConnectorSheetProps {
  branchSlug: string
}

export default function CreatePrinterConnectorSheet({ branchSlug }: CreatePrinterConnectorSheetProps) {
  const { t } = useTranslation(['chefArea', 'common'])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<ICreatePrinterConnectorRequest | null>(null)

  const form = useForm<TCreatePrinterConnectorSchema>({
    resolver: zodResolver(createPrinterConnectorSchema),
    defaultValues: { branchSlug, url: '', apiKey: '' },
  })

  const handleSubmit = (values: TCreatePrinterConnectorSchema) => {
    setFormData({ ...values, branchSlug })
    setDialogOpen(true)
  }

  const resetForm = () => {
    form.reset({ branchSlug, url: '', apiKey: '' })
  }

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button>
          <PlusCircle size={16} />
          {t('chefArea:printerConnector.create')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('chefArea:printerConnector.create')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] p-4">
            <Form {...form}>
              <form id="connector-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="p-4 bg-white rounded-md border dark:bg-transparent space-y-4">
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <span className="text-destructive">*</span> URL
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="http://192.168.1.100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <span className="text-destructive">*</span> API Key
                        </FormLabel>
                        <FormControl>
                          <Input placeholder={t('chefArea:printerConnector.enterApiKey')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="submit" form="connector-form">
              {t('chefArea:printerConnector.create')}
            </Button>
          </SheetFooter>
        </div>
        {dialogOpen && (
          <CreatePrinterConnectorDialog
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
