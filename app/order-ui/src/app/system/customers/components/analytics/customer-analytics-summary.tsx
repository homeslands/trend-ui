import { useTranslation } from 'react-i18next'
import { UserPlus, Wallet, TrendingUp, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui'
import { CustomerAccountRevenueType, ICustomerAccountRevenue } from '@/types'
import { formatCurrency } from '@/utils'
import { cn } from '@/lib/utils'

import {
  computeGrowth,
  computePaymentMethodBreakdown,
  computeSpendingKpis,
  GrowthResult,
} from './spending-kpis'

/**
 * TẠM TẮT card "Khách có chi tiêu / chuyển đổi".
 *
 * Lý do: mẫu số của tỉ lệ là `revenue.total` từ `GET /user/revenue/account`, và hiện
 * KHÔNG xác minh được nó đếm gì — endpoint đó chưa có trong monorepo checkout (nằm ở
 * branch BE chưa merge), nên mô tả "tổng khách trong phạm vi lọc" trong `spending-kpis.ts`
 * mới chỉ là giả định theo lời product owner, không phải đọc từ code. Số liệu thực tế
 * làm giả định đó đáng ngờ: với 31 khách chi tiêu và tỉ lệ 17.4%, mẫu số suy ra là 178 —
 * trong khi card "Khách mới" cùng hàng đang là 72. Nếu 178 là tổng khách MỌI THỜI ĐẠI
 * của chi nhánh (không theo khoảng ngày), tỉ lệ này sẽ tụt dần vĩnh viễn theo thời gian
 * và không đo lường được gì cả.
 *
 * Thà không hiện còn hơn hiện một tỉ lệ có thể sai về ngữ nghĩa — người đọc không có
 * cách nào tự phát hiện, và một con số sai vẫn được tin hơn là một ô trống.
 *
 * BẬT LẠI (đổi thành `true`) sau khi xác minh `revenue.total` bằng một trong hai cách:
 *   - Đọc handler thật ở branch BE có `/user/revenue/account`, hoặc
 *   - Network tab: đổi khoảng ngày trên panel và xem `total` có đổi theo không.
 *     `total` đứng yên → mẫu số không theo khoảng ngày → tỉ lệ sai ngữ nghĩa, phải sửa
 *     cách tính (hoặc đổi nhãn card) TRƯỚC khi bật.
 *
 * Phần code hiển thị `31 / 178` (phơi mẫu số ra thay vì để người đọc tự đoán) đã hoàn
 * thiện và được test khoá — giữ nguyên, không xoá, để bật lại chỉ tốn đúng một dòng này.
 */
const SHOW_CONVERSION_CARD = false

interface CustomerAnalyticsSummaryProps {
  revenue?: ICustomerAccountRevenue
  newCustomerTotal: number
  /**
   * Tổng khách TOÀN HỆ THỐNG, không giới hạn khoảng ngày (từ `GET /user`, chỉ lọc
   * `role = CUSTOMER`). Không lọc chi nhánh được — khách tự đăng ký có `branch = NULL`,
   * xem giải thích đầy đủ tại chỗ gọi trong `customer-analytics-panel.tsx`.
   *
   * `undefined` = chưa tải xong → ẩn hẳn card thay vì hiện 0, vì "0 khách" là một khẳng
   * định sai và người đọc không phân biệt được nó với trạng thái đang tải.
   */
  allCustomerTotal?: number
  /** Tổng khách mới kỳ trước — `undefined` khi so sánh TẮT hoặc chưa có dữ liệu. */
  newCustomerPrevTotal?: number
  /** Tổng chi tiêu kỳ trước — cùng quy ước `undefined` như trên. */
  spendPrevTotal?: number
  customerType: CustomerAccountRevenueType
  isLoading: boolean
  /**
   * `true` khi filter SĐT đang thu hẹp khối chi tiêu — ẨN HẲN card "Khách mới". Ba card
   * chi tiêu còn lại re-flow sang lưới 3 cột.
   */
  hideNewCustomerCard?: boolean
  /**
   * `true` khi đã chọn MỘT phương thức thanh toán cụ thể. Lúc đó API chỉ trả tiền của
   * phương thức đó nên breakdown 4 card thành vô nghĩa (1 card = tổng, 3 card = 0đ) —
   * ẩn breakdown, chỉ giữ card "Tổng chi tiêu" (vốn đã = tiền của phương thức đang lọc).
   * Chỉ có tác dụng khi `hideNewCustomerCard` cũng true.
   */
  paymentMethodSelected?: boolean
}

export default function CustomerAnalyticsSummary({
  revenue,
  newCustomerTotal,
  allCustomerTotal,
  newCustomerPrevTotal,
  spendPrevTotal,
  customerType,
  isLoading,
  hideNewCustomerCard = false,
  paymentMethodSelected = false,
}: CustomerAnalyticsSummaryProps) {
  const { t } = useTranslation('customer')
  const kpis = computeSpendingKpis({ revenue })
  // Chỉ có ý nghĩa (và chỉ được RENDER) ở chế độ `hideNewCustomerCard` — xem JSX bên
  // dưới — nhưng tính sẵn ở đây để không lồng lời gọi hook-adjacent bên trong nhánh JSX.
  const paymentBreakdown = computePaymentMethodBreakdown(revenue)

  const newGrowth = computeGrowth(newCustomerTotal, newCustomerPrevTotal)
  const spendGrowth = computeGrowth(kpis.totalAmount, spendPrevTotal)

  const value = (node: React.ReactNode) =>
    isLoading ? <Skeleton className="w-20 h-7" /> : node

  // Chênh lệch so kỳ trước: chỉ hiện khi computeGrowth có gì đó để nói (percent hoặc
  // "mới"). Khi so sánh TẮT hoặc chưa có dữ liệu kỳ trước, `computeGrowth` trả về
  // percent: null, isNew: false → render null (không bịa baseline).
  //
  // `onPrimary`: card "Khách mới" có nền `bg-primary` (cam) — xanh lá (`text-green-500`)
  // trên nền cam gần như không đọc được (tương phản kém), nên trên nền này chữ LUÔN
  // trắng bất kể tăng hay giảm (ngữ cảnh của card đã ngầm nói metric là gì, không cần
  // màu xanh/đỏ để phân biệt). Vẫn giữ dấu +/- và mũi tên ý nghĩa tăng/giảm — chỉ đổi
  // MÀU, không đổi NỘI DUNG. Hai card trắng còn lại (Tổng chi tiêu, …) không truyền cờ
  // này nên vẫn giữ xanh lá/đỏ như cũ (tương phản tốt trên nền trắng).
  const renderGrowth = (growth: GrowthResult, onPrimary = false) => {
    if (isLoading) return null
    if (growth.isNew) {
      return (
        <div
          className={cn(
            'text-xs font-medium tabular-nums',
            onPrimary ? 'text-white' : 'text-green-500',
          )}
        >
          {t('customer.analytics.newLabel')}
        </div>
      )
    }
    if (growth.percent === null) return null
    const isPositive = growth.percent >= 0
    return (
      <div
        className={cn(
          'text-xs font-medium tabular-nums',
          onPrimary ? 'text-white' : isPositive ? 'text-green-500' : 'text-destructive',
        )}
      >
        {isPositive ? '+' : ''}
        {growth.percent}% {t('customer.analytics.vsPrevious')}
      </div>
    )
  }

  // "Tổng chi tiêu" xuất hiện trong CẢ hai layout (4-card mặc định lẫn breakdown theo
  // SĐT) với cùng nội dung VÀ cùng lưới `grid grid-cols-2 lg:grid-cols-4` — tách thành
  // hàm dựng thay vì chép JSX hai lần.
  const renderTotalSpendingCard = () => (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">
          {t('customer.analytics.totalSpending')}
        </CardTitle>
        <Wallet className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {value(
          <>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(kpis.totalAmount)}
            </div>
            {renderGrowth(spendGrowth)}
          </>,
        )}
      </CardContent>
    </Card>
  )

  // Bốn card chia chi tiêu theo phương thức thanh toán (đọc thẳng `revenue.summary`).
  // Dùng CHUNG cho hai chỗ: nhánh lọc-SĐT (kèm "Tổng chi tiêu" trong cùng lưới) và
  // nhánh mặc định "Tất cả phương thức" (một lưới riêng bên dưới bốn card KPI). Luôn đủ
  // bốn phương thức kể cả 0đ (theo yêu cầu product owner).
  const renderBreakdownCards = () =>
    paymentBreakdown.map((item) => (
      <Card key={item.i18nKey} className="shadow-none">
        <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">{t(item.i18nKey)}</CardTitle>
        </CardHeader>
        <CardContent>
          {value(
            <>
              <div className="text-2xl font-bold tabular-nums">
                {formatCurrency(item.amount)}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {item.percent}%
              </div>
            </>,
          )}
        </CardContent>
      </Card>
    ))

  return (
    <div className="flex flex-col gap-2">
      {hideNewCustomerCard ? (
        /* Lọc theo SĐT → dashboard chỉ còn nói về MỘT khách: "Khách có chi tiêu" (~luôn
           1) và "TB mỗi khách" (~luôn bằng "Tổng chi tiêu") không còn mang thông tin gì
           mới nên được thay bằng bảng chia theo phương thức thanh toán
           (`computePaymentMethodBreakdown`, đọc thẳng `revenue.summary`). LUÔN đủ 4 card
           phương thức (kể cả 0đ, theo yêu cầu product owner) + 1 card "Tổng chi tiêu" =
           5 card cố định. Dùng CÙNG lưới `grid grid-cols-2 lg:grid-cols-4` với layout
           không-phone bên dưới (thay vì `flex flex-wrap` + `flex-1`) — `flex-1` từng
           kéo dãn MỘT card lẻ loi (vd. chỉ còn "Tổng chi tiêu" khi đã lọc 1 phương thức)
           thành full-width, xấu. Lưới cột cố định thì mỗi card luôn giữ đúng 1 ô (~1/2
           màn hẹp, ~1/4 màn rộng) bất kể đang hiện 1, 2 hay 5 card — card lẻ loi nằm gọn
           bên trái thay vì bị bóp giãn. Ô trống ở hàng cuối khi số card không chia hết
           cho số cột (vd. 5 card / 4 cột) là đánh đổi chấp nhận được, tốt hơn hẳn một
           card full-width. */
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {renderTotalSpendingCard()}
          {/* Đã lọc 1 phương thức cụ thể → breakdown thừa (chỉ phương thức đó có tiền),
              ẩn đi, chỉ giữ "Tổng chi tiêu" phía trên. */}
          {!paymentMethodSelected && renderBreakdownCards()}
        </div>
      ) : (
        // LUÔN 4 cột, kể cả khi `SHOW_CONVERSION_CARD` tắt và hàng này chỉ còn 3 card.
        // Hàng breakdown 4 phương thức thanh toán ngay bên dưới là một lưới RIÊNG, cố
        // định `lg:grid-cols-4` — co hàng này xuống 3 cột thì hai hàng lệch mạch cột, các
        // card so le nhau theo chiều dọc và khối summary đọc ra như hai bảng rời rạc. Một
        // ô trống ở cuối hàng trên đỡ hại hơn nhiều so với việc phá mạch cột chung.
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Card className="text-white shadow-none bg-primary">
            <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
              <CardTitle className="text-sm font-bold">
                {t('customer.analytics.totalNewCustomers')}
              </CardTitle>
              <UserPlus className="w-4 h-4" />
            </CardHeader>
            <CardContent>
              {value(
                <>
                  <div className="text-2xl font-bold tabular-nums">{newCustomerTotal}</div>
                  {/* Cảnh báo phạm vi, KHÔNG phải trang trí. Số này đến từ
                      `/user/statistics`, mà endpoint đó chỉ lọc theo `role = Customer`
                      + khoảng ngày — KHÔNG nhận tham số `branch` (xem
                      GetUserStatisticsQueryRequestDto ở BE). Ba card còn lại trên cùng
                      hàng thì CÓ lọc chi nhánh (`/user/revenue/account`). Đổi chi nhánh
                      trên panel, card này đứng yên còn ba card kia nhảy — không phơi sự
                      khác biệt đó ra thì người đọc mặc định cả hàng cùng phạm vi và sẽ
                      ghép nhầm tỉ lệ giữa chúng.
                      XOÁ DÒNG NÀY khi BE bổ sung filter chi nhánh cho /user/statistics
                      và panel truyền `branch` vào — lúc đó nó thành sai. */}
                  <div className="text-xs font-medium text-white/80">
                    {t('customer.analytics.allBranchesScope')}
                  </div>
                  {renderGrowth(newGrowth, true)}
                </>,
              )}
            </CardContent>
          </Card>

          {/* Tổng khách của chi nhánh — KHÔNG theo khoảng ngày (xem prop
              `allCustomerTotal`). Đặt ngay sau "Khách mới" vì hai card này cùng đếm
              ĐẦU NGƯỜI: để cạnh nhau thì khác biệt về phạm vi (kỳ này ↔ mọi thời đại,
              toàn hệ thống ↔ chi nhánh) đọc ra ngay, thay vì bị hai card TIỀN chen vào
              giữa làm đứt mạch so sánh.
              Ẩn khi `undefined` — xem lý do ở khai báo prop. */}
          {allCustomerTotal !== undefined && (
            <Card className="shadow-none">
              <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">
                  {t('customer.analytics.allCustomerTotal')}
                </CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {value(
                  <>
                    <div className="text-2xl font-bold tabular-nums">
                      {allCustomerTotal}
                    </div>
                    {/* Nhãn phạm vi bắt buộc, đối xứng với nhãn "Toàn hệ thống" của card
                        "Khách mới": mọi card khác trên trang đều bị khoá theo khoảng ngày
                        đang chọn, riêng card này thì không. Không nói ra thì người đọc mặc
                        định nó cũng theo kỳ và sẽ thắc mắc vì sao kéo ngày nó không đổi. */}
                    <div className="text-xs text-muted-foreground">
                      {t('customer.analytics.allTimeScope')}
                    </div>
                  </>,
                )}
              </CardContent>
            </Card>
          )}

          {renderTotalSpendingCard()}

          {/* Tử số (customers.length) và mẫu số (total) đến từ CÙNG response
              /revenue/account, dưới CÙNG bộ filter → tỉ lệ luôn mô tả đúng một tập
              khách, có nghĩa với cả hai customerType. Tiêu đề vẫn phân biệt hai tập
              ("khách mới đã chi tiêu" khi lọc new-register, "khách đã chi tiêu" khi
              all) vì đó là điều customerType thực sự thay đổi. Giá trị chính LUÔN là
              số tuyệt đối; % chỉ là chú thích, ẩn riêng khi total = 0 (không chia 0).

              Đang TẠM TẮT qua `SHOW_CONVERSION_CARD` — xem lý do đầy đủ ở khai báo
              hằng số đó, đầu file. */}
          {SHOW_CONVERSION_CARD && (
          <Card className="shadow-none">
            <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {customerType === CustomerAccountRevenueType.NEW_REGISTER
                  ? t('customer.analytics.conversion')
                  : t('customer.analytics.spendingCustomers')}
              </CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {value(
                <>
                  <div className="text-2xl font-bold tabular-nums">
                    {kpis.spendingCustomers}
                    {/* Mẫu số hiển thị NGAY cạnh tử số, nhỏ và mờ hơn để không tranh
                        chấp vai trò "con số chính" của card — nhưng vẫn phải nằm trên
                        cùng dòng: đẩy nó xuống dòng phụ là quay lại đúng trạng thái
                        người đọc phải tự ghép tử/mẫu. Chỉ ẩn khi total = 0, đúng
                        điều kiện `conversion === null` (không có gì để chia). */}
                    {kpis.totalCustomers > 0 && (
                      <span className="ml-1 text-base font-normal text-muted-foreground">
                        / {kpis.totalCustomers}
                      </span>
                    )}
                  </div>
                  {kpis.conversion !== null && (
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {kpis.conversion}% {t('customer.analytics.conversionSuffix')}
                    </div>
                  )}
                </>,
              )}
            </CardContent>
          </Card>
          )}

          <Card className="shadow-none">
            <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {t('customer.analytics.avgPerCustomer')}
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {value(
                <div className="text-2xl font-bold tabular-nums">
                  {formatCurrency(kpis.avgPerCustomer)}
                </div>,
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* "Tất cả phương thức" (không lọc riêng một phương thức) → thêm hàng chia chi tiêu
          tổng theo từng phương thức, dưới các card KPI. Khi đã lọc 1 phương thức cụ thể
          thì thừa (chỉ phương thức đó có tiền) nên ẩn. Ở chế độ lọc-SĐT breakdown đã nằm
          ngay trong lưới trên nên không lặp lại ở đây. */}
      {!hideNewCustomerCard && !paymentMethodSelected && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{renderBreakdownCards()}</div>
      )}
    </div>
  )
}
