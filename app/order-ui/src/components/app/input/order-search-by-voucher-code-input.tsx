import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Search } from "lucide-react";
import { useSpecificVoucher } from "@/hooks";
import { showErrorToast } from "@/utils";

import { Input, Button } from "@/components/ui";

interface OrderSearchByVoucherCodeInputProps {
    onSearch?: (code: string) => void
    onVoucherChange?: (voucherSlug: string | null) => void
    placeholder?: string
    isLoading?: boolean
}

export default function OrderSearchByVoucherCodeInput({
    onSearch,
    onVoucherChange,
    placeholder,
    isLoading: externalIsLoading
}: OrderSearchByVoucherCodeInputProps) {
    const { t } = useTranslation(['voucher'])
    const [inputValue, setInputValue] = useState<string>('')
    const [internalIsLoading, setInternalIsLoading] = useState(false)
    const [searchCode, setSearchCode] = useState<string>('')
    const lastVoucherSlugRef = useRef<string | null>(null)
    const hasShownErrorRef = useRef<boolean>(false)

    // Nếu có onVoucherChange, tự động search voucher qua API
    const { data: voucherData, isLoading: isLoadingVoucher, isError } = useSpecificVoucher({
        code: onVoucherChange && searchCode ? searchCode : undefined,
    }, !!(onVoucherChange && searchCode && searchCode.trim().length > 0))

    // Sử dụng external loading hoặc loading từ API nếu có onVoucherChange
    const isLoading = externalIsLoading !== undefined
        ? externalIsLoading
        : (onVoucherChange ? isLoadingVoucher : internalIsLoading)

    const handleSearch = () => {
        if (inputValue.trim() === '') {
            // Nếu input rỗng, reset
            if (onVoucherChange) {
                setSearchCode('')
                lastVoucherSlugRef.current = null
                hasShownErrorRef.current = false
                onVoucherChange(null)
            }
            return
        }

        if (onVoucherChange) {
            // Mode tự động search voucher qua API
            hasShownErrorRef.current = false // Reset error flag khi search mới
            setSearchCode(inputValue.trim())
        } else {
            // Mode callback thông thường
            if (externalIsLoading === undefined) {
                setInternalIsLoading(true)
            }
            onSearch?.(inputValue.trim())
            if (externalIsLoading === undefined) {
                setInternalIsLoading(false)
            }
        }
    }

    // Xử lý kết quả khi tìm voucher qua API
    useEffect(() => {
        if (onVoucherChange && !isLoadingVoucher && searchCode) {
            const currentSlug = voucherData?.result?.slug || null

            if (isError || !currentSlug) {
                // Voucher not found or error - luôn reset filter để bảng rỗng
                if (!hasShownErrorRef.current) {
                    // Chỉ show error toast một lần cho mỗi lần search
                    showErrorToast(1000) // 1000 là error code cho voucher not found
                    hasShownErrorRef.current = true
                }
                lastVoucherSlugRef.current = null
                onVoucherChange(null)
            } else if (currentSlug && lastVoucherSlugRef.current !== currentSlug) {
                // Voucher found and slug changed, update filter
                hasShownErrorRef.current = false // Reset error flag khi tìm thấy voucher
                lastVoucherSlugRef.current = currentSlug
                onVoucherChange(currentSlug)
            }
        }
    }, [voucherData?.result?.slug, searchCode, isLoadingVoucher, isError, onVoucherChange])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value)
    }

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    return (
        <div className="flex gap-2">
            <Input
                type="text"
                placeholder={placeholder || t('voucher.enterVoucherCode')}
                value={inputValue}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
            />
            <Button
                onClick={handleSearch}
                disabled={isLoading}
                className="flex justify-center items-center bg-primary"
            >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
        </div>
    )
}