import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CountdownTimer } from '@/components/ui'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should subtract the default 30s buffer', () => {
    // hết hạn sau 60s → còn 30s sau khi trừ buffer
    render(<CountdownTimer expiresAt="2026-08-11T10:01:00.000Z" />)

    expect(screen.getByText(/0:30/)).toBeInTheDocument()
  })

  it('should show the full remaining time when bufferMs is 0', () => {
    render(<CountdownTimer expiresAt="2026-08-11T10:01:00.000Z" bufferMs={0} />)

    expect(screen.getByText(/1:00/)).toBeInTheDocument()
  })
})
