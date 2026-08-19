/**
 * `GET /revenue/account` đánh dấu `branch` là REQUIRED trong Swagger — UI không còn
 * được phép gửi request thiếu `branch` ("Tất cả chi nhánh" đã bị bỏ, xem panel).
 * Khi URL chưa có `branch`, phải chọn một mặc định thay vì để trống.
 *
 * Ưu tiên giống `BranchSelect` (`src/components/app/select/branch-select.tsx`):
 * chi nhánh đang lưu trong `useBranchStore` (chi nhánh nhân viên đang thao tác,
 * persist qua localStorage) nếu nó còn tồn tại trong danh sách hiện tại; nếu
 * không, lấy chi nhánh ĐẦU TIÊN theo thứ tự API trả về.
 *
 * Hàm thuần (không phụ thuộc hook) để unit-test được mà không cần dựng
 * QueryClientProvider/Zustand — component gọi hàm này với dữ liệu đã lấy sẵn.
 */
export function resolveDefaultBranch(
  branches: { slug: string }[],
  storeBranchSlug?: string,
): string {
  if (branches.length === 0) return ''
  if (storeBranchSlug && branches.some((b) => b.slug === storeBranchSlug)) {
    return storeBranchSlug
  }
  return branches[0].slug
}
