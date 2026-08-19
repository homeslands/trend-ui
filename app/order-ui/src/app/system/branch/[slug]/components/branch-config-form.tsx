import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronsLeftRight, Plus, Trash2 } from 'lucide-react'

import { Label, Input, Button, Skeleton } from '@/components/ui'
import {
  useCreateBranchConfig,
} from '@/hooks'
import { IBranchConfig, ICreateBranchConfigRequest } from '@/types'
import { showToast } from '@/utils'
import { ButtonLoading } from '@/components/app/loading'
import { DeleteBranchConfigDialog, UpdateBranchConfigDialog } from '@/components/app/dialog'

// Helper function to get translated config key
// Tham khảo logic từ system-lock-management/page.tsx
// Trong system-lock-management: dùng `system.lockFeature.${name.toLowerCase()}` 
// mặc dù đã có useTranslation(['system']), nhưng vẫn chỉ định đầy đủ path
const getTranslatedConfigKey = (
  key: string,
  tBranch: (key: string, options?: { defaultValue?: string }) => string,
): string => {
  // Tạo i18n key với format đầy đủ: branch.configKeys.KEY
  // Giống như system-lock-management dùng system.lockFeature.${name}
  const i18nKey = `branch.configKeys.${key}`
  // Sử dụng defaultValue là key gốc nếu không tìm thấy translation
  return tBranch(i18nKey, { defaultValue: key })
}

interface BranchConfigFormProps {
  branchSlug: string
  configs: IBranchConfig[]
  isLoading: boolean
  onSuccess?: () => void
}

const NewConfigRow = ({
  config,
  onChange,
  onRemove,
  t,
}: {
  config: { key: string; value: string; description?: string }
  onChange: (field: 'key' | 'value' | 'description', value: string) => void
  onRemove: () => void
  t: (key: string) => string
}) => (
  <div className="grid items-center w-full grid-cols-1 col-span-8 gap-4 lg:grid-cols-3">
    <div className="flex flex-col w-full gap-2">
      <Label>{t('config.key')}</Label>
      <Input
        value={config.key}
        onChange={(e) => onChange('key', e.target.value)}
        placeholder={t('config.enterKey')}
      />
    </div>
    <div className="flex flex-col w-full gap-2">
      <Label>{t('config.value')}</Label>
      <Input
        value={config.value}
        onChange={(e) => onChange('value', e.target.value)}
        placeholder={t('config.enterValue')}
      />
    </div>
    <div className="flex items-end gap-2">
      <div className="flex flex-col flex-1 w-full gap-2">
        <Label>{t('config.description')}</Label>
        <Input
          value={config.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder={t('config.enterDescription')}
        />
      </div>
      <Button
        type="button"
        variant="destructive"
        size="icon"
        onClick={onRemove}
        className="h-10"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  </div>
)

const ConfigRow = ({ 
  config, 
  tBranch,
}: { 
  config: IBranchConfig
  tBranch: (key: string) => string
}) => {
  const translatedKey = getTranslatedConfigKey(config.key, tBranch)
  
  return (
    <div className="grid grid-cols-1 gap-2 p-2 bg-white border rounded-md dark:bg-transparent lg:grid-cols-8 lg:items-center">
      {/* Column 1: Key */}
      <div className="flex items-center gap-2 col-span-2">
        <div className="p-2 bg-gray-100 rounded-full dark:bg-gray-800 h-fit w-fit">
          <ChevronsLeftRight size={18} />
        </div>
        <span className="text-sm font-medium">{translatedKey}</span>
      </div>
      
      {/* Column 2: Value - căn trái với khoảng cách */}
      <div className="flex items-center col-span-5 pl-4 lg:pl-8">
        <span className="text-sm text-left">{config.value}</span>
      </div>
      
      {/* Column 3: Actions */}
      <div className="flex items-center justify-end gap-2">
        <UpdateBranchConfigDialog branchConfig={config} />
        <DeleteBranchConfigDialog branchConfig={config} />
      </div>
    </div>
  )
}

export const BranchConfigForm: React.FC<BranchConfigFormProps> = ({
  branchSlug,
  configs,
  isLoading,
  onSuccess,
}) => {
  const queryClient = useQueryClient()
  const { t } = useTranslation(['config'])
  const { t: tBranch } = useTranslation(['branch'])
  const { t: tToast } = useTranslation(['toast'])
  const { mutate: createConfig, isPending: isCreating } = useCreateBranchConfig()

  const [newConfigs, setNewConfigs] = useState<
    Array<{ key: string; value: string; description?: string }>
  >([
    {
      key: '',
      value: '',
      description: '',
    },
  ])

  const updateConfigField = (
    index: number,
    field: 'key' | 'value' | 'description',
    value: string,
  ) => {
    setNewConfigs((prevConfigs) =>
      prevConfigs.map((config, i) =>
        i === index ? { ...config, [field]: value } : config,
      ),
    )
  }

  const addNewConfigRow = () => {
    setNewConfigs((prev) => [
      ...prev,
      {
        key: '',
        value: '',
        description: '',
      },
    ])
  }

  const removeConfigRow = (index: number) => {
    setNewConfigs((prevConfigs) => prevConfigs.filter((_, i) => i !== index))
  }

  const createNewConfigs = async () => {
    const validConfigs = newConfigs.filter(
      (config) => config.key && config.value,
    )

    if (validConfigs.length > 0) {
      await Promise.all(
        validConfigs.map((config) => {
          const configData: ICreateBranchConfigRequest = {
            branchSlug,
            key: config.key,
            value: config.value,
            description: config.description || undefined,
          }

          return createConfig(configData, {
            onSuccess: () => {
              setNewConfigs([
                {
                  key: '',
                  value: '',
                  description: '',
                },
              ])
              queryClient.invalidateQueries({
                queryKey: ['branchConfigs', branchSlug],
              })
              showToast(tToast('toast.createBranchConfigSuccess'))
              onSuccess?.()
            },
          })
        }),
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full gap-4 mt-2">
      {/* Create new config */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">
          {t('config.addNewConfig')}
        </h3>
        <div className="p-4 pb-8 border dark:border-gray-700">
          <div className="grid w-full gap-2">
            {newConfigs.map((config, index) => (
              <NewConfigRow
                key={index}
                t={t}
                config={config}
                onChange={(field, value) => updateConfigField(index, field, value)}
                onRemove={() => removeConfigRow(index)}
              />
            ))}
          </div>
          <div className="flex justify-between mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={addNewConfigRow}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('config.addRow')}
            </Button>
            <Button
              disabled={
                isCreating ||
                !newConfigs.some((config) => config.key && config.value)
              }
              onClick={createNewConfigs}
            >
              {isCreating ? <ButtonLoading /> : t('config.save')}
            </Button>
          </div>
        </div>
      </div>

      {/* Config list */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">
          {t('config.savedConfigs')}
        </h3>
        {configs.length > 0 ? (
          <div className="grid w-full gap-2 pb-4">
            {configs.map((config) => (
              <ConfigRow 
                key={config.slug} 
                config={config} 
                tBranch={tBranch}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-500">{t('config.noSavedConfig')}</p>
        )}
      </div>
    </div>
  )
}

