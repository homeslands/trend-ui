import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import {
  applyVoucher,
  createMultipleVoucher,
  createVoucher,
  createVoucherForUserGroup,
  createVoucherGroup,
  deleteVoucher,
  deleteVoucherForUserGroup,
  deleteVoucherPaymentMethod,
  getPublicVouchersForOrder,
  getSpecificPublicVoucher,
  getSpecificVoucher,
  getVoucherGroups,
  getVouchers,
  getVouchersForOrder,
  removeAppliedVoucher,
  updateVoucher,
  updateVoucherGroup,
  updateVoucherGroupApplyTime,
  updateVoucherPaymentMethod,
  validatePublicVoucher,
  validatePublicVoucherPaymentMethod,
  validateVoucher,
  validateVoucherPaymentMethod,
} from '@/api'
import { QUERYKEY } from '@/constants'
import {
  IApplyVoucherRequest,
  ICreateMultipleVoucherRequest,
  ICreateVoucherForUserGroupRequest,
  ICreateVoucherGroupRequest,
  ICreateVoucherRequest,
  IDeleteVoucherForUserGroupRequest,
  IGetAllVoucherGroupRequest,
  IGetAllVoucherRequest,
  IGetSpecificVoucherRequest,
  IRemoveAppliedVoucherRequest,
  IUpdateVoucherGroupApplyTimeRequest,
  IUpdateVoucherGroupRequest,
  IUpdateVoucherPaymentMethodParamToRequest,
  IUpdateVoucherRequest,
  IValidateVoucherPaymentMethodRequest,
  IValidateVoucherRequest,
  IVoucher,
} from '@/types'

export const useVoucherGroups = (
  params?: IGetAllVoucherGroupRequest,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [QUERYKEY.voucherGroups, params],
    queryFn: () => getVoucherGroups(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export const useCreateVoucherGroup = () => {
  return useMutation({
    mutationFn: async (data: ICreateVoucherGroupRequest) => {
      return createVoucherGroup(data)
    },
  })
}

export const useUpdateVoucherGroup = () => {
  return useMutation({
    mutationFn: async (data: IUpdateVoucherGroupRequest) => {
      return updateVoucherGroup(data)
    },
  })
}

// vouchers for management
export const useVouchers = (params?: IGetAllVoucherRequest) => {
  return useQuery({
    queryKey: [QUERYKEY.vouchers, params],
    queryFn: () => getVouchers(params),
    placeholderData: keepPreviousData,
    enabled: !!params,
  })
}

// Vouchers for order
export const useVouchersForOrder = (
  params?: IGetAllVoucherRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: [QUERYKEY.vouchersForOrder, params], // Include params để tự động refetch khi params thay đổi
    queryFn: () => getVouchersForOrder(params),
    placeholderData: keepPreviousData,
    enabled: !!params && !!enabled,
  })
}
export const usePublicVouchersForOrder = (
  params?: IGetAllVoucherRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: [QUERYKEY.vouchers, params], // Include params to automatically refetch when params change
    queryFn: () => getPublicVouchersForOrder(params),
    placeholderData: keepPreviousData,
    enabled: !!params && !!enabled,
  })
}
export const useSpecificVoucher = (
  data: IGetSpecificVoucherRequest,
  enabled?: boolean,
) => {
  const isEnabled = enabled !== undefined 
    ? enabled && Boolean(data?.code || data?.slug)
    : Boolean(data?.code || data?.slug)
  return useQuery({
    queryKey: [QUERYKEY.specificVoucher, data],
    queryFn: () => getSpecificVoucher(data),
    enabled: isEnabled, // chỉ gọi khi có code hoặc slug và enabled = true (nếu được truyền)
  })
}

export const useSpecificPublicVoucher = (data: IGetSpecificVoucherRequest) => {
  return useQuery({
    queryKey: [QUERYKEY.vouchers, data],
    queryFn: () => getSpecificPublicVoucher(data),
    enabled: !!data.code,
  })
}

export const useCreateVoucher = () => {
  return useMutation({
    mutationFn: async (data: ICreateVoucherRequest) => {
      return createVoucher(data)
    },
  })
}

export const useCreateMultipleVoucher = () => {
  return useMutation({
    mutationFn: async (data: ICreateMultipleVoucherRequest) => {
      return createMultipleVoucher(data)
    },
  })
}

export const useUpdateVoucher = () => {
  return useMutation({
    mutationFn: async (data: IUpdateVoucherRequest) => {
      return updateVoucher(data)
    },
  })
}

export const useDeleteVoucher = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteVoucher(slug)
    },
  })
}

export const useValidateVoucher = () => {
  return useMutation({
    mutationFn: async (data: IValidateVoucherRequest) => {
      return validateVoucher(data)
    },
  })
}

export const useValidatePublicVoucher = () => {
  return useMutation({
    mutationFn: async (data: IValidateVoucherRequest) => {
      return validatePublicVoucher(data)
    },
  })
}

export const useValidateVoucherPaymentMethod = () => {
  return useMutation({
    mutationFn: async (data: IValidateVoucherPaymentMethodRequest) => {
      return validateVoucherPaymentMethod(data)
    },
  })
}

export const useValidatePublicVoucherPaymentMethod = () => {
  return useMutation({
    mutationFn: async (data: IValidateVoucherPaymentMethodRequest) => {
      return validatePublicVoucherPaymentMethod(data)
    },
  })
}

export const useApplyVoucher = () => {
  return useMutation({
    mutationFn: async (data: IApplyVoucherRequest) => {
      return applyVoucher(data)
    },
  })
}

export const useRemoveAppliedVoucher = () => {
  return useMutation({
    mutationFn: async (data: IRemoveAppliedVoucherRequest) => {
      return removeAppliedVoucher(data)
    },
  })
}

export const useUpdateVoucherPaymentMethod = () => {
  return useMutation({
    mutationFn: async (data: IUpdateVoucherPaymentMethodParamToRequest) => {
      return updateVoucherPaymentMethod(data)
    },
  })
}

export const useDeleteVoucherPaymentMethod = () => {
  return useMutation({
    mutationFn: async (data: IUpdateVoucherPaymentMethodParamToRequest) => {
      return deleteVoucherPaymentMethod(data)
    },
  })
}

export const useCreateVoucherForUserGroup = () => {
  return useMutation({
    mutationFn: async (data: ICreateVoucherForUserGroupRequest) => {
      return createVoucherForUserGroup(data)
    },
  })
}

export const useDeleteVoucherForUserGroup = () => {
  return useMutation({
    mutationFn: async (data: IDeleteVoucherForUserGroupRequest) => {
      return deleteVoucherForUserGroup(data)
    },
  })
}

export const useUpdateVoucherGroupApplyTime = () => {
  return useMutation({
    mutationFn: async (data: IUpdateVoucherGroupApplyTimeRequest) => {
      return updateVoucherGroupApplyTime(data)
    },
  })
}

/**
 * Tra voucher từ định danh đọc được trên mã QR.
 *
 * Dùng mutation chứ không dùng `useSpecificVoucher`: hook đó là `useQuery`,
 * chỉ chạy theo state, không gọi mệnh lệnh được từ callback quét.
 *
 * Thử `slug` trước rồi mới tới `code`: QR mới mã hoá slug, nhưng nhãn đã in
 * trước tính năng này chỉ chứa code. Thiếu bước hai thì nhãn cũ quét không ra.
 *
 * `ignoreGlobalError` là bắt buộc — nếu để global handler bắt, lần tra `slug`
 * thất bại sẽ bắn toast lỗi trước khi lần tra `code` kịp thành công.
 */
export const useLookupVoucherByQr = () => {
  return useMutation({
    mutationKey: ['lookupVoucherByQr'],
    meta: { ignoreGlobalError: true },
    mutationFn: async ({
      identifier,
      isPublic,
    }: {
      identifier: string
      isPublic: boolean
    }): Promise<IVoucher> => {
      const lookup = isPublic ? getSpecificPublicVoucher : getSpecificVoucher

      // Tra theo SLUG trước vì mã QR in ra chứa slug. Nhánh code giữ lại cho
      // trường hợp nhân viên gõ tay chuỗi in trên nhãn, và cho nhãn in kiểu cũ.
      // Sai thứ tự thì mọi lần quét đều tốn một request hỏng trước.
      const bySlug = await lookup({ slug: identifier }).catch(() => null)
      if (bySlug?.result) return bySlug.result

      const byCode = await lookup({ code: identifier }).catch(() => null)
      if (byCode?.result) return byCode.result

      throw new Error(`Voucher not found for identifier: ${identifier}`)
    },
  })
}
