import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { PickupTimeSelect, TableInCartSelect } from '@/components/app/select'

import MapAddressSelector from './map-address-selector'

export default function FulfillmentFields() {
  const type = useOrderFlowStore((state) => state.orderingData?.type)

  if (type === OrderTypeEnum.DELIVERY) return <MapAddressSelector />
  if (type === OrderTypeEnum.TAKE_OUT) return <PickupTimeSelect />
  return <TableInCartSelect />
}
