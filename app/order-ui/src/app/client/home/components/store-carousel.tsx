import { NewsArticle11, NewsArticle12, NewsArticle13, NewsArticle22, NewsArticle23, NewsArticle32, NewsArticle33, NewsArticle34 } from '@/assets/images'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Navigation, Pagination, EffectFade } from 'swiper/modules'

const images = [NewsArticle11, NewsArticle12, NewsArticle13, NewsArticle22, NewsArticle23, NewsArticle32, NewsArticle33, NewsArticle34]

export default function StoreCarousel() {
  return (
    <div className="overflow-hidden w-full max-w-6xl rounded-md sm:rounded-xl">
      <Swiper
        autoplay={{
          delay: 3000,
          pauseOnMouseEnter: true,
          disableOnInteraction: false,
        }}
        loop={true}
        speed={800}
        effect="slide"
        slidesPerView={1}
        spaceBetween={0}
        pagination={{
          clickable: true,
        }}
        modules={[Autoplay, Navigation, Pagination, EffectFade]}
        className="w-full rounded-md sm:rounded-xl"
        style={{
          borderRadius: '0.75rem',
          overflow: 'hidden',
        }}
      >
        {images.map((image, index) => (
          <SwiperSlide key={index} className="w-full">
            <div className="flex h-[12rem] w-full sm:h-[28rem] overflow-hidden rounded-md sm:rounded-xl">
              <img
                src={image}
                alt={`Slide ${index + 1}`}
                className="object-cover w-full h-full rounded-md sm:rounded-xl"
                style={{
                  borderRadius: '0.75rem',
                }}
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}
