import { useQuery } from '@tanstack/react-query'
import { getAuthScope } from '@/api'
import { QUERYKEY } from '@/constants'
import { useAuthStore } from '@/stores'

/**
 * Bao lâu thì coi scope là cũ. Trong khoảng này, chuyển trang trong ứng dụng
 * dùng lại bản đã có, không gọi lại `/auth/scope`.
 *
 * Vì sao cần: `QueryClient` không đặt `staleTime` mặc định, nên trước đây mỗi
 * lần điều hướng sang một trang được bảo vệ là một lời gọi mới — `ProtectedElement`
 * mount lại theo từng route.
 *
 * Vì sao 5 phút là đủ an toàn: quyền ở giao diện chỉ để điều hướng, không phải
 * hàng rào. Hàng rào thật nằm ở `trend`, dựng lại từ cơ sở dữ liệu trên **mọi**
 * request (`JwtStrategy` + `RolesGuard`). Bản cũ trong tối đa 5 phút chỉ khiến
 * một mục menu hiện thừa rồi bấm vào bị chặn, không cấp thêm quyền thật.
 *
 * Vì sao không dài hơn: đổi vai trò cho ai đó phải có tác dụng mà không bắt họ
 * đăng nhập lại. Tải lại trang thì luôn lấy bản mới ngay, vì bộ nhớ đệm của
 * react-query nằm trong RAM và mất khi F5.
 */
const SCOPE_STALE_TIME_MS = 5 * 60 * 1000

/**
 * Giữ scope trong bộ nhớ đệm lâu hơn `staleTime` để những lúc route tháo ra rồi
 * gắn lại (chuyển trang, Suspense) không rơi về trạng thái "chưa biết quyền" và
 * bắt người dùng nhìn vòng quay chờ giữa phiên. Mặc định của react-query là 5
 * phút, vừa đúng bằng `staleTime`, nên rất dễ chạm ranh giới đó.
 */
const SCOPE_GC_TIME_MS = 30 * 60 * 1000

export interface IPermissionsStatus {
  permissions: string[]
  /**
   * `true` khi đã có token nhưng lời gọi `/auth/scope` CHƯA trả về lần nào.
   *
   * Phân biệt được hai trạng thái này là bắt buộc: "chưa biết có quyền gì" khác
   * hẳn "không có quyền nào". Gộp chúng lại chính là nguyên nhân lỗi tester ghi
   * ngày 03/09/2026 — mỗi lần F5, cache của react-query rỗng nên
   * `permissions` là `[]`, `ProtectedElement` hiểu là không có quyền và đá
   * người dùng sang trang 403. Khách hàng không dính vì nhánh kiểm tra của họ
   * nằm trước, không đọc tới `permissions`.
   */
  isLoading: boolean
}

/**
 * Nguồn quyền duy nhất của giao diện: `GET {trend}/auth/scope`.
 *
 * Vì sao phải gọi API chứ không đọc từ token: từ đợt tách service, JWT do
 * `shared-user` phát hành không còn mang `scope` nữa — vai trò và quyền là
 * nghiệp vụ của `trend` (xem `architect-http.md` mục 1, dòng Role/Permission).
 */
export function usePermissionsStatus(): IPermissionsStatus {
  const { token } = useAuthStore()

  const { data, isFetched } = useQuery({
    queryKey: [QUERYKEY.authScope],
    queryFn: getAuthScope,
    enabled: !!token,
    staleTime: SCOPE_STALE_TIME_MS,
    gcTime: SCOPE_GC_TIME_MS,
  })

  return {
    permissions: data?.result?.permissions ?? [],
    // Có token mà chưa từng lấy xong scope ⇒ vẫn đang chờ, chưa kết luận được.
    isLoading: !!token && !isFetched,
  }
}

/**
 * Hook để lấy danh sách permissions từ API (/auth/scope)
 * @returns Array of permission strings
 */
export function usePermissions(): string[] {
  return usePermissionsStatus().permissions
}

/**
 * Hook để kiểm tra user có permission cụ thể không
 * @param permission - Permission code cần kiểm tra
 * @returns boolean
 */
export function useHasPermission(permission: string): boolean {
  const permissions = usePermissions()
  return permissions.includes(permission)
}
