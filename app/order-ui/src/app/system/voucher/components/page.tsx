import { useCallback, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { SquareMenu } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DataTable } from '@/components/ui'
import { usePagination, useSpecificVoucher, useVouchers } from '@/hooks'
import { VoucherAction } from '../DataTable/actions'
import { useVoucherColumns } from '../DataTable/columns'
import { IGetAllVoucherRequest, IVoucher } from '@/types'
import { VoucherDetailInfoDialog } from '@/components/app/dialog'
import { VOUCHER_CUSTOMER_TYPE } from '@/constants'

export default function VoucherPage() {
    const { t } = useTranslation(['voucher'])
    const { t: tHelmet } = useTranslation('helmet')
    const { slug } = useParams()
    const [searchParams] = useSearchParams()
    const userGroupSlug = searchParams.get('userGroup') || ''
    const customerTypeParam = searchParams.get('customerType') || VOUCHER_CUSTOMER_TYPE.ALL
    const [isOpen, setIsOpen] = useState(false)
    const [selectedVouchers, setSelectedVouchers] = useState<IVoucher[]>([])
    const [voucherCode, setVoucherCode] = useState<string>('')
    const [selectedVoucherSlug, setSelectedVoucherSlug] = useState<string>('')
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
    const { handlePageChange, handlePageSizeChange, pagination } = usePagination()
    
    // Xây dựng params cho useVouchers dựa trên customerType
    const voucherParams: IGetAllVoucherRequest = {
        sort: 'DESC',
        voucherGroup: slug,
        page: pagination.pageIndex,
        size: pagination.pageSize,
        hasPaging: true,
        customerType: customerTypeParam as VOUCHER_CUSTOMER_TYPE,
    }

    // Chỉ thêm các filter liên quan đến userGroup khi customerType là GROUP
    if (customerTypeParam === VOUCHER_CUSTOMER_TYPE.GROUP && userGroupSlug) {
        voucherParams.isVerificationIdentity = true
        voucherParams.isAppliedUserGroup = true
        voucherParams.userGroup = userGroupSlug
    }

    const { data: voucherListData, isLoading: isLoadingList, refetch: refetchList } = useVouchers(voucherParams)

    const { data: specificVoucher, isLoading: isLoadingSpecificVoucher } = useSpecificVoucher({
        code: voucherCode,
    }, !!voucherCode && voucherCode.trim().length > 0)

    const data = voucherCode
        ? specificVoucher ? [specificVoucher.result] : []
        : voucherListData?.result.items || []

    const isLoading = voucherCode ? isLoadingSpecificVoucher : isLoadingList

    const handleSelectionChange = useCallback((selectedSlugs: IVoucher[]) => {
        setSelectedVouchers(selectedSlugs)
    }, [])

    const handleCreateVoucherSuccess = () => {
        setSelectedVouchers([])
        refetchList()
    }

    const handleUpdateVoucherSuccess = () => {
        refetchList()
    }

    const handleSearchChange = (value: string) => {
        if (value === '') {
            setVoucherCode('')
            return
        }
        setVoucherCode(value)
    }

    const handleRowClick = (voucher: IVoucher) => {
        setSelectedVoucherSlug(voucher.slug)
        setIsDetailDialogOpen(true)
    }

    return (
        <div className="flex flex-col flex-1 w-full">
            <Helmet>
                <meta charSet='utf-8' />
                <title>
                    {tHelmet('helmet.voucher.title')}
                </title>
                <meta name='description' content={tHelmet('helmet.voucher.title')} />
            </Helmet>
            <span className="flex gap-1 items-center text-lg">
                <SquareMenu />
                {t('voucher.voucherTitle')}
            </span>
            <div className="grid grid-cols-1 gap-2 mt-4 h-full">
                <DataTable
                    columns={useVoucherColumns(handleUpdateVoucherSuccess, handleSelectionChange, selectedVouchers)}
                    data={data}
                    isLoading={isLoading}
                    pages={voucherListData?.result.totalPages || 1}
                    hiddenInput={false}
                    searchPlaceholder={t('voucher.searchByCode')}
                    onInputChange={handleSearchChange}
                    onRowClick={handleRowClick}
                    actionOptions={() => <VoucherAction onSuccess={handleCreateVoucherSuccess} selectedVouchers={selectedVouchers} onOpenChange={setIsOpen} isConfirmExportVoucherDialogOpen={isOpen} />}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                />
            </div>
            <VoucherDetailInfoDialog
                voucherSlug={selectedVoucherSlug}
                isOpen={isDetailDialogOpen}
                onOpenChange={setIsDetailDialogOpen}
                showTrigger={false}
            />
        </div>
    )
}
