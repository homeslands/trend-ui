import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { createCatalog, getCatalog, updateCatalog, deleteCatalog } from '@/api'
import { ICreateCatalogRequest, IUpdateCatalogRequest } from '@/types'

export const useCatalogs = (enabled = true) => {
  return useQuery({
    queryKey: ['catalogs'],
    queryFn: () => getCatalog(),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export const useCreateCatalog = () => {
  return useMutation({
    mutationFn: async (data: ICreateCatalogRequest) => {
      return createCatalog(data)
    },
  })
}

export const useUpdateCatalog = () => {
  return useMutation({
    mutationFn: async (data: IUpdateCatalogRequest) => {
      return updateCatalog(data)
    },
  })
}

export const useDeleteCatalog = () => {
  return useMutation({
    mutationFn: async (catalogSlug: string) => {
      return deleteCatalog(catalogSlug)
    },
  })
}
