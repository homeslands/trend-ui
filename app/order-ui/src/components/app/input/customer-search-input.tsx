import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { CircleX, User2Icon, Scan } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useOrderFlowStore } from '@/stores'
import { IUserInfo } from '@/types'
import { useDebouncedInput, usePagination, useUsers, useValidateVoucher } from '@/hooks'
import {
    Button, Input, Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui'
import { Role } from '@/constants'
import { setValidatingFromCustomerChange, showToast } from '@/utils'
import { ScanRFIDCustomerDialog } from '@/components/app/dialog'

export default function CustomerSearchInput() {
    const { t } = useTranslation(['menu'])
    const { t: tCommon } = useTranslation(['common'])
    const { t: tCustomer } = useTranslation(['customer'])
    const [users, setUsers] = useState<IUserInfo[]>([])
    const [isRFIDDialogOpen, setIsRFIDDialogOpen] = useState(false)
    const [scannedIdentityCode, setScannedIdentityCode] = useState<string>('')
    const { pagination, setPagination } = usePagination()
    const { inputValue, setInputValue, debouncedInputValue } = useDebouncedInput()
    const { getCartItems, addCustomerInfo, removeCustomerInfo, setDeliveryPhone, removeVoucher } = useOrderFlowStore()
    const { mutate: validateVoucher } = useValidateVoucher()
    const cartItems = getCartItems()
    const voucherSlug = useMemo(() => {
        return cartItems?.voucher?.slug
    }, [cartItems?.voucher])
    const userListRef = useRef<HTMLDivElement>(null)

    // Search by identity code (QR scan)
    const { data: userByIdentityCode, isFetching: isFetchingIdentityCode } = useUsers(
        scannedIdentityCode
            ? {
                order: 'DESC',
                page: 1,
                size: 10,
                slug: scannedIdentityCode,
                role: Role.CUSTOMER,
                hasPaging: false,
            }
            : null,
        !!scannedIdentityCode
    )

    // Search by phone number only
    const { data: userByPhoneNumber } = useUsers(
        debouncedInputValue
            ? {
                order: 'DESC',
                page: pagination.pageIndex,
                size: pagination.pageSize,
                phonenumber: debouncedInputValue,
                role: Role.CUSTOMER,
                hasPaging: true,
            }
            : null,
        !!debouncedInputValue // Chỉ search khi có input value
    )


    const handleAddOwner = useCallback((user: IUserInfo) => {
        addCustomerInfo(user)
        setUsers([])
        setInputValue('')
        setDeliveryPhone(user.phonenumber)
        if (voucherSlug) {
            // Set flag để prevent duplicate validation trong cart-content
            setValidatingFromCustomerChange(true)

            validateVoucher({
                voucher: voucherSlug,
                user: user.slug,
                orderItems: cartItems?.orderItems?.map(item => ({
                    quantity: item.quantity,
                    variant: item.variant.slug,
                })) || []
            }, {
                onError: () => {
                    removeVoucher()
                },
                onSettled: () => {
                    // Reset flag sau khi validation hoàn tất
                    setTimeout(() => {
                        setValidatingFromCustomerChange(false)
                    }, 500)
                }
            })
        }
    }, [addCustomerInfo, setDeliveryPhone, voucherSlug, validateVoucher, cartItems?.orderItems, removeVoucher, setInputValue])

    const handleRemoveOwner = () => {
        setInputValue('')
        removeCustomerInfo()
        setDeliveryPhone('')
    }

    const handleAddOwnerRef = useRef(handleAddOwner)
    handleAddOwnerRef.current = handleAddOwner

    // Handle identity code (QR scan) lookup result
    useEffect(() => {
        if (!scannedIdentityCode) return
        if (isFetchingIdentityCode) return
        if (!userByIdentityCode?.result?.items) return

        const items = userByIdentityCode.result.items
        if (items.length === 0) {
            showToast(t('menu.userNotFound'))
        } else if (items.length > 1) {
            showToast(t('menu.multipleUsersFound'))
        } else if (!items[0].isActive) {
            showToast(t('menu.userInactive'))
        } else {
            handleAddOwnerRef.current(items[0])
            setIsRFIDDialogOpen(false)
        }
        setScannedIdentityCode('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userByIdentityCode, scannedIdentityCode, isFetchingIdentityCode, t])

    // Handle phone number search results
    useEffect(() => {
        if (debouncedInputValue === '') {
            setUsers([])
        } else if (userByPhoneNumber?.result?.items) {
            if (pagination.pageIndex === 1) {
                setUsers(userByPhoneNumber.result.items)
            } else {
                setUsers(prev => [...prev, ...userByPhoneNumber.result.items])
            }
        }
    }, [debouncedInputValue, userByPhoneNumber, pagination.pageIndex])

    const handleScroll = () => {
        if (userListRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = userListRef.current
            if (scrollTop + clientHeight >= scrollHeight - 20) {
                setPagination(prev => ({
                    ...prev,
                    pageIndex: prev.pageIndex + 1
                }))
            }
        }
    }


    return (
        <div className='flex relative flex-col gap-3'>
            {/* Customer Information */}
            <div className="flex flex-col gap-1">
                <div className="flex relative gap-2">
                    <Input
                        className='flex-1 text-xs xl:text-sm'
                        placeholder={t('order.enterPhoneNumber')}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                    />
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="shrink-0"
                                    onClick={() => setIsRFIDDialogOpen(true)}
                                >
                                    <Scan className="w-4 h-4" />
                                    <span className="">{t('menu.scanMembershipCardToSearch')}</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t('menu.scanMembershipCardToSearch')}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                {(cartItems?.ownerFullName || cartItems?.ownerPhoneNumber) && (
                    <div className='flex gap-2 justify-between items-center w-full'>
                        <div className='flex flex-col gap-1 justify-center items-start py-1 text-sm w-fit'>
                            <span className='text-xs font-bold xl:text-sm'>
                                {cartItems?.ownerFullName}
                            </span>
                            <span className='text-xs xl:text-sm text-muted-foreground'>
                                {cartItems?.ownerPhoneNumber}
                            </span>
                        </div>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" className='text-destructive bg-destructive/10 border-destructive hover:bg-destructive/10 hover:text-destructive' onClick={() => handleRemoveOwner()}>
                                        <CircleX />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{tCommon('common.cancel')}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )}
            </div>

            {/* User list dropdown */}
            {users.length > 0 && (
                <div
                    ref={userListRef}
                    onScroll={handleScroll}
                    className="overflow-y-auto absolute z-50 mt-11 w-full max-h-96 bg-white rounded-md border shadow-lg dark:bg-background"
                >
                    {users.map((user, index) => (
                        <div
                            key={user.slug}
                            onClick={user.isActive ? () => handleAddOwner(user) : undefined}
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

            {/* RFID Scan Dialog */}
            <ScanRFIDCustomerDialog
                isOpen={isRFIDDialogOpen}
                onOpenChange={setIsRFIDDialogOpen}
                onUserSelect={(user) => {
                    handleAddOwner(user)
                    setIsRFIDDialogOpen(false)
                }}
                onQrTokenScanned={(token) => setScannedIdentityCode(token)}
                defaultTab="rfid"
            />
        </div>
    )
}