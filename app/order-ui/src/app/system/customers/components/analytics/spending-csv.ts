import moment from 'moment'

import { SpendingRow } from '@/app/system/customers/DataTable/columns/customer-spending-columns'

/** Bọc nháy kép khi ô chứa dấu phẩy, nháy kép, xuống dòng hoặc carriage return (RFC 4180); nháy kép bên trong nhân đôi. */
const escapeCell = (value: string | number): string => {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Excel/Google Sheets diễn giải ô bắt đầu bằng =, +, -, @, tab hoặc carriage return
 * là CÔNG THỨC. customerName do chính khách hàng tự nhập lúc đăng ký (dữ liệu ngoài,
 * không tin cậy), nên một cái tên như '=HYPERLINK("http://evil.com","Click")' có thể
 * tấn công nhân viên khi mở file export bằng Excel. Thêm dấu nháy đơn đứng trước để ép
 * trình đọc bảng tính coi ô là văn bản thuần — đây là biện pháp chống CSV/formula
 * injection tiêu chuẩn (OWASP). KHÔNG PHẢI lỗi gõ nhầm — đừng xoá khi refactor.
 * Chỉ áp dụng cho ô văn bản; cột số (totalAmount, ...) không bao giờ mang giá trị
 * này nên không cần và không được thêm nháy đơn.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/
const escapeText = (value: string): string =>
  escapeCell(FORMULA_TRIGGER.test(value) ? `'${value}` : value)

export function buildSpendingCsv(
  rows: SpendingRow[],
  headers: string[],
): string {
  const lines = [headers.map(escapeCell).join(',')]
  for (const r of rows) {
    lines.push(
      [
        escapeText(r.customerName),
        escapeCell(moment(r.customerRegisteredAt).format('DD/MM/YYYY')),
        r.totalAmount,
        r.totalAmountBank,
        r.totalAmountCash,
        r.totalAmountPoint,
        r.totalAmountCreditCard,
      ].join(','),
    )
  }
  return lines.join('\n')
}
