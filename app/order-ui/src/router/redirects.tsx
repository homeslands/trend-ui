import { Navigate, useParams } from 'react-router-dom'
import { ROUTE } from '@/constants'

export function RedirectToCustomerGroup() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={`${ROUTE.STAFF_CUSTOMER_AND_MARKETING_CUSTOMER_GROUP}/${slug}`} replace />
}

export function RedirectToVoucherGroup() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={`${ROUTE.STAFF_CUSTOMER_AND_MARKETING_VOUCHER_GROUP}/${slug}`} replace />
}
