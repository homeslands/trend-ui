import { IBase } from '@/types'
import { PrinterDataType } from '@/constants'

export interface ICreatePrinterConnectorRequest {
    branchSlug: string
    url: string
    apiKey: string
}

export interface IUpdatePrinterConnectorRequest {
    slug: string
    url: string
    apiKey: string
}

export interface IPrinterConnector extends IBase {
    url: string
    apiKey: string
}

export interface ICreateInvoiceAreaRequest {
  branch: string
  name: string
  description?: string
}

export interface IInvoiceArea extends IBase {
    branch: string
    name: string
    description?: string    
}

export interface IUpdateInvoiceAreaRequest {
    slug: string
    branch: string
    name: string
    description?: string    
}

export interface ICreatePrinterForInvoiceAreaRequest {
    slug: string // slug of the invoice area
    dataType: PrinterDataType
    name: string
    ip: string
    port: string
    description?: string
    printerId: string
}

export interface IUpdatePrinterForInvoiceAreaRequest {
    slug: string // slug of the invoice area
    printerSlug: string // slug of the printer
    printerId: string
    dataType: PrinterDataType
    name: string
    ip: string
    port: string
    description?: string
    isActive: boolean
}

export interface IPrinter extends IBase {
    name: string
    dataType: PrinterDataType
    ip: string
    port: string
    description?: string
    printerId: string
    isActive: boolean
}