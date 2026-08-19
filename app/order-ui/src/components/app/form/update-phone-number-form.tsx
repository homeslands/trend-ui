import React from 'react'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Button,
  Input,
} from '@/components/ui'

import { IUserInfo } from '@/types'
import { useCompleteRegistration } from '@/hooks'
import { showToast, showErrorToastMessage } from '@/utils'

interface IUpdatePhoneNumberFormProps {
  user: IUserInfo
  onSubmit: (isOpen: boolean) => void
}

const phoneNumberSchema = z.object({
  phonenumber: z
    .string()
    .min(1, 'Số điện thoại không được để trống')
    .regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ'),
})

type PhoneNumberFormData = z.infer<typeof phoneNumberSchema>

export const UpdatePhoneNumberForm: React.FC<IUpdatePhoneNumberFormProps> = ({
  user,
  onSubmit,
}) => {
  const queryClient = useQueryClient()
  const { t } = useTranslation(['customer', 'menu'])
  const { t: tToast } = useTranslation('toast')
  const { mutate: completeRegistration, isPending } = useCompleteRegistration()

  const form = useForm<PhoneNumberFormData>({
    resolver: zodResolver(phoneNumberSchema),
    defaultValues: {
      phonenumber: user?.phonenumber || '',
    },
  })

  const handleSubmit = (data: PhoneNumberFormData) => {
    if (!user?.slug) {
      showErrorToastMessage(tToast('toast.userNotFound', { ns: 'toast' }))
      return
    }

    // Call completeRegistration with phonenumber only
    // Backend should handle updating phone number without requiring password
    completeRegistration(
      {
        slug: user.slug,
        phonenumber: data.phonenumber,
        password: '', // Empty password - backend should handle this
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['users'],
            exact: false,
          })
          queryClient.refetchQueries({
            queryKey: ['users'],
            exact: false,
          })
          showToast(tToast('toast.updatePhoneNumberSuccess'))
          onSubmit(false)
          form.reset()
        },
      }
    )
  }

  return (
    <div className="mt-3">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="phonenumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex gap-2 items-center">
                  <span className="text-destructive">*</span>
                  {t('customer.phoneNumber')}
                </FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={t('customer.enterPhoneNumber')}
                    {...field}
                    disabled={isPending}
                    onChange={(e) => {
                      const onlyNumbers = e.target.value.replace(/\D/g, '')
                      field.onChange(onlyNumbers)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onSubmit(false)}
              disabled={isPending}
            >
              {t('menu.close', { ns: 'menu' })}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t('customer.update')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

