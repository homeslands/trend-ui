import { IApiResponse, ICreatePrinterConnectorRequest, IUpdatePrinterConnectorRequest, IPrinterConnector, IPrinter, IUpdateInvoiceAreaRequest, IUpdatePrinterForInvoiceAreaRequest } from '@/types'
import { ICreateInvoiceAreaRequest, IInvoiceArea, ICreatePrinterForInvoiceAreaRequest } from '@/types'
import { http } from '@/utils'

// PRINTER CONNECTOR API
export async function createPrinterConnectors(params: ICreatePrinterConnectorRequest): Promise<IApiResponse<IPrinterConnector>> {
  const response = await http.post<IApiResponse<IPrinterConnector>>('/printer-connector', params)
  return response.data
}

export async function getPrinterConnectorsByBranch(branchSlug: string): Promise<IApiResponse<IPrinterConnector>> {
  const response = await http.get<IApiResponse<IPrinterConnector>>(`/printer-connector/branch/${branchSlug}`)
  return response.data
}

export async function updatePrinterConnector(slug: string, params: IUpdatePrinterConnectorRequest): Promise<IApiResponse<IPrinterConnector>> {
  const response = await http.patch<IApiResponse<IPrinterConnector>>(`/printer-connector/${slug}`, params)
  return response.data
}

export async function deletePrinterConnector(slug: string): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/printer-connector/${slug}`)
  return response.data
}

// INVOICE AREA API
export async function createInvoiceArea(params: ICreateInvoiceAreaRequest): Promise<IApiResponse<IInvoiceArea>> {
  const response = await http.post<IApiResponse<IInvoiceArea>>('/invoice-area', params)
  return response.data
}

export async function getInvoiceAreasByBranch(branch: string): Promise<IApiResponse<IInvoiceArea[]>> {
  const response = await http.get<IApiResponse<IInvoiceArea[]>>(`/invoice-area/branch/${branch}`)
  return response.data
}

export async function updateInvoiceArea(params: IUpdateInvoiceAreaRequest): Promise<IApiResponse<IInvoiceArea>> {
  const response = await http.patch<IApiResponse<IInvoiceArea>>(`/invoice-area/${params.slug}`, params)
  return response.data
}

export async function deleteInvoiceArea(slug: string): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/invoice-area/${slug}`)
  return response.data
}

// INVOICE AREA PRINTERS API
export async function createPrinterForInvoiceArea(params: ICreatePrinterForInvoiceAreaRequest): Promise<IApiResponse<IPrinter>> {
  const { slug, ...body } = params
  const response = await http.post<IApiResponse<IPrinter>>(`/invoice-area/${slug}/printer`, body)
  return response.data
}

export async function getPrintersForInvoiceArea(slug: string): Promise<IApiResponse<IPrinter[]>> {
  const response = await http.get<IApiResponse<IPrinter[]>>(`/invoice-area/${slug}/printers`)
  return response.data
}

export async function updatePrinterForInvoiceArea(params: IUpdatePrinterForInvoiceAreaRequest): Promise<IApiResponse<IPrinter>> {
  const { slug, printerSlug, ...body } = params
  const response = await http.patch<IApiResponse<IPrinter>>(`/invoice-area/${slug}/printer/${printerSlug}`, body)
  return response.data
}

export async function deletePrinterForInvoiceArea(slug: string, printerSlug: string): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/invoice-area/${slug}/printer/${printerSlug}`)
  return response.data
}

export async function togglePrinterForInvoiceArea(slug: string, printerSlug: string, isActive: boolean): Promise<IApiResponse<IPrinter>> {
  const response = await http.patch<IApiResponse<IPrinter>>(`/invoice-area/${slug}/printer/${printerSlug}/toggle`, { isActive })
  return response.data
}
