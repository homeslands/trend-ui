import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CameraOff,
  Check,
  Copy,
  Keyboard,
  Lightbulb,
  Loader2,
  TriangleAlert,
  X,
} from 'lucide-react'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui'
import {
  detectInAppBrowser,
  detectScanEnvironment,
  hasFullscreenHijack,
  isCameraBlockedEnvironment,
  rememberFullscreenHijack,
} from '@/utils/browser-environment'
import VoucherFixProductList from './voucher-fix-product-list'

const SCANNER_ELEMENT_ID = 'voucher-qr-scanner-region'

/** Tên hiển thị của app đang nhúng trình duyệt, để câu hướng dẫn gọi đúng tên. */
const IN_APP_LABEL: Record<string, string> = {
  zalo: 'Zalo',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  line: 'LINE',
  other: 'Ứng dụng này',
}

/**
 * Thời gian nguội cho MỘT mã vừa quét hỏng.
 *
 * Sau lượt quét hỏng ta mở lại chốt để người dùng quét tiếp, nhưng mã cũ vẫn còn
 * trong khung ngắm nên thư viện đọc lại nó ngay khung hình sau. Không có khoảng
 * nguội này thì thành vòng lặp hỏng → mở chốt → đọc lại → hỏng, mỗi vòng bắn
 * thêm request, còn người dùng chỉ thấy lớp phủ nhấp nháy và tưởng máy hỏng.
 *
 * Chỉ chặn ĐÚNG mã vừa hỏng: chĩa sang phiếu khác là ăn ngay.
 */
const RESCAN_COOLDOWN_MS = 2500

/**
 * Chờ bao lâu rồi mới hiện lớp phủ "Đang kiểm tra mã…".
 *
 * Tra cứu trên mạng tốt chỉ mất khoảng một phần mười giây. Hiện lớp phủ ngay lập
 * tức thì nó bật rồi tắt trong chớp mắt — người dùng thấy màn hình chớp đen một
 * cái mỗi lần quét, không kịp đọc chữ và cũng chẳng hiểu vừa xảy ra chuyện gì.
 * Chờ qua ngưỡng này mới hiện: mạng nhanh thì không bao giờ thấy lớp phủ, mạng
 * chậm mới thấy — đúng lúc nó thật sự có ích.
 */
const PROCESSING_VEIL_DELAY_MS = 400

/**
 * Thông báo từ chối ở lại bao lâu.
 *
 * Dài hơn khoảng nguội có chủ ý: khoảng nguội chỉ cần đủ để chặn vòng lặp đọc
 * lại, còn thông báo phải đủ lâu để đọc hết hai dòng trong lúc tay vẫn đang cầm
 * điện thoại và mắt còn ở trên tờ phiếu.
 */
const NOTICE_DURATION_MS = 4000

/**
 * Camera chạy bao lâu mà chưa giải mã được gì thì coi là đang bế tắc.
 *
 * Lưới an toàn cho những gì không thể liệt kê trước: trình duyệt lạ chặn đọc
 * pixel, mã in mờ, thiếu sáng, hoặc đơn giản là người dùng chưa biết phải làm
 * gì. Không sửa được nguyên nhân, nhưng thay được sự im lặng bằng một lời
 * khuyên — và im lặng mới là thứ khiến người ta kết luận "máy hỏng".
 *
 * 12 giây: đủ dài để không làm phiền người quét bình thường (thường xong trong
 * vài giây), đủ ngắn để không ai kịp bỏ cuộc trước khi được giúp.
 */
const SCAN_STALL_MS = 12000

/**
 * Lần quét bị từ chối, kèm lời khuyên cho người dùng.
 *
 * `permanent` = mã này không bao giờ dùng được (hết hạn, hết lượt). Khi đó màn
 * quét chặn hẳn mã đó trong cả phiên thay vì chỉ nguội vài giây — quét lại nó
 * là việc chắc chắn thất bại, không đáng để mời.
 */
export interface ScanRejection {
  /** Lý do, đã dịch. Dòng chính của dải chữ. */
  message: string
  /** Việc cần làm, đã dịch. Bỏ trống khi lý do đã đủ rõ. */
  hint?: string
  /**
   * Toàn bộ tên món được áp dụng, để bung ra khi người dùng bấm. Dòng `hint`
   * chỉ nêu được vài tên đầu.
   */
  hintItems?: string[]
  permanent: boolean
  /**
   * Hành động nối tiếp, để màn quét không thành ngõ cụt.
   *
   * `add-customer`: voucher đòi định danh mà đơn chưa có khách. Chỉ các sheet
   * nhân viên đặt cờ này — phía khách không có khái niệm "thêm khách hàng".
   */
  action?: 'add-customer'
}

type ScanOutcome = ScanRejection | boolean | void

interface VoucherQrScannerDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Trả `false` hoặc một `ScanRejection` để MỞ LẠI CHỐT quét: lần quét đó hỏng,
   * camera quét tiếp mà người dùng không phải đóng/mở lại dialog. Mọi giá trị
   * khác — kể cả không trả gì — giữ nguyên chốt, tức là chuỗi quét được coi như
   * đã tiêu thụ.
   *
   * Mặc định cố ý nghiêng về phía an toàn: nơi gọi quên trả giá trị thì nhận lại
   * hành vi cũ (một lần quét bắn đúng một lần), chứ không phải onScanned bắn
   * theo TỪNG KHUNG HÌNH — trên luồng này nó nghĩa là áp voucher nhiều lần vào
   * một đơn hàng thật.
   */
  onScanned: (raw: string) => ScanOutcome | Promise<ScanOutcome>
}

/**
 * Lớp phủ toàn màn bật camera đọc mã QR. Component này KHÔNG biết voucher là gì
 * — nó chỉ trả về chuỗi thô đọc được. Việc diễn giải chuỗi đó thuộc về nơi gọi.
 *
 * Toàn màn chứ không phải hộp thoại nhỏ: vùng ảnh lớn hơn thì bắt được mã ở
 * khoảng cách xa hơn, và trên điện thoại một hộp thoại 26rem bỏ phí phần lớn
 * màn hình.
 */
export default function VoucherQrScannerDialog({
  isOpen,
  onOpenChange,
  onScanned,
}: VoucherQrScannerDialogProps) {
  const { t } = useTranslation(['voucher'])
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Đọc được mã rồi nhưng nơi gọi còn đang tra cứu: nếu không hiện gì, khung
  // camera trông y hệt lúc chưa quét được, và mạng chậm thì người dùng tưởng
  // quét hụt nên chĩa lại — trong khi lượt tra cứu cũ vẫn đang chạy.
  const [isProcessing, setIsProcessing] = useState(false)

  // Ref chứ không phải state: html5-qrcode gọi callback mỗi khung hình khi mã
  // còn trong khung ngắm. State sẽ không kịp cập nhật giữa các lần gọi liên
  // tiếp, và onScanned sẽ chạy nhiều lần cho cùng một lần quét.
  const hasScannedRef = useRef(false)
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(
    null,
  )
  // Mã vừa quét hỏng và thời điểm hỏng — dùng để chặn vòng lặp đọc lại chính nó.
  const lastFailedRef = useRef<{ text: string; at: number } | null>(null)
  // Những mã không bao giờ dùng được — chặn hẳn trong phiên, không nguội rồi mở
  // lại. Người dùng cứ chĩa vào cũng không sao: máy im lặng bỏ qua đúng mã đó
  // và vẫn ăn ngay mã khác.
  const blockedCodesRef = useRef<Set<string>>(new Set())
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const veilTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Thẻ video do thư viện chèn vào, giữ lại để gỡ listener lúc dọn dẹp.
  const fullscreenVideoRef = useRef<HTMLVideoElement | null>(null)
  const onFullscreenRef = useRef<(() => void) | null>(null)
  // Gợi ý khi camera chạy mãi mà không đọc được gì. Ở lại tới khi quét được —
  // khác `notice` vốn tự tắt sau vài giây — vì đây là bế tắc, không phải một
  // lượt quét hỏng.
  const [stallHelpKey, setStallHelpKey] = useState<string | null>(null)
  // Cho người dùng THẤY là máy vừa từ chối một mã, thay vì im lặng bỏ qua các
  // khung hình tiếp theo — im lặng chính là thứ khiến họ tưởng máy không quét được.
  const [notice, setNotice] = useState<ScanRejection | null>(null)
  // Màn hướng dẫn thay cho camera ở nơi camera chắc chắn không dùng được.
  const [showInAppGuide, setShowInAppGuide] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const inAppBrowser = detectInAppBrowser()
  const inAppName = IN_APP_LABEL[inAppBrowser ?? 'other']

  // `onScanned` đi qua ref chứ không nằm trong dependency của effect. Nơi gọi
  // thường truyền vào một hàm tạo mới mỗi lần render; nếu để nó trong deps thì
  // effect chạy lại theo từng render, camera bị tắt/bật liên tục và người dùng
  // thấy khung hình nhấp nháy không quét được.
  const onScannedRef = useRef(onScanned)
  useEffect(() => {
    onScannedRef.current = onScanned
  }, [onScanned])

  const resolveErrorKey = (error: unknown): string => {
    const name = (error as { name?: string })?.name
    if (name === 'NotAllowedError') return 'voucher.cameraPermissionDenied'
    if (name === 'NotFoundError') return 'voucher.cameraNotFound'
    return 'voucher.cameraUnknownError'
  }

  useEffect(() => {
    if (!isOpen) return

    hasScannedRef.current = false
    lastFailedRef.current = null
    setErrorKey(null)
    setIsProcessing(false)
    setNotice(null)
    setStallHelpKey(null)
    setShowInAppGuide(false)
    setLinkCopied(false)
    blockedCodesRef.current = new Set()

    let cancelled = false

    // Đã biết trình duyệt này ép video toàn màn thì ĐỪNG mở camera nữa — mở ra
    // là người dùng lãnh nguyên màn video trần, phải tự vuốt xuống mới thấy lời
    // giải thích. `webkitExitFullscreen()` không cứu được vì iOS chỉ cho thoát
    // bằng thao tác tay. Nút "Thử lại" vẫn cho họ ép mở nếu muốn.
    // Đừng mở camera ở nơi chắc chắn hỏng. Mở ra là người dùng lãnh nguyên màn
    // video trần, phải tự vuốt xuống mới thấy lời giải thích —
    // `webkitExitFullscreen()` không cứu được vì iOS chỉ cho thoát bằng tay.
    // `hasFullscreenHijack` bắt thêm những môi trường ta chưa đoán ra, sau khi
    // đã dính một lần.
    if (isCameraBlockedEnvironment() || hasFullscreenHijack()) {
      setShowInAppGuide(true)
      return
    }

    if (!navigator.mediaDevices) {
      // Ba nguyên nhân rất khác nhau, và cách sửa cũng khác nhau hoàn toàn. Gộp
      // hết vào "cần HTTPS" như trước là nói sai với đa số: trong trình duyệt
      // của Zalo thì trang vẫn HTTPS, chỉ là WebView không cho dùng camera.
      detectScanEnvironment().then((env) => {
        if (cancelled) return
        if (env === 'in-app') setErrorKey('voucher.cameraInAppBrowser')
        else if (!window.isSecureContext)
          setErrorKey('voucher.cameraInsecureContext')
        else setErrorKey('voucher.cameraNotSupported')
      })
      return () => {
        cancelled = true
      }
    }

    const startScanner = async () => {
      try {
        // import động: thư viện ~300KB, không được nằm trong bundle chính.
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return

        // Dùng bộ giải mã gốc của trình duyệt khi có. Bộ giải mã JS mặc định đọc
        // pixel qua `getImageData` — chính đường mà Brave trộn nhiễu để chống
        // lấy dấu vân tay, khiến mã không bao giờ giải được dù camera vẫn hiện
        // ảnh. `BarcodeDetector` nhận thẳng canvas và đọc ở tầng trong, không
        // qua đường đó. Trình duyệt không hỗ trợ thì thư viện tự rơi về bộ giải
        // mã JS như cũ, nên đây là thay đổi không có mặt trái.
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
          verbose: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        })
        scannerRef.current = scanner

        await scanner.start(
          // Tham số này bị BỎ QUA khi `videoConstraints` bên dưới hợp lệ — thư
          // viện chỉ dùng một trong hai. Giữ lại làm phương án dự phòng nếu
          // `videoConstraints` bị coi là không hợp lệ, và đó cũng là lý do
          // `facingMode` phải có mặt ở CẢ HAI: xoá nó khỏi `videoConstraints`
          // là mất camera sau.
          { facingMode: 'environment' },
          // KHÔNG đặt `qrbox`: nó giới hạn vùng giải mã vào một ô cố định
          // 240×240 của khung video, mà ô đó không trùng 4 góc cam vẽ trên màn
          // (khung ngắm co theo bề rộng màn, còn video thì bị `object-cover`
          // cắt bớt). Người dùng căn mã vào đúng góc cam nhưng mã lại nằm ngoài
          // vùng máy thật sự đọc, và màn hình không báo gì — chỉ là quét mãi
          // không ăn. Bỏ đi thì thứ gì nhìn thấy là quét được, đúng trực giác.
          {
            fps: 10,
            // Chặn độ phân giải video. Từ khi bỏ `qrbox`, thư viện giải mã TOÀN
            // khung hình thay vì một ô 240×240 — camera iPhone trả 1080p+ nên
            // mỗi lượt phải xử lý gấp hàng chục lần số điểm ảnh. Lượt nào lâu
            // hơn 100ms là khung hình bị bỏ, và người dùng thấy "lúc ăn lúc
            // không". Safari lộ rõ hơn Chrome vì không có `BarcodeDetector`,
            // luôn phải chạy bộ giải mã JS.
            //
            // 1280 vẫn thừa sức đọc mã QR chiếm một phần khung hình, mà chi phí
            // giải mã giảm khoảng 2/3 so với 1080p.
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          (decodedText: string) => {
            // Đọc được rồi thì không còn bế tắc: huỷ hẹn giờ và gỡ gợi ý nếu có.
            if (stallTimerRef.current) {
              clearTimeout(stallTimerRef.current)
              stallTimerRef.current = null
            }
            setStallHelpKey(null)

            if (hasScannedRef.current) return

            // Mã đã biết chắc không dùng được: bỏ qua vĩnh viễn trong phiên này.
            if (blockedCodesRef.current.has(decodedText)) return

            // Chặn vòng lặp: đúng mã vừa hỏng thì bỏ qua cho tới khi hết nguội.
            const last = lastFailedRef.current
            if (
              last &&
              last.text === decodedText &&
              Date.now() - last.at < RESCAN_COOLDOWN_MS
            ) {
              return
            }

            hasScannedRef.current = true
            // Quét hụt (nơi gọi trả đúng `false`) thì phải mở lại chốt, nếu không
            // mọi khung hình sau đó đều dừng ở `if (hasScannedRef.current) return`:
            // camera vẫn chạy nhưng không còn quét được gì cho tới khi người
            // dùng đóng và mở lại dialog.
            // Hẹn giờ thay vì bật ngay — xem ghi chú ở PROCESSING_VEIL_DELAY_MS.
            if (veilTimerRef.current) clearTimeout(veilTimerRef.current)
            veilTimerRef.current = setTimeout(
              () => setIsProcessing(true),
              PROCESSING_VEIL_DELAY_MS,
            )
            const stopVeil = () => {
              if (veilTimerRef.current) {
                clearTimeout(veilTimerRef.current)
                veilTimerRef.current = null
              }
              setIsProcessing(false)
            }

            Promise.resolve(onScannedRef.current(decodedText))
              .then((outcome) => {
                // `false` vẫn được chấp nhận như một lời từ chối không kèm lý
                // do — hợp đồng cũ, và là mặc định an toàn cho nơi gọi chưa kịp
                // dựng thông điệp riêng.
                const rejection: ScanRejection | null =
                  outcome === false
                    ? { message: t('voucher.scanHintTryAnother'), permanent: false }
                    : outcome && typeof outcome === 'object'
                      ? outcome
                      : null
                if (!rejection) return

                if (rejection.permanent) {
                  blockedCodesRef.current.add(decodedText)
                } else {
                  lastFailedRef.current = { text: decodedText, at: Date.now() }
                }

                setNotice(rejection)
                if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
                noticeTimerRef.current = setTimeout(
                  () => setNotice(null),
                  NOTICE_DURATION_MS,
                )
                hasScannedRef.current = false
              })
              .catch(() => {
                // Nơi gọi ném thì chắc chắn nó KHÔNG tiêu thụ được chuỗi quét.
                hasScannedRef.current = false
              })
              .finally(stopVeil)
          },
          undefined,
        )

        if (cancelled) return

        // WKWebView có cờ `allowsInlineMediaPlayback`; app chủ không bật thì MỌI
        // video bị ép toàn màn, bất kể thuộc tính `playsinline`. Khi đó video
        // được vẽ ngoài luồng DOM: người dùng thấy đúng ảnh camera trần, mất
        // sạch nút đóng và lối nhập tay, trong khi JS vẫn đọc được mã. Không
        // sửa được từ phía web — chỉ phát hiện rồi thoát ra cho tử tế.
        const video = document
          .getElementById(SCANNER_ELEMENT_ID)
          ?.querySelector('video')
        if (video) {
          // Thư viện chỉ đặt thuộc tính JS; đặt thêm cả HTML attribute cho
          // WebKit bản cũ. Vô hại ở nơi đã chạy đúng.
          video.setAttribute('playsinline', '')
          video.setAttribute('webkit-playsinline', '')

          fullscreenVideoRef.current = video
          const onEnterFullscreen = () => {
            // Nhớ lại để lần sau khỏi mở camera nữa. Lần đầu thì không tránh
            // được: không có cách nào biết trước WebView có bật
            // `allowsInlineMediaPlayback` hay không.
            rememberFullscreenHijack()
            const fsVideo = video as HTMLVideoElement & {
              webkitExitFullscreen?: () => void
            }
            // Thường bị iOS bỏ qua vì nó đòi thao tác tay, nhưng gọi thì không
            // mất gì và có WebView chấp nhận.
            fsVideo.webkitExitFullscreen?.()
            setErrorKey('voucher.cameraFullscreenHijack')
          }
          onFullscreenRef.current = onEnterFullscreen
          video.addEventListener('webkitbeginfullscreen', onEnterFullscreen)
        }

        // Camera đã chạy. Bắt đầu đếm: nếu tới hạn mà chưa đọc được mã nào thì
        // hiện gợi ý hợp với môi trường đang chạy.
        stallTimerRef.current = setTimeout(async () => {
          const env = await detectScanEnvironment()
          if (cancelled) return
          setStallHelpKey(
            env === 'brave'
              ? 'voucher.scanStallBrave'
              : env === 'in-app'
                ? 'voucher.scanStallInApp'
                : 'voucher.scanStallGeneric',
          )
        }, SCAN_STALL_MS)
      } catch (error) {
        if (!cancelled) setErrorKey(resolveErrorKey(error))
      }
    }

    startScanner()

    return () => {
      cancelled = true
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current)
        noticeTimerRef.current = null
      }
      if (veilTimerRef.current) {
        clearTimeout(veilTimerRef.current)
        veilTimerRef.current = null
      }
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
      if (fullscreenVideoRef.current && onFullscreenRef.current) {
        fullscreenVideoRef.current.removeEventListener(
          'webkitbeginfullscreen',
          onFullscreenRef.current,
        )
        fullscreenVideoRef.current = null
        onFullscreenRef.current = null
      }
      const scanner = scannerRef.current
      scannerRef.current = null
      if (!scanner) return
      // Bỏ qua lỗi stop: nếu camera chưa kịp chạy thì stop sẽ ném, và ta không
      // có gì để làm với lỗi đó lúc dọn dẹp.
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => undefined)
    }
  }, [isOpen, attempt])

  const handleCopyLink = useCallback(async () => {
    // Cách duy nhất chạy được ở mọi app: `window.open` trong WKWebView thường
    // chỉ mở lại trong chính app đó, còn các mẹo kiểu `x-safari-https://` thì
    // tuỳ app có chịu hay không.
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied(true)
    } catch {
      setLinkCopied(false)
    }
  }, [])

  const handleRetry = useCallback(() => {
    setErrorKey(null)
    setAttempt((value) => value + 1)
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/*
        Ghi đè kiểu mặc định của DialogContent để phủ kín màn: bỏ căn giữa, bỏ
        max-w-lg, bỏ viền và bo góc. `[&>button]:hidden` giấu nút X mặc định mà
        DialogContent luôn render — ở đây đã có nút đóng riêng trong thanh trên.
        Mọi nút khác đều nằm trong div nên không bị luật này chạm tới.
      */}
      <DialogContent
        className="fixed inset-0 left-0 top-0 z-50 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-[#0C0A09] p-0 text-white [&>button]:hidden"
      >
        <DialogTitle className="sr-only">
          {t('voucher.scanQrCodeTitle')}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t('voucher.scanQrCodeHint')}
        </DialogDescription>

        {/*
          Khung camera. html5-qrcode chèn thẳng thẻ <video> vào đây với kích
          thước riêng của nó, nên phải ép object-cover để ảnh phủ kín thay vì
          nằm lọt thỏm; và giấu lớp che sẵn có của thư viện (#qr-shaded-region)
          vì ta vẽ khung ngắm riêng bên dưới.
        */}
        <div
          id={SCANNER_ELEMENT_ID}
          className="absolute inset-0 [&_#qr-shaded-region]:!hidden [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />

        {/*
          Khung ngắm: chỉ 4 góc cam, KHÔNG có lớp che xám — toàn màn là ảnh
          camera thật. Một chiều rộng duy nhất cộng `aspect-square` để khung
          luôn vuông; đặt riêng `h-` và `w-` như trước thì chỉ cần một class
          không biên dịch được là khung lệch khỏi 4 góc.

          Đây thuần tuý là GỢI Ý CĂN CHỈNH, không phải ranh giới vùng quét: từ
          khi bỏ `qrbox`, thư viện đọc toàn bộ khung hình. Mã nằm hơi lệch ra
          ngoài 4 góc vẫn ăn — đúng như người dùng vẫn tưởng nó hoạt động.
        */}
        {!errorKey && !showInAppGuide && (
          <div
            className="flex absolute inset-0 justify-center items-center"
            aria-hidden="true"
          >
            <div className="voucher-qr-reticle relative aspect-square w-[min(70vw,280px)]">
              <span className="absolute left-0 top-0 w-8 h-8 rounded-tl-xl border-l-[3px] border-t-[3px] border-primary" />
              <span className="absolute right-0 top-0 w-8 h-8 rounded-tr-xl border-r-[3px] border-t-[3px] border-primary" />
              <span className="absolute bottom-0 left-0 w-8 h-8 rounded-bl-xl border-b-[3px] border-l-[3px] border-primary" />
              <span className="absolute right-0 bottom-0 w-8 h-8 rounded-br-xl border-r-[3px] border-b-[3px] border-primary" />
            </div>
          </div>
        )}

        {/* Thanh trên: tiêu đề + nút đóng */}
        {/*
          Dải chuyển sắc mỏng ở hai mép — KHÔNG phải lớp che toàn màn. Không có
          nó, chữ trắng biến mất khi camera hướng vào trần nhà hay tường sáng.
        */}
        <div className="flex absolute inset-x-0 top-0 gap-3 justify-between items-center bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
          <p className="text-sm font-medium text-white">
            {t('voucher.scanQrCodeTitle')}
          </p>
          <DialogClose
            aria-label={t('voucher.close')}
            className="grid place-items-center w-9 h-9 text-white rounded-full bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-4 h-4" />
          </DialogClose>
        </div>

        {/* Hướng dẫn + lối thoát nhập tay */}
        {!errorKey && !showInAppGuide && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-5 pt-16 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mb-4 text-center">
              <p className="text-sm font-medium text-white">
                {t('voucher.scanQrCodeHint')}
              </p>
              <span className="block mt-1 text-xs text-white/60">
                {t('voucher.scanQrCodeSource')}
              </span>
            </div>
            <DialogClose className="flex gap-2 justify-center items-center w-full h-11 text-sm font-medium text-white rounded-lg border border-white/25 bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Keyboard className="w-4 h-4" />
              {t('voucher.enterCodeManually')}
            </DialogClose>
          </div>
        )}

        {/*
          Mã vừa bị từ chối. Không có dải này, các khung hình tiếp theo bị bỏ qua
          trong im lặng và người dùng tưởng máy hỏng — đúng phản hồi đã nhận được
          từ thực tế sử dụng.
        */}
        {/*
          Cùng ngôn ngữ với nút "Nhập mã bằng tay" ở đáy — nền trong mờ, viền
          mảnh, bo góc như nhau — chỉ đổi sang màu báo lỗi. `backdrop-blur` là
          thứ giữ cho chữ đọc được: nền chỉ 15% nên nếu camera đang chĩa vào
          tường trắng thì chữ trắng sẽ chìm, làm mờ ảnh phía sau mới cứu được.
          Canh lề trùng nút nhập tay (inset-x-5) để hai khối thẳng hàng nhau.
        */}
        {notice && !errorKey && !showInAppGuide && !isProcessing && (
          <div
            role="alert"
            className="voucher-qr-notice absolute inset-x-5 top-[4.5rem] flex gap-2.5 items-start px-4 py-3 rounded-lg border backdrop-blur-sm border-[#F87171]/60 bg-[#F87171]/15"
          >
            <TriangleAlert className="mt-0.5 w-4 h-4 shrink-0 text-[#F87171]" />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug text-white">
                {notice.message}
              </p>
              <VoucherFixProductList
                // Đổi lượt quét là thu gọn lại: danh sách của phiếu trước không
                // còn liên quan gì tới phiếu vừa quét.
                key={notice.hint}
                hint={notice.hint}
                items={notice.hintItems}
                tone="overlay"
              />
            </div>
          </div>
        )}

        {/*
          Gợi ý khi quét mãi không ăn. Đặt sát đáy, ngay trên nút nhập tay —
          đây là lúc lối thoát đó đáng được để ý nhất. Không dùng màu báo lỗi:
          chưa chắc có gì hỏng, có thể chỉ là thiếu sáng.
        */}
        {stallHelpKey && !errorKey && !showInAppGuide && !notice && !isProcessing && (
          <div className="voucher-qr-notice absolute inset-x-5 bottom-[8.5rem] flex gap-2.5 items-start px-4 py-3 rounded-lg border backdrop-blur-sm border-white/25 bg-white/10">
            <Lightbulb className="mt-0.5 w-4 h-4 shrink-0 text-primary" />
            <p className="text-xs leading-snug text-white">{t(stallHelpKey)}</p>
          </div>
        )}

        {/* Đang tra cứu */}
        {isProcessing && !errorKey && !showInAppGuide && (
          <div className="flex absolute inset-0 flex-col gap-3 justify-center items-center px-8 text-center bg-[#0C0A09]/85">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-white">
              {t('voucher.scanQrCodeProcessing')}
            </p>
          </div>
        )}

        {/*
          Trình duyệt trong app trên iOS: camera chắc chắn bị ép toàn màn nên
          không mở nữa. Ưu tiên NHẬP TAY làm việc chính — mã voucher chỉ vài ký
          tự, gõ nhanh hơn hẳn việc thoát app, dán link, đăng nhập lại và tìm lại
          giỏ hàng. Chuyển sang trình duyệt là lựa chọn phụ cho ai thật sự muốn quét.
        */}
        {showInAppGuide && (
          <div className="flex overflow-y-auto absolute inset-0 flex-col justify-center px-6 py-10 bg-[#0C0A09]/95">
            <div className="mx-auto w-full max-w-sm">
              <div className="grid place-items-center mx-auto mb-5 w-14 h-14 rounded-full bg-primary/15">
                <CameraOff className="w-6 h-6 text-primary" />
              </div>

              <h2 className="mb-2 text-base font-semibold text-center text-white">
                {t('voucher.inAppTitle')}
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-center text-white/70">
                {t('voucher.inAppBody', { app: inAppName })}
              </p>

              <DialogClose className="flex gap-2 justify-center items-center mb-3 w-full h-11 text-sm font-medium rounded-lg bg-primary text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <Keyboard className="w-4 h-4" />
                {t('voucher.enterCodeManually')}
              </DialogClose>

              <div className="p-4 rounded-lg border border-white/15 bg-white/5">
                <p className="mb-2 text-xs font-medium text-white/90">
                  {t('voucher.inAppOpenInBrowser')}
                </p>
                <p className="mb-3 text-xs leading-relaxed text-white/60">
                  {t(
                    inAppBrowser === 'zalo'
                      ? 'voucher.inAppStepsZalo'
                      : 'voucher.inAppStepsGeneric',
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex gap-2 justify-center items-center w-full h-9 text-xs font-medium text-white rounded-lg border border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {linkCopied ? (
                    <Check className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {t(linkCopied ? 'voucher.linkCopied' : 'voucher.copyLink')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lỗi camera */}
        {errorKey && !showInAppGuide && (
          <div className="flex absolute inset-0 flex-col gap-3 justify-center items-center px-8 text-center bg-[#0C0A09]/90">
            <div className="grid place-items-center w-14 h-14 rounded-full bg-primary/15">
              <CameraOff className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-white">{t(errorKey)}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="px-5 h-9 mt-1 text-xs font-medium text-white rounded-lg border border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {/* Ở màn bị ép toàn màn, "Thử lại" là sai nghĩa: bấm vào sẽ mở
                  camera và chắc chắn lại bị chiếm màn hình. Nói đúng điều đó
                  để người dùng chọn có ý thức. */}
              {errorKey === 'voucher.cameraFullscreenHijack'
                ? t('voucher.tryCameraAnyway')
                : t('voucher.retry')}
            </button>
            <DialogClose className="flex gap-2 items-center px-5 h-9 text-xs font-medium text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
              <Keyboard className="w-4 h-4" />
              {t('voucher.enterCodeManually')}
            </DialogClose>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
