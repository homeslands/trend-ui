import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { PenLine, User2Icon, CircleX } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
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
} from '@/components/ui'
import { ConfirmUpdateVoucherDialog } from '@/components/app/dialog'
import { IUpdateVoucherRequest, IVoucher, IUserInfo } from '@/types'
import { DateAndTimePicker, TimeOnlyPicker } from '../picker'
import { TUpdateVoucherSchema, updateVoucherSchema } from '@/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { VoucherApplicabilityRuleSelect, VoucherTypeSelect, VoucherUsageFrequencyRuleSelect, VoucherCustomerTypeSelect } from '../select'
import { useSpecificVoucher, useUsers, useDebouncedInput } from '@/hooks'
import { APPLICABILITY_RULE, VOUCHER_CUSTOMER_TYPE, VOUCHER_TYPE, VOUCHER_USAGE_FREQUENCY_UNIT, Role } from '@/constants'

interface IUpdateVoucherSheetProps {
  voucher: IVoucher
  onSuccess?: () => void
}

export default function UpdateVoucherSheet({
  voucher,
  onSuccess,
}: IUpdateVoucherSheetProps) {
  const { t } = useTranslation(['voucher'])
  const { t: tCustomer } = useTranslation(['customer'])
  const { t: tCommon } = useTranslation(['common'])
  const { slug } = useParams()
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState<IUpdateVoucherRequest | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isMaxItemsEnabled, setIsMaxItemsEnabled] = useState(false)
  const [maxItemsInputValue, setMaxItemsInputValue] = useState<string>('') // State tạm thời để lưu giá trị input khi user đang nhập
  const [isUsageFrequencyEnabled, setIsUsageFrequencyEnabled] = useState(true)
  const [isActiveTimeEnabled, setIsActiveTimeEnabled] = useState(false)
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
  const [assignedUserInfo, setAssignedUserInfo] = useState<{ firstName: string; lastName: string; phonenumber: string; email?: string } | null>(null) // State để lưu thông tin user đã được gán từ API
  const { data: specificVoucher } = useSpecificVoucher({ slug: voucher.slug }, !!sheetOpen)
  const hasLoadedData = useRef(false)

  const specificVoucherData = specificVoucher?.result

  // Lấy voucherGroup slug từ voucher (hỗ trợ cả object và string), fallback sang slug từ URL
  const voucherGroupSlug =
    typeof voucher?.voucherGroup === 'string'
      ? voucher.voucherGroup
      : voucher?.voucherGroup?.slug ?? (slug as string)

  const form = useForm<TUpdateVoucherSchema>({
    resolver: zodResolver(updateVoucherSchema),
    defaultValues: {
      slug: '',
      voucherGroup: voucherGroupSlug,
      createdAt: '',
      title: '',
      applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
      description: '',
      type: '',
      paymentMethods: [],
      startDate: '',
      endDate: '',
      code: '',
      value: 0,
      remainingUsage: 0,
      maxUsage: 0,
      isActive: false,
      isPrivate: false,
      customerType: VOUCHER_CUSTOMER_TYPE.ALL,
      usageFrequencyUnit: 'unlimited' as unknown as VOUCHER_USAGE_FREQUENCY_UNIT,
      usageFrequencyValue: 0,
      maxItems: null,
      activeStartTime: null,
      activeEndTime: null,
      numberOfUsagePerUser: 0,
      minOrderValue: 0,
      isVerificationIdentity: false,
      products: [],
      assignedUser: null,
    },
  })

  // Chỉ cập nhật form values khi specificVoucherData được load lần đầu
  useEffect(() => {
    if (specificVoucherData?.slug && sheetOpen && !hasLoadedData.current) {
      hasLoadedData.current = true
      const normalizedUsageFrequencyUnit =
        specificVoucherData.usageFrequencyUnit ??
        ('unlimited' as unknown as VOUCHER_USAGE_FREQUENCY_UNIT)
      const normalizedUsageFrequencyValue =
        specificVoucherData.usageFrequencyUnit &&
        specificVoucherData.usageFrequencyUnit !== 'unlimited'
          ? specificVoucherData.usageFrequencyValue
          : null
      const normalizedCustomerType: VOUCHER_CUSTOMER_TYPE =
        specificVoucherData.customerType === VOUCHER_CUSTOMER_TYPE.GROUP
          ? VOUCHER_CUSTOMER_TYPE.GROUP
          : specificVoucherData.customerType === VOUCHER_CUSTOMER_TYPE.PERSON
          ? VOUCHER_CUSTOMER_TYPE.PERSON
          : VOUCHER_CUSTOMER_TYPE.ALL

      // Lấy assignedUser từ specificVoucherData (có thể là object hoặc slug string)
      const assignedUserData = specificVoucherData.assignedUser
      const assignedUserSlug = typeof assignedUserData === 'string' 
        ? assignedUserData 
        : assignedUserData?.slug || null

      form.reset({
        slug: specificVoucherData.slug,
        voucherGroup:
          typeof specificVoucherData.voucherGroup === 'string'
            ? specificVoucherData.voucherGroup
            : specificVoucherData.voucherGroup?.slug ?? voucherGroupSlug,
        createdAt: specificVoucherData.createdAt,
        title: specificVoucherData.title,
        applicabilityRule: specificVoucherData.applicabilityRule,
        description: specificVoucherData.description,
        type: specificVoucherData.type,
        paymentMethods: specificVoucherData.voucherPaymentMethods.map((method) => method.paymentMethod),
        startDate: specificVoucherData.startDate,
        endDate: specificVoucherData.endDate,
        code: specificVoucherData.code,
        value: specificVoucherData.value,
        remainingUsage: specificVoucherData.remainingUsage,
        maxUsage: specificVoucherData.maxUsage,
        isActive: specificVoucherData.isActive,
        isPrivate: specificVoucherData.isPrivate,
        numberOfUsagePerUser: specificVoucherData.numberOfUsagePerUser,
        minOrderValue: specificVoucherData.minOrderValue,
        isVerificationIdentity: specificVoucherData.isVerificationIdentity,
        customerType: normalizedCustomerType,
        maxItems: specificVoucherData.maxItems,
        usageFrequencyUnit: normalizedUsageFrequencyUnit,
        usageFrequencyValue: normalizedUsageFrequencyValue,
        products: (specificVoucherData.voucherProducts || []).map((item: { slug?: string; product?: { slug?: string } } | string) =>
          typeof item === 'string' ? item : item.slug || item.product?.slug || ''
        ).filter(Boolean),
        assignedUser: assignedUserSlug,
        activeStartTime: specificVoucherData.activeStartTime ?? null,
        activeEndTime: specificVoucherData.activeEndTime ?? null,
      })

      setIsActiveTimeEnabled(!!specificVoucherData?.activeStartTime)

      // Set selectedUser và assignedUserInfo nếu có assignedUser
      if (assignedUserSlug) {
        setSelectedUser(assignedUserSlug)
        // Nếu assignedUser là object, lấy thông tin để hiển thị
        if (typeof assignedUserData === 'object' && assignedUserData) {
          setAssignedUserInfo({
            firstName: assignedUserData.firstName,
            lastName: assignedUserData.lastName,
            phonenumber: assignedUserData.phonenumber,
            email: assignedUserData.email,
          })
          // Tạo IUserInfo object từ assignedUserData để hiển thị
          setSelectedUserInfo({
            slug: assignedUserSlug,
            firstName: assignedUserData.firstName,
            lastName: assignedUserData.lastName,
            phonenumber: assignedUserData.phonenumber,
            email: assignedUserData.email,
            isActive: true, // Assume active if assigned
          } as IUserInfo)
        }
      } else {
        setAssignedUserInfo(null)
        setSelectedUserInfo(null)
      }
    }
  }, [specificVoucherData, sheetOpen, form, slug, voucherGroupSlug])

  // Reset hasLoadedData khi sheet đóng
  useEffect(() => {
    if (!sheetOpen) {
      hasLoadedData.current = false
    }
  }, [sheetOpen])
  
  const customerType = form.watch('customerType')
  
  // Search user by phone number - chỉ search khi có debouncedInputValue
  const shouldSearchUser = Boolean(
    customerType === VOUCHER_CUSTOMER_TYPE.PERSON && 
    sheetOpen && 
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
    if (!sheetOpen) {
      setIsMaxItemsEnabled(false)
      setMaxItemsInputValue('')
      setIsUsageFrequencyEnabled(true)
      setIsActiveTimeEnabled(false)
      setSelectedUser(null)
      setSelectedUserInfo(null)
      setInputValue('')
      setUsers([])
      setAssignedUserInfo(null)
      setUserPagination({
        pageIndex: 1,
        pageSize: 10
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen])

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

  // Sync maxItemsInputValue với field.value và isMaxItemsEnabled khi form được populate hoặc thay đổi
  const maxItemsValue = form.watch('maxItems')
  useEffect(() => {
    if (maxItemsValue !== null && maxItemsValue !== undefined) {
      setIsMaxItemsEnabled(true)
      setMaxItemsInputValue(maxItemsValue.toString())
    } else {
      setIsMaxItemsEnabled(false)
      setMaxItemsInputValue('')
    }
  }, [maxItemsValue])

  const usageFrequencyUnitValue = form.watch('usageFrequencyUnit')
  useEffect(() => {
    if (
      usageFrequencyUnitValue === null ||
      usageFrequencyUnitValue === undefined ||
      usageFrequencyUnitValue === 'unlimited'
    ) {
      setIsUsageFrequencyEnabled(false)
    } else {
      setIsUsageFrequencyEnabled(true)
    }
  }, [usageFrequencyUnitValue])

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

  const handleUserSelectionChange = useCallback((user: IUserInfo) => {
    setSelectedUser(user.slug)
    setSelectedUserInfo(user)
    form.setValue('assignedUser', user.slug)
    form.clearErrors('assignedUser') // Clear validation error khi chọn user
    setUsers([]) // Clear dropdown sau khi chọn
    setInputValue('') // Clear input
    setAssignedUserInfo(null) // Clear assignedUserInfo khi chọn user mới
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const handleClearUserSelection = () => {
    setSelectedUser(null)
    setSelectedUserInfo(null)
    setInputValue('')
    setUsers([])
    setAssignedUserInfo(null)
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

  const handleSubmit = (data: IUpdateVoucherRequest) => {
    // Ensure value is converted to number before submitting
    const submissionData = {
      ...data,
      value: Number(data.value),
      usageFrequencyUnit: isUsageFrequencyEnabled
        ? data.usageFrequencyUnit
        : ('unlimited' as unknown as VOUCHER_USAGE_FREQUENCY_UNIT),
      usageFrequencyValue: isUsageFrequencyEnabled ? data.usageFrequencyValue : null,
    };
    setFormData(submissionData);
    setIsOpen(true);
  }

  // Add onSubmit handler directly to form element
  const onSubmit = form.handleSubmit((data) => {
    handleSubmit(data as IUpdateVoucherRequest);
  });

  // const handleClick = (e: React.MouseEvent) => {
  //   e.preventDefault()
  //   e.stopPropagation()
  //   setSheetOpen(true)
  // }

  const formFields = {
    title: (
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex gap-1 items-center">
              <span className="text-destructive">*</span>
              {t('voucher.title')}
            </FormLabel>
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
            <FormLabel className="flex gap-1 items-center">
              {t('voucher.description')}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t('voucher.enterVoucherDescription')}
              />
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
            <FormLabel className="flex gap-1 items-center">
              <span className="text-destructive">*</span>
              {t('voucher.startDate')}
            </FormLabel>
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
            <FormLabel className="flex gap-1 items-center">
              <span className="text-destructive">*</span>
              {t('voucher.endDate')}
            </FormLabel>
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
                disabled={true}
                defaultValue={field.value}
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
                defaultValue={field.value}
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
            <FormLabel className="flex items-center justify-between gap-2">
              <div className="flex gap-1 items-center">
                <span className="text-destructive">
                  *
                </span>
                {t('voucher.usageFrequencyUnit')}
              </div>
              <Switch
                id="update-usage-frequency-enabled"
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
                  defaultValue={field.value || undefined}
                  {...field}
                  onChange={(value) => {
                    field.onChange(value);
                  }}
                />
              )}
            </FormControl>
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
            <FormLabel className="flex gap-1 mt-2 items-center">
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
                value={field.value?.toString() ?? ''} // convert number -> string
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
              <div className="flex gap-1 items-center">
                <span className="text-destructive">*</span>
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
            <FormLabel className="flex gap-1 items-center">
              <span className="text-destructive">*</span>
              {t('voucher.code')}
            </FormLabel>
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
        defaultValue={voucher.value}
        render={({ field }) => (
          <FormItem className='flex flex-col justify-between'>
            <FormLabel className='flex gap-1 items-center'>
              <span className="text-destructive">*</span>
              {t('voucher.value')}
            </FormLabel>
            <FormControl>
              {form.watch('type') === VOUCHER_TYPE.PERCENT_ORDER ? (
                <div className='relative'>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Chỉ set number, không set empty string để tránh validation fail
                      if (value === '' || Number(value) <= 0) {
                        field.onChange(1); // Set minimum valid value for percent
                      } else {
                        const numValue = Number(value);
                        field.onChange(numValue > 100 ? 100 : numValue);
                      }
                    }}
                    value={field.value || 1}
                    min={1}
                    max={100}
                    placeholder={t('voucher.enterVoucherValue')}
                  />

                  <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                    %
                  </span>
                </div>
              ) : (
                <div className='relative'>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Chỉ set number, không set empty string để tránh validation fail
                      if (value === '' || Number(value) <= 0) {
                        field.onChange(1000); // Set minimum valid value for fixed amount
                      } else {
                        field.onChange(Number(value));
                      }
                    }}
                    value={field.value || 1000}
                    min={1}
                    placeholder={t('voucher.enterVoucherValue')}
                  />
                  <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                    ₫
                  </span>
                </div>
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    remainingUsage: (
      <FormField
        control={form.control}
        name="remainingUsage"
        render={({ field }) => (
          <FormItem>
            <FormLabel className='flex gap-1 items-center'>
              {t('voucher.remainingUsage')}</FormLabel>
            <FormControl>
              <Input
                type="number"
                disabled
                {...field}
                placeholder={t('voucher.enterRemainingUsage')}
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
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
            <FormLabel className="flex gap-1 items-center">
              <span className="text-destructive">*</span>
              {t('voucher.voucherMaxUsage')}
            </FormLabel>
            <FormControl>
              <Input
                disabled
                type="number"
                {...field}
                // onChange={(e) => {
                //   const value = e.target.value;
                //   field.onChange(value === '' ? '' : Number(value));
                // }}
                className='text-sm'
                // value={field.value?.toString() ?? ''} // convert number -> string
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
                  type="number"
                  {...field}
                  placeholder={t('voucher.enterNumberOfUsagePerUser')}
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
            <FormLabel className="flex gap-1 items-center">
              <span className="text-destructive">*</span>
              {t('voucher.minOrderValue')}
            </FormLabel>
            <FormControl>
              <div className='relative'>
                <Input
                  type="number"
                  {...field}
                  placeholder={t('voucher.enterMinOrderValue')}
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
    isActive: (
      <FormField
        control={form.control}
        name="isActive"
        render={({ field }) => {
          const startDate = form.getValues('startDate')
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const start = new Date(startDate)
          start.setHours(0, 0, 0, 0)

          const isStartDateAfterToday = start.getTime() > today.getTime()

          return (
            <FormItem>
              <FormLabel className="flex gap-1 items-center">
                {t('voucher.isActive')}
              </FormLabel>
              <FormControl>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isStartDateAfterToday}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    ),
    isVerificationIdentity: (
      <FormField
        control={form.control}
        name="isVerificationIdentity"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex gap-1 items-center">
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
          <FormItem>
            <FormLabel className="flex gap-1 items-start leading-6">
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

  const handleUpdateVoucherSuccess = () => {
    setSheetOpen(false)
    onSuccess?.()
  }

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="flex gap-1 justify-start px-2 w-full">
          <PenLine className="icon" />
          {t('voucher.update')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">
            {t('voucher.update')}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden bg-transparent backdrop-blur-md">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)] gap-4 p-4">
            {/* Voucher name and description */}
            <div className="flex flex-col flex-1">
              <Form {...form}>
                <form
                  id="voucher-form"
                  onSubmit={onSubmit}
                  className="space-y-4"
                >
                  {/* Nhóm: Tên và Mô tả */}
                  <div className="p-4 rounded-md border">
                    <div className="grid grid-cols-1 gap-2">
                      {formFields.title}
                      {formFields.description}
                    </div>
                  </div>

                  {/* Nhóm: Ngày bắt đầu và Kết thúc */}
                  <div className="grid grid-cols-2 gap-2 p-4 rounded-md border">
                    {formFields.startDate}
                    {formFields.endDate}
                  </div>

                  {/* Active Time Frame */}
                  <div className="p-4 rounded-md border">
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
                  <div className="grid grid-cols-2 gap-2 p-4 rounded-md border">
                    {formFields.applicabilityRule}
                    {formFields.type}
                  </div>

                  {/* Nhóm: Tần suất sử dụng */}
                  <div className="grid grid-cols-1 gap-2 p-4 rounded-md border">
                    {formFields.usageFrequencyUnit}
                    {formFields.usageFrequencyValue}
                  </div>

                  {/* Nhóm: Số lượng sản phẩm tối đa */}
                  <div className="grid grid-cols-1 gap-2 p-4 rounded-md border">
                    {formFields.maxItems}
                  </div>

                  {/* Nhóm: Code */}
                  <div className="grid grid-cols-2 gap-2 p-4 rounded-md border">
                    {formFields.code}
                    {formFields.value}
                  </div>

                  {/* Nhóm: Giá trị đơn hàng tối thiểu */}
                  <div className="grid grid-cols-1 gap-2 p-4 rounded-md border">
                    {formFields.minOrderValue}
                  </div>

                  {/* Nhóm: Số lượng sử dụng */}
                  <div className={`grid grid-cols-2 gap-2 p-4 rounded-md border dark:bg-transparent`}>
                    {formFields.maxUsage}
                    {formFields.remainingUsage}
                  </div>

                  <div className="grid grid-cols-1 gap-2 p-4 rounded-md border">
                    {formFields.numberOfUsagePerUser}
                  </div>

                  {/* Nhóm: Kích hoạt voucher */}
                  <div className="flex flex-col gap-4 p-4 rounded-md border dark:bg-transparent">
                    {formFields.isActive}
                    {formFields.isPrivate}
                    {formFields.customerType}
                  </div>

                  {/* Nhóm: Chọn người dùng (chỉ hiển thị khi customerType === PERSON) */}
                  {customerType === VOUCHER_CUSTOMER_TYPE.PERSON && (
                    <div className={`grid grid-cols-1 gap-2 p-4 rounded-md border dark:bg-transparent`}>
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
                                        setAssignedUserInfo(null)
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
                                {selectedUser && (selectedUserInfo || assignedUserInfo) && (
                                  <div className='p-3 bg-muted rounded-md border animate-in fade-in-50'>
                                    <div className='flex justify-between items-start'>
                                      <div className='flex flex-col gap-1.5 flex-1'>
                                        <div>
                                          <p className='text-xs text-muted-foreground mb-0.5'>Tên</p>
                                          <p className='text-sm font-medium'>
                                            {selectedUserInfo 
                                              ? `${selectedUserInfo.firstName} ${selectedUserInfo.lastName}`
                                              : assignedUserInfo 
                                              ? `${assignedUserInfo.firstName} ${assignedUserInfo.lastName}`
                                              : ''}
                                          </p>
                                        </div>
                                        <div>
                                          <p className='text-xs text-muted-foreground mb-0.5'>Số điện thoại</p>
                                          <p className='text-sm text-foreground'>
                                            {selectedUserInfo?.phonenumber || assignedUserInfo?.phonenumber || ''}
                                          </p>
                                        </div>
                                        {(selectedUserInfo?.email || assignedUserInfo?.email) && (
                                          <div>
                                            <p className='text-xs text-muted-foreground mb-0.5'>Email</p>
                                            <p className='text-sm text-foreground'>
                                              {selectedUserInfo?.email || assignedUserInfo?.email}
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

                  {/* Nhóm: Kiểm tra định danh */}
                  <div className="grid grid-cols-1 p-4 rounded-md border">
                    {formFields.isVerificationIdentity}
                  </div>
                </form>
              </Form>
            </div>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button
              type="submit"
              form="voucher-form"
            >
              {t('voucher.update')}
            </Button>
            {isOpen && (
              <ConfirmUpdateVoucherDialog
                voucher={formData}
                isOpen={isOpen}
                onOpenChange={setIsOpen}
                onCloseSheet={() => setSheetOpen(false)}
                onSuccess={handleUpdateVoucherSuccess}
              />
            )}
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}
