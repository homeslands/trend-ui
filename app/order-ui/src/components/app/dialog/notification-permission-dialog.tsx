import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

interface NotificationPermissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function NotificationPermissionDialog({
  open,
  onOpenChange,
}: NotificationPermissionDialogProps) {
  const { t } = useTranslation(['notification'])
  const isNative = Capacitor.isNativePlatform()

  const handleOpenChange = (newOpen: boolean) => {
    // Cho phép đóng dialog khi user bấm nút đóng hoặc X
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-lg" 
        onInteractOutside={(e) => {
          // Cho phép đóng khi click outside
          e.preventDefault()
          onOpenChange(false)
        }} 
        onEscapeKeyDown={() => {
          // Cho phép đóng khi bấm ESC
          onOpenChange(false)
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            {t('notification.permissionDialog.title', {
              defaultValue: 'Thông báo bị tắt',
            })}
          </DialogTitle>
          <DialogDescription>
            {t('notification.permissionDialog.description', {
              defaultValue:
                'Bạn cần bật thông báo để nhận được các thông báo quan trọng từ hệ thống.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isNative ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">
                {t('notification.permissionDialog.nativeSteps', {
                  defaultValue: 'Cách bật thông báo trên thiết bị:',
                })}
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>
                  {t('notification.permissionDialog.nativeStep1', {
                    defaultValue: 'Mở Cài đặt (Settings) trên thiết bị',
                  })}
                </li>
                <li>
                  {t('notification.permissionDialog.nativeStep2', {
                    defaultValue: 'Tìm và chọn ứng dụng này',
                  })}
                </li>
                <li>
                  {t('notification.permissionDialog.nativeStep3', {
                    defaultValue: 'Bật "Thông báo" (Notifications)',
                  })}
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="font-medium">
                {t('notification.permissionDialog.webSteps', {
                  defaultValue: 'Cách bật thông báo trên trình duyệt:',
                })}
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>
                  {t('notification.permissionDialog.webStep1', {
                    defaultValue: 'Nhấn vào biểu tượng khóa hoặc thông tin ở thanh địa chỉ',
                  })}
                </li>
                <li>
                  {t('notification.permissionDialog.webStep2', {
                    defaultValue: 'Tìm mục "Thông báo" (Notifications)',
                  })}
                </li>
                <li>
                  {t('notification.permissionDialog.webStep3', {
                    defaultValue: 'Chọn "Cho phép" (Allow)',
                  })}
                </li>
              </ol>
            </div>
          )}

          <p className="text-sm text-destructive font-medium">
            {t('notification.permissionDialog.warning', {
              defaultValue: 'Nếu đóng thì bạn sẽ không nhận được thông báo từ trình duyệt.',
            })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('notification.permissionDialog.close', { defaultValue: 'Đóng' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

