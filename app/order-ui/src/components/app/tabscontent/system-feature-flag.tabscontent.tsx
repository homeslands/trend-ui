import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Skeleton, Switch } from '@/components/ui';
import { GiftCardFlagGroup, GiftCardType } from '@/constants';
import { useBulkToggleFeatureFlags, useGetFeatureFlagsByGroup } from '@/hooks';
import { IGiftCardFlagFeature } from '@/types';
import { showToast } from '@/utils';
import { LockIcon, SaveIcon, UnlockIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next';


export interface IFilterProps {
  startDate?: string;
  endDate?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  status?: any;
}


export function SystemFeatureFlagTabContent() {
  const { t } = useTranslation(['giftCard'])
  const { t: tCommon } = useTranslation(['common'])

  const [localFlags, setLocalFlags] = useState<IGiftCardFlagFeature[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  const {
    data: featureFlagsResponse,
    isLoading,
    refetch: refetchFeatureFlags,
  } = useGetFeatureFlagsByGroup(GiftCardFlagGroup.GIFT_CARD)
  const featureFlags = useMemo(
    () => (featureFlagsResponse && featureFlagsResponse?.result) || [],
    [featureFlagsResponse],
  )

  const { mutate: bulkToggleFlags, isPending: isSaving } =
    useBulkToggleFeatureFlags()

  // Initialize local state when data loads
  useEffect(() => {
    if (featureFlags.length > 0) {
      setLocalFlags([...featureFlags])
      setHasChanges(false)
    }
  }, [featureFlags])

  const handleToggleFlag = (flagSlug: string) => {
    setLocalFlags((prev) =>
      prev.map((flag) =>
        flag.slug === flagSlug ? { ...flag, isLocked: !flag.isLocked } : flag,
      ),
    )
    setHasChanges(true)
  }

  const handleSave = () => {
    const updates = localFlags.map((flag) => ({
      slug: flag.slug,
      isLocked: flag.isLocked,
    }))

    bulkToggleFlags(updates, {
      onSuccess: () => {
        showToast(t('giftCard.giftCardFeatureFlag.updateSuccess'))
        setHasChanges(false)
        refetchFeatureFlags()
      },
    })
  }

  const handleReset = () => {
    setLocalFlags([...featureFlags])
    setHasChanges(false)
  }

  const getGiftCardTypeLabel = (type: GiftCardType) => {
    const labels = {
      [GiftCardType.SELF]: t('giftCard.buyForSelf'),
      [GiftCardType.GIFT]: t('giftCard.giftToOthers'),
      [GiftCardType.BUY]: t('giftCard.purchaseGiftCard'),
      [GiftCardType.NONE]: t('giftCard.giftCardLock'),
    }
    return labels[type] || type
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4">

      <div className="">

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving || !hasChanges}
          >
            {tCommon('common.reset')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            <SaveIcon className="mr-2 h-4 w-4" />
            {tCommon('common.save')}
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LockIcon className="h-5 w-5" />
                {t('giftCard.giftCardFeatureFlag.featureControls')}
              </div>
              <div className="pr-4">
                {/* Switch Unlock/lock All */}
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="lock-all-switch"
                    className={`cursor-pointer font-semibold transition-colors ${localFlags.every((flag) => flag.isLocked)
                      ? 'text-red-600 hover:text-red-700'
                      : 'text-green-600 hover:text-green-700'
                      }`}
                  >
                    {localFlags.every((flag) => flag.isLocked) ? (
                      <div className="flex items-center gap-1">
                        <UnlockIcon className="h-4 w-4" />
                        {t('giftCard.giftCardFeatureFlag.unlockAll')}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <LockIcon className="h-4 w-4" />
                        {t('giftCard.giftCardFeatureFlag.lockAll')}
                      </div>
                    )}
                  </Label>
                  <Switch
                    id="lock-all-switch"
                    checked={localFlags.every((flag) => flag.isLocked)}
                    disabled={isSaving || isLoading || localFlags.length === 0}
                    onCheckedChange={(checked) => {
                      setLocalFlags((prev) =>
                        prev.map((flag) => ({ ...flag, isLocked: checked })),
                      )
                      setHasChanges(true)
                    }}
                    className="data-[state=checked]:bg-destructive data-[state=unchecked]:bg-primary"
                  />
                </div>
              </div>
            </CardTitle>
            <CardDescription>
              {t('giftCard.giftCardFeatureFlag.featureControlsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-12" />
                </div>
              ))
            ) : localFlags.length > 0 ? (
              localFlags
                .sort((a, b) => a.order - b.order)
                .map((flag) => (
                  <div
                    key={flag.slug}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={flag.slug} className="font-medium">
                          {getGiftCardTypeLabel(flag.name)}
                        </Label>
                        <Badge
                          variant={flag.isLocked ? 'destructive' : 'default'}
                        >
                          {flag.isLocked
                            ? t('giftCard.giftCardFeatureFlag.locked')
                            : t('giftCard.giftCardFeatureFlag.unlocked')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t(
                          `giftCard.giftCardFeatureFlag.${flag.name.toLowerCase()}Description`,
                        )}
                      </p>
                    </div>
                    <Switch
                      id={flag.slug}
                      checked={flag.isLocked}
                      onCheckedChange={() => handleToggleFlag(flag.slug)}
                      disabled={isSaving}
                      className="data-[state=checked]:bg-destructive data-[state=unchecked]:bg-primary"
                    />
                  </div>
                ))
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                {t('giftCard.giftCardFeatureFlag.noFeatureFlags')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
