import { useCallback, useMemo } from 'react'
import moment from 'moment'
import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import {
  Button,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui'
import { IUserInfo } from '@/types'
import { Copy, MoreHorizontal } from 'lucide-react'
import { showToast } from '@/utils'
import UpdateUserStatusDialog from '@/components/app/dialog/update-user-status-dialog'
import {
  AssignMembershipCardToExistingMemberDialog,
  ReplaceMembershipCardDialog,
  DeleteMembershipCardDialog,
  UpdateMembershipCardStatusDialog,
  UpdatePhoneNumberDialog,
} from '@/components/app/dialog'
import { UserRequirementStatus, UserRequirementKey, UserRequirementScope } from '@/constants/user.constants'

export const useUserListColumns = (): ColumnDef<IUserInfo>[] => {
  const { t } = useTranslation(['customer'])
  const { t: tCommon } = useTranslation('common')
  const { t: tToast } = useTranslation('toast')

  // `useCallback` không phải trang trí: handler này nằm trong deps của `useMemo` dựng
  // cột bên dưới — nếu tạo mới mỗi render thì mảng cột cũng dựng lại mỗi render và
  // useMemo mất tác dụng hoàn toàn.
  const handleCopyPhoneNumber = useCallback(
    (phonenumber: string) => {
      navigator.clipboard.writeText(phonenumber)
      showToast(tToast('toast.copyPhonenumberSuccess'))
    },
    [tToast],
  )

  return useMemo<ColumnDef<IUserInfo>[]>(() => [
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.createdAt')} />
      ),
      cell: ({ row }) => {
        const createdAt = row.getValue('createdAt')
        return (
          <div className="w-36 text-sm">
            {createdAt ? moment(createdAt).format('HH:mm DD/MM/YYYY') : ''}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.status')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        return <div className={`text-sm w-36 ${user?.isActive ? 'text-green-500' : 'text-destructive'}`}>{user?.isActive ? t('customer.active') : t('customer.inactive')}</div>
      },
    },
    {
      accessorKey: 'slug',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.slug')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        return <div className="text-sm">{user?.slug}</div>
      },
    },
    {
      accessorKey: 'fullname',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.name')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="text-sm min-w-36">
            {user?.firstName} {user?.lastName}
          </div>
        )
      },
    },
    {
      accessorKey: 'phoneNumber',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.phoneNumber')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        const phonenumber = user?.phonenumber
        if (!phonenumber) return <div className="text-sm">-</div>
        return (
          // `group` + `opacity-0 group-hover:opacity-100`: nút chỉ hiện khi trỏ vào ô,
          // để cột không bị rối bởi một icon trên mỗi dòng. `focus-visible:opacity-100`
          // để người dùng bàn phím vẫn thấy được nút khi tab tới.
          <div className="group flex gap-1 items-center text-sm">
            {phonenumber}
            <Button
              variant="ghost"
              className="p-0 w-6 h-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              title={tCommon('common.copy')}
              // Hàng của bảng có `onRowClick` điều hướng sang trang chi tiết khách. Click
              // vào nút copy nằm TRONG hàng nên sự kiện sẽ nổi bọt lên hàng và làm nhảy
              // trang — `stopPropagation` chặn ngay tại đây. Cần cả `onMouseDown`: một số
              // handler hàng bắt mousedown chứ không phải click, và chặn ở click là quá
              // muộn cho những handler đó.
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                handleCopyPhoneNumber(phonenumber)
              }}
            >
              <span className="sr-only">{tCommon('common.copy')}</span>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        )
      },
    },
    {
      accessorKey: 'membershipCard',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.membershipCard')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        const isExistMembershipCard = user?.membershipCard
        return (
          <span className={`text-sm ${isExistMembershipCard ? 'text-green-500' : 'text-destructive'}`}>
            {isExistMembershipCard ? tCommon('common.yes') : tCommon('common.no')}
          </span>
        )
      },
    },
    {
      accessorKey: 'membershipCardStatus',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.membershipCardStatus')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        const isActive = user?.membershipCard?.isActive
        return (
          <span className={`text-sm ${isActive ? 'text-green-500' : 'text-destructive'}`}>
            {isActive ? tCommon('common.active') : tCommon('common.inactive')}
          </span>
        )
      },
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.email')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        return <div className="text-sm">{user?.email}</div>
      },
    },
    {
      accessorKey: 'dob',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.dob')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="text-sm w-32">
            {user?.dob ? user?.dob : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'branch',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.branch')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="text-sm min-w-32">
            {user?.branch?.name || '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'verifiedStatus',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.verifiedStatus')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        const isEmailVerified = user?.isVerifiedEmail
        const isPhoneVerified = user?.isVerifiedPhonenumber
        return (
          <div className="text-sm min-w-32">
            <div className="flex flex-col gap-1">
              <span className={isEmailVerified ? 'text-green-500' : 'text-destructive'}>
                {isEmailVerified ? t('customer.verifiedEmail') : t('customer.notVerifiedEmail')}
              </span>
              <span className={isPhoneVerified ? 'text-green-500' : 'text-destructive'}>
                {isPhoneVerified ? t('customer.verifiedPhone') : t('customer.notVerifiedPhone')}
              </span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'userRequirements',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.userRequirements')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        const requirements = user?.userRequirements || []
        const pendingRequirements = requirements.filter(
          (req) => req.status === UserRequirementStatus.PENDING
        )
        const hasPendingRequirements = pendingRequirements.length > 0
        
        return (
          <div className="text-sm min-w-32">
            {hasPendingRequirements ? (
              <div className="flex flex-col gap-1">
                <span className="text-orange-500 font-medium">
                  {t('customer.hasRequirements')} ({pendingRequirements.length})
                </span>
                <div className="text-xs text-muted-foreground">
                  {pendingRequirements.map((req, idx) => (
                    <div key={idx}>
                      {req.key === UserRequirementKey.NEED_UPDATE_PASSWORD
                        ? t('customer.needUpdatePassword')
                        : req.key === UserRequirementKey.NEED_UPDATE_PHONE_NUMBER
                        ? t('customer.needUpdatePhoneNumber')
                        : req.key}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-green-500">{t('customer.noRequirements')}</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: tCommon('common.action'),
      cell: ({ row }) => {
        const user = row.original
        return (
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-0 w-8 h-8">
                  <span className="sr-only">{tCommon('common.action')}</span>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {tCommon('common.action')}
                </DropdownMenuLabel>
                <div onClick={(e) => e.stopPropagation()}>
                  <UpdateUserStatusDialog user={user} />
                </div>
                {user?.userRequirements?.some(req => req.key === UserRequirementKey.NEED_UPDATE_PHONE_NUMBER && req.status === UserRequirementStatus.PENDING && req.scope === UserRequirementScope.INITIAL) && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <UpdatePhoneNumberDialog user={user} />
                  </div>
                )}
                {!user?.membershipCard ? (
                  // Nếu không có thẻ thành viên: Hiển thị dialog gán thẻ
                  <div onClick={(e) => e.stopPropagation()}>
                    <AssignMembershipCardToExistingMemberDialog user={user} />
                  </div>
                ) : (
                  // Nếu có thẻ thành viên (dù hoạt động hay không): Hiển thị các dialog quản lý thẻ
                  <>
                    <div onClick={(e) => e.stopPropagation()}>
                      <ReplaceMembershipCardDialog user={user} />
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <UpdateMembershipCardStatusDialog user={user} />
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DeleteMembershipCardDialog user={user} />
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ], [t, tCommon, handleCopyPhoneNumber])
}
