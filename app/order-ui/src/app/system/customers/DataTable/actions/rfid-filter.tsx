import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Scan, CreditCard, QrCode } from 'lucide-react'
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui'
import { listenRFID } from '@/utils'

type ScanMode = 'rfid' | 'qr'

interface RFIDFilterProps {
    onScan: (code: string, mode: ScanMode) => void
    scannedCode?: string
}

export default function RFIDFilter({ onScan, scannedCode }: RFIDFilterProps) {
    const { t } = useTranslation('customer')
    const { t: tCommon } = useTranslation('common')
    const [isOpen, setIsOpen] = useState(false)
    const [scanMode, setScanMode] = useState<ScanMode>('rfid')
    const processedCodeRef = useRef<string>('')

    useEffect(() => {
        if (!scannedCode || isOpen) {
            processedCodeRef.current = ''
        }
    }, [scannedCode, isOpen])

    useEffect(() => {
        if (!isOpen) {
            return
        }

        processedCodeRef.current = ''

        const cleanup = listenRFID((scannedString: string) => {
            if (scannedString !== processedCodeRef.current) {
                processedCodeRef.current = scannedString
                onScan(scannedString, scanMode)
                setIsOpen(false)
            }
        })

        return () => {
            cleanup()
        }
    }, [isOpen, onScan, scanMode])

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)
        if (!open) {
            processedCodeRef.current = ''
        }
    }

    const handleScanModeChange = (mode: ScanMode) => {
        setScanMode(mode)
        processedCodeRef.current = ''
    }

    return (
        <div className="flex gap-2 items-center">
            <Dialog open={isOpen} onOpenChange={handleOpenChange}>
                <DialogTrigger asChild>
                    <Button variant="outline">
                        <Scan className="mr-2 w-4 h-4" />
                        {t('customer.rfid.scanButton')}
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex gap-2 items-center">
                            <Scan className="w-5 h-5" />
                            {t('customer.rfid.dialogTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('customer.rfid.dialogDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Toggle RFID / QR */}
                    <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted">
                        <button
                            onClick={() => handleScanModeChange('rfid')}
                            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                                scanMode === 'rfid'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <CreditCard className="w-4 h-4" />
                            {t('customer.rfid.modeRfid')}
                        </button>
                        <button
                            onClick={() => handleScanModeChange('qr')}
                            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                                scanMode === 'qr'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <QrCode className="w-4 h-4" />
                            {t('customer.rfid.modeQr')}
                        </button>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col justify-center items-center py-8 text-center">
                            <div className="p-4 mb-4 rounded-full bg-primary/10">
                                <Scan className="w-12 h-12 text-primary" />
                            </div>
                            <p className="mb-2 text-muted-foreground">
                                {scanMode === 'rfid'
                                    ? t('customer.rfid.waitingRfid')
                                    : t('customer.rfid.waitingQr')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {scanMode === 'rfid'
                                    ? t('customer.rfid.hintRfid')
                                    : t('customer.rfid.hintQr')}
                            </p>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => handleOpenChange(false)}>
                                {tCommon('common.close')}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
