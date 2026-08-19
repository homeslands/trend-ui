import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PenLine } from 'lucide-react'
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
import { UpdatePrinterConnectorDialog } from '@/components/app/dialog'
import { updatePrinterConnectorSchema, TUpdatePrinterConnectorSchema } from '@/schemas'
import { IPrinterConnector, IUpdatePrinterConnectorRequest } from '@/types'

interface UpdatePrinterConnectorSheetProps {
  connector: IPrinterConnector
}

export default function UpdatePrinterConnectorSheet({ connector }: UpdatePrinterConnectorSheetProps) {
  const { t } = useTranslation(['chefArea', 'common'])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState<IUpdatePrinterConnectorRequest | null>(null)

  const form = useForm<TUpdatePrinterConnectorSchema>({
    resolver: zodResolver(updatePrinterConnectorSchema),
    defaultValues: { slug: connector.slug, url: connector.url, apiKey: connector.apiKey },
  })

  useEffect(() => {
    form.reset({ slug: connector.slug, url: connector.url, apiKey: connector.apiKey })
  }, [connector.slug, connector.url, connector.apiKey, form])

  const handleSubmit = (values: TUpdatePrinterConnectorSchema) => {
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
          {t('chefArea:printerConnector.update')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('chefArea:printerConnector.update')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] p-4">
            <Form {...form}>
              <form id="update-connector-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                          <Input {...field} />
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
                          <Input {...field} />
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
            <Button type="submit" form="update-connector-form">
              {t('chefArea:printerConnector.update')}
            </Button>
          </SheetFooter>
        </div>
        {dialogOpen && (
          <UpdatePrinterConnectorDialog
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
            onCloseSheet={() => setSheetOpen(false)}
            slug={connector.slug}
            data={formData}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
