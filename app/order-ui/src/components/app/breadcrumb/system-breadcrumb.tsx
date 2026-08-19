import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui'
import { useUserStore } from '@/stores'
import { Role, ROUTE } from '@/constants'

const routeNameMap: { [key: string]: string } = {
  orders: 'orders',
  payment: 'payment',
  tracking: 'tracking',
  staff: 'staff',
  menu: 'menu',
  products: 'products',
  tables: 'tables',
  users: 'users',
  catalog: 'catalog',
  branch: 'branch',
  settings: 'settings',
}

// Các path segment tĩnh đã biết (không phải slug động)
const knownStaticSegments = new Set([
  'customer-and-marketing-management', 'voucher-group', 'customer-group',
  'branch-and-system-management', 'menu-and-product-management',
  'customers', 'staff', 'role', 'overview', 'order-management',
  'delivery-management', 'chef-order', 'card-order-management',
  'table', 'menu', 'product', 'gift-card', 'card', 'catalog', 'checkout',
  'system-management', 'area', 'config', 'promotion', 'banner',
  'feature-lock-management', 'system-lock-management',
  'invoice-area',
])

export default function SystemBreadcrumb() {
  const location = useLocation()
  const { t } = useTranslation(['route'])
  const { userInfo } = useUserStore()
  const locationState = location.state as { name?: string } | null

  // Filter out empty segments and clean up path
  const pathnames = location.pathname.split('/').filter((x) => x && x !== 'app' && x !== 'system')

  const getBreadcrumbText = (name: string, index: number) => {
    const key = name.toLowerCase()
    if (routeNameMap[key]) {
      return t(`route.${routeNameMap[key]}`)
    }
    // Segment động (:slug) — dùng state.name nếu có, fallback "Chi tiết"
    if (!knownStaticSegments.has(key)) {
      const isLast = index === pathnames.length - 1
      if (isLast && locationState?.name) return locationState.name
      return t('route.details')
    }
    return t(`route.${key}`, { defaultValue: name })
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink asChild>
            {userInfo?.role?.name === Role.CUSTOMER ? (
              <Link to="/">{t('route.home')}</Link>
            ) : (
              <Link to={ROUTE.OVERVIEW}>{t('route.home')}</Link>
            )}
          </BreadcrumbLink>
        </BreadcrumbItem>
        {pathnames.map((name, index) => {
          const breadcrumbText = getBreadcrumbText(name, index)
          let routeTo = `/system/${pathnames.slice(0, index + 1).join('/')}`
          // Xử lý nested routes dưới customer-and-marketing-management: customer-group và voucher-group
          // link về tab tương ứng thay vì path không tồn tại
          const prevSegment = pathnames[index - 1]
          if (name === 'customer-group' && prevSegment === 'customer-and-marketing-management') {
            routeTo = `${ROUTE.STAFF_CUSTOMER_AND_MARKETING_MANAGEMENT}?tab=customer-group`
          } else if (name === 'voucher-group' && prevSegment === 'customer-and-marketing-management') {
            routeTo = `${ROUTE.STAFF_CUSTOMER_AND_MARKETING_MANAGEMENT}?tab=voucher`
          }
          const isLast = index === pathnames.length - 1

          return (
            <React.Fragment key={name}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{breadcrumbText}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={routeTo}>{breadcrumbText}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
