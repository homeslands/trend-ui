import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { AxiosError } from 'axios'

import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@/components/ui'
import { ButtonLoading } from '@/components/app/loading'
import { useInitiateRegister } from '@/hooks'
import { useRegisterFlowStore } from '@/stores'
import { useRegisterPhoneSchema, TRegisterPhoneSchema } from '@/schemas'
import { ROUTE } from '@/constants'
import { showErrorToast, showToast } from '@/utils'
import { IApiErrorResponse } from '@/types'

export const RegisterPhoneForm = () => {
  const { t } = useTranslation(['auth'])
  const navigate = useNavigate()
  const { startFlow, startFlowWithUnknownOtp, resumeFlow } =
    useRegisterFlowStore()
  const { mutate: initiateRegister, isPending } = useInitiateRegister()
  const [existingAccount, setExistingAccount] = useState(false)

  const form = useForm<TRegisterPhoneSchema>({
    resolver: zodResolver(useRegisterPhoneSchema()),
    defaultValues: { phonenumber: '' },
  })

  const handleSubmit = (values: TRegisterPhoneSchema) => {
    setExistingAccount(false)
    initiateRegister(
      { phonenumber: values.phonenumber },
      {
        onSuccess: (response) => {
          startFlow(values.phonenumber, response.result?.expiresAt ?? '')
          navigate(ROUTE.REGISTER_OTP)
        },
        onError: (error) => {
          const statusCode = (error as AxiosError<IApiErrorResponse>).response
            ?.data?.statusCode

          // 119041: số đã có tài khoản. Không tự chuyển trang — hiện lỗi kèm
          // hai lối đi để khách tự chọn.
          if (statusCode === 119041) {
            setExistingAccount(true)
            form.setError('phonenumber', {
              message: t('register.phoneAlreadyRegistered'),
            })
            return
          }

          // 119046: OTP trước đó vẫn còn hiệu lực → đi thẳng sang bước nhập mã.
          if (statusCode === 119046) {
            showToast('toast.registerOtpAlreadySent')
            // Lỗi này không kèm expiresAt lẫn lastSentAt. Máy này còn giữ mốc
            // thật của mã gửi gần nhất thì khôi phục — đó là con số đúng. Không
            // có thì thà không hiện đồng hồ còn hơn bịa ra 10 phút.
            if (!resumeFlow(values.phonenumber)) {
              startFlowWithUnknownOtp(values.phonenumber)
            }
            navigate(ROUTE.REGISTER_OTP)
            return
          }

          if (statusCode) {
            showErrorToast(statusCode)
            return
          }

          showErrorToast(
            (error as AxiosError).response?.status ?? 0,
          )
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="phonenumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">
                {t('register.phoneNumber')}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('register.enterPhoneNumber')}
                  inputMode="numeric"
                  autoComplete="tel"
                  // Input gốc thừa hưởng màu chữ của Card (tối); trên thẻ kính
                  // đặt trên ảnh nền thì phải chỉ định trắng.
                  className="text-white"
                  onChange={(e) =>
                    field.onChange(e.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {existingAccount && (
          <div className="flex gap-3 text-sm">
            <NavLink to={ROUTE.LOGIN} className="text-primary hover:underline">
              {t('register.goToLogin')}
            </NavLink>
            <NavLink
              to={ROUTE.FORGOT_PASSWORD}
              className="text-primary hover:underline"
            >
              {t('register.goToForgotPassword')}
            </NavLink>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <ButtonLoading /> : t('register.continue')}
        </Button>
      </form>
    </Form>
  )
}
