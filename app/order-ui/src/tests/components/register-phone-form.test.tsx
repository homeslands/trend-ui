import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutate = vi.fn()
const startFlow = vi.fn()
const navigate = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/hooks', () => ({
  useInitiateRegister: () => ({ mutate, isPending: false }),
}))
vi.mock('@/stores', () => ({
  useRegisterFlowStore: () => ({ startFlow }),
}))
vi.mock('react-router-dom', async () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  NavLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

import { RegisterPhoneForm } from '@/components/app/form'

describe('RegisterPhoneForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should strip non digits and cap the input at 10 characters', async () => {
    render(<RegisterPhoneForm />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, '03a76295216999')

    expect(input).toHaveValue('0376295216')
  })

  it('should not call the API when the phone number is incomplete', async () => {
    render(<RegisterPhoneForm />)

    await userEvent.type(screen.getByRole('textbox'), '0376')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(mutate).not.toHaveBeenCalled()
  })

  it('should call initiate with the phone number when valid', async () => {
    render(<RegisterPhoneForm />)

    await userEvent.type(screen.getByRole('textbox'), '0376295216')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(mutate).toHaveBeenCalledWith(
      { phonenumber: '0376295216' },
      expect.any(Object),
    )
  })
})
