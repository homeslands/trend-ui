import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Input,
  Form,
  Button,
  PasswordInput,
} from '@/components/ui'
import { loginSchema } from '@/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { ButtonLoading } from '@/components/app/loading'
import { useLogin, useHandleAuthSuccess } from '@/hooks'
import { showToast } from '@/utils'

export const LoginForm: React.FC = () => {
  const { t } = useTranslation(['auth'])
  const { mutate: login, isPending } = useLogin()
  const handleAuthSuccess = useHandleAuthSuccess()
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phonenumber: '',
      password: '',
    },
  })

  const handleSubmit = async (data: z.infer<typeof loginSchema>) => {
    login(data, {
      onSuccess: async (response) => {
        try {
          await handleAuthSuccess(response.result)
          showToast(t('toast.loginSuccess'))
        } catch {
          showToast(t('toast.loginError') || 'Đăng nhập thất bại')
        }
      },
    })
  }

  const formFields = {
    phonenumber: (
      <FormField
        control={form.control}
        name="phonenumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('login.phoneNumber')}</FormLabel>
            <FormControl>
              <Input placeholder={t('login.enterPhoneNumber')} {...field}
                onChange={(e) => {
                  const onlyNumbers = e.target.value.replace(/\D/g, '')
                  field.onChange(onlyNumbers)
                }}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    password: (
      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('login.password')}</FormLabel>
            <FormControl>
              <PasswordInput
                placeholder={t('login.enterPassword')}
                {...field}
              />
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
          <div className="grid grid-cols-1 gap-2 text-white md:w-[24rem]">
            {Object.keys(formFields).map((key) => (
              <React.Fragment key={key}>
                {formFields[key as keyof typeof formFields]}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between items-center w-full">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <ButtonLoading /> : t('login.title')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
