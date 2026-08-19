import { useDownloadStore } from '@/stores'
import { ICardOrderGetRequest, ICardOrderResponse } from '@/types'
import { IPaginationResponse, IApiResponse } from '@/types'
import { http } from '@/utils'
import { AxiosRequestConfig } from 'axios'

export const getCardOrders = async (
  params?: ICardOrderGetRequest,
): Promise<IApiResponse<IPaginationResponse<ICardOrderResponse>>> => {
  const response = await http.get<
    IApiResponse<IPaginationResponse<ICardOrderResponse>>
  >('/card-order', {
    // @ts-expect-error doNotShowLoading is not in AxiosRequestConfig
    doNotShowLoading: true,
    params,
  })
  return response.data as IApiResponse<IPaginationResponse<ICardOrderResponse>>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exportExcel(params: any): Promise<Blob> {
  const { setProgress, setFileName, setIsDownloading, reset } =
    useDownloadStore.getState()

  const currentDate = new Date().toISOString().split('T')[0]
  setFileName(`danh-sach-don-hang-the-qua-tang-${currentDate}.xlsx`)
  setIsDownloading(true)

  try {
    const response = await http.get(`/card-order/export/excel`, {
      params: {
        ...params
      },
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
