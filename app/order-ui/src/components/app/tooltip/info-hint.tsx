import { InfoIcon } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'

interface IInfoHintProps {
  /** Giải thích viết cho NGƯỜI NGOÀI NGÀNH: không thuật ngữ thống kê, nói bằng thứ mà
   * người vận hành cửa hàng nhìn thấy trên màn hình. */
  content: React.ReactNode
  /** Nhãn cho trình đọc màn hình — mô tả chỉ số đang được giải thích. */
  ariaLabel: string
  className?: string
}

/**
 * Dấu ⓘ nhỏ, hover hoặc focus bàn phím thì hiện giải thích.
 *
 * Dùng `<button type="button">` chứ không phải `<span>`: trigger phải focus được bằng
 * bàn phím, nếu không người không dùng chuột sẽ KHÔNG BAO GIỜ đọc được phần giải thích.
 * Radix mở tooltip trên cả hover lẫn focus, nên một thẻ button là đủ cho cả hai.
 */
export default function InfoHint({
  content,
  ariaLabel,
  className,
}: IInfoHintProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            // `onClick` chặn submit/side-effect ngoài ý muốn khi nút nằm trong form.
            onClick={(event) => event.preventDefault()}
            className={`inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className ?? ''}`}
          >
            <InfoIcon className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[16rem] text-xs font-normal leading-relaxed">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
