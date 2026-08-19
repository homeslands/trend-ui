import { useNavigate } from 'react-router-dom'
import { ROUTE } from '@/constants'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  Card,
} from '@/components/ui'
import { NewsArticle11, NewsArticle21, NewsArticle31 } from '@/assets/images'
import type { NewsArticle } from '@/app/client/news/types'

const mockNewsArticles: NewsArticle[] = [
  {
    id: '1',
    slug: 'bai-viet-1',
    title: 'Tổ chức Sự kiện Acoustic hằng tuần tại Trend Coffee – Không gian chill cho cuối tuần thư thái',
    summary: 'Bạn đang tìm một nơi để thư giãn, nghe nhạc sống và tận hưởng không gian cà phê ấm cúng sau những ngày làm việc căng thẳng? Trend Coffee & Foods chính là điểm hẹn lý tưởng với sự kiện Acoustic hằng tuần – nơi âm nhạc, cà phê và cảm xúc hòa quyện trong một trải nghiệm trọn vẹn.',
    thumbnail: NewsArticle11,
    publishDate: '2025-11-27',
  },
  {
    id: '2',
    slug: 'bai-viet-2',
    title: 'Check-in Giáng sinh, rinh ngay voucher 100k tại Trend Coffee & Foods!',
    summary: 'Mùa lễ hội cuối năm đã chính thức gõ cửa, mang theo không khí lung linh và rộn ràng khắp mọi nẻo đường. Tại Trend Coffee & Foods, Giáng Sinh năm nay trở nên đặc biệt hơn bao giờ hết với chương trình "Check-in Giáng sinh – Rinh ngay voucher 100k" dành cho tất cả khách hàng.',
    thumbnail: NewsArticle21,
    publishDate: '2025-11-27',
  },
  {
    id: '3',
    slug: 'bai-viet-3',
    title: 'Trend Coffee ưu đãi đồng giá 29.000đ trong tuần khai trương',
    summary: 'Tuần khai trương luôn là dấu mốc quan trọng đối với Trend Coffee, nơi chúng tôi chính thức mở cửa và mang đến cho khách hàng những trải nghiệm đồ uống chất lượng trong không gian rustic hiện đại. Để chào đón giai đoạn đặc biệt này, Trend Coffee triển khai chương trình ưu đãi đồng giá 29.000đ cho toàn bộ menu nước trong suốt tuần lễ khai trương.',
    thumbnail: NewsArticle31,
    publishDate: '2025-11-27',
  },
]

export default function NewsCarousel() {
  const navigate = useNavigate()

  const handleArticleClick = (slug: string) => {
    navigate(`${ROUTE.CLIENT_NEWS}/${slug}`)
  }

  return (
    <div className="w-full flex justify-center">
      <Carousel
        opts={{
          align: 'center',
          loop: true,
        }}
        className="w-full max-w-5xl"
      >
        <CarouselContent className="flex items-center -ml-2 md:-ml-4">
          {mockNewsArticles.map((article) => (
            <CarouselItem key={article.id} className="pl-2 md:pl-4 basis-1/2 sm:basis-1/2 lg:basis-1/3">
              <div className="flex justify-center h-full">
                <Card
                  className="cursor-pointer bg-transparent border-none shadow-none h-full flex flex-col w-full max-w-[180px] sm:max-w-[320px]"
                  onClick={() => handleArticleClick(article.slug)}
                >
                  <div className="relative w-full sm:aspect-auto sm:h-auto overflow-hidden rounded-xl bg-muted">
                    <img
                      src={article.thumbnail}
                      alt={article.title}
                      className="w-full h-full sm:h-auto object-cover rounded-xl"
                    />
                  </div>
                  <div className="p-3 sm:p-4 flex flex-col gap-2 flex-1">
                    <h2 className="text-base sm:text-lg font-bold line-clamp-2 sm:min-h-[3.5rem]">
                      {article.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3">
                      {article.summary}
                    </p>
                  </div>
                </Card>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden sm:flex top-[calc(50%-80px)] text-primary" />
        <CarouselNext className="hidden sm:flex top-[calc(50%-80px)] text-primary" />
      </Carousel>
    </div>
  )
}
