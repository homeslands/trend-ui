import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'

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
import { getProfile } from '@/api'
import { DatePicker } from '@/components/app/picker'
import { ButtonLoading } from '@/components/app/loading'
import { useUpdateProfile } from '@/hooks'
import { useUserStore } from '@/stores'
import { useRegisterProfileSchema, TRegisterProfileSchema } from '@/schemas'
import { ROUTE } from '@/constants'
import { showToast } from '@/utils'

export const RegisterProfileForm = () => {
  const { t } = useTranslation(['auth'])
  const navigate = useNavigate()
  const { setUserInfo } = useUserStore()
  const { mutate: updateProfile, isPending } = useUpdateProfile()

  const form = useForm<TRegisterProfileSchema>({
    resolver: zodResolver(useRegisterProfileSchema()),
    defaultValues: { firstName: '', lastName: '', dob: '' },
  })

  // Kết thúc luồng đăng ký là về trang chủ.
  const leaveFlow = () => navigate(ROUTE.CLIENT_HOME, { replace: true })

  // Cả ba trường đều bắt buộc; khoá nút cho tới khi form hợp lệ.
  const [lastName, firstName, dob] = form.watch(['lastName', 'firstName', 'dob'])
  const isIncomplete = !lastName?.trim() || !firstName?.trim() || !dob?.trim()

  const renderRequiredLabel = (label: string) => (
    <FormLabel className="flex gap-1 items-baseline text-white">
      <span className="text-destructive">*</span>
      {label}
    </FormLabel>
  )

  const handleSubmit = (values: TRegisterProfileSchema) => {
    updateProfile(
      {
        firstName: values.firstName || null,
        lastName: values.lastName || null,
        dob: values.dob || null,
      },
      {
        onSuccess: async () => {
          // PATCH /auth/profile trả hồ sơ KHÔNG kèm role (service backend nạp
          // user không có relation), nên ghi thẳng response vào userInfo sẽ
          // xoá mất role và mọi guard route đá khách sang /403. Lấy lại hồ sơ
          // đầy đủ rồi mới lưu — cùng cách form cập nhật hồ sơ đang làm.
          try {
            const profile = await getProfile()
            if (profile?.result) {
              setUserInfo(profile.result)
            }
          } catch {
            // Không lấy lại được cũng không chặn luồng: dữ liệu đã lưu ở server
            // và trang Hồ sơ sẽ nạp lại ở lần vào sau.
          }
          showToast('toast.updateProfileSuccess')
          leaveFlow()
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              {renderRequiredLabel(t('register.lastName'))}
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('register.enterLastName')}
                  // Input gốc thừa hưởng màu chữ của Card (tối); thẻ kính trên
                  // ảnh nền thì phải chỉ định trắng.
                  className="text-white"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              {renderRequiredLabel(t('register.firstName'))}
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('register.enterFirstName')}
                  // Input gốc thừa hưởng màu chữ của Card (tối); thẻ kính trên
                  // ảnh nền thì phải chỉ định trắng.
                  className="text-white"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dob"
          render={({ field }) => (
            <FormItem>
              {renderRequiredLabel(t('register.dob'))}
              <FormControl>
                <DatePicker
                  backgroundColor="bg-transparent"
                  className="text-white hover:text-white"
                  date={field.value}
                  onSelect={(selectedDate) => field.onChange(selectedDate)}
                  validateDate={(date) => date <= new Date()}
                  disableFutureDate
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || isIncomplete}
          >
            {isPending ? <ButtonLoading /> : t('register.complete')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
