import { http } from '@/utils'
import {
  IAllRevenueQuery,
  IApiResponse,
  IBranchRevenue,
  IBranchRevenueQuery,
  ICustomerAccountRevenueQuery,
  ICustomerAccountRevenue,
  IRevenue,
  IRevenueQuery,
} from '@/types'
import { useDownloadStore } from '@/stores'
import { AxiosRequestConfig } from 'axios'
import moment from 'moment'

export async function getRevenue(
  params: IRevenueQuery,
): Promise<IApiResponse<IRevenue[]>> {
  const response = await http.get<IApiResponse<IRevenue[]>>('/revenue', {
    params,
  })
  return response.data
}

export async function getAllRevenue(
  params: IAllRevenueQuery,
): Promise<IApiResponse<IBranchRevenue[]>> {
  const response = await http.get<IApiResponse<IBranchRevenue[]>>(
    `/revenue/from-branch-revenue`,
    {
      params,
    },
  )
  return response.data
}

export async function getBranchRevenue(
  params: IBranchRevenueQuery,
): Promise<IApiResponse<IBranchRevenue[]>> {
  const response = await http.get<IApiResponse<IBranchRevenue[]>>(
    `/revenue/branch/${params.branch}`,
    {
      params,
    },
  )
  return response.data
}

/**
 * Đường dẫn nằm dưới `/user` nhưng hàm này CỐ Ý ở `revenue.ts`, không phải `user.ts`.
 *
 * Convention của dự án là một file một DOMAIN, không phải một file một tiền tố URL — và
 * cả lát cắt dọc của tính năng này đều thuộc domain revenue: type `ICustomerAccountRevenue`
 * (`types/revenue.type.ts`), hook `useCustomerAccountRevenue` (`hooks/use-revenue.ts`),
 * query key `customerAccountRevenue` (`constants/query.ts`). Chuyển riêng hàm này sang
 * `user.ts` sẽ xé lát cắt làm đôi, sửa một tính năng phải nhảy giữa hai domain.
 *
 * `/user` ở đây là lựa chọn routing của backend (route gắn dưới controller `user`), không
 * phải tín hiệu về domain nghiệp vụ.
 */
export async function getCustomerAccountRevenue(
  params: ICustomerAccountRevenueQuery,
): Promise<IApiResponse<ICustomerAccountRevenue>> {
  const response = await http.get<IApiResponse<ICustomerAccountRevenue>>(
    `/user/revenue/account`,
    {
      params,
    },
  )
  return response.data
}

// export async function getLatestRevenue(): Promise<IApiResponse<IRevenue[]>> {
//   const response = await http.patch<IApiResponse<IRevenue[]>>('/revenue/latest')
//   return response.data
// }

export async function getLatestRevenueForARange(
  params: IRevenueQuery,
): Promise<IApiResponse<IRevenue[]>> {
  const response = await http.patch<IApiResponse<IRevenue[]>>('/revenue/date', {
    params,
  })
  return response.data
}

// use for both revenue and branch revenue
export async function getLatestRevenue(): Promise<IApiResponse<void>> {
  const response = await http.patch<IApiResponse<void>>(
    `/revenue/branch/latest`,
  )
  return response.data
}

// use for both revenue and branch revenue
export async function getLatestBranchRevenueForARange(
  params: IBranchRevenueQuery,
): Promise<IApiResponse<IBranchRevenue[]>> {
  const response = await http.patch<IApiResponse<IBranchRevenue[]>>(
    `/revenue/branch/date`,
    {
      params,
    },
  )
  return response.data
}

export async function exportExcelRevenue(params: IRevenueQuery): Promise<Blob> {
  const { setProgress, setFileName, setIsDownloading, reset } =
    useDownloadStore.getState()

  const currentDate = moment().format('dd/MM/yyyy')
  setFileName(`TRENDCoffee-doanh-thu${currentDate}.xlsx`)
  setIsDownloading(true)
  try {
    const response = await http.get(`/revenue/branch/export`, {
      params,
      responseType: 'blob',
      headers: {
        Accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total ?? 1),
        )
        setProgress(percentCompleted)
      },
      doNotShowLoading: true,
    } as AxiosRequestConfig)

    // Create a URL for the blob
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `TRENDCoffee-doanh-thu-${currentDate}.xlsx`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)

    return response.data
  } finally {
    setIsDownloading(false)
    reset()
  }
}

export async function exportProductRevenueToExcel(
  params: IBranchRevenueQuery,
): Promise<Blob> {
  const { setProgress, setFileName, setIsDownloading, reset } =
    useDownloadStore.getState()

  const currentDate = moment().format('dd/MM/yyyy')
  setFileName(`TRENDCoffee-doanh-so-san-pham-${currentDate}.xlsx`)
  setIsDownloading(true)
  try {
    const response = await http.get(
      `/product-analysis/top-sell/branch/${params.branch}/export`,
      {
        params,
        responseType: 'blob',
        headers: {
          Accept:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        onDownloadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total ?? 1),
          )
          setProgress(percentCompleted)
        },
        doNotShowLoading: true,
      } as AxiosRequestConfig,
    )

    // Create a URL for the blob
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `TRENDCoffee-doanh-so-san-pham-${currentDate}.xlsx`,
    )
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)

    return response.data
  } finally {
    setIsDownloading(false)
    reset()
  }
}

export async function exportPDFRevenue(params: IRevenueQuery): Promise<Blob> {
  const { setProgress, setFileName, setIsDownloading, reset } =
    useDownloadStore.getState()
  const currentDate = new Date().toISOString()
  setFileName(`TRENDCoffee-doanh-thu-${currentDate}.pdf`)
  setIsDownloading(true)
  try {
    const response = await http.post(`/revenue/branch/export-pdf`, params, {
      responseType: 'blob',
      headers: {
        Accept: 'application/pdf',
      },
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total ?? 1),
        )
        setProgress(percentCompleted)
      },
      doNotShowLoading: true,
    } as AxiosRequestConfig)

    // create a url for the blob
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `TRENDCoffee-doanh-thu-${currentDate}.pdf`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    return response.data
  } finally {
    setIsDownloading(false)
    reset()
  }
}
