import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IProductVariant } from '@/types'

interface ProductVariantSelectProps {
  variants?: IProductVariant[]
  value?: string
  /** Size đã lưu trong giỏ (`item.size`), dùng khi món không còn danh sách variant. */
  fallbackLabel?: string
  onChange: (variantSlug: string) => void
}

function SizeBadge({ label }: { label: string }) {
  return (
    <span className="px-2 py-1 text-xs rounded-full border text-muted-foreground border-muted-foreground/40">
      {`Size ${label.toUpperCase()}`}
    </span>
  )
}

export default function ProductVariantSelect({
  variants,
  value,
  fallbackLabel,
  onChange,
}: ProductVariantSelectProps) {
  const { t } = useTranslation(['product'])
  const list = variants ?? []

  // Món cũ trong localStorage có thể không có allVariants; không được truy cập list[0].
  if (list.length === 0) {
    return fallbackLabel ? <SizeBadge label={fallbackLabel} /> : null
  }

  if (list.length === 1) {
    return <SizeBadge label={list[0].size?.name ?? fallbackLabel ?? ''} />
  }

  return (
    <Select value={value ?? list[0].slug} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs rounded-full w-fit min-w-24 dark:border-muted-foreground/60">
        <SelectValue placeholder={t('product.selectProductVariant')} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {list.map((item) => (
            <SelectItem key={item.slug} value={item.slug}>
              {`Size ${item.size?.name?.toUpperCase() ?? ''}`}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
