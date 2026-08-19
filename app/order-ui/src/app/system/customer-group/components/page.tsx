import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { SquareMenu, Users, Ticket } from 'lucide-react'

import { DataTable } from '@/components/ui'
import { usePagination, useUserGroupMembers, useVouchers } from '@/hooks'
import { useUserGroupMemberListColumns } from '../DataTable/columns/user-group-member-columns'
import { useCustomerGroupVoucherColumns } from '../DataTable/columns/customer-group-voucher-columns'
import AddUserGroupMemberSheet from '@/components/app/sheet/add-user-group-member-sheet'
import { VoucherDetailInfoDialog } from '@/components/app/dialog'
import { VOUCHER_CUSTOMER_TYPE } from '@/constants'
import { IVoucher } from '@/types'

export default function UserGroupMembersPage() {
    const { t } = useTranslation(['customer'])
    const { t: tHelmet } = useTranslation('helmet')
    const { slug } = useParams()
    const [searchParams, setSearchParams] = useSearchParams()
    const page = Number(searchParams.get('page')) || 1
    const size = Number(searchParams.get('size')) || 10
    const [phonenumber, setPhoneNumber] = useState<string>('')
    const [selectedVoucherSlug, setSelectedVoucherSlug] = useState<string>('')
    const [isVoucherDetailOpen, setIsVoucherDetailOpen] = useState(false)
    const { handlePageChange, handlePageSizeChange, pagination } = usePagination({ isSearchParams: true })
    const { pagination: voucherPagination, handlePageChange: handleVoucherPageChange, handlePageSizeChange: handleVoucherPageSizeChange } = usePagination({ isSearchParams: false })

    const { data: userGroupMemberListData, isLoading: isLoadingList } = useUserGroupMembers({
        userGroup: slug as string,
        page,
        size,
        hasPaging: true,
        phonenumber,
    })

    const voucherParams = slug
        ? {
              userGroup: slug,
              isAppliedUserGroup: true,
              isVerificationIdentity: true,
              customerType: VOUCHER_CUSTOMER_TYPE.GROUP,
              page: voucherPagination.pageIndex,
              size: voucherPagination.pageSize,
              hasPaging: true,
              sort: 'DESC' as const,
          }
        : undefined

    const { data: voucherListData, isLoading: isLoadingVouchers, refetch: refetchVouchers } = useVouchers(voucherParams)

    // add page size to query params
    useEffect(() => {
        setSearchParams((prev) => {
            prev.set('page', pagination.pageIndex.toString())
            prev.set('size', pagination.pageSize.toString())
            return prev
        })
    }, [pagination.pageIndex, pagination.pageSize, setSearchParams])

    const isLoading = isLoadingList
    const data = userGroupMemberListData?.result.items || []
    const totalMembers = userGroupMemberListData?.result.total || 0
    const userGroupName = userGroupMemberListData?.result.items[0]?.userGroup?.name
    const voucherList = voucherListData?.result.items || []

    const handleVoucherRowClick = (voucher: IVoucher) => {
        setSelectedVoucherSlug(voucher.slug)
        setIsVoucherDetailOpen(true)
    }

    const handleVoucherActionSuccess = () => {
        refetchVouchers()
    }

    return (
        <div className="flex flex-col flex-1 w-full">
            <Helmet>
                <meta charSet='utf-8' />
                <title>
                    {tHelmet('helmet.userGroup.title')}
                </title>
                <meta name='description' content={tHelmet('helmet.userGroup.title')} />
            </Helmet>
            <div className="flex justify-between items-center mb-4">
                <span className="flex gap-1 items-center text-lg">
                    <SquareMenu />
                    {t('customer.userGroup.userGroupMemberTitle')}
                </span>
                <AddUserGroupMemberSheet />
            </div>

            {/* User Group Info Card */}
            <div className="p-4 mb-6 bg-gradient-to-r rounded-lg border shadow-sm to-primary/5 from-primary/10 border-primary/20">
                <div className="flex justify-between items-center">
                    <div className="flex gap-3 items-center">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {userGroupName || t('customer.userGroup.userGroupName')}
                            </h2>
                            <p className="text-sm text-gray-600">
                                {t('customer.userGroup.userGroupMemberTitle')}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                            {totalMembers}
                        </div>
                        <div className="text-sm text-gray-500">
                            {t('customer.userGroup.totalMembers')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Members Table */}
            <div className="grid grid-cols-1 gap-2 mt-4 h-full">
                <DataTable
                    columns={useUserGroupMemberListColumns()}
                    data={data}
                    isLoading={isLoading}
                    pages={userGroupMemberListData?.result.totalPages || 1}
                    hiddenInput={false}
                    searchPlaceholder={t('customer.userGroup.searchByPhoneNumber')}
                    onInputChange={setPhoneNumber}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                />
            </div>

            {/* Applied Vouchers Section */}
            <div className="mt-8">
                <div className="flex gap-1 items-center text-lg">
                    <Ticket className="w-5 h-5" />
                    {t('customer.userGroup.appliedVouchers')}
                </div>
                <DataTable
                    columns={useCustomerGroupVoucherColumns(handleVoucherActionSuccess)}
                    data={voucherList}
                    isLoading={isLoadingVouchers}
                    pages={voucherListData?.result.totalPages || 1}
                    hiddenInput={true}
                    onPageChange={handleVoucherPageChange}
                    onPageSizeChange={handleVoucherPageSizeChange}
                    onRowClick={handleVoucherRowClick}
                />
            </div>

            <VoucherDetailInfoDialog
                voucherSlug={selectedVoucherSlug}
                isOpen={isVoucherDetailOpen}
                onOpenChange={setIsVoucherDetailOpen}
                showTrigger={false}
            />
        </div>
    )
}
