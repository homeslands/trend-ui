import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('❌ Uncaught error:', error, errorInfo)
    
    // Try to clear corrupted storage
    try {
      localStorage.removeItem('auth-storage')
      localStorage.removeItem('user-info')
    } catch {
      // Ignore
    }
  }

  private handleReload = () => {
    // Clear storage and reload
    try {
      localStorage.clear()
    } catch {
      // Ignore
    }
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-center">
              <svg
                className="h-12 w-12 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-center text-xl font-bold text-gray-900">
              Đã xảy ra lỗi
            </h1>
            <p className="mb-4 text-center text-sm text-gray-600">
              Ứng dụng gặp sự cố không mong muốn. Vui lòng thử lại.
            </p>
            {this.state.error && (
              <details className="mb-4 rounded bg-gray-100 p-2">
                <summary className="cursor-pointer text-xs text-gray-700">
                  Chi tiết lỗi
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-red-600">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReload}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Tải lại ứng dụng
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

