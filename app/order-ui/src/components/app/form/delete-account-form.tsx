import React from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Button,
  PasswordInput,
} from '@/components/ui'
import { useDeleteAccountSchema, type TDeleteAccountSchema } from '@/schemas'
import { IDeleteAccountRequest } from '@/types'

interface IDeleteAccountFormProps {
  onSubmit: (data: IDeleteAccountRequest) => void
  isPending: boolean
  onCancel: () => void
}

export const DeleteAccountForm: React.FC<IDeleteAccountFormProps> = ({
  onSubmit,
  isPending,
  onCancel,
}) => {
  const { t } = useTranslation('profile')
  const deleteAccountSchema = useDeleteAccountSchema()
  const form = useForm<TDeleteAccountSchema>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '' },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('profile.deleteAccount.password')}</FormLabel>
              <FormControl>
                {/* Ô nhập mật khẩu ĐANG DÙNG, không phải đặt mật khẩu mới —
                    nên không hiện checklist độ mạnh. */}
                <PasswordInput
                  {...field}
                  placeholder={t('profile.deleteAccount.enterPassword')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-row gap-2 justify-between sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onCancel}
          >
            {t('profile.deleteAccount.cancel')}
          </Button>
          <Button
            type="submit"
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('profile.deleteAccount.confirm')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
