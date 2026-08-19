import { http } from '@/utils'
import {
  IApiResponse,
} from '@/types'
import { CardOrderRevenue, ICardOrderRevenueQuery } from '@/types/card-order-revenue.type'
import { useDownloadStore } from '@/stores'
import { AxiosRequestConfig } from 'axios'

export async function getAllCardOrderRevenueApi(
  params: ICardOrderRevenueQuery,
): Promise<IApiResponse<CardOrderRevenue[]>> {
  const response = await http.get<IApiResponse<CardOrderRevenue[]>>('/card-order-revenue', {
    params,
  })
  return response.data
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exportAllCardOrderRevenueApi(params: any): Promise<Blob> {
  const { setProgress, setFileName, setIsDownloading, reset } =
    useDownloadStore.getState()

  const currentDate = new Date().toISOString().split('T')[0]
  setFileName(`card-order-renenue-${currentDate}.xlsx`)
  setIsDownloading(true)

  try {
    const response = await http.post(`/card-order-revenue/export/excel`, { ...params }, {
      responseType: 'blob',
      headers: {
        Accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          )
          setProgress(percentCompleted)
        }
      },
      doNotShowLoading: true,
    } as AxiosRequestConfig)

    return response.data
  } finally {
    setIsDownloading(false)
    reset()
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exportPdfCardOrderRevenueApi(params: any): Promise<Blob> {
  const { setProgress, setFileName, setIsDownloading, reset } =
    useDownloadStore.getState()

  const currentDate = new Date().toISOString().split('T')[0]
  setFileName(`card-order-renenue-${currentDate}.pdf`)
  setIsDownloading(true)

  try {
    const response = await http.post(`/card-order-revenue/export/pdf`, { ...params }, {
      responseType: 'blob',
      headers: {
        Accept: 'application/pdf',
      },
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          )
          setProgress(percentCompleted)
        }
      },
      doNotShowLoading: true,
    } as AxiosRequestConfig)

    return response.data
  } finally {
    setIsDownloading(false)
    reset()
  }
}