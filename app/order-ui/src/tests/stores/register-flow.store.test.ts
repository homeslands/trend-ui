import { describe, it, expect, beforeEach } from 'vitest'

import {
  useRegisterFlowStore,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
} from '@/stores'

describe('useRegisterFlowStore', () => {
  beforeEach(() => {
    useRegisterFlowStore.getState().clearRegisterFlow()
  })

  it('should expose backend timings as constants', () => {
    expect(OTP_TTL_MS).toBe(10 * 60 * 1000)
    expect(RESEND_COOLDOWN_MS).toBe(2 * 60 * 1000)
  })

  it('should start empty', () => {
    const state = useRegisterFlowStore.getState()
    expect(state.phonenumber).toBe('')
    expect(state.otpExpiresAt).toBe('')
    expect(state.resendAvailableAt).toBe('')
  })

  it('should store the phone number and both timestamps when the flow starts', () => {
    const expiresAt = '2026-08-11T10:00:00.000Z'
    const before = Date.now()

    useRegisterFlowStore.getState().startFlow('0376295216', expiresAt)

    const state = useRegisterFlowStore.getState()
    expect(state.phonenumber).toBe('0376295216')
    expect(state.otpExpiresAt).toBe(expiresAt)
    expect(new Date(state.resendAvailableAt).getTime()).toBeGreaterThanOrEqual(
      before + RESEND_COOLDOWN_MS,
    )
  })

  it('should refresh both timestamps but keep the phone number when the OTP is resent', () => {
    useRegisterFlowStore
      .getState()
      .startFlow('0376295216', '2026-08-11T10:00:00.000Z')

    const before = Date.now()

    useRegisterFlowStore.getState().markOtpSent('2026-08-11T10:10:00.000Z')

    const state = useRegisterFlowStore.getState()
    expect(state.phonenumber).toBe('0376295216')
    expect(state.otpExpiresAt).toBe('2026-08-11T10:10:00.000Z')
    expect(new Date(state.resendAvailableAt).getTime()).toBeGreaterThanOrEqual(
      before + RESEND_COOLDOWN_MS,
    )
  })

  it('should fall back to now + OTP_TTL_MS when the server omits expiresAt', () => {
    const before = Date.now()

    useRegisterFlowStore.getState().startFlow('0376295216', '')

    const state = useRegisterFlowStore.getState()
    expect(new Date(state.otpExpiresAt).getTime()).toBeGreaterThanOrEqual(
      before + OTP_TTL_MS,
    )
  })

  it('should reset every field when cleared', () => {
    useRegisterFlowStore
      .getState()
      .startFlow('0376295216', '2026-08-11T10:00:00.000Z')

    useRegisterFlowStore.getState().clearRegisterFlow()

    const state = useRegisterFlowStore.getState()
    expect(state.phonenumber).toBe('')
    expect(state.otpExpiresAt).toBe('')
    expect(state.resendAvailableAt).toBe('')
  })

  it('should keep the last sent code on record when the flow is cleared', () => {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    useRegisterFlowStore.getState().startFlow('0376295216', expiresAt)

    useRegisterFlowStore.getState().clearRegisterFlow()

    const state = useRegisterFlowStore.getState()
    expect(state.phonenumber).toBe('')
    expect(state.lastOtpPhonenumber).toBe('0376295216')
    expect(state.lastOtpExpiresAt).toBe(expiresAt)
  })

  it('should resume a still-alive code with its real expiry', () => {
    // Backend trả 119046 mà không kèm mốc nào; đây là nguồn duy nhất cho phép
    // hiện đồng hồ đúng thay vì đếm lại từ đầu.
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    useRegisterFlowStore.getState().startFlow('0376295216', expiresAt)
    useRegisterFlowStore.getState().clearRegisterFlow()

    const resumed = useRegisterFlowStore.getState().resumeFlow('0376295216')

    expect(resumed).toBe(true)
    expect(useRegisterFlowStore.getState().otpExpiresAt).toBe(expiresAt)
  })

  it('should refuse to resume a dead code or a different number', () => {
    useRegisterFlowStore
      .getState()
      .startFlow('0376295216', new Date(Date.now() - 1000).toISOString())
    useRegisterFlowStore.getState().clearRegisterFlow()

    expect(useRegisterFlowStore.getState().resumeFlow('0376295216')).toBe(false)

    const alive = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    useRegisterFlowStore.getState().startFlow('0376295216', alive)
    useRegisterFlowStore.getState().clearRegisterFlow()
    expect(useRegisterFlowStore.getState().resumeFlow('0987654321')).toBe(false)
  })
})
