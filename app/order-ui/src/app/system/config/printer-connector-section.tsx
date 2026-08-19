import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, MoreHorizontal, Plug } from 'lucide-react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui'
import { CreatePrinterConnectorSheet, UpdatePrinterConnectorSheet } from '@/components/app/sheet'
import { DeletePrinterConnectorDialog } from '@/components/app/dialog'
import { BranchSelect } from '@/components/app/select'
import { useGetPrinterConnectorsByBranch } from '@/hooks'
import { useBranchStore } from '@/stores'

export default function PrinterConnectorSection() {
  const { t } = useTranslation(['chefArea', 'common'])
  const branch = useBranchStore((s) => s.branch)
  const branchSlug = branch?.slug ?? ''
  const { data, isLoading } = useGetPrinterConnectorsByBranch(branchSlug)
  const connector = data?.result ?? null
  const [showApiKey, setShowApiKey] = useState(false)

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('printerConnector.title')}</h2>
        <div className="flex items-center gap-2">
          <BranchSelect />
          {!connector && !isLoading && branchSlug && (
            <CreatePrinterConnectorSheet branchSlug={branchSlug} />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
          {t('common:common.loading', 'Đang tải...')}
        </div>
      ) : connector ? (
        <div className="flex items-start justify-between gap-4 p-4 border rounded-md bg-white dark:bg-transparent">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
              <Plug className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{connector.url}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="shrink-0">API Key:</span>
                <span className="font-mono">
                  {showApiKey ? connector.apiKey : `${connector.apiKey.slice(0, 8)}••••••••`}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-5 h-5 shrink-0"
                  onClick={() => setShowApiKey((v) => !v)}
                >
                  {showApiKey
                    ? <EyeOff className="w-3.5 h-3.5" />
                    : <Eye className="w-3.5 h-3.5" />
                  }
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">Slug: {connector.slug}</span>
            </div>
          </div>

          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-8 h-8 p-0">
                  <span className="sr-only">{t('common:common.action')}</span>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="flex flex-col gap-1">
                <DropdownMenuLabel>{t('common:common.action')}</DropdownMenuLabel>
                <UpdatePrinterConnectorSheet connector={connector} />
                <DeletePrinterConnectorDialog slug={connector.slug} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : branchSlug ? (
        <div className="flex flex-col items-center justify-center gap-2 h-24 border border-dashed rounded-md text-sm text-muted-foreground">
          <Plug className="w-6 h-6" />
          <span>{t('printerConnector.noConnector', 'Chưa có printer connector')}</span>
        </div>
      ) : (
        <div className="flex items-center justify-center h-24 border border-dashed rounded-md text-sm text-muted-foreground">
          {t('printerConnector.selectBranch', 'Chọn chi nhánh để xem printer connector')}
        </div>
      )}
    </div>
  )
}
