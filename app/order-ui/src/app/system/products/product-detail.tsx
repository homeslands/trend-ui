import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import { SquareMenu } from 'lucide-react'
import { useEffect, useState } from 'react'

import { DataTable } from '@/components/ui'
import { useProductBySlug } from '@/hooks'
import { publicFileURL } from '@/constants'
import { ProductImageCarousel, ProductRating } from '.'
import { useProductVariantColumns } from './DataTable/columns'
import { ProductVariantActionOptions } from './DataTable/actions'
import { ProductDetailSkeleton } from '@/components/app/skeleton'
import { UploadMultipleProductImagesDialog } from '@/components/app/dialog'
import {ProductImage} from '@/assets/images'

export default function ProductManagementPage() {
  const { t } = useTranslation(['product'])
  const { t: tHelmet } = useTranslation('helmet')
  const { slug } = useParams()
  const { data: product, isLoading } = useProductBySlug(slug as string)
  const productDetailColumns = useProductVariantColumns()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const productDetail = product?.result
  useEffect(() => {
    if (productDetail?.image) {
      setSelectedImage(productDetail.image)
    } else {
      setSelectedImage(null)
    }
  }, [productDetail?.image])

  if (isLoading) {
    return <ProductDetailSkeleton />
  }

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <Helmet>
        <meta charSet='utf-8' />
        <title>
          {tHelmet('helmet.productDetail.title')}
        </title>
        <meta name='description' content={tHelmet('helmet.productDetail.description')} />
      </Helmet>
      <span className="flex gap-1 items-center text-lg">
        <SquareMenu />
        {t('product.title')}
      </span>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 pb-8 w-full border-b lg:flex-row lg:gap-6">
          <div className="flex flex-col gap-2 w-full lg:w-1/2">
            {productDetail && (
              <img
                src={selectedImage ? `${publicFileURL}/${selectedImage}` : ProductImage}
                alt={productDetail.name}
                className="object-cover w-full h-[15rem] sm:h-[20rem] transition-opacity duration-300 ease-in-out rounded-xl border"
              />
            )}
            <div className='flex justify-center items-center'>
              <ProductImageCarousel
                images={productDetail ? [productDetail.image, ...(productDetail.images || [])] : []}
                onImageClick={setSelectedImage}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full lg:w-1/2 lg:gap-4">
            {productDetail && (
              <>
                <div className='flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center'>
                  <h1 className="text-2xl sm:text-3xl font-semibold break-words">
                    {productDetail.name}
                  </h1>
                  <div className="flex-shrink-0">
                    <UploadMultipleProductImagesDialog product={productDetail} />
                  </div>
                </div>
                <p className="text-sm sm:text-md text-muted-foreground break-words">
                  {productDetail.description}
                </p>
                <div className="mt-1">
                  <ProductRating rating={productDetail.rating} />
                </div>
              </>
            )}
          </div>
        </div>
        <span className="text-xl font-semibold">
          {t('product.variant')}
        </span>
        <div className="w-full overflow-x-auto">
          <DataTable
            columns={productDetailColumns}
            data={productDetail?.variants || []}
            isLoading={isLoading}
            pages={1}
            onPageChange={() => { }}
            onPageSizeChange={() => { }}
            actionOptions={ProductVariantActionOptions}
          />
        </div>
      </div>
    </div>
  )
}
