import { IBase } from './base.type'

export interface IBranch extends IBase {
  name: string
  address: string
  addressDetail: {
    slug: string
    formattedAddress: string
    lat: number
    lng: number
    url: string
  }
}

export interface ICreateBranchRequest {
  name: string
  address: string
}

export interface IUpdateBranchRequest {
  slug: string
  name: string
  address: string
}

export interface IBranchInfoForDelivery {
  maxDistanceDelivery: number
  deliveryFeePerKm: number
}


export interface ICreateBranchConfigRequest {
  branchSlug: string
  key: string
  value: string
  description?: string
}

export interface IUpdateBranchConfigRequest {
  slug: string
  key: string
  value: string
  description?: string
}

export interface IGetSpecificBranchConfigRequest {
  branchSlug: string
  key?: string
  slug?: string
}

export interface IBranchConfig extends IBase {
  key: string
  value: string
  description?: string
}