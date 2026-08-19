import { Label, Switch } from '@/components/ui'
import { useTranslation } from 'react-i18next'

interface IIsCustomPriceSwitchProps {
    defaultValue: boolean | undefined
    onChange: (checked: boolean) => void
}

export default function IsCustomPriceSwitch({ defaultValue, onChange }: IIsCustomPriceSwitchProps) {
    const { t } = useTranslation(['product'])
    return (
        <>
            <div className="flex gap-4 justify-between items-center py-2 w-full">
                <Label>{t('product.isCustomPrice')}</Label>
                <Switch defaultChecked={defaultValue} onCheckedChange={onChange} />
            </div>
        </>
    )
}
