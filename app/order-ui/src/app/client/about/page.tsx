import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { HighlightMenu2, HighlightMenu5, FeaturedServices3, FeaturedServices4 } from '@/assets/images'
import { SwiperBanner } from '../home/components'
import { useBanners } from '@/hooks/use-banner'
import { BannerPage } from '@/constants'

export default function AboutPage() {
  const { t } = useTranslation('about')
  const { data: banner } = useBanners({ isActive: true, page: BannerPage.ABOUT })

    //get banner data
    const bannerData = useMemo(() => banner?.result || [], [banner])

const headerSections = [
  {
    key: 'title',
    title: t('about.title'),
    descriptions: [t('about.description'), t('about.description2')],
    titleClass: 'text-4xl font-extrabold uppercase',
    titleColor: 'text-primary',
  },
  {
    key: 'vision',
    title: t('about.vision'),
    descriptions: [t('about.visionDescription')],
    titleClass: 'text-2xl font-bold uppercase',
    titleColor: 'text-primary',
  },
  {
    key: 'mission',
    title: t('about.mission'),
    descriptions: [t('about.missionDescription')],
    titleClass: 'text-2xl font-bold uppercase',
    titleColor: 'text-primary',
  },
]

  const featuredServices = [
    {
      key: 'service-1',
      image: HighlightMenu2,
      title: t('about.featuredServicesTitle1'),
      descriptions: [
        t('about.featuredServicesDescription1'),
        t('about.featuredServicesDescription2'),
      ],
    },
    {
      key: 'service-2',
      image: HighlightMenu5,
      title: t('about.featuredServicesTitle2'),
      descriptions: [t('about.featuredServicesDescription3')],
    },
    {
      key: 'service-3',
      image: FeaturedServices3,
      title: t('about.featuredServicesTitle3'),
      descriptions: [t('about.featuredServicesDescription4')],
    },
    {
      key: 'service-4',
      image: FeaturedServices4,
      title: t('about.featuredServicesTitle4'),
      descriptions: [t('about.featuredServicesDescription5')],
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Section 1: Hero - Full width */}
      <SwiperBanner bannerData={bannerData} />
      <header className="py-6 flex flex-col gap-6">
        <div className="container mx-auto flex flex-col gap-3 text-center">
          <span className={`${headerSections[0].titleClass} ${headerSections[0].titleColor}`}>
            {headerSections[0].title}
          </span>
          <div className="flex flex-col gap-4 text-left text-lg">
            {headerSections[0].descriptions
              .filter(Boolean)
              .map((paragraph, index) => (
                <span key={`title-desc-${index}`} className="text-muted-foreground leading-relaxed">
                  {paragraph}
                </span>
              ))}
          </div>
        </div>
        {headerSections.slice(1).map(({ key, title, descriptions, titleClass, titleColor }) => (
          <div key={key} className="container mx-auto flex items-start gap-3">
            <span className="w-1 h-10 rounded-full bg-primary shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className={`${titleClass} ${titleColor}`}>
                {title}
              </span>
              {descriptions
                .filter(Boolean)
                .map((paragraph, index) => (
                  <span key={`${key}-desc-${index}`} className="text-lg text-muted-foreground leading-relaxed">
                    {paragraph}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </header>
      <main className="container px-4 py-8 mx-auto ql-snow">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col items-center text-center gap-3">
            <h2 className="text-3xl sm:text-3xl font-extrabold uppercase text-primary">
              {t('about.featuredServices')}
            </h2>
          </div>
          <div className="flex flex-col gap-10">
            {featuredServices.map((service, index) => {
              const isReversed = index % 2 === 1
              const hasImage = Boolean(service.image)

              return (
                <div
                  key={service.key}
                  className={`flex flex-col gap-6 lg:gap-10 ${isReversed && hasImage ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center text-center lg:items-start lg:text-left`}
                >
                  {hasImage && (
                    <div className="w-full max-w-xs sm:max-w-sm lg:w-1/4 lg:max-w-md flex justify-center shrink-0">
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
                    className={`flex flex-col gap-3 w-full ${hasImage ? 'lg:flex-1' : 'lg:w-full'} items-center text-center ${
                      isReversed && hasImage ? 'lg:items-end lg:text-right' : 'lg:items-start lg:text-left'
                    }`}
                  >
                    <h3 className="sm:text-2xl text-xl font-bold text-primary">
                      {service.title}
                    </h3>
                    {service.descriptions.map((description) => (
                      <p
                        key={description}
                        className="sm:text-lg text-base text-muted-foreground leading-relaxed"
                      >
                        {description}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

