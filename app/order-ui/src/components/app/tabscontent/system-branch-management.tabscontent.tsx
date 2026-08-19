import { useNavigate } from 'react-router-dom'
import { DataTable } from '@/components/ui'
import { useBranch } from '@/hooks'
import { useBranchesColumns } from '@/app/system/branch/DataTable/columns'
import { BranchActionOptions } from '@/app/system/branch/DataTable/actions'
import { ROUTE } from '@/constants'
import { IBranch } from '@/types'

export function SystemBranchManagementTabsContent() {
  const { data, isLoading } = useBranch()
  const navigate = useNavigate()

  const handleRowClick = (branch: IBranch) => {
    navigate(ROUTE.STAFF_BRANCH_DETAIL.replace(':slug', branch.slug))
  }

  return (
    <div className="grid w-full h-full grid-cols-1">
      <DataTable
        columns={useBranchesColumns()}
        data={data?.result || []}
        isLoading={isLoading}
        pages={1}
        onPageChange={() => { }}
        onPageSizeChange={() => { }}
        actionOptions={BranchActionOptions}
        onRowClick={handleRowClick}
      />
    </div>
  )
}

