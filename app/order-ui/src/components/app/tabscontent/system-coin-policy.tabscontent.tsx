
import CoinPolicyItem from '@/app/system/coin-policy/components/coin-policy-item'
import { useTranslation } from 'react-i18next'
import { useCoinPolicies } from '@/hooks/use-coin-policies'

export interface IFilterProps {
  startDate?: string;
  endDate?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  status?: any;
}


export function SystemCoinPolicyTabContent() {
  const { t } = useTranslation(['coinPolicy'])

  const { data } = useCoinPolicies()

  const coinPolicies = data?.result || [];

  return (
    coinPolicies?.length > 0 ? (
      <div className="grid w-full gap-2">
        {coinPolicies.map((config) => (
          <CoinPolicyItem key={config.slug} data={config} />
        ))}
      </div>
    ) : (
      <p className="text-gray-500 text-center">
        {t('coinPolicy.noData')}
      </p>
    )
  )
}
