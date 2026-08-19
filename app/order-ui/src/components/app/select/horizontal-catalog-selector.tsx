import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

import { useCatalogs } from '@/hooks'
import { useMenuFilterStore, useThemeStore } from '@/stores'

const TOP_SELL_CATALOG_VALUE = '__top_sell__'
const NEW_PRODUCT_CATALOG_VALUE = '__new_product__'

export default function HorizontalCatalogSelect() {
    const { t } = useTranslation('menu')
    const { t: tProduct } = useTranslation('product')
    const { getTheme } = useThemeStore()
    const { menuFilter, setMenuFilter } = useMenuFilterStore()
    const [selected, setSelected] = useState<string>(
        menuFilter.isTopSell
            ? TOP_SELL_CATALOG_VALUE
            : menuFilter.isNewProduct
                ? NEW_PRODUCT_CATALOG_VALUE
                : (menuFilter.catalog || '')
    )
    const [catalogs, setCatalogs] = useState<{ label: string; value: string }[]>([
        { value: '', label: t('menu.all') },
    ])
    const { data } = useCatalogs()

    useEffect(() => {
        if (data?.result) {
            const newCatalogs = data.result.map((item) => ({
                value: item.slug || '',
                label: item.name || '',
            }))
            setCatalogs([
                { value: '', label: t('menu.all') },
                { value: TOP_SELL_CATALOG_VALUE, label: tProduct('product.isTopSell') },
                { value: NEW_PRODUCT_CATALOG_VALUE, label: tProduct('product.isNew') },
                ...newCatalogs,
            ])
        }
    }, [data, t, tProduct])

    useEffect(() => {
        setSelected(
            menuFilter.isTopSell
                ? TOP_SELL_CATALOG_VALUE
                : menuFilter.isNewProduct
                    ? NEW_PRODUCT_CATALOG_VALUE
                    : (menuFilter.catalog || '')
        )
    }, [menuFilter.catalog, menuFilter.isTopSell, menuFilter.isNewProduct])

    const handleClick = (value: string) => {
        setSelected(value)
        if (value === TOP_SELL_CATALOG_VALUE) {
            setMenuFilter({ ...menuFilter, catalog: undefined, isTopSell: true, isNewProduct: false })
            return
        }
        if (value === NEW_PRODUCT_CATALOG_VALUE) {
            setMenuFilter({ ...menuFilter, catalog: undefined, isTopSell: false, isNewProduct: true })
            return
        }
        setMenuFilter({ ...menuFilter, catalog: value, isTopSell: false, isNewProduct: false })
    }

    return (
        <div className="flex flex-wrap gap-2 items-center px-2 sm:max-w-full">
            {catalogs.map((catalog) => (
                <button
                    key={catalog.value}
                    onClick={() => handleClick(catalog.value)}
                    className={clsx(
                        'px-4 py-1 rounded-full border text-sm whitespace-nowrap transition-all duration-200',
                        selected === catalog.value
                            ? getTheme() === 'light'
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-black border-white'
                            : getTheme() === 'light'
                                ? 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                                : 'bg-[#1e1e1e] text-gray-300 border-gray-600 hover:bg-[#2a2a2a]'
                    )}
                >
                    {catalog?.label.charAt(0).toUpperCase() + catalog?.label.slice(1)}
                </button>
            ))}
        </div>

    )
}
