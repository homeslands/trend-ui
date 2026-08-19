import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Undo } from 'lucide-react'
import { FeaturedServices3, FeaturedServices4, LogoIcon } from '@/assets/images'
import { SwiperBanner } from '../home/components'

import { useBanners } from '@/hooks/use-banner'
import { BannerPage, bookingHotline, fanpageUrl } from '@/constants'

export default function BookingPage() {
  const { t } = useTranslation('booking')
  const { data: banner } = useBanners({ isActive: true, page: BannerPage.BOOKING })

  //get banner data
  const bannerData = useMemo(() => banner?.result || [], [banner])

  // use useEffect to scroll to the top of the page
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

const headerSections = [
  {
    key: 'title',
    title: t('booking.title'),
    titleClass: 'text-2xl sm:text-3xl font-extrabold uppercase',
    titleColor: 'text-primary',
  },
]

  const featuredServices = [
    {
      key: 'service-1',
      image: FeaturedServices3,
      title: t('booking.partyPersonal'),
      descriptions: [
        t('booking.partyPersonalDescription'),
        t('booking.partyPersonalThemeDescription'),
        t('booking.partyPersonalDecorationDescription'),
      ],
    },
    {
      key: 'service-2',
      image: FeaturedServices4,
      title: t('booking.partyGroup'),
      descriptions: [t('booking.partyGroupDescription'), t('booking.partyGroupDescription2'), t('booking.partyGroupDescription3')],
    },
    {
      key: 'service-3',
      image: LogoIcon,
      title: t('booking.bookingContact'),
      descriptions: [t('booking.bookingContactDescription'), t('booking.bookingContactDescription2')],
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Section 1: Hero - Full width */}
      <SwiperBanner bannerData={bannerData} />
      <header className="py-6 flex flex-col gap-6">
        <div className="container mx-auto flex flex-col gap-3 uppercase text-center">
          <span className={`${headerSections[0].titleClass} ${headerSections[0].titleColor}`}>
            {headerSections[0].title}
          </span>
        </div>
        {headerSections.slice(1).map(({ key, title, titleClass, titleColor }) => (
          <div key={key} className="container mx-auto flex items-start gap-3">
            <span className="w-1 h-12 rounded-full bg-primary" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className={`${titleClass} ${titleColor}`}>
                {title}
              </span>
            </div>
          </div>
        ))}
      </header>
      <main className="w-full px-4 py-8 mx-auto ql-snow flex justify-center">
        <div className="flex flex-col gap-8 w-full max-w-6xl">
          <div className="flex flex-col gap-10 items-center">
            {featuredServices.map((service) => {
              const hasImage = Boolean(service.image)

              return (
                service.key === 'service-3' ? (
                  <div
                    key={service.key}
                    className="w-full flex flex-col items-center text-center gap-6"
                  >
                    <div className="flex flex-col gap-3">
                      <h3 className="sm:text-2xl text-xl font-extrabold text-primary">
                        {service.title}
                      </h3>
                      <p className="sm:text-lg text-base text-muted-foreground leading-relaxed">
                        {service.descriptions[0]}
                      </p>
                      <p className="sm:text-3xl text-2xl font-black tracking-wide text-primary">
                        {bookingHotline}
                      </p>
                      <p className="sm:text-lg text-base text-muted-foreground leading-relaxed">
                        {service.descriptions[1]}
                      </p>
                    </div>
                    {hasImage && (
                      <div className="flex flex-col items-center gap-4 relative">
                        <div className="w-full max-w-xs sm:max-w-sm flex justify-center">
                          <div className="w-full aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
                            <img
                              src={service.image}
                              alt={service.title}
                              className="w-48 object-cover cursor-pointer"
                              onClick={() => window.open(fanpageUrl, '_blank')}
                            />
                          </div>
                        </div>
                        <div className="relative flex flex-col items-center gap-2 pt-6 w-full">
                        <Undo className="w-16 h-16 font-thin absolute bottom-6 right-0 text-muted-foreground rotate-[75deg]  origin-bottom-right"/>
                          <span className="text-lg font-semibold text-primary">
                            {t('booking.clickHere')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    key={service.key}
                    className="w-full max-w-4xl flex flex-col gap-6 lg:gap-10 lg:flex-row items-center lg:items-start text-center lg:text-left mx-auto"
                  >
                    {hasImage && (
                      <div className="w-full max-w-xs sm:max-w-sm lg:w-1/3 lg:max-w-md flex justify-center">
                        <div className="w-full aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
                          <img
                            src={service.image}
                            alt={service.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                    <div
                      className={`flex flex-col gap-3 w-full lg:w-2/3 items-start text-left`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-1 h-9 rounded-full bg-primary" aria-hidden="true" />
                        <h3 className="text-xl font-extrabold uppercase text-primary">
                          {service.title}
                        </h3>
                      </div>
                      {service.descriptions.map((description) => (
                        <p
                          key={description.toString()}
                          className="text-lg text-muted-foreground leading-relaxed"
                        >
                          {description}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

