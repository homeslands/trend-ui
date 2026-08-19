import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutate = vi.fn()
const setUserInfo = vi.fn()
const navigate = vi.fn()
const { getProfile } = vi.hoisted(() => ({ getProfile: vi.fn() }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/hooks', () => ({
  useUpdateProfile: () => ({ mutate, isPending: false }),
}))
vi.mock('@/stores', () => ({
  useUserStore: () => ({ setUserInfo }),
}))
vi.mock('@/api', () => ({
  getProfile: () => getProfile(),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))
vi.mock('@/components/app/picker', () => ({
  DatePicker: ({ onSelect }: { onSelect: (v: string) => void }) => (
    <button type="button" onClick={() => onSelect('01/01/1990')}>
      date-picker
    </button>
  ),
}))

import { RegisterProfileForm } from '@/components/app/form'

describe('RegisterProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should keep the finish button disabled until all three fields are filled', async () => {
    render(<RegisterProfileForm />)

    expect(screen.getByRole('button', { name: /complete/i })).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/register.lastName/i), 'Phan')
    expect(screen.getByRole('button', { name: /complete/i })).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/register.firstName/i), 'Thắng')
    expect(screen.getByRole('button', { name: /complete/i })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /date-picker/i }))
    expect(screen.getByRole('button', { name: /complete/i })).toBeEnabled()
  })

  it('should not offer a way to skip the profile step', () => {
    render(<RegisterProfileForm />)

    expect(screen.queryByRole('button', { name: /skip/i })).toBeNull()
  })

  it('should send the filled values with dob as DD/MM/YYYY', async () => {
    render(<RegisterProfileForm />)

    await userEvent.type(screen.getByLabelText(/register.lastName/i), 'Phan')
    await userEvent.type(screen.getByLabelText(/register.firstName/i), 'Thắng')
    await userEvent.click(screen.getByRole('button', { name: /date-picker/i }))
    await userEvent.click(screen.getByRole('button', { name: /complete/i }))

    expect(mutate).toHaveBeenCalledWith(
      { firstName: 'Thắng', lastName: 'Phan', dob: '01/01/1990' },
      expect.any(Object),
    )
  })

  it('should refetch the full profile before saving it, then go home', async () => {
    // PATCH /auth/profile trả hồ sơ KHÔNG kèm role. Ghi thẳng nó vào userInfo
    // sẽ xoá mất role và guard route đá khách sang /403 — nên phải lấy lại hồ
    // sơ đầy đủ bằng getProfile().
    getProfile.mockResolvedValue({
      result: { slug: 'user-1', role: { name: 'CUSTOMER' } },
    })
    render(<RegisterProfileForm />)

    await userEvent.type(screen.getByLabelText(/register.lastName/i), 'Phan')
    await userEvent.type(screen.getByLabelText(/register.firstName/i), 'Thắng')
    await userEvent.click(screen.getByRole('button', { name: /date-picker/i }))
    await userEvent.click(screen.getByRole('button', { name: /complete/i }))
    const onSuccess = mutate.mock.calls[0][1].onSuccess
    await act(async () => {
      await onSuccess({ result: { slug: 'user-1' } })
    })

    expect(getProfile).toHaveBeenCalled()
    expect(setUserInfo).toHaveBeenCalledWith({
      slug: 'user-1',
      role: { name: 'CUSTOMER' },
    })
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('should still finish the flow when refetching the profile fails', async () => {
    getProfile.mockRejectedValue(new Error('network down'))
    render(<RegisterProfileForm />)

    await userEvent.type(screen.getByLabelText(/register.lastName/i), 'Phan')
    await userEvent.type(screen.getByLabelText(/register.firstName/i), 'Thắng')
    await userEvent.click(screen.getByRole('button', { name: /date-picker/i }))
    await userEvent.click(screen.getByRole('button', { name: /complete/i }))
    const onSuccess = mutate.mock.calls[0][1].onSuccess
    await act(async () => {
      await onSuccess({ result: { slug: 'user-1' } })
    })

    expect(setUserInfo).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })
})
