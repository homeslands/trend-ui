import { z } from 'zod'
import { PrinterDataType } from '@/constants'

// Printer Connector
export const createPrinterConnectorSchema = z.object({
  branchSlug: z.string().min(1),
  url: z.string().url({ message: 'Invalid URL' }),
  apiKey: z.string().min(1),
})

export const updatePrinterConnectorSchema = z.object({
  slug: z.string().min(1),
  url: z.string().url({ message: 'Invalid URL' }),
  apiKey: z.string().min(1),
})

// Invoice Area
export const createInvoiceAreaSchema = z.object({
  branch: z.string().min(1),
  name: z.string().min(1),
  description: z.optional(z.string()),
})

export const updateInvoiceAreaSchema = z.object({
  slug: z.string().min(1),
  branch: z.string().min(1),
  name: z.string().min(1),
  description: z.optional(z.string()),
})

// Printer in Invoice Area
export const createPrinterForInvoiceAreaSchema = z.object({
  slug: z.string().min(1), // invoice area slug
  name: z.string().min(1),
  ip: z.string().min(1),
  port: z.string().min(1),
  dataType: z.enum([PrinterDataType.TSPL_ZPL, PrinterDataType.ESC_POS]),
  description: z.optional(z.string()),
  printerId: z.string().min(1),
})

export const updatePrinterForInvoiceAreaSchema = z.object({
  slug: z.string().min(1),        // invoice area slug
  printerSlug: z.string().min(1),
  name: z.string().min(1),
  ip: z.string().min(1),
  port: z.string().min(1),
  dataType: z.enum([PrinterDataType.TSPL_ZPL, PrinterDataType.ESC_POS]),
  description: z.optional(z.string()),
  printerId: z.string().min(1),
  isActive: z.boolean(),
})

export type TCreatePrinterConnectorSchema = z.infer<typeof createPrinterConnectorSchema>
export type TUpdatePrinterConnectorSchema = z.infer<typeof updatePrinterConnectorSchema>
export type TCreateInvoiceAreaSchema = z.infer<typeof createInvoiceAreaSchema>
export type TUpdateInvoiceAreaSchema = z.infer<typeof updateInvoiceAreaSchema>
export type TCreatePrinterForInvoiceAreaSchema = z.infer<typeof createPrinterForInvoiceAreaSchema>
export type TUpdatePrinterForInvoiceAreaSchema = z.infer<typeof updatePrinterForInvoiceAreaSchema>
