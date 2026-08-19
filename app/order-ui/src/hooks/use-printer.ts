import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPrinterConnectors,
  getPrinterConnectorsByBranch,
  updatePrinterConnector,
  deletePrinterConnector,
  createInvoiceArea,
  getInvoiceAreasByBranch,
  updateInvoiceArea,
  deleteInvoiceArea,
  createPrinterForInvoiceArea,
  getPrintersForInvoiceArea,
  updatePrinterForInvoiceArea,
  deletePrinterForInvoiceArea,
  togglePrinterForInvoiceArea,
} from '@/api'
import {
  ICreatePrinterConnectorRequest,
  IUpdatePrinterConnectorRequest,
  ICreateInvoiceAreaRequest,
  IUpdateInvoiceAreaRequest,
  ICreatePrinterForInvoiceAreaRequest,
  IUpdatePrinterForInvoiceAreaRequest,
} from '@/types'
import { QUERYKEY } from '@/constants'

// ── Printer Connector ──────────────────────────────────────────────────────
export const useGetPrinterConnectorsByBranch = (branchSlug: string) => {
  return useQuery({
    queryKey: [QUERYKEY.printerConnectors, branchSlug],
    queryFn: () => getPrinterConnectorsByBranch(branchSlug),
    enabled: !!branchSlug,
    meta: { ignoreGlobalError: true },
  })
}

export const useCreatePrinterConnector = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: ICreatePrinterConnectorRequest) => createPrinterConnectors(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.printerConnectors] })
    },
  })
}

export const useUpdatePrinterConnector = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, params }: { slug: string; params: IUpdatePrinterConnectorRequest }) =>
      updatePrinterConnector(slug, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.printerConnectors] })
    },
  })
}

export const useDeletePrinterConnector = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => deletePrinterConnector(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.printerConnectors] })
    },
  })
}

// ── Invoice Area ───────────────────────────────────────────────────────────
export const useGetInvoiceAreasByBranch = (branch: string) => {
  return useQuery({
    queryKey: [QUERYKEY.invoiceAreas, branch],
    queryFn: () => getInvoiceAreasByBranch(branch),
    enabled: !!branch,
  })
}

export const useCreateInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: ICreateInvoiceAreaRequest) => createInvoiceArea(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreas] })
    },
  })
}

export const useUpdateInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: IUpdateInvoiceAreaRequest) => updateInvoiceArea(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreas] })
    },
  })
}

export const useDeleteInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => deleteInvoiceArea(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreas] })
    },
  })
}

// ── Invoice Area Printers ──────────────────────────────────────────────────
export const useGetPrintersForInvoiceArea = (slug: string) => {
  return useQuery({
    queryKey: [QUERYKEY.invoiceAreaPrinters, slug],
    queryFn: () => getPrintersForInvoiceArea(slug),
    enabled: !!slug,
  })
}

export const useCreatePrinterForInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: ICreatePrinterForInvoiceAreaRequest) => createPrinterForInvoiceArea(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreaPrinters] })
    },
  })
}

export const useUpdatePrinterForInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: IUpdatePrinterForInvoiceAreaRequest) => updatePrinterForInvoiceArea(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreaPrinters] })
    },
  })
}

export const useDeletePrinterForInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, printerSlug }: { slug: string; printerSlug: string }) =>
      deletePrinterForInvoiceArea(slug, printerSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreaPrinters] })
    },
  })
}

export const useTogglePrinterForInvoiceArea = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, printerSlug, isActive }: { slug: string; printerSlug: string; isActive: boolean }) =>
      togglePrinterForInvoiceArea(slug, printerSlug, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERYKEY.invoiceAreaPrinters] })
    },
  })
}
