import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Scan, QrCode } from 'lucide-react'
import toast from 'react-hot-toast'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Button,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui'
import { useUsers } from '@/hooks'
import { Role } from '@/constants'
import { IUserInfo } from '@/types'
import { listenRFID } from '@/utils'
import { UserRequirementLevel, UserRequirementStatus, UserRequirementKey, UserRequirementScope } from '@/constants/user.constants'
import { UpdatePhoneNumberForm } from '@/components/app/form'

type ScanTab = 'rfid' | 'qr'

interface ScanRFIDCustomerDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onUserSelect: (user: IUserInfo, cardCode?: string) => void
    suppressToast?: boolean
    // When provided, a QR tab appears. On scan the dialog fires this callback
    // with the raw token string and closes. Parent holds the token and passes
    // it to POST /payment/initiate as qrToken.
    onQrTokenScanned?: (qrToken: string) => void
    defaultTab?: ScanTab
}

export default function ScanRFIDCustomerDialog({
    isOpen,
    onOpenChange,
    onUserSelect,
    suppressToast = false,
    onQrTokenScanned,
    defaultTab,
}: ScanRFIDCustomerDialogProps) {
    const { t } = useTranslation(['menu', 'customer'])
    const showQrTab = !!onQrTokenScanned
    const [activeTab, setActiveTab] = useState<ScanTab>(defaultTab ?? (showQrTab ? 'qr' : 'rfid'))
    const [cardCode, setCardCode] = useState<string>('')
    const [scannedCode, setScannedCode] = useState<string>('')
    const [isShowingUpdatePhoneForm, setIsShowingUpdatePhoneForm] = useState(false)
    const processedCodeRef = useRef<string>('')
    const isProcessingRef = useRef(false)
    const onUserSelectRef = useRef(onUserSelect)
    const onOpenChangeRef = useRef(onOpenChange)
    const suppressToastRef = useRef(suppressToast)
    const onQrTokenScannedRef = useRef(onQrTokenScanned)
    const activeTabRef = useRef<ScanTab>(activeTab)

    /**
     * FLOW HOẠT ĐỘNG:
     *
     * BƯỚC 1: Dialog mở (isOpen = true)
     *   → useEffect setup RFID listener
     *   → Hiển thị UI "Đang chờ quét thẻ..."
     *   → Reset processedCodeRef để có thể quét lại
     *
     * BƯỚC 2: User quét thẻ RFID
     *   → listenRFID callback được gọi với scannedString
     *   → Set cardCode (để hiển thị) và scannedCode (để search API)
     *   → UI hiển thị "Đang tìm kiếm..."
     *
     * BƯỚC 3: useUsers hook tự động gọi API
     *   → API search user với membershipCard = scannedCode
     *   → isLoading = true → UI hiển thị "Đang tìm kiếm..."
     *
     * BƯỚC 4: API trả về response
     *   → useEffect xử lý kết quả:
     *
     *   CASE 1: Tìm thấy 1 user ACTIVE
     *     → Show toast "Đã tìm thấy thành viên"
     *     → Gọi onUserSelect(user) để lưu user mới
     *     → Đóng dialog ngay lập tức (onOpenChange(false))
     *     → Reset tất cả state (cardCode, scannedCode, processedCodeRef)
     *
     *   CASE 2: Tìm thấy 1 user INACTIVE
     *     → Hiển thị message lỗi
     *     → Reset isProcessingRef và processedCodeRef sau 100ms để có thể scan lại
     *
     *   CASE 3: Tìm thấy nhiều users
     *     → Hiển thị message "multipleUsersFound"
     *     → Reset isProcessingRef và processedCodeRef sau 100ms để có thể scan lại
     *
     *   CASE 4: Không tìm thấy user
     *     → Hiển thị message "userNotFound"
     *     → Reset isProcessingRef và processedCodeRef sau 100ms để có thể scan lại
     *
     * BƯỚC 5: Dialog đóng
     *   → useEffect cleanup reset tất cả states
     *   → Sẵn sàng cho lần quét tiếp theo
     */

    // Search user by membershipCard (RFID only). QR tab bypasses user lookup entirely.
    // Không gọi API khi form update phone number đang hiển thị
    const enabled = !!scannedCode && isOpen && !isShowingUpdatePhoneForm

    const { data: users, isLoading } = useUsers(
        scannedCode && !isShowingUpdatePhoneForm
            ? {
                order: 'DESC',
                page: 1,
                size: 10,
                membershipCard: scannedCode,
                role: Role.CUSTOMER,
                hasPaging: false,
            }
            : null,
        enabled
    )

    // Cập nhật refs khi callbacks thay đổi
    useEffect(() => {
        onUserSelectRef.current = onUserSelect
        onOpenChangeRef.current = onOpenChange
        suppressToastRef.current = suppressToast
        onQrTokenScannedRef.current = onQrTokenScanned
    }, [onUserSelect, onOpenChange, suppressToast, onQrTokenScanned])

    // Track activeTab in ref so the RFID listener callback (closure) can read the current tab
    useEffect(() => {
        activeTabRef.current = activeTab
    }, [activeTab])

    // Reset tab to default when dialog closes
    useEffect(() => {
        if (!isOpen) {
            setActiveTab(defaultTab ?? (showQrTab ? 'qr' : 'rfid'))
        }
    }, [isOpen, defaultTab, showQrTab])

    // Setup RFID listener khi dialog mở
    useEffect(() => {
        if (!isOpen) {
            setCardCode('')
            setScannedCode('')
            setIsShowingUpdatePhoneForm(false)
            processedCodeRef.current = ''
            isProcessingRef.current = false
            return
        }

        const cleanup = listenRFID((scannedString: string) => {
            // QR tab: fire callback immediately — no user lookup, no phone verification
            if (activeTabRef.current === 'qr') {
                if (scannedString === processedCodeRef.current) return
                processedCodeRef.current = scannedString
                onQrTokenScannedRef.current?.(scannedString)
                onOpenChangeRef.current(false)
                return
            }

            // RFID tab: trigger useUsers search as before
            if (scannedString !== processedCodeRef.current) {
                setCardCode(scannedString)
                setScannedCode(scannedString)
                isProcessingRef.current = false
            }
        })

        return () => {
            cleanup()
        }
    }, [isOpen])

    // Tự động chọn user nếu tìm thấy 1 user duy nhất - đóng dialog ngay lập tức
    useEffect(() => {
        // Chỉ xử lý khi:
        // - Dialog đang mở
        // - Có scannedCode
        // - Có users data
        // - Không đang loading
        // - Chưa xử lý mã này
        // - Chưa đang xử lý
        if (
            !isOpen ||
            !scannedCode ||
            !users?.result?.items ||
            isLoading ||
            processedCodeRef.current === scannedCode ||
            isProcessingRef.current
        ) {
            return
        }

        // Đánh dấu đang xử lý
        isProcessingRef.current = true
        processedCodeRef.current = scannedCode

        if (users.result.items.length === 1) {
            const user = users.result.items[0]

            // Kiểm tra userRequirements: nếu có requirement với level = BLOCK, status = PENDING và scope = INITIAL thì không cho phép sử dụng
            const requirements = user?.userRequirements || []
            const blockedRequirements = requirements.filter(
                (req) =>
                    req.level === UserRequirementLevel.BLOCK &&
                    req.status === UserRequirementStatus.PENDING &&
                    req.scope === UserRequirementScope.INITIAL
            )

            // Kiểm tra xem có requirement cần cập nhật số điện thoại không
            const hasPhoneNumberRequirement = blockedRequirements.some(
                (req) => req.key === UserRequirementKey.NEED_UPDATE_PHONE_NUMBER
            )

            if (hasPhoneNumberRequirement) {
                // Có requirement cần cập nhật số điện thoại - không reset để hiển thị form
                // Đánh dấu form đang hiển thị để không gọi useUsers với membershipCard
                setIsShowingUpdatePhoneForm(true)
                return
            }

            if (blockedRequirements.length > 0) {
                // Có requirement bị block khác - hiển thị message và cho phép scan lại
                setTimeout(() => {
                    isProcessingRef.current = false
                    processedCodeRef.current = ''
                }, 100)
            } else if (user.isActive) {
                // Lưu scannedCode trước khi reset (cần truyền vào callback)
                const currentScannedCode = scannedCode
                // Reset state NGAY LẬP TỨC để UI không hiển thị gì
                setCardCode('')
                setScannedCode('')
                processedCodeRef.current = ''
                isProcessingRef.current = false
                // Show toast thông báo thành công (only if not suppressed)
                // Use ref to get latest value to avoid stale closure
                if (!suppressToastRef.current) {
                    toast.success(t('menu.userFound'))
                }
                // Gọi callback để lưu user mới và cardCode (scannedCode)
                onUserSelectRef.current(user, currentScannedCode)
                // Đóng dialog ngay lập tức
                onOpenChangeRef.current(false)
            } else {
                // User không active - hiển thị message và cho phép scan lại
                setTimeout(() => {
                    isProcessingRef.current = false
                    processedCodeRef.current = ''
                }, 100)
            }
        } else if (users.result.items.length > 1) {
            // Nhiều users - hiển thị message và cho phép scan lại
            setTimeout(() => {
                isProcessingRef.current = false
                processedCodeRef.current = ''
            }, 100)
        } else {
            // Không tìm thấy user - hiển thị message và cho phép scan lại
            setTimeout(() => {
                isProcessingRef.current = false
                processedCodeRef.current = ''
            }, 100)
        }
    }, [isOpen, users, scannedCode, isLoading, t])

    const handleClose = () => {
        onOpenChange(false)
        setCardCode('')
        setScannedCode('')
        setIsShowingUpdatePhoneForm(false)
    }

    // Handler khi form cập nhật số điện thoại thành công
    const handlePhoneNumberUpdateSuccess = () => {
        // Reset form state
        setIsShowingUpdatePhoneForm(false)
        // Đóng dialog
        handleClose()
        // Reset để có thể scan lại
        processedCodeRef.current = ''
        isProcessingRef.current = false
    }

    // RFID content shared between tab mode and RFID-only mode
    const rfidContent = (
        <div className="flex flex-col gap-4">
            {cardCode ? (
                <div className="space-y-2">
                    {isLoading ? (
                        <div className="py-4 text-center">
                            <p className="text-sm text-muted-foreground">
                                {t('menu.searching')}
                            </p>
                        </div>
                    ) : users?.result?.items && users.result.items.length > 0 ? (
                        <div className="space-y-2">
                            {users.result.items.length === 1 ? (
                                // Kiểm tra xem có requirement bị block không
                                (() => {
                                    const user = users.result.items[0]
                                    const requirements = user?.userRequirements || []
                                    const blockedRequirements = requirements.filter(
                                        (req) =>
                                            req.level === UserRequirementLevel.BLOCK &&
                                            req.status === UserRequirementStatus.PENDING &&
                                            req.scope === UserRequirementScope.INITIAL
                                    )

                                    // Kiểm tra xem có requirement cần cập nhật số điện thoại không
                                    const hasPhoneNumberRequirement = blockedRequirements.some(
                                        (req) => req.key === UserRequirementKey.NEED_UPDATE_PHONE_NUMBER
                                    )

                                    // Nếu có requirement cần cập nhật số điện thoại, hiển thị form
                                    if (hasPhoneNumberRequirement) {
                                        return (
                                            <div className="space-y-4">
                                                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                                                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-1">
                                                        {t('menu.needUpdatePhoneNumberError')}
                                                    </p>
                                                    <p className="text-xs text-yellow-600 dark:text-yellow-300">
                                                        {t('menu.needUpdatePhoneNumberErrorDescription')}
                                                    </p>
                                                </div>
                                                <UpdatePhoneNumberForm
                                                    user={user}
                                                    onSubmit={handlePhoneNumberUpdateSuccess}
                                                />
                                            </div>
                                        )
                                    }

                                    if (blockedRequirements.length > 0) {
                                        // Lấy các requirement keys để hiển thị message cụ thể
                                        const hasPasswordRequirement = blockedRequirements.some(
                                            (req) => req.key === UserRequirementKey.NEED_UPDATE_PASSWORD
                                        )

                                        // Tạo danh sách các message lỗi
                                        const errorMessages: string[] = []
                                        if (hasPasswordRequirement) {
                                            errorMessages.push(t('menu.needUpdatePasswordError'))
                                        }

                                        // Nếu có requirement khác, hiển thị message
                                        if (errorMessages.length > 0) {
                                            const descriptionMessages: string[] = []
                                            if (hasPasswordRequirement) {
                                                descriptionMessages.push(t('menu.needUpdatePasswordErrorDescription'))
                                            }

                                            return (
                                                <div className="p-3 bg-red-50 rounded-lg border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                                                    <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                                                        {t('menu.cardBlockedByRequirements')}
                                                    </p>
                                                    <ul className="list-disc list-inside space-y-1 text-xs text-red-600 dark:text-red-300 mb-2">
                                                        {errorMessages.map((msg, index) => (
                                                            <li key={index}>{msg}</li>
                                                        ))}
                                                    </ul>
                                                    {descriptionMessages.length > 0 && (
                                                        <div className="space-y-1">
                                                            {descriptionMessages.map((desc, index) => (
                                                                <p key={index} className="text-xs text-red-600 dark:text-red-300">
                                                                    {desc}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        }

                                        // Fallback nếu không match requirement key nào
                                        return (
                                            <div className="p-3 bg-red-50 rounded-lg border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                                                <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                                                    {t('menu.cardBlockedByRequirements')}
                                                </p>
                                                <p className="text-xs text-red-600 dark:text-red-300">
                                                    {t('menu.cardBlockedByRequirementsDescription')}
                                                </p>
                                            </div>
                                        )
                                    }

                                    // Không hiển thị "userFound" nữa, chỉ show toast và đóng dialog
                                    return null
                                })()
                            ) : (
                                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                        {t('menu.multipleUsersFound')}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                            <p className="text-sm text-red-700 dark:text-red-400">
                                {t('menu.userNotFound')}
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col justify-center items-center py-8 text-center">
                    <div className="p-4 mb-4 rounded-full bg-primary/10">
                        <Scan className="w-12 h-12 text-primary" />
                    </div>
                    <p className="mb-2 text-muted-foreground">
                        {t('paymentMethod.waitingRfid')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {t('paymentMethod.rfidInstruction')}
                    </p>
                </div>
            )}

            {/* Chỉ hiển thị nút đóng khi không có form update phone number */}
            {!isShowingUpdatePhoneForm && (
                <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={handleClose}>
                        {t('menu.close')}
                    </Button>
                </div>
            )}
        </div>
    )

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex gap-2 items-center">
                        <Scan className="w-5 h-5" />
                        {t('menu.scanCardToSearch')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('menu.scanCardInstruction')}
                    </DialogDescription>
                </DialogHeader>

                {showQrTab ? (
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ScanTab)}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="rfid">
                                <Scan className="mr-2 h-4 w-4" />
                                {t('paymentMethod.rfidTab')}
                            </TabsTrigger>
                            <TabsTrigger value="qr">
                                <QrCode className="mr-2 h-4 w-4" />
                                {t('paymentMethod.qrTab')}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="rfid">
                            {rfidContent}
                        </TabsContent>
                        <TabsContent value="qr">
                            <div className="flex flex-col items-center gap-4 py-6 text-center text-muted-foreground">
                                <QrCode size={48} className="opacity-50" />
                                <p className="text-sm">{t('paymentMethod.qrScanInstruction')}</p>
                            </div>
                        </TabsContent>
                    </Tabs>
                ) : (
                    /* RFID-only mode: render existing content as-is */
                    <>
                        {rfidContent}
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
