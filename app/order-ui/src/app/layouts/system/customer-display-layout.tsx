import { Outlet } from 'react-router-dom'

export default function CustomerDisplayLayout() {
  // Layout không có header, sidebar, chỉ hiển thị nội dung trần
  return <Outlet />
}

