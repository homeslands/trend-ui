import { useTranslation } from 'react-i18next'
import { BookOpenIcon } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui'
import { MIN_TREND_R2, TREND_SIGNIFICANCE } from '@/utils'

/** Mỗi mục = một chỉ số, gồm: tên (kèm thuật ngữ chuyên ngành để người dùng học đúng từ),
 * một dòng mẹo đọc nhanh, rồi phần giải thích có ví dụ bằng CON SỐ THẬT trên màn hình —
 * người mới nhận ra ngay con số mình đang nhìn thay vì phải bắc cầu từ ví dụ trừu tượng. */
const GUIDE_ITEM_KEYS = [
  'slope',
  'r2',
  'pValue',
  'band',
  'hidden',
] as const

/**
 * Hướng dẫn đọc các chỉ số thống kê của chart, dạng đóng/mở.
 *
 * Mặc định ĐÓNG: người dùng quen rồi thì không phải nhìn nó mỗi ngày, còn người mới vẫn
 * tìm thấy ngay tại chỗ cần — thay vì phải đi hỏi hoặc đoán.
 */
export default function TrendReadingGuide() {
  const { t } = useTranslation('common')

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="trend-guide" className="border-none">
        <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
          <span className="flex gap-1.5 items-center">
            <BookOpenIcon className="w-3.5 h-3.5" />
            {t('trendGuide.title')}
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <dl className="flex flex-col gap-3 pb-1 text-xs">
            {GUIDE_ITEM_KEYS.map((key) => (
              <div key={key} className="flex flex-col gap-0.5">
                <dt className="font-semibold text-foreground">
                  {t(`trendGuide.${key}.term`)}
                </dt>
                {/* Mẹo đọc nhanh đứng TRƯỚC phần giải thích: người đang cần tra cứu
                    giữa lúc xem dashboard thường chỉ đọc đúng dòng này. */}
                <dd className="text-foreground/90">
                  {t(`trendGuide.${key}.quick`, {
                    alpha: TREND_SIGNIFICANCE,
                    minR2: MIN_TREND_R2,
                  })}
                </dd>
                <dd className="text-muted-foreground">
                  {t(`trendGuide.${key}.body`, {
                    alpha: TREND_SIGNIFICANCE,
                    minR2: MIN_TREND_R2,
                  })}
                </dd>
              </div>
            ))}
          </dl>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
