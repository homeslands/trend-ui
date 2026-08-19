import CardOrderPaymentMethodSelect from '@/components/app/select/card-order-payment-method-select';
import CardOrderStatusSelect from '@/components/app/select/card-order-status-select'
import { Button, ExcelIcon } from '@/components/ui';
import { memo } from 'react'

export interface ICardOrderActionProps {
  disabled?: boolean
  status?: string;
  pm?: string;
  onSelectChange: (v: string) => void;
  onExportExcel?: () => void;
  onPMSelectChange: (v: string) => void
}

const CardOrderAction = memo(({ disabled = false, pm, status, onSelectChange, onExportExcel, onPMSelectChange }: ICardOrderActionProps) => {

  return (
    <div className="flex gap-2 flex-wrap">
      <CardOrderPaymentMethodSelect value={pm} onChange={onPMSelectChange} />
      <CardOrderStatusSelect value={status} onChange={onSelectChange} />
      <Button variant="outline" className='bg-background' onClick={onExportExcel} disabled={disabled}>
        <ExcelIcon />
        Excel
      </Button>
    </div>
  )
});

export default CardOrderAction;