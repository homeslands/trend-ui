import { useTranslation } from 'react-i18next'

import { useBranch, useGetAuthorityGroup, useGetChefAreas } from '@/hooks'
import { useBranchStore, useUserStore } from '@/stores'
import { CreateChefAreaDialog } from '@/components/app/dialog'
import { ChefAreaCard } from '@/app/system/chef-area/components'
import { BranchSelect } from '@/components/app/select'
import { hasPermissionInBoth } from '@/utils'

export function SystemChefAreaManagementTabsContent() {
  const { t } = useTranslation(['chefArea'])
  const { data: authorityData } = useGetAuthorityGroup({})
  const { userInfo } = useUserStore()
  const { branch } = useBranchStore()
  const authorityGroup = authorityData?.result ?? [];
  const authorityGroupCodes = Array.isArray(authorityGroup)
    ? authorityGroup.flatMap(group => group.authorities.map(auth => auth.code))
    : [];
  const userPermissionCodes = userInfo?.role.permissions.map(p => p.authority.code) ?? [];

  const isViewPermissionValid = hasPermissionInBoth("VIEW_KITCHEN_AREA", authorityGroupCodes, userPermissionCodes);
  const isDeletePermissionValid = hasPermissionInBoth("DELETE_KITCHEN_AREA", authorityGroupCodes, userPermissionCodes);
  const isUpdatePermissionValid = hasPermissionInBoth("EDIT_KITCHEN_AREA", authorityGroupCodes, userPermissionCodes);

  const { data: areaData } = useGetChefAreas(branch?.slug || '')
  const { data: branchData } = useBranch();
  const branchGroups = (branchData?.result || []).map((branch) => ({
    ...branch,
    areas: areaData?.result.filter((area) => area.branch.slug === branch.slug) || [],
  })).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col flex-1 w-full">
      <div className="flex gap-2 justify-end items-center pb-4">
        {isViewPermissionValid && <BranchSelect />}
        {isViewPermissionValid && <CreateChefAreaDialog />}
      </div>
      <div className='flex flex-col gap-4 pb-4'>
        {branchGroups?.length > 0 ? branchGroups.map((group) => (
          group.areas.length > 0 &&
          <div className='gap-4 mt-4 w-full' key={group.slug}>
            {/* <div className='uppercase primary-highlight'>{group.name} - {group.address}</div> */}
            <div className="grid grid-cols-1 gap-2 h-full sm:grid-cols-2">
              {group.areas.map((area) => (
                <ChefAreaCard key={area.slug} chefArea={area} isDeletePermissionValid={isDeletePermissionValid} isUpdatePermissionValid={isUpdatePermissionValid} />
              ))}
            </div>
          </div>
        )) : <p>{t('chefArea.noData')}</p>}
      </div>
    </div>
  )
}

