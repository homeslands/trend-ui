import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** OTP đăng ký sống 10 phút — khớp auth.service.ts của backend. */
export const OTP_TTL_MS = 10 * 60 * 1000
/** Backend chặn gửi lại trong 120 giây kể từ lần gửi gần nhất. */
export const RESEND_COOLDOWN_MS = 2 * 60 * 1000

export interface IRegisterFlowStore {
  phonenumber: string
  otpExpiresAt: string
  resendAvailableAt: string
  /**
   * Mã gửi gần nhất, ghi lại tách khỏi luồng đang chạy và KHÔNG bị
   * clearRegisterFlow xoá. Nhờ nó, khách bỏ dở rồi nhập lại đúng số đó vẫn thấy
   * đồng hồ đúng: backend trả 119046 mà không kèm mốc nào, đây là nguồn duy nhất.
   */
  lastOtpPhonenumber: string
  lastOtpExpiresAt: string
  lastOtpResendAvailableAt: string
  setPhonenumber: (phonenumber: string) => void
  setOtpExpiresAt: (otpExpiresAt: string) => void
  setResendAvailableAt: (resendAvailableAt: string) => void
  startFlow: (phonenumber: string, expiresAt: string) => void
  /**
   * Vào bước 2 mà không biết mã cũ còn sống bao lâu (backend trả 119046 không
   * kèm mốc nào). Để trống hai mốc thay vì bịa: giao diện sẽ ẩn đồng hồ và mở
   * sẵn nút gửi lại, server tự chặn bằng 119050 nếu còn sớm.
   */
  startFlowWithUnknownOtp: (phonenumber: string) => void
  /** Khôi phục luồng từ mã gửi gần nhất nếu đúng số và còn hạn. */
  resumeFlow: (phonenumber: string) => boolean
  markOtpSent: (expiresAt: string) => void
  clearRegisterFlow: () => void
}

const resolveExpiresAt = (expiresAt: string) =>
  expiresAt || new Date(Date.now() + OTP_TTL_MS).toISOString()

const nextResendAvailableAt = () =>
  new Date(Date.now() + RESEND_COOLDOWN_MS).toISOString()

export const useRegisterFlowStore = create<IRegisterFlowStore>()(
  persist(
    (set, get) => ({
      phonenumber: '',
      otpExpiresAt: '',
      resendAvailableAt: '',
      lastOtpPhonenumber: '',
      lastOtpExpiresAt: '',
      lastOtpResendAvailableAt: '',
      setPhonenumber: (phonenumber: string) => {
        set({ phonenumber })
      },
      setOtpExpiresAt: (otpExpiresAt: string) => {
        set({ otpExpiresAt })
      },
      setResendAvailableAt: (resendAvailableAt: string) => {
        set({ resendAvailableAt })
      },
      startFlow: (phonenumber: string, expiresAt: string) => {
        const otpExpiresAt = resolveExpiresAt(expiresAt)
        const resendAvailableAt = nextResendAvailableAt()
        set({
          phonenumber,
          otpExpiresAt,
          resendAvailableAt,
          lastOtpPhonenumber: phonenumber,
          lastOtpExpiresAt: otpExpiresAt,
          lastOtpResendAvailableAt: resendAvailableAt,
        })
      },
      startFlowWithUnknownOtp: (phonenumber: string) => {
        set({ phonenumber, otpExpiresAt: '', resendAvailableAt: '' })
      },
      markOtpSent: (expiresAt: string) => {
        const otpExpiresAt = resolveExpiresAt(expiresAt)
        const resendAvailableAt = nextResendAvailableAt()
        set({
          otpExpiresAt,
          resendAvailableAt,
          lastOtpPhonenumber: get().phonenumber,
          lastOtpExpiresAt: otpExpiresAt,
          lastOtpResendAvailableAt: resendAvailableAt,
        })
      },
      resumeFlow: (phonenumber: string) => {
        const { lastOtpPhonenumber, lastOtpExpiresAt, lastOtpResendAvailableAt } =
          get()
        const isLive =
          lastOtpPhonenumber === phonenumber &&
          !!lastOtpExpiresAt &&
          new Date(lastOtpExpiresAt).getTime() > Date.now()
        if (!isLive) return false
        set({
          phonenumber,
          otpExpiresAt: lastOtpExpiresAt,
          resendAvailableAt: lastOtpResendAvailableAt,
        })
        return true
      },
      // Chỉ dọn luồng đang chạy; hồ sơ mã gửi gần nhất giữ lại để còn khôi phục
      // đồng hồ khi khách nhập lại đúng số đó.
      clearRegisterFlow: () => {
        set({ phonenumber: '', otpExpiresAt: '', resendAvailableAt: '' })
      },
    }),
    {
      name: 'register-flow-store',
    },
  ),
)
