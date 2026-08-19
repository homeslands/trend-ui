import React from 'react'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Form,
  Button,
  Input,
} from '@/components/ui'
import { IBranchConfig, IUpdateBranchConfigRequest } from '@/types'
import { useUpdateBranchConfig } from '@/hooks'
import { showToast } from '@/utils'
import { z } from 'zod'
import { useParams } from 'react-router-dom'

const updateBranchConfigSchema = z.object({
  slug: z.string().min(1),
  key: z.string().min(1),
  value: z.string().min(1),
  description: z.string().optional(),
})

type TUpdateBranchConfigSchema = z.infer<typeof updateBranchConfigSchema>

interface IFormUpdateBranchConfigProps {
  branchConfig?: IBranchConfig
  onSubmit: (isOpen: boolean) => void
}

export const UpdateBranchConfigForm: React.FC<
  IFormUpdateBranchConfigProps
> = ({ branchConfig, onSubmit }) => {
  const { slug } = useParams()
  const queryClient = useQueryClient()
  const { t } = useTranslation(['config'])
  const { t: tToast } = useTranslation('toast')
  const { mutate: updateBranchConfig } = useUpdateBranchConfig()
  const form = useForm<TUpdateBranchConfigSchema>({
    resolver: zodResolver(updateBranchConfigSchema),
    defaultValues: {
      slug: branchConfig?.slug || '',
      key: branchConfig?.key || '',
      value: branchConfig?.value || '',
      description: branchConfig?.description || '',
    },
  })

  React.useEffect(() => {
    if (branchConfig) {
      form.reset({
        slug: branchConfig?.slug || '',
        key: branchConfig.key,
        value: branchConfig.value,
        description: branchConfig.description || '',
      })
    }
  }, [branchConfig, slug, form])

  const handleSubmit = (data: TUpdateBranchConfigSchema) => {
    const updateData: IUpdateBranchConfigRequest = {
      slug: branchConfig?.slug || data.slug,
      key: data.key,
      value: data.value,
      description: data.description || undefined,
    }

    updateBranchConfig(updateData, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['branchConfigs'],
          exact: false,
          refetchType: 'all',
        })
        onSubmit(false)
        form.reset()
        showToast(tToast('toast.updateBranchConfigSuccess'))
      }
    })
  }

  const formFields = {
    key: (
      <FormField
        control={form.control}
        name="key"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('config.key')}</FormLabel>
            <FormControl>
              <Input {...field} disabled />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    value: (
      <FormField
        control={form.control}
        name="value"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('config.value')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    description: (
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('config.description')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
  }

  return (
    <div className="mt-3">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-2">
            {Object.keys(formFields).map((key) => (
              <React.Fragment key={key}>
                {formFields[key as keyof typeof formFields]}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-end">
            <Button className="flex justify-end" type="submit">
              {t('config.update')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

