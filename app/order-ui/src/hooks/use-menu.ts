import {
  createMenu,
  updateMenu,
  deleteMenu,
  getAllMenus,
  getSpecificMenu,
  addMenuItem,
  addMenuItems,
  updateMenuItem,
  deleteMenuItem,
  getSpecificMenuItem,
  getPublicSpecificMenu,
} from '@/api'
import {
  IAddMenuItemRequest,
  ICreateMenuRequest,
  ISpecificMenu,
  ISpecificMenuRequest,
  IUpdateMenuRequest,
  IUpdateMenuItemRequest,
  IAllMenuRequest,
} from '@/types'
import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query'

export const useAllMenus = (q: IAllMenuRequest) => {
  return useQuery({
    queryKey: ['menus', JSON.stringify(q)],
    queryFn: async () => getAllMenus(q),
  })
}

export const useSpecificMenu = (
  query: ISpecificMenuRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: ['specific-menu', query],
    queryFn: async () => getSpecificMenu(query),
    enabled: !!enabled,
  })
}
export const usePublicSpecificMenu = (
  query: ISpecificMenuRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: ['public-specific-menu', query],
    queryFn: async () => getPublicSpecificMenu(query),
    enabled: !!enabled,
  })
}

export const useSpecificMenuInfinite = (
  query: ISpecificMenuRequest,
  enabled?: boolean,
) => {
  return useInfiniteQuery({
    queryKey: ['specific-menu-infinite', query],
    queryFn: async ({ pageParam }) =>
      getSpecificMenu({ ...query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { hasNext, page, totalPages } = lastPage.result
      return hasNext && page < totalPages ? page + 1 : undefined
    },
    enabled: !!enabled,
  })
}

export const usePublicSpecificMenuInfinite = (
  query: ISpecificMenuRequest,
  enabled?: boolean,
) => {
  return useInfiniteQuery({
    queryKey: ['public-specific-menu-infinite', query],
    queryFn: async ({ pageParam }) =>
      getPublicSpecificMenu({ ...query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { hasNext, page, totalPages } = lastPage.result
      return hasNext && page < totalPages ? page + 1 : undefined
    },
    enabled: !!enabled,
  })
}

// The specific-menu endpoint always returns exactly one menu per page (`items[0]`),
// paginating that menu's `menuItems`. Flatten pages into one menu with all items merged.
export function flattenSpecificMenuPages(
  pages: { result: { items: ISpecificMenu[] } }[] | undefined,
): ISpecificMenu | undefined {
  const base = pages?.[0]?.result.items?.[0]
  if (!base) return undefined
  return {
    ...base,
    menuItems: pages!.flatMap((p) => p.result.items?.[0]?.menuItems ?? []),
  }
}

export const useSpecificMenuItem = (slug: string) => {
  return useQuery({
    queryKey: ['specific-menu-item', slug],
    queryFn: async () => getSpecificMenuItem(slug),
  })
}

export const useCreateMenu = () => {
  return useMutation({
    mutationFn: async (data: ICreateMenuRequest) => {
      return createMenu(data)
    },
  })
}

export const useUpdateMenu = () => {
  return useMutation({
    mutationFn: async (data: IUpdateMenuRequest) => {
      return updateMenu(data)
    },
  })
}

export const useDeleteMenu = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteMenu(slug)
    },
  })
}

export const useAddMenuItem = () => {
  return useMutation({
    mutationFn: async (data: IAddMenuItemRequest) => {
      return addMenuItem(data)
    },
  })
}

export const useAddMenuItems = () => {
  return useMutation({
    mutationFn: async (data: IAddMenuItemRequest[]) => {
      return addMenuItems(data)
    },
  })
}

export const useUpdateMenuItem = () => {
  return useMutation({
    mutationFn: async (data: IUpdateMenuItemRequest) => {
      return updateMenuItem(data)
    },
  })
}

export const useDeleteMenuItem = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteMenuItem(slug)
    },
  })
}
