import {
  APPLICABILITY_RULE,
  VOUCHER_CUSTOMER_TYPE,
  VOUCHER_PAYMENT_METHOD,
  VOUCHER_TYPE,
  VOUCHER_USAGE_FREQUENCY_UNIT,
} from '@/constants'
import { z } from 'zod'

export const createVoucherGroupSchema = z.object({
  title: z.string().min(1),
  description: z.optional(z.string()),
})

export const updateVoucherGroupSchema = z.object({
  slug: z.string(),
  title: z.string().min(1),
  description: z.optional(z.string()),
})

export const createVoucherSchema = z
  .object({
    voucherGroup: z.string(),
    title: z.string().min(1),
    applicabilityRule: z.enum([
      APPLICABILITY_RULE.ALL_REQUIRED,
      APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
    ]),
    description: z.optional(z.string()),
    type: z.enum([
      VOUCHER_TYPE.FIXED_VALUE,
      VOUCHER_TYPE.PERCENT_ORDER,
      VOUCHER_TYPE.SAME_PRICE_PRODUCT,
    ]),
    paymentMethods: z
      .array(
        z.enum([
          VOUCHER_PAYMENT_METHOD.CASH,
          VOUCHER_PAYMENT_METHOD.POINT,
          VOUCHER_PAYMENT_METHOD.BANK_TRANSFER,
          VOUCHER_PAYMENT_METHOD.CREDIT_CARD,
        ]),
      )
      .min(1, { message: 'Vui lòng chọn ít nhất một phương thức thanh toán' }),
    code: z.string().min(1),
    value: z
      .union([z.string().regex(/^\d+$/).transform(Number), z.number()])
      .refine((val) => val > 0, {
        message: 'Giá trị phải lớn hơn 0',
      }),
    maxUsage: z.number().int().positive(),
    minOrderValue: z.number().int().nonnegative(),
    isActive: z.boolean(),
    isPrivate: z.boolean(),
    customerType: z.enum([
      VOUCHER_CUSTOMER_TYPE.ALL,
      VOUCHER_CUSTOMER_TYPE.GROUP,
      VOUCHER_CUSTOMER_TYPE.PERSON,
    ]),
    assignedUser: z.string().nullable(),
    maxItems: z.number().int().positive().nullable(),
    startDate: z.string(),
    endDate: z.string(),
    activeStartTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Định dạng giờ không hợp lệ (HH:mm)')
      .nullable(),
    activeEndTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Định dạng giờ không hợp lệ (HH:mm)')
      .nullable(),
    isVerificationIdentity: z.boolean(),
    usageFrequencyUnit: z
      .union([
        z.enum([
          VOUCHER_USAGE_FREQUENCY_UNIT.HOUR,
          VOUCHER_USAGE_FREQUENCY_UNIT.DAY,
          VOUCHER_USAGE_FREQUENCY_UNIT.WEEK,
          VOUCHER_USAGE_FREQUENCY_UNIT.MONTH,
          VOUCHER_USAGE_FREQUENCY_UNIT.YEAR,
        ]),
        z.literal('unlimited'),
      ])
      .nullable(),
    usageFrequencyValue: z
      .union([z.string().regex(/^\d+$/).transform(Number), z.number()])
      .refine((val) => val > 0, {
        message: 'Giá trị phải lớn hơn 0',
      })
      .nullable(),
    numberOfUsagePerUser: z.number().int().positive(),
    products: z.array(z.string()),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
    path: ['endDate'],
  })
  .superRefine((data, ctx) => {
    // Validate percentage value
    if (data.type === VOUCHER_TYPE.PERCENT_ORDER) {
      if (data.value < 1 || data.value > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Giá trị phần trăm phải từ 1 đến 100',
        })
      }
    }
    // Validate maxItems when it's not null
    if (data.maxItems !== null && data.maxItems <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxItems'],
        message: 'Số lượng sản phẩm tối đa phải lớn hơn 0',
      })
    }
    // Validate assignedUser when customerType is PERSON
    if (data.customerType === VOUCHER_CUSTOMER_TYPE.PERSON && !data.assignedUser) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assignedUser'],
        message: 'Vui lòng chọn người dùng khi loại khách hàng là người dùng đơn lẻ',
      })
    }
    // Validate activeStartTime / activeEndTime
    const hasStart = data.activeStartTime !== null && data.activeStartTime !== undefined
    const hasEnd = data.activeEndTime !== null && data.activeEndTime !== undefined
    if (hasStart !== hasEnd) {
      const msg = 'Phải nhập cả giờ bắt đầu và kết thúc'
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeStartTime'], message: msg })
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeEndTime'], message: msg })
    }
    if (hasStart && hasEnd && data.activeStartTime! >= data.activeEndTime!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['activeEndTime'],
        message: 'Giờ bắt đầu phải trước giờ kết thúc',
      })
    }
  })

export const createMultipleVoucherSchema = z
  .object({
    voucherGroup: z.string(),
    numberOfVoucher: z.number().int().positive(),
    title: z.string().min(1),
    applicabilityRule: z.enum([
      APPLICABILITY_RULE.ALL_REQUIRED,
      APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
    ]),
    description: z.optional(z.string()),
    type: z.enum([
      VOUCHER_TYPE.FIXED_VALUE,
      VOUCHER_TYPE.PERCENT_ORDER,
      VOUCHER_TYPE.SAME_PRICE_PRODUCT,
    ]),
    paymentMethods: z
      .array(
        z.enum([
          VOUCHER_PAYMENT_METHOD.CASH,
          VOUCHER_PAYMENT_METHOD.POINT,
          VOUCHER_PAYMENT_METHOD.BANK_TRANSFER,
          VOUCHER_PAYMENT_METHOD.CREDIT_CARD,
        ]),
      )
      .min(1, { message: 'Vui lòng chọn ít nhất một phương thức thanh toán' }),
    startDate: z.string(),
    endDate: z.string(),
    activeStartTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Định dạng giờ không hợp lệ (HH:mm)')
      .nullable(),
    activeEndTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Định dạng giờ không hợp lệ (HH:mm)')
      .nullable(),
    value: z
      .union([z.string().regex(/^\d+$/).transform(Number), z.number()])
      .refine((val) => val > 0, {
        message: 'Giá trị phải lớn hơn 0',
      }),
    minOrderValue: z.number().int().nonnegative(),
    maxUsage: z.number().int().positive(),
    isActive: z.boolean(),
    isPrivate: z.boolean(),
    customerType: z.enum([
      VOUCHER_CUSTOMER_TYPE.ALL,
      VOUCHER_CUSTOMER_TYPE.GROUP,
      VOUCHER_CUSTOMER_TYPE.PERSON,
    ]),
    assignedUser: z.string().nullable(),
    isVerificationIdentity: z.boolean(),
    maxItems: z.number().int().positive().nullable(),
    usageFrequencyUnit: z
      .union([
        z.enum([
          VOUCHER_USAGE_FREQUENCY_UNIT.HOUR,
          VOUCHER_USAGE_FREQUENCY_UNIT.DAY,
          VOUCHER_USAGE_FREQUENCY_UNIT.WEEK,
          VOUCHER_USAGE_FREQUENCY_UNIT.MONTH,
          VOUCHER_USAGE_FREQUENCY_UNIT.YEAR,
        ]),
        z.literal('unlimited'),
      ])
      .nullable(),
    usageFrequencyValue: z
      .union([z.string().regex(/^\d+$/).transform(Number), z.number()])
      .refine((val) => val > 0, {
        message: 'Giá trị phải lớn hơn 0',
      })
      .nullable(),
    numberOfUsagePerUser: z.number().int().positive(),
    products: z.array(z.string()),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
    path: ['endDate'],
  })
  .superRefine((data, ctx) => {
    // Validate percentage value
    if (data.type === VOUCHER_TYPE.PERCENT_ORDER) {
      if (data.value < 1 || data.value > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Giá trị phần trăm phải từ 1 đến 100',
        })
      }
    }
    // Validate maxItems when it's not null
    if (data.maxItems !== null && data.maxItems <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxItems'],
        message: 'Số lượng sản phẩm tối đa phải lớn hơn 0',
      })
    }
    // Validate assignedUser when customerType is PERSON
    if (data.customerType === VOUCHER_CUSTOMER_TYPE.PERSON && !data.assignedUser) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assignedUser'],
        message: 'Vui lòng chọn người dùng khi loại khách hàng là người dùng đơn lẻ',
      })
    }
    // Validate activeStartTime / activeEndTime
    const hasStart = data.activeStartTime !== null && data.activeStartTime !== undefined
    const hasEnd = data.activeEndTime !== null && data.activeEndTime !== undefined
    if (hasStart !== hasEnd) {
      const msg = 'Phải nhập cả giờ bắt đầu và kết thúc'
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeStartTime'], message: msg })
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeEndTime'], message: msg })
    }
    if (hasStart && hasEnd && data.activeStartTime! >= data.activeEndTime!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['activeEndTime'],
        message: 'Giờ bắt đầu phải trước giờ kết thúc',
      })
    }
  })

export const updateVoucherSchema = z
  .object({
    voucherGroup: z.string(),
    slug: z.string(),
    createdAt: z.string(),
    title: z.string().min(1),
    applicabilityRule: z.enum([
      APPLICABILITY_RULE.ALL_REQUIRED,
      APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
    ]),
    description: z.optional(z.string()),
    type: z.enum([
      VOUCHER_TYPE.FIXED_VALUE,
      VOUCHER_TYPE.PERCENT_ORDER,
      VOUCHER_TYPE.SAME_PRICE_PRODUCT,
    ]),
    paymentMethods: z
      .array(
        z.enum([
          VOUCHER_PAYMENT_METHOD.CASH,
          VOUCHER_PAYMENT_METHOD.POINT,
          VOUCHER_PAYMENT_METHOD.BANK_TRANSFER,
          VOUCHER_PAYMENT_METHOD.CREDIT_CARD,
        ]),
      )
      .min(1, { message: 'Vui lòng chọn ít nhất một phương thức thanh toán' }),
    code: z.string().min(1),
    value: z
      .union([z.string().regex(/^\d+$/).transform(Number), z.number()])
      .refine((val) => val > 0, {
        message: 'Giá trị phải lớn hơn 0',
      }),
    maxUsage: z.number().int().positive(),
    minOrderValue: z.number().int().nonnegative(),
    remainingUsage: z.number().int().nonnegative(),
    isActive: z.boolean(),
    isPrivate: z.boolean(),
    customerType: z.enum([
      VOUCHER_CUSTOMER_TYPE.ALL,
      VOUCHER_CUSTOMER_TYPE.GROUP,
      VOUCHER_CUSTOMER_TYPE.PERSON,
    ]),
    assignedUser: z.string().nullable(),
    maxItems: z.number().int().positive().nullable(),
    startDate: z.string(),
    endDate: z.string(),
    activeStartTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Định dạng giờ không hợp lệ (HH:mm)')
      .nullable(),
    activeEndTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Định dạng giờ không hợp lệ (HH:mm)')
      .nullable(),
    isVerificationIdentity: z.boolean(),
    usageFrequencyUnit: z
      .union([
        z.enum([
          VOUCHER_USAGE_FREQUENCY_UNIT.HOUR,
          VOUCHER_USAGE_FREQUENCY_UNIT.DAY,
          VOUCHER_USAGE_FREQUENCY_UNIT.WEEK,
          VOUCHER_USAGE_FREQUENCY_UNIT.MONTH,
          VOUCHER_USAGE_FREQUENCY_UNIT.YEAR,
        ]),
        z.literal('unlimited'),
      ])
      .nullable(),
    usageFrequencyValue: z
      .union([z.string().regex(/^\d+$/).transform(Number), z.number()])
      .refine((val) => val > 0, {
        message: 'Giá trị phải lớn hơn 0',
      })
      .nullable(),
    numberOfUsagePerUser: z.number().int().positive(),
    products: z.array(z.string()),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
    path: ['endDate'],
  })
  .superRefine((data, ctx) => {
    if (data.type === VOUCHER_TYPE.PERCENT_ORDER) {
      if (data.value < 1 || data.value > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Giá trị phần trăm phải từ 1 đến 100',
        })
      }
    }

    if (data.maxUsage < data.remainingUsage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxUsage'],
        message: 'Số lượng tối đa không thể nhỏ hơn số lượng còn lại',
      })
    }

    // Validate maxItems when it's not null
    if (data.maxItems !== null && data.maxItems <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxItems'],
        message: 'Số lượng sản phẩm tối đa phải lớn hơn 0',
      })
    }
    // Validate assignedUser when customerType is PERSON
    if (data.customerType === VOUCHER_CUSTOMER_TYPE.PERSON && !data.assignedUser) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assignedUser'],
        message: 'Vui lòng chọn người dùng khi loại khách hàng là người dùng đơn lẻ',
      })
    }
    // Validate activeStartTime / activeEndTime
    const hasStart = data.activeStartTime !== null && data.activeStartTime !== undefined
    const hasEnd = data.activeEndTime !== null && data.activeEndTime !== undefined
    if (hasStart !== hasEnd) {
      const msg = 'Phải nhập cả giờ bắt đầu và kết thúc'
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeStartTime'], message: msg })
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeEndTime'], message: msg })
    }
    if (hasStart && hasEnd && data.activeStartTime! >= data.activeEndTime!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['activeEndTime'],
        message: 'Giờ bắt đầu phải trước giờ kết thúc',
      })
    }
  })

export const updateVoucherGroupApplyTimeSchema = z
  .object({
    voucherGroup: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
    path: ['endDate'],
  })

export type TCreateVoucherGroupSchema = z.infer<typeof createVoucherGroupSchema>
export type TUpdateVoucherGroupSchema = z.infer<typeof updateVoucherGroupSchema>

export type TCreateVoucherSchema = z.infer<typeof createVoucherSchema>
export type TUpdateVoucherSchema = z.infer<typeof updateVoucherSchema>

export type TCreateMultipleVoucherSchema = z.infer<
  typeof createMultipleVoucherSchema
>

export type TUpdateVoucherGroupApplyTimeSchema = z.infer<
  typeof updateVoucherGroupApplyTimeSchema
>
