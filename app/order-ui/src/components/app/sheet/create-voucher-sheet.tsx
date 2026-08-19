import { useCallback, useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { User2Icon, CircleX } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  ScrollArea,
  Input,
  SheetFooter,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Form,
  Switch,
  DataTable,
} from '@/components/ui'
import { CreateVoucherDialog } from '@/components/app/dialog'
import { ICreateVoucherRequest, IUserInfo } from '@/types'
import { DateAndTimePicker, TimeOnlyPicker } from '../picker'
import { createVoucherSchema, TCreateVoucherSchema } from '@/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { VoucherApplicabilityRuleSelect, VoucherPaymentMethodSelect, VoucherTypeSelect, VoucherUsageFrequencyRuleSelect, VoucherCustomerTypeSelect } from '../select'
import { APPLICABILITY_RULE, VOUCHER_CUSTOMER_TYPE, VOUCHER_PAYMENT_METHOD, VOUCHER_TYPE, VOUCHER_USAGE_FREQUENCY_UNIT, Role } from '@/constants'
import { useProductColumns } from '@/app/system/voucher/DataTable/columns'
import { useCatalogs, useProducts, useUsers, useDebouncedInput } from '@/hooks'
import { ProductFilterOptions } from '@/app/system/products/DataTable/actions'

export default function CreateVoucherSheet({ onSuccess, isOpen, openChange }: { onSuccess: () => void, isOpen: boolean, openChange: (open: boolean) => void }) {
  const { slug } = useParams()
  const { t } = useTranslation(['voucher'])
  const { t: tCustomer } = useTranslation(['customer'])
  const { t: tCommon } = useTranslation(['common'])
  const [isOpenDialog, setIsOpenDialog] = useState(false)
  const [formData, setFormData] = useState<ICreateVoucherRequest | null>(null)
  const [catalog, setCatalog] = useState<string | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]) // State để lưu danh sách sản phẩm đã chọn qua tất cả các trang
  const [isMaxItemsEnabled, setIsMaxItemsEnabled] = useState(false)
  const [isActiveTimeEnabled, setIsActiveTimeEnabled] = useState(false)
  const [maxItemsInputValue, setMaxItemsInputValue] = useState<string>('') // State tạm thời để lưu giá trị input khi user đang nhập
  const [sheetPagination, setSheetPagination] = useState({
    pageIndex: 1,
    pageSize: 10
  })
  const [isUsageFrequencyEnabled, setIsUsageFrequencyEnabled] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string | null>(null) // State để lưu user slug đã chọn
  const [selectedUserInfo, setSelectedUserInfo] = useState<IUserInfo | null>(null) // State để lưu thông tin user đã chọn
  const [users, setUsers] = useState<IUserInfo[]>([]) // State để lưu danh sách users từ search
  const [userPagination, setUserPagination] = useState({
    pageIndex: 1,
    pageSize: 10
  })
  const userListRef = useRef<HTMLDivElement>(null)
  const { inputValue, setInputValue, debouncedInputValue } = useDebouncedInput({
    defaultValue: '',
    delay: 500
  })

  // Helper function to format date consistently
  const formatDateForForm = (date: Date): string => {
    return format(date, 'yyyy-MM-dd HH:mm:ss')
  }

  const { data: catalogs } = useCatalogs()

  // const [sheetOpen, setSheetOpen] = useState(openChange)
  const form = useForm<TCreateVoucherSchema>({
    resolver: zodResolver(createVoucherSchema),
    defaultValues: {
      voucherGroup: slug as string,
      title: '',
      applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
      description: '',
      type: VOUCHER_TYPE.PERCENT_ORDER,
      paymentMethods: [VOUCHER_PAYMENT_METHOD.CASH],
      startDate: formatDateForForm(new Date()),
      endDate: formatDateForForm(new Date()),
      code: '',
      value: 0,
      isActive: false,
      isPrivate: false,
      customerType: VOUCHER_CUSTOMER_TYPE.ALL,
      assignedUser: null,
      numberOfUsagePerUser: 1,
      maxUsage: 0,
      minOrderValue: 0,
      isVerificationIdentity: true,
      usageFrequencyUnit: null,
      usageFrequencyValue: null,
      maxItems: null,
      activeStartTime: null,
      activeEndTime: null,
      products: []
    }
  })

  const customerType = form.watch('customerType')

  const { data: products, isLoading } = useProducts({
    page: sheetPagination.pageIndex,
    size: sheetPagination.pageSize,
    hasPaging: true,
    catalog: catalog || undefined,
  },
    !!isOpen
  )

  // Search user by phone number - chỉ search khi có debouncedInputValue
  const shouldSearchUser = Boolean(
    customerType === VOUCHER_CUSTOMER_TYPE.PERSON && 
    isOpen && 
    !selectedUser && 
    debouncedInputValue && 
    debouncedInputValue.trim().length > 0
  )

  const { data: userByPhoneNumber, isLoading: isLoadingUsers } = useUsers(
    shouldSearchUser
      ? {
          page: userPagination.pageIndex,
          size: userPagination.pageSize,
          order: 'DESC',
          phonenumber: debouncedInputValue.trim(),
          hasPaging: true,
          role: Role.CUSTOMER,
        }
      : null,
    shouldSearchUser
  )

  const productsData = products?.result.items
  const catalogsData = catalogs?.result

  // Cập nhật danh sách users từ API response
  useEffect(() => {
    if (debouncedInputValue === '') {
      setUsers([])
    } else if (userByPhoneNumber?.result?.items) {
      if (userPagination.pageIndex === 1) {
        setUsers(userByPhoneNumber.result.items)
      } else {
        setUsers(prev => [...prev, ...userByPhoneNumber.result.items])
      }
    }
  }, [debouncedInputValue, userByPhoneNumber, userPagination.pageIndex])

  // Reset state when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setIsMaxItemsEnabled(false)
      setMaxItemsInputValue('')
      setIsUsageFrequencyEnabled(true)
      setCatalog(null)
      setSelectedProducts([])
      setSelectedUser(null)
      setSelectedUserInfo(null)
      setInputValue('')
      setUsers([])
      setUserPagination({
        pageIndex: 1,
        pageSize: 10
      })
      setSheetPagination({
        pageIndex: 1,
        pageSize: 10
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Reset selectedUser when customerType changes
  useEffect(() => {
    if (customerType !== VOUCHER_CUSTOMER_TYPE.PERSON) {
      setSelectedUser(null)
      setSelectedUserInfo(null)
      setInputValue('')
      setUsers([])
      form.setValue('assignedUser', null)
      setUserPagination({
        pageIndex: 1,
        pageSize: 10
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerType, form])

  // Sync maxItemsInputValue với field.value khi switch được bật
  const maxItemsValue = form.watch('maxItems')
  useEffect(() => {
    if (isMaxItemsEnabled && maxItemsValue !== null && maxItemsValue !== undefined) {
      setMaxItemsInputValue(maxItemsValue.toString())
    } else if (!isMaxItemsEnabled) {
      setMaxItemsInputValue('')
    }
  }, [isMaxItemsEnabled, maxItemsValue])

  const usageFrequencyUnitValue = form.watch('usageFrequencyUnit')
  useEffect(() => {
    if (usageFrequencyUnitValue === 'unlimited' || usageFrequencyUnitValue === null) {
      setIsUsageFrequencyEnabled(false)
    } else {
      setIsUsageFrequencyEnabled(true)
    }
  }, [usageFrequencyUnitValue])

  const handlePageSizeChange = useCallback((size: number) => {
    setSheetPagination(() => ({
      pageIndex: 1, // Reset to first page when changing page size
      pageSize: size
    }))
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setSheetPagination(prev => ({
      ...prev,
      pageIndex: page
    }))
  }, [])

  const disableStartDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  const disableEndDate = (date: Date) => {
    const startDate = form.getValues('startDate')
    if (!startDate) return false

    const selectedStartDate = new Date(startDate)

    // Nếu là ngày khác thì chỉ so sánh ngày
    const dateOnly = new Date(date)
    dateOnly.setHours(0, 0, 0, 0)
    const startDateOnly = new Date(selectedStartDate)
    startDateOnly.setHours(0, 0, 0, 0)

    // Disable nếu ngày endDate < ngày startDate
    return dateOnly < startDateOnly
  }

  const handleDateChange = (fieldName: 'startDate' | 'endDate', date: string | null) => {
    form.setValue(fieldName, date || '')

    // Nếu thay đổi startDate, kiểm tra và cập nhật endDate nếu cần
    if (fieldName === 'startDate') {
      const currentEndDate = form.getValues('endDate')
      if (currentEndDate && new Date(currentEndDate) < new Date(date || '')) {
        form.setValue('endDate', date || '')
      }
    }

    // Nếu thay đổi endDate, kiểm tra với startDate
    if (fieldName === 'endDate' && date) {
      const currentStartDate = form.getValues('startDate')
      if (currentStartDate) {
        const startDateTime = new Date(currentStartDate)
        const endDateTime = new Date(date)

        // Nếu endDate < startDate (cả ngày và giờ), set endDate = startDate
        if (endDateTime < startDateTime) {
          form.setValue('endDate', currentStartDate)
        }
      }
    }
  }

  const handleSelectionChange = (selectedSlugs: string[]) => {
    setSelectedProducts(selectedSlugs) // Cập nhật state selectedProducts
    form.setValue('products', selectedSlugs)
  }

  const handleUserSelectionChange = useCallback((user: IUserInfo) => {
    setSelectedUser(user.slug)
    setSelectedUserInfo(user)
    form.setValue('assignedUser', user.slug)
    form.clearErrors('assignedUser') // Clear validation error khi chọn user
    setUsers([]) // Clear dropdown sau khi chọn
    setInputValue('') // Clear input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const handleClearUserSelection = () => {
    setSelectedUser(null)
    setSelectedUserInfo(null)
    setInputValue('')
    setUsers([])
    form.setValue('assignedUser', null)
    setUserPagination({
      pageIndex: 1,
      pageSize: 10
    })
  }

  // Xử lý scroll để load more users
  const handleUserListScroll = () => {
    if (userListRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = userListRef.current
      if (scrollTop + clientHeight >= scrollHeight - 20) {
        // Kiểm tra xem còn trang tiếp theo không
        const totalPages = userByPhoneNumber?.result?.totalPages || 1
        if (userPagination.pageIndex < totalPages) {
          setUserPagination(prev => ({
            ...prev,
            pageIndex: prev.pageIndex + 1
          }))
        }
      }
    }
  }

  // Reset pagination khi debouncedInputValue thay đổi
  useEffect(() => {
    if (debouncedInputValue) {
      setUserPagination({
        pageIndex: 1,
        pageSize: 10
      })
      setUsers([])
    }
  }, [debouncedInputValue])

  // Clear users và selection khi input được xóa
  useEffect(() => {
    if (inputValue === '') {
      setUsers([])
      if (!selectedUser) {
        setUserPagination({
          pageIndex: 1,
          pageSize: 10
        })
      }
    }
  }, [inputValue, selectedUser])

  const filterConfig = [
    {
      id: 'catalog',
      label: t('catalog.title'),
      options: [
        { label: tCommon('dataTable.all'), value: 'all' },
        ...(catalogsData?.map(catalog => ({
          label: catalog.name.charAt(0).toUpperCase() + catalog.name.slice(1),
          value: catalog.slug,
        })) || []),
      ],
    },
  ]

  const handleFilterChange = (filterId: string, value: string) => {
    if (filterId === 'catalog') {
      setCatalog(value === 'all' ? null : value)
    }
  }

  const handleSubmit = (data: ICreateVoucherRequest) => {
    const payload = {
      ...data,
      usageFrequencyUnit: isUsageFrequencyEnabled
        ? data.usageFrequencyUnit
        : ('unlimited' as unknown as VOUCHER_USAGE_FREQUENCY_UNIT),
      usageFrequencyValue: isUsageFrequencyEnabled ? data.usageFrequencyValue : null,
    }
    setFormData(payload)
    setIsOpenDialog(true)
  }

  const resetForm = () => {
    form.reset({
      voucherGroup: slug as string,
      title: '',
      description: '',
      applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
      type: VOUCHER_TYPE.PERCENT_ORDER,
      paymentMethods: [VOUCHER_PAYMENT_METHOD.CASH],
      startDate: formatDateForForm(new Date()),
      endDate: formatDateForForm(new Date()),
      code: '',
      value: 0,
      isActive: false,
      isPrivate: false,
      customerType: VOUCHER_CUSTOMER_TYPE.ALL,
      assignedUser: null,
      numberOfUsagePerUser: 1,
      maxUsage: 0,
      minOrderValue: 0,
      isVerificationIdentity: true,
      products: [],
      usageFrequencyUnit: 'unlimited' as unknown as VOUCHER_USAGE_FREQUENCY_UNIT,
      usageFrequencyValue: null,
      maxItems: null,
    })
    setSelectedProducts([]) // Reset danh sách sản phẩm đã chọn
    setIsMaxItemsEnabled(false) // Reset switch
    form.setValue('activeStartTime', null)
    form.setValue('activeEndTime', null)
    setIsActiveTimeEnabled(false)
    setMaxItemsInputValue('') // Reset input value
    setIsUsageFrequencyEnabled(true)
    setSelectedUser(null) // Reset selected user
    setSelectedUserInfo(null) // Reset selected user info
    setInputValue('') // Reset phone input
    setUsers([]) // Reset users list
    setUserPagination({
      pageIndex: 1,
      pageSize: 10
    })
  }

  const formFields = {
    name: (
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 items-center'>
              <span className="text-destructive">
                *
              </span>
              {t('voucher.name')}</FormLabel>
            <FormControl>
              <Input {...field} placeholder={t('voucher.enterVoucherName')} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    description: (
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 items-center'>
              {t('voucher.description')}</FormLabel>
            <FormControl>
              <Input {...field} placeholder={t('voucher.enterVoucherDescription')} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    startDate: (
      <FormField
        control={form.control}
        name="startDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 items-center'>
              <span className="text-destructive">
                *
              </span>
              {t('voucher.startDate')}</FormLabel>
            <FormControl>
              <DateAndTimePicker
                date={field.value}
                onSelect={(date) => handleDateChange('startDate', date)}
                disabledDates={disableStartDate}
                showTime={true}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    endDate: (
      <FormField
        control={form.control}
        name="endDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 items-center'>
              <span className="text-destructive">
                *
              </span>
              {t('voucher.endDate')}</FormLabel>
            <FormControl>
              <DateAndTimePicker
                date={field.value}
                onSelect={(date) => handleDateChange('endDate', date)}
                disabledDates={disableEndDate}
                showTime={true}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    type: (
      <FormField
        control={form.control}
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 items-center'>
              <span className="text-destructive">
                *
              </span>
              {t('voucher.type')}</FormLabel>
            <FormControl>
              <VoucherTypeSelect
                {...field}
                onChange={(value) => {
                  field.onChange(value);
                  form.setValue('value', 0); // Reset value when type changes
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    paymentMethods: (
      <FormField
        control={form.control}
        name="paymentMethods"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 items-center'>
              <span className="text-destructive">
                *
              </span>
              {t('voucher.paymentMethods')}</FormLabel>
            <FormControl>
              <VoucherPaymentMethodSelect
                {...field}
                onChange={(value) => {
                  field.onChange(value);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    applicabilityRule: (
      <FormField
        control={form.control}
        name="applicabilityRule"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 items-center'>
              <span className="text-destructive">
                *
              </span>
              {t('voucher.applicabilityRule')}</FormLabel>
            <FormControl>
              <VoucherApplicabilityRuleSelect
                {...field}
                onChange={(value) => {
                  field.onChange(value);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    usageFrequencyUnit: (
      <FormField
        control={form.control}
        name="usageFrequencyUnit"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex items-center justify-between gap-2'>
              <div className='flex gap-1 items-center'>
                <span className="text-destructive">
                  *
                </span>
                {t('voucher.usageFrequencyUnit')}
              </div>
              <Switch
                id="usage-frequency-enabled"
                checked={isUsageFrequencyEnabled}
                onCheckedChange={(checked) => {
                  setIsUsageFrequencyEnabled(checked)
                  if (checked) {
                    const currentUnit = form.getValues('usageFrequencyUnit')
                    const nextUnit =
                      currentUnit && currentUnit !== 'unlimited'
                        ? currentUnit
                        : VOUCHER_USAGE_FREQUENCY_UNIT.DAY
                    field.onChange(nextUnit)
                    const currentValue = form.getValues('usageFrequencyValue')
                    form.setValue('usageFrequencyValue', currentValue ?? 1)
                  } else {
                    field.onChange('unlimited' as unknown as VOUCHER_USAGE_FREQUENCY_UNIT)
                    form.setValue('usageFrequencyValue', null as unknown as number)
                  }
                }}
              />
            </FormLabel>
            <FormControl>
              {isUsageFrequencyEnabled && (
                <VoucherUsageFrequencyRuleSelect
                  {...field}
                  onChange={(value) => {
                    field.onChange(value);
                  }}
                />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    usageFrequencyValue: isUsageFrequencyEnabled ? (
      <FormField
        control={form.control}
        name="usageFrequencyValue"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 mt-2 items-center'>
              <span className="text-destructive">
                *
              </span>
              {t('voucher.usageFrequencyValue')}</FormLabel>
            <FormControl>
              <Input
                type="number"
                {...field}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(value === '' ? '' : Number(value));
                }}
                className='text-sm'
                value={field.value?.toString() ?? ''}
                min={0}
                placeholder={t('voucher.enterUsageFrequencyValue')}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ) : null,
    maxItems: (
      <FormField
        control={form.control}
        name="maxItems"
        render={({ field }) => (
          <FormItem className='flex flex-col gap-2'>
            <FormLabel className='flex items-center justify-between gap-2'>
              <div className='flex gap-1 items-center'>
                <span className="text-destructive">
                  *
                </span>
                {t('voucher.maxItems')}
              </div>
              <Switch
                id="max-items-enabled"
                checked={isMaxItemsEnabled}
                onCheckedChange={(checked) => {
                  setIsMaxItemsEnabled(checked)
                  if (checked) {
                    // Khi bật switch, set giá trị mặc định là 1 nếu chưa có giá trị
                    const currentValue = form.getValues('maxItems')
                    if (currentValue === null || currentValue === undefined) {
                      field.onChange(1)
                      setMaxItemsInputValue('1')
                    } else {
                      setMaxItemsInputValue(currentValue.toString())
                    }
                  } else {
                    // Khi tắt switch, set về null
                    field.onChange(null)
                    setMaxItemsInputValue('')
                  }
                }}
              />
            </FormLabel>
            <FormControl>
              <div className="flex flex-col gap-2">
                {isMaxItemsEnabled && (
                  <Input
                    type="number"
                    onChange={(e) => {
                      const value = e.target.value;
                      // Cập nhật state tạm thời để hiển thị giá trị user đang nhập
                      setMaxItemsInputValue(value)

                      // Chỉ cập nhật field.value khi có giá trị hợp lệ
                      if (value === '') {
                        // Cho phép input rỗng tạm thời, không set field.value
                        // User có thể đang xóa để nhập số mới
                      } else {
                        const numValue = Number(value);
                        if (numValue > 0) {
                          field.onChange(numValue);
                        }
                        // Nếu số <= 0, không cập nhật field.value nhưng vẫn giữ input value để user có thể tiếp tục nhập
                      }
                    }}
                    onBlur={(e) => {
                      // Khi blur (mất focus), validate và xử lý giá trị
                      const value = e.target.value;
                      if (value === '') {
                        // Nếu input rỗng khi blur, set giá trị mặc định là 1 để giữ switch bật
                        // User có thể đang xóa để nhập số mới, không nên tắt switch
                        field.onChange(1)
                        setMaxItemsInputValue('1')
                      } else {
                        const numValue = Number(value);
                        if (numValue > 0) {
                          field.onChange(numValue);
                          setMaxItemsInputValue(numValue.toString())
                        } else {
                          // Nếu giá trị không hợp lệ (<= 0), set giá trị mặc định là 1
                          field.onChange(1)
                          setMaxItemsInputValue('1')
                        }
                      }
                    }}
                    className='text-sm'
                    value={maxItemsInputValue}
                    min={1}
                    placeholder={t('voucher.enterMaxItems')}
                  />
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    code: (
      <FormField
        control={form.control}
        name="code"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 items-center'>
              <span className="text-destructive">
                *
              </span>
              {t('voucher.code')}</FormLabel>
            <FormControl>
              <Input
                type="text"
                {...field}
                placeholder={t('voucher.enterVoucherCode')}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    value: (
      <FormField
        control={form.control}
        name="value"
        render={({ field }) => (
          <FormItem className='flex flex-col justify-between'>
            <FormLabel className='flex gap-1 items-center'>
              <span className="text-destructive">
                *
              </span>
              {t('voucher.value')}</FormLabel>
            <FormControl>
              {form.watch('type') === VOUCHER_TYPE.PERCENT_ORDER ? (
                <div className='relative'>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        field.onChange('');
                      } else {
                        field.onChange(Number(value));
                      }
                    }}
                    className='text-sm'
                    value={field.value === 0 ? '' : field.value}
                    min={0}
                    max={100}
                    placeholder={t('voucher.enterVoucherValue')}
                  />
                  <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                    %
                  </span>
                </div>
              ) : form.watch('type') === VOUCHER_TYPE.FIXED_VALUE ? (
                <div className='relative'>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value === '' ? '' : Number(value));
                    }}
                    className='text-sm'
                    value={field.value?.toString() ?? ''} // convert number -> string
                    placeholder={t('voucher.enterVoucherValue')}
                  />
                  <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                    ₫
                  </span>
                </div>
              ) : form.watch('type') === VOUCHER_TYPE.SAME_PRICE_PRODUCT ? (
                <div className='relative'>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        field.onChange('');
                      } else {
                        field.onChange(Number(value));
                      }
                    }}
                    className='text-sm'
                    value={field.value === 0 ? '' : field.value}
                    placeholder={t('voucher.enterFixedProductPrice')}
                  />
                  <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                    ₫
                  </span>
                </div>
              ) : null}

            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    maxUsage: (
      <FormField
        control={form.control}
        name="maxUsage"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 items-center'>
              <span className="text-destructive">
                *
              </span>
              {t('voucher.voucherMaxUsage')}</FormLabel>
            <FormControl>
              <Input
                type="number"
                {...field}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(value === '' ? '' : Number(value));
                }}
                className='text-sm'
                value={field.value?.toString() ?? ''} // convert number -> string
                min={0}
                placeholder={t('voucher.enterVoucherMaxUsage')}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    numberOfUsagePerUser: (
      <FormField
        control={form.control}
        name="numberOfUsagePerUser"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 items-center'>
              <span className="text-destructive">
                *
              </span>
              {t('voucher.numberOfUsagePerUser')}</FormLabel>
            <FormControl>
              <div className='relative'>
                <Input
                  placeholder={t('voucher.enterNumberOfUsagePerUser')}
                  type="number"
                  {...field}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value === '' ? '' : Number(value));
                  }}
                  className='text-sm'
                  value={field.value?.toString() ?? ''} // convert number -> string
                />
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  {t('voucher.usage')}
                </span>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    minOrderValue: (
      <FormField
        control={form.control}
        name="minOrderValue"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 items-center'>
              <span className="text-destructive">
                *
              </span>
              {t('voucher.minOrderValue')}</FormLabel>
            <FormControl>
              <div className='relative'>
                <Input
                  placeholder={t('voucher.enterMinOrderValue')}
                  type="number"
                  {...field}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value === '' ? '' : Number(value));
                  }}
                  className='text-sm'
                  value={field.value?.toString() ?? ''} // convert number -> string
                />
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  ₫
                </span>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    isVerificationIdentity: (
      <FormField
        control={form.control}
        name="isVerificationIdentity"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex gap-1 items-center">
              <span className="text-destructive">*</span>
              {t('voucher.isVerificationIdentity')}
            </FormLabel>
            <FormControl>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-verification-identity"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    isPrivate: (
      <FormField
        control={form.control}
        name="isPrivate"
        render={({ field }) => (
          <FormItem className='flex flex-col gap-1'>
            <FormLabel className="flex gap-1 items-center">
              <span className="text-destructive">*</span>
              {t('voucher.isPrivate')}
            </FormLabel>

            <FormControl>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-private"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    customerType: (
      <FormField
        control={form.control}
        name="customerType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex gap-1 items-center">
              <span className="text-destructive">*</span>
              {t('voucher.customerType')}
            </FormLabel>
            <FormControl>
              <VoucherCustomerTypeSelect
                {...field}
                onChange={(value) => {
                  field.onChange(value);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
  }

  const handleCreateVoucherSuccess = () => {
    resetForm()
    onSuccess()
  }

  return (
    <Sheet open={isOpen} onOpenChange={openChange}>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">
            {t('voucher.create')}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden backdrop-blur-md bg-background">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] gap-4 p-4 bg-transparent">
            {/* Voucher name and description */}
            <div className="flex flex-col flex-1">
              <Form {...form}>
                <form id="voucher-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  {/* Nhóm: Tên và Mô tả */}
                  <div className={`p-4 bg-white rounded-md border dark:bg-transparent`}>
                    <div className="grid grid-cols-1 gap-2">
                      {formFields.name}
                      {formFields.description}
                    </div>
                  </div>

                  {/* Nhóm: Ngày bắt đầu và Kết thúc */}
                  <div className={`grid grid-cols-2 gap-2 p-4 bg-white rounded-md border dark:bg-transparent`}>
                    {formFields.startDate}
                    {formFields.endDate}
                  </div>

                  {/* Active Time Frame */}
                  <div className="p-4 bg-white rounded-md border dark:bg-transparent">
                    <FormItem>
                      <FormLabel className="flex items-center justify-between gap-2">
                        <span>{t('voucher.applyTimeFrame')}</span>
                        <Switch
                          checked={isActiveTimeEnabled}
                          onCheckedChange={(checked) => {
                            setIsActiveTimeEnabled(checked)
                            if (!checked) {
                              form.setValue('activeStartTime', null)
                              form.setValue('activeEndTime', null)
                            } else {
                              form.setValue('activeStartTime', '08:00')
                              form.setValue('activeEndTime', '22:00')
                            }
                          }}
                        />
                      </FormLabel>
                      {isActiveTimeEnabled && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="activeStartTime"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('voucher.activeStartTime')}</FormLabel>
                                <FormControl>
                                  <TimeOnlyPicker
                                    value={field.value}
                                    onSelect={(val) => field.onChange(val)}
                                    clearable
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="activeEndTime"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('voucher.activeEndTime')}</FormLabel>
                                <FormControl>
                                  <TimeOnlyPicker
                                    value={field.value}
                                    onSelect={(val) => field.onChange(val)}
                                    clearable
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </FormItem>
                  </div>

                  {/* Nhóm: Quy tắc áp dụng & Loại voucher & Tần suất sử dụng */}
                  <div className={`grid grid-cols-2 gap-2 p-4 bg-white rounded-md border dark:bg-transparent`}>
                    {formFields.applicabilityRule}
                    {formFields.type}
                  </div>

                  {/* Nhóm: Tần suất sử dụng */}
                  <div className={`grid grid-cols-1 gap-2 p-4 bg-white rounded-md border dark:bg-transparent`}>
                    {formFields.usageFrequencyUnit}
                    {formFields.usageFrequencyValue}
                  </div>

                  {/* Nhóm: Số lượng sản phẩm tối đa */}
                  <div className={`grid grid-cols-1 gap-2 p-4 bg-white rounded-md border dark:bg-transparent`}>
                    {formFields.maxItems}
                  </div>

                  {/* Nhóm: Mã phương thức thanh toán */}
                  <div className={`grid grid-cols-1 gap-2 p-4 bg-white rounded-md border dark:bg-transparent`}>
                    {formFields.paymentMethods}
                  </div>

                  {/* Nhóm: Code */}
                  <div className={`grid grid-cols-2 gap-2 p-4 bg-white rounded-md border dark:bg-transparent`}>
                    {formFields.code}
                    {formFields.value}
                  </div>

                  {/* Nhóm: Giá trị đơn hàng tối thiểu */}
                  <div className={`grid grid-cols-1 gap-2 p-4 bg-white rounded-md border dark:bg-transparent`}>
                    {formFields.minOrderValue}
                  </div>
                  {/* Nhóm: Số lượng sử dụng */}
                  <div className={`grid grid-cols-2 gap-2 p-4 bg-white rounded-md border dark:bg-transparent`}>
                    {formFields.maxUsage}
                    {formFields.numberOfUsagePerUser}
                  </div>
                  {/* Nhóm: Sản phẩm */}
                  <div className={`grid grid-cols-1 gap-2 p-4 bg-white rounded-md border dark:bg-transparent`}>
                    <div className='flex justify-between items-center'>
                      <span className='text-sm font-medium'>
                        {t('voucher.products')}
                      </span>
                      {selectedProducts.length > 0 && (
                        <span className='px-2 py-1 text-xs rounded-full text-muted-foreground bg-primary/10'>
                          {selectedProducts.length} sản phẩm đã chọn
                        </span>
                      )}
                    </div>
                    <DataTable
                      columns={useProductColumns({
                        onSelectionChange: handleSelectionChange,
                        selectedProducts: selectedProducts, // Truyền danh sách sản phẩm đã chọn
                      })}
                      data={productsData || []}
                      isLoading={isLoading}
                      pages={products?.result.totalPages || 1}
                      filterOptions={ProductFilterOptions}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                      filterConfig={filterConfig}
                      onFilterChange={handleFilterChange}
                    />
                  </div>
                  {/* Nhóm: Kiểm tra định danh */}
                  <div className={`flex flex-col gap-4 p-4 bg-white rounded-md border dark:bg-transparent`}>
                    {formFields.isVerificationIdentity}
                    {formFields.isPrivate}
                    {formFields.customerType}
                  </div>
                  {/* Nhóm: Chọn người dùng (chỉ hiển thị khi customerType === PERSON) */}
                  {customerType === VOUCHER_CUSTOMER_TYPE.PERSON && (
                    <div className={`grid grid-cols-1 gap-2 p-4 bg-white rounded-md border dark:bg-transparent`}>
                      <FormField
                        control={form.control}
                        name="assignedUser"
                        render={() => (
                          <FormItem>
                            <div className='flex justify-between items-center'>
                              <FormLabel className='text-sm font-medium'>
                                {t('voucher.selectUser')}
                                <span className="text-destructive ml-1">*</span>
                              </FormLabel>
                              {selectedUser && (
                                <span className='px-2 py-1 text-xs rounded-full text-muted-foreground bg-primary/10'>
                                  {t('voucher.userSelected')}
                                </span>
                              )}
                            </div>
                            <FormControl>
                              <div className='flex relative flex-col gap-2'>
                                {/* Input search */}
                                <div className='relative'>
                                  <Input
                                    type="tel"
                                    placeholder={tCustomer('customer.searchByPhoneNumber')}
                                    value={inputValue}
                                    onChange={(e) => {
                                      setInputValue(e.target.value)
                                      // Clear selection khi user bắt đầu gõ lại
                                      if (selectedUser && e.target.value !== '') {
                                        setSelectedUser(null)
                                        setSelectedUserInfo(null)
                                        form.setValue('assignedUser', null)
                                      }
                                    }}
                                    className='text-sm'
                                  />
                                </div>

                                {/* Loading indicator */}
                                {isLoadingUsers && inputValue && (
                                  <p className='text-xs text-muted-foreground'>
                                    {tCommon('common.searching')}...
                                  </p>
                                )}

                                {/* User list dropdown */}
                                {users.length > 0 && !selectedUser && (
                                  <div
                                    ref={userListRef}
                                    onScroll={handleUserListScroll}
                                    className="overflow-y-auto absolute z-50 mt-11 w-full max-h-96 bg-white rounded-md border shadow-lg dark:bg-background"
                                  >
                                    {users.map((user, index) => (
                                      <div
                                        key={user.slug}
                                        onClick={user.isActive ? () => handleUserSelectionChange(user) : undefined}
                                        className={`flex gap-2 items-center p-2 rounded-md transition-all duration-300 ${user.isActive
                                          ? 'cursor-pointer hover:bg-primary/20'
                                          : 'cursor-not-allowed opacity-50 bg-gray-50 dark:bg-gray-900'
                                          } ${index < users.length - 1 ? 'border-b' : ''}`}
                                      >
                                        <div className={`flex justify-center items-center p-2 rounded-full ${user.isActive ? 'bg-primary/10' : 'bg-gray-300 dark:bg-gray-700'
                                          }`}>
                                          <User2Icon className={`w-4 h-4 ${user.isActive ? 'text-primary' : 'text-gray-500'}`} />
                                        </div>
                                        <div className='flex flex-col flex-1'>
                                          <div className="flex gap-2 justify-between items-center">
                                            <div className="text-sm font-bold text-muted-foreground">
                                              {user.firstName} {user.lastName}
                                            </div>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${user.isActive
                                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                              : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                              }`}>
                                              {user.isActive ? tCustomer('customer.active') : tCustomer('customer.inactive')}
                                            </span>
                                          </div>
                                          <div className="text-xs xl:text-sm text-muted-foreground">
                                            {user.phonenumber}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Selected user info */}
                                {selectedUser && selectedUserInfo && (
                                  <div className='p-3 bg-muted rounded-md border animate-in fade-in-50'>
                                    <div className='flex justify-between items-start'>
                                      <div className='flex flex-col gap-1.5 flex-1'>
                                        <div>
                                          <p className='text-xs text-muted-foreground mb-0.5'>Tên</p>
                                          <p className='text-sm font-medium'>
                                            {selectedUserInfo.firstName} {selectedUserInfo.lastName}
                                          </p>
                                        </div>
                                        <div>
                                          <p className='text-xs text-muted-foreground mb-0.5'>Số điện thoại</p>
                                          <p className='text-sm text-foreground'>
                                            {selectedUserInfo.phonenumber}
                                          </p>
                                        </div>
                                        {selectedUserInfo.email && (
                                          <div>
                                            <p className='text-xs text-muted-foreground mb-0.5'>Email</p>
                                            <p className='text-sm text-foreground'>
                                              {selectedUserInfo.email}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClearUserSelection}
                                        className='h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive ml-2'
                                      >
                                        <CircleX className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* No results message */}
                                {debouncedInputValue &&
                                  !selectedUser &&
                                  !isLoadingUsers &&
                                  users.length === 0 &&
                                  userByPhoneNumber?.result?.items?.length === 0 && (
                                    <p className='text-xs text-destructive animate-in fade-in-50'>
                                      {tCustomer('customer.userNotFound')}
                                    </p>
                                  )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </form>
              </Form>
            </div>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="submit" form="voucher-form">
              {t('voucher.create')}
            </Button>
            {isOpenDialog && (
              <CreateVoucherDialog
                voucher={formData}
                isOpen={isOpenDialog}
                onOpenChange={setIsOpenDialog}
                onCloseSheet={() => openChange(false)}
                onSuccess={handleCreateVoucherSuccess}
              />
            )}
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}
