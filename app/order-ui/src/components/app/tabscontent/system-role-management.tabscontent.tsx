import { DataTable } from '@/components/ui'
import { useRoles } from '@/hooks'
import { useRoleListColumns } from '@/app/system/role/DataTable/columns'
import { useNavigate } from 'react-router-dom'
import { IRole } from '@/types'
import { ROUTE } from '@/constants'

export function SystemRoleManagementTabsContent() {
  const navigate = useNavigate()
  const { data, isLoading } = useRoles()

  const handleRowClick = (row: IRole) => {
    navigate(`${ROUTE.STAFF_ROLE_MANAGEMENT}/${row.slug}`)
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      <DataTable
        columns={useRoleListColumns()}
        data={data?.result || []}
        isLoading={isLoading}
        pages={1}
        onPageChange={() => { }}
        onPageSizeChange={() => { }}
        onRowClick={handleRowClick}
      />
    </div>
  )
}

