import { Coins, CreditCard, CircleDollarSign, CoinsIcon, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState, useCallback, useMemo, Fragment } from 'react'

import { RadioGroup, RadioGroupItem, Label, Input, Button } from '@/components/ui'
import { PaymentMethod, Role, VOUCHER_PAYMENT_METHOD } from '@/constants'
import { useUserStore } from '@/stores'
import { useGetUserBalance } from '@/hooks'
import { formatCurrency, showToast } from '@/utils'
import { IOrder, IUserInfo } from '@/types'
import { ScanRFIDCustomerDialog } from '@/components/app/dialog'

interface StaffPaymentMethodRadioGroupProps {
  order?: IOrder
  defaultValue: string | null
  disabledMethods?: PaymentMethod[]
  disabledReasons?: Record<PaymentMethod, string>
  onSubmit?: (paymentMethod: PaymentMethod, transactionId?: string, qrToken?: string) => void
  initialQrToken?: string
}
export default function StaffPaymentMethodRadioGroup({
  order,
  defaultValue,
  disabledMethods,
  disabledReasons,
  onSubmit,
  initialQrToken,
}: StaffPaymentMethodRadioGroupProps) {
  const { t } = useTranslation('menu')
  const { t: tProfile } = useTranslation('profile')
  const { userInfo } = useUserStore()

  const { data: balanceData } = useGetUserBalance(
    order?.owner?.slug,
    order?.owner?.slug ? true : false,
  )
  const balance = balanceData?.result?.points || 0
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [creditCardTransactionId, setCreditCardTransactionId] = useState<string>('')
  const [isScanCardDialogOpen, setIsScanCardDialogOpen] = useState(false)
  const [isPointVerified, setIsPointVerified] = useState(false) // Track if POINT payment is verified
  const [verifiedMembershipCardCode, setVerifiedMembershipCardCode] = useState<string>('') // Store verified membership card code
  const [scannedQrToken, setScannedQrToken] = useState<string>(initialQrToken ?? '')
  const prevOrderSlugRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (initialQrToken && !scannedQrToken) {
      setScannedQrToken(initialQrToken)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQrToken])

  const voucherPaymentMethods = useMemo(() =>
    order?.voucher?.voucherPaymentMethods || [],
    [order?.voucher?.voucherPaymentMethods]
  )

  // Get all available payment methods based on user role
  const getAvailablePaymentMethods = useCallback(() => {
    const methods = [PaymentMethod.BANK_TRANSFER]

    if (userInfo && userInfo.role.name !== Role.CUSTOMER) {
      methods.push(PaymentMethod.CASH)
    }

    // POINT available for all roles
    if (userInfo) {
      methods.push(PaymentMethod.POINT)
    }

    if (userInfo && userInfo.role.name !== Role.CUSTOMER) {
      methods.push(PaymentMethod.CREDIT_CARD)
    }

    // Filter out disabled methods
    if (disabledMethods) {
      return methods.filter(method => !disabledMethods.includes(method))
    }

    return methods
  }, [userInfo, disabledMethods])

  // Get supported payment methods from voucher
  const getSupportedPaymentMethods = useCallback(() => {
    if (!order?.voucher || voucherPaymentMethods.length === 0) {
      return getAvailablePaymentMethods()
    }

    const supportedMethods = voucherPaymentMethods.map(vpm => {
      // Map voucher payment methods to PaymentMethod enum
      switch (vpm.paymentMethod) {
        case VOUCHER_PAYMENT_METHOD.CASH:
          return PaymentMethod.CASH
        case VOUCHER_PAYMENT_METHOD.BANK_TRANSFER:
          return PaymentMethod.BANK_TRANSFER
        case VOUCHER_PAYMENT_METHOD.POINT:
          return PaymentMethod.POINT
        case VOUCHER_PAYMENT_METHOD.CREDIT_CARD:
          return PaymentMethod.CREDIT_CARD
        default:
          return PaymentMethod.BANK_TRANSFER
      }
    })

    // Filter out disabled methods
    if (disabledMethods) {
      return supportedMethods.filter(method => !disabledMethods.includes(method))
    }

    return supportedMethods
  }, [order?.voucher, voucherPaymentMethods, getAvailablePaymentMethods, disabledMethods])

  // Check if payment method is supported by voucher and role
  const isPaymentMethodSupported = (paymentMethod: PaymentMethod) => {
    // Nếu method nằm trong danh sách disabled thì không hỗ trợ
    if (disabledMethods?.includes(paymentMethod)) {
      return false
    }

    // Lấy danh sách method theo role
    const availableMethods = getAvailablePaymentMethods()
    if (!availableMethods.includes(paymentMethod)) {
      return false
    }

    // Nếu không có voucher hoặc voucher không giới hạn phương thức thì chỉ check theo role
    if (!order?.voucher || voucherPaymentMethods.length === 0) {
      return true
    }

    // Nếu có voucher, kiểm tra method có trong danh sách voucher hỗ trợ không
    return voucherPaymentMethods.some(vpm => {
      switch (paymentMethod) {
        case PaymentMethod.CASH:
          return vpm.paymentMethod === 'cash'
        case PaymentMethod.BANK_TRANSFER:
          return vpm.paymentMethod === 'bank-transfer'
        case PaymentMethod.POINT:
          return vpm.paymentMethod === 'point'
        case PaymentMethod.CREDIT_CARD:
          return vpm.paymentMethod === 'credit-card'
        default:
          return false
      }
    })
  }

  // Check if there's any compatible payment method between voucher and user role
  const hasCompatiblePaymentMethod = useMemo(() => {
    const availableMethods = getAvailablePaymentMethods()

    if (!order?.voucher || voucherPaymentMethods.length === 0) {
      return availableMethods.length > 0 // Has at least one available method
    }

    const supportedMethods = getSupportedPaymentMethods()
    return supportedMethods.some(method => availableMethods.includes(method))
  }, [order?.voucher, voucherPaymentMethods, getAvailablePaymentMethods, getSupportedPaymentMethods])

  // Initialize payment method when defaultValue changes or when voucher payment methods change
  // Reset selectedPaymentMethod whenever defaultValue changes
  useEffect(() => {
    if (defaultValue) {
      setSelectedPaymentMethod(defaultValue)
      // Reset POINT verification when payment method changes away from POINT
      if (defaultValue !== PaymentMethod.POINT) {
        setIsPointVerified(false)
        setVerifiedMembershipCardCode('')
        setScannedQrToken('')
      }
    } else {
      setSelectedPaymentMethod('')
      setIsPointVerified(false)
      setVerifiedMembershipCardCode('')
      setScannedQrToken('')
    }
  }, [defaultValue])

  // Sync selectedPaymentMethod with defaultValue to prevent flickering
  useEffect(() => {
    if (defaultValue && defaultValue !== selectedPaymentMethod) {
      setSelectedPaymentMethod(defaultValue)
      // Reset POINT verification when payment method changes away from POINT
      if (defaultValue !== PaymentMethod.POINT) {
        setIsPointVerified(false)
        setVerifiedMembershipCardCode('')
        setScannedQrToken('')
      }
    }
  }, [defaultValue, selectedPaymentMethod])

  // Reset POINT verification when navigating to a different order (not on initial API resolution)
  useEffect(() => {
    const prevSlug = prevOrderSlugRef.current
    prevOrderSlugRef.current = order?.slug
    if (order?.slug && prevSlug && order.slug !== prevSlug) {
      setIsPointVerified(false)
      setVerifiedMembershipCardCode('')
      setScannedQrToken('')
    }
  }, [order?.slug])

  const handleQrTokenScanned = (qrToken: string) => {
    setScannedQrToken(qrToken)
    setSelectedPaymentMethod(PaymentMethod.POINT)
    setIsPointVerified(false)
    setVerifiedMembershipCardCode('')
    if (onSubmit) {
      onSubmit(PaymentMethod.POINT, undefined, qrToken)
    }
  }

  const handlePaymentMethodChange = (paymentMethod: PaymentMethod) => {
    setSelectedPaymentMethod(paymentMethod)
    if (onSubmit) {
      // If credit card is selected, include transaction ID
      if (paymentMethod === PaymentMethod.CREDIT_CARD) {
        onSubmit(paymentMethod, creditCardTransactionId)
      } else if (paymentMethod === PaymentMethod.POINT) {
        if (scannedQrToken) {
          onSubmit(paymentMethod, undefined, scannedQrToken)
        } else if (isPointVerified && verifiedMembershipCardCode) {
          onSubmit(paymentMethod, verifiedMembershipCardCode)
        } else {
          setIsScanCardDialogOpen(true)
        }
      } else {
        onSubmit(paymentMethod)
      }
    }
  }

  const handleUserSelectFromScan = (user: IUserInfo, cardCode?: string) => {
    
    // Close dialog first to prevent any toast from dialog
    setIsScanCardDialogOpen(false)
    
    // Use setTimeout to ensure dialog toast (if any) is cleared before showing our toast
    setTimeout(() => {
      // Check if scanned user's phone number matches order owner's phone number
      if (order?.owner?.phonenumber && user.phonenumber === order.owner.phonenumber) {
        if (cardCode) {
          // Mark as verified and store the membership card code
          setScannedQrToken('')
          setIsPointVerified(true)
          setVerifiedMembershipCardCode(cardCode)
          
          // Automatically submit POINT payment method with membership card code
          if (onSubmit) {
            onSubmit(PaymentMethod.POINT, cardCode)
          }
          showToast(t('menu.membershipCardVerified'))
        } else {
          // User doesn't have membership card
          showToast(t('menu.membershipCardNotFound'))
        }
      } else {
        // Phone number doesn't match - show error
        showToast(t('menu.phoneNumberNotMatch'))
      }
    }, 100) // Small delay to ensure dialog toast is cleared
  }

  const handleTransactionIdChange = (transactionId: string) => {
    setCreditCardTransactionId(transactionId)
    // If credit card is currently selected, update the parent with new transaction ID
    if (selectedPaymentMethod === PaymentMethod.CREDIT_CARD && onSubmit) {
      onSubmit(PaymentMethod.CREDIT_CARD, transactionId)
    }
  }

  // Show warning when no compatible methods exist
  if (!hasCompatiblePaymentMethod) {
    return (
      <Fragment>
      <div className="flex flex-col gap-4">
        <div className="p-4 bg-orange-50 rounded-md border border-orange-200">
          <div className="flex gap-2 items-center text-orange-800">
            <span className="text-sm font-medium">⚠️ Voucher không tương thích với phương thức thanh toán hiện có</span>
          </div>
          <p className="mt-1 text-xs text-orange-600">
            {t('paymentMethod.voucherNotCompatible')} {voucherPaymentMethods.map(vpm => {
              switch (vpm.paymentMethod) {
                case 'cash': return t('paymentMethod.cash')
                case 'bank-transfer': return t('paymentMethod.bankTransfer')
                case 'point': return t('paymentMethod.coin')
                case 'credit-card': return t('paymentMethod.creditCard')
                default: return vpm.paymentMethod
              }
            }).join(', ')}, {t('paymentMethod.butYouCanUse')} {getAvailablePaymentMethods().map(method => {
              switch (method) {
                case PaymentMethod.CASH: return t('paymentMethod.cash')
                case PaymentMethod.BANK_TRANSFER: return t('paymentMethod.bankTransfer')
                case PaymentMethod.POINT: return t('paymentMethod.coin')
                case PaymentMethod.CREDIT_CARD: return t('paymentMethod.creditCard')
                default: return method
              }
            }).join(', ')}
          </p>
        </div>
        <RadioGroup
          value={defaultValue || selectedPaymentMethod || ''}
          className="gap-6 min-w-full"
          onValueChange={handlePaymentMethodChange}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value={PaymentMethod.BANK_TRANSFER} id="r2" />
            <div className={`flex gap-1 items-center pl-2 ${isPaymentMethodSupported(PaymentMethod.BANK_TRANSFER)
              ? 'text-muted-foreground'
              : 'text-muted-foreground/50'
              }`}>
              <Label htmlFor="r2" className={`flex gap-1 items-center ${!isPaymentMethodSupported(PaymentMethod.BANK_TRANSFER) ? 'opacity-50' : ''
                }`}>
                <Smartphone size={20} />
                {t('paymentMethod.bankTransfer')}
                {!isPaymentMethodSupported(PaymentMethod.BANK_TRANSFER) && (
                  <span className="ml-1 text-xs text-orange-500">
                    ({disabledReasons?.[PaymentMethod.BANK_TRANSFER] || t('paymentMethod.voucherNotSupport')})
                  </span>
                )}
              </Label>
            </div>
          </div>
          {userInfo && userInfo.role.name !== Role.CUSTOMER && (
            <div className="flex items-center space-x-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={PaymentMethod.CREDIT_CARD} id="r3" />
                  <div className={`flex gap-1 items-center ${isPaymentMethodSupported(PaymentMethod.CREDIT_CARD)
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/50'
                    }`}>
                    <Label htmlFor="r3" className={`flex gap-1 items-center ${!isPaymentMethodSupported(PaymentMethod.CREDIT_CARD) ? 'opacity-50' : ''
                      }`}>
                      <CreditCard size={20} />
                      {t('paymentMethod.creditCard')}
                      {!isPaymentMethodSupported(PaymentMethod.CREDIT_CARD) && (
                        <span className="ml-1 text-xs text-orange-500">
                          ({disabledReasons?.[PaymentMethod.CREDIT_CARD] || t('paymentMethod.voucherNotSupport')})
                        </span>
                      )}
                    </Label>
                  </div>
                </div>
                {selectedPaymentMethod === PaymentMethod.CREDIT_CARD && (
                  <Input
                    type="text"
                    placeholder={t('paymentMethod.creditCardTransactionIdPlaceholder')}
                    className="ml-6 w-full h-9"
                    value={creditCardTransactionId}
                    onChange={(e) => handleTransactionIdChange(e.target.value)}
                    disabled={!isPaymentMethodSupported(PaymentMethod.CREDIT_CARD)}
                  />
                )}
              </div>
            </div>

          )}
          {userInfo && userInfo.role.name !== Role.CUSTOMER && (
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={PaymentMethod.CASH} id="r4" />
              <div className={`flex gap-1 items-center pl-2 ${isPaymentMethodSupported(PaymentMethod.CASH)
                ? 'text-muted-foreground'
                : 'text-muted-foreground/50'
                }`}>
                <Label htmlFor="r4" className={`flex gap-1 items-center ${!isPaymentMethodSupported(PaymentMethod.CASH) ? 'opacity-50' : ''
                  }`}>
                  <Coins size={20} />
                  {t('paymentMethod.cash')}
                  {!isPaymentMethodSupported(PaymentMethod.CASH) && (
                    <span className="ml-1 text-xs text-orange-500">
                      ({disabledReasons?.[PaymentMethod.CASH] || t('paymentMethod.voucherNotSupport')})
                    </span>
                  )}
                </Label>
              </div>
            </div>
          )}
          {userInfo && (
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-2">
                <RadioGroupItem
                  value={PaymentMethod.POINT}
                  id="r5"
                  className="mt-[2px]"
                />
                <div className="flex flex-col space-x-2">
                  <div className={`flex gap-1 items-center pl-2 ${isPaymentMethodSupported(PaymentMethod.POINT)
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/50'
                    }`}>
                    <Label htmlFor="r5" className={`flex gap-1 items-center ${!isPaymentMethodSupported(PaymentMethod.POINT) ? 'opacity-50' : ''
                      }`}>
                      <CircleDollarSign size={20} />
                      <span className="flex flex-col">
                        <span>{t('paymentMethod.coin')}</span>
                        {!isPaymentMethodSupported(PaymentMethod.POINT) && (
                          <span className="text-xs text-orange-500">
                            ({disabledReasons?.[PaymentMethod.POINT] || t('paymentMethod.voucherNotSupport')})
                          </span>
                        )}
                      </span>
                    </Label>
                  </div>
                  <span className={`flex gap-1 items-center text-xs font-medium ${isPaymentMethodSupported(PaymentMethod.POINT)
                    ? 'text-primary'
                    : 'text-primary/50'
                    }`}>
                    {tProfile('profile.coinBalance')}: {formatCurrency(balance, '')}
                    <CoinsIcon className="w-4 h-4" />
                  </span>
                </div>
              </div>
              {selectedPaymentMethod === PaymentMethod.POINT && (
                <div className="flex flex-col gap-2 ml-6">
                  {scannedQrToken && (
                    <div className="flex gap-2 items-center">
                      <span className="inline-flex gap-1 items-center px-2 py-0.5 text-xs font-medium rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-800">
                        <CircleDollarSign size={12} />
                        {t('paymentMethod.qrTokenReady')}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setScannedQrToken('')
                          setIsScanCardDialogOpen(true)
                        }}
                      >
                        {t('paymentMethod.rescanQr')}
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    {t('paymentMethod.pointMethodNote')}
                  </p>
                </div>
              )}
            </div>
          )}
        </RadioGroup>
      </div>
      <ScanRFIDCustomerDialog
        isOpen={isScanCardDialogOpen}
        onOpenChange={setIsScanCardDialogOpen}
        onUserSelect={handleUserSelectFromScan}
        onQrTokenScanned={handleQrTokenScanned}
        suppressToast={true}
        defaultTab="qr"
      />
      </Fragment>
    )
  }

  return (
    <Fragment>
    <RadioGroup
      value={defaultValue || selectedPaymentMethod || ''}
      className="gap-6 min-w-full"
      onValueChange={handlePaymentMethodChange}
    >
      <div className="flex items-center space-x-2">
        <RadioGroupItem value={PaymentMethod.BANK_TRANSFER} id="r2" />
        <div className={`flex gap-1 items-center pl-2 ${isPaymentMethodSupported(PaymentMethod.BANK_TRANSFER)
          ? 'text-muted-foreground'
          : 'text-muted-foreground/50'
          }`}>
          <Label htmlFor="r2" className={`flex gap-1 items-center ${!isPaymentMethodSupported(PaymentMethod.BANK_TRANSFER) ? 'opacity-50' : ''
            }`}>
            <Smartphone size={20} />
            {t('paymentMethod.bankTransfer')}
            {!isPaymentMethodSupported(PaymentMethod.BANK_TRANSFER) && (
              <span className="ml-1 text-xs text-orange-500">({t('paymentMethod.voucherNotSupport')})</span>
            )}
          </Label>
        </div>
      </div>
      {userInfo && userInfo.role.name !== Role.CUSTOMER && (
        <div className="flex items-center space-x-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={PaymentMethod.CREDIT_CARD} id="r3" />
              <div className={`flex gap-1 items-center ${isPaymentMethodSupported(PaymentMethod.CREDIT_CARD)
                ? 'text-muted-foreground'
                : 'text-muted-foreground/50'
                }`}>
                <Label htmlFor="r3" className={`flex gap-1 items-center ${!isPaymentMethodSupported(PaymentMethod.CREDIT_CARD) ? 'opacity-50' : ''
                  }`}>
                  <CreditCard size={20} />
                  {t('paymentMethod.creditCard')}
                  {!isPaymentMethodSupported(PaymentMethod.CREDIT_CARD) && (
                    <span className="ml-1 text-xs text-orange-500">({t('paymentMethod.voucherNotSupport')})</span>
                  )}
                </Label>
              </div>
            </div>
            {selectedPaymentMethod === PaymentMethod.CREDIT_CARD && (
              <Input
                type="text"
                placeholder={t('paymentMethod.creditCardTransactionIdPlaceholder')}
                className="ml-6 w-full h-9 text-sm"
                value={creditCardTransactionId}
                onChange={(e) => handleTransactionIdChange(e.target.value)}
                disabled={!isPaymentMethodSupported(PaymentMethod.CREDIT_CARD)}
              />
            )}
          </div>
        </div>
      )}
      {userInfo && userInfo.role.name !== Role.CUSTOMER && (
        <div className="flex items-center space-x-2">
          <RadioGroupItem value={PaymentMethod.CASH} id="r4" />
          <div className={`flex gap-1 items-center pl-2 ${isPaymentMethodSupported(PaymentMethod.CASH)
            ? 'text-muted-foreground'
            : 'text-muted-foreground/50'
            }`}>
            <Label htmlFor="r4" className={`flex gap-1 items-center ${!isPaymentMethodSupported(PaymentMethod.CASH) ? 'opacity-50' : ''
              }`}>
              <Coins size={20} />
              {t('paymentMethod.cash')}
              {!isPaymentMethodSupported(PaymentMethod.CASH) && (
                <span className="ml-1 text-xs text-orange-500">({t('paymentMethod.voucherNotSupport')})</span>
              )}
            </Label>
          </div>
        </div>
      )}
      {userInfo && (
        <div className="flex flex-col space-y-2">
          <div className="flex space-x-2">
            <RadioGroupItem
              value={PaymentMethod.POINT}
              id="r5"
              className="mt-[2px]"
            />
            <div className="flex flex-col space-x-2">
              <div className={`flex gap-1 items-center pl-2 ${isPaymentMethodSupported(PaymentMethod.POINT)
                ? 'text-muted-foreground'
                : 'text-muted-foreground/50'
                }`}>
                <Label htmlFor="r5" className={`flex gap-1 items-center ${!isPaymentMethodSupported(PaymentMethod.POINT) ? 'opacity-50' : ''
                  }`}>
                  <CircleDollarSign size={20} />
                  <span className="flex flex-col">
                    <span>{t('paymentMethod.coin')}</span>
                    {!isPaymentMethodSupported(PaymentMethod.POINT) && (
                      <span className="text-xs text-orange-500">({t('paymentMethod.voucherNotSupport')})</span>
                    )}
                  </span>
                </Label>
              </div>
              <span className={`flex gap-1 items-center text-xs font-medium ${isPaymentMethodSupported(PaymentMethod.POINT)
                ? 'text-primary'
                : 'text-primary/50'
                }`}>
                {tProfile('profile.coinBalance')}: {formatCurrency(balance, '')}
                <CoinsIcon className="w-4 h-4" />
              </span>
            </div>
          </div>
          {selectedPaymentMethod === PaymentMethod.POINT && (
            <div className="flex flex-col gap-2 ml-6">
              {scannedQrToken && (
                <div className="flex gap-2 items-center">
                  <span className="inline-flex gap-1 items-center px-2 py-0.5 text-xs font-medium rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-800">
                    <CircleDollarSign size={12} />
                    {t('paymentMethod.qrTokenReady')}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setScannedQrToken('')
                      setIsScanCardDialogOpen(true)
                    }}
                  >
                    {t('paymentMethod.rescanQr')}
                  </Button>
                </div>
              )}
              <p className="text-xs text-orange-600 dark:text-orange-400">
                {t('paymentMethod.pointMethodNote')}
              </p>
            </div>
          )}
        </div>
      )}
    </RadioGroup>
    <ScanRFIDCustomerDialog
      isOpen={isScanCardDialogOpen}
      onOpenChange={setIsScanCardDialogOpen}
      onUserSelect={handleUserSelectFromScan}
      onQrTokenScanned={handleQrTokenScanned}
      suppressToast={true}
      defaultTab="qr"
    />
    </Fragment>
  )
}
