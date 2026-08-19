import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { useGetPrinterConnectorsByBranch } from '@/hooks'

interface PrinterConnectorSelectProps {
  branchSlug: string
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
}

export default function PrinterConnectorSelect({
  branchSlug,
  value,
  onChange,
  disabled,
}: PrinterConnectorSelectProps) {
  const { t } = useTranslation('chefArea')
  const { data, isLoading } = useGetPrinterConnectorsByBranch(branchSlug)
  const connector = data?.result ?? null

  return (
    <Select
      onValueChange={onChange}
      value={value}
      disabled={disabled || isLoading || !branchSlug || !connector}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t('printer.choosePrinterConnector')} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{t('printer.printerConnector')}</SelectLabel>
          {connector && (
            <SelectItem value={connector.slug}>
              {connector.url}
            </SelectItem>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
