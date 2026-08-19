import { Button } from "@/components/ui";
import { downloadQrCode } from "@/utils";
import { useTranslation } from "react-i18next";
import { useState } from "react";

interface IDownloadQrCodeProps {
    qrCode: string | null
    slug: string | null
}

export default function DownloadQrCode({ qrCode, slug }: IDownloadQrCodeProps) {
    const { t } = useTranslation(['menu'])
    const { t: tCommon } = useTranslation(['common'])
    const [isDownloading, setIsDownloading] = useState(false)

    const handleDownloadQR = async () => {
        if (!qrCode || !slug) return;

        setIsDownloading(true)
        try {
            await downloadQrCode(qrCode, `payment-qr-${slug}`)
        } catch {
            // Error đã được handle trong downloadQrCode utility
        } finally {
            setIsDownloading(false)
        }
    };
    return (
        <Button
            disabled={!qrCode || isDownloading}
            className="w-fit"
            onClick={handleDownloadQR}
        >
            {isDownloading ? tCommon('common.loading') || 'Downloading...' : t('paymentMethod.downloadQRCode')}
        </Button>
    )
}