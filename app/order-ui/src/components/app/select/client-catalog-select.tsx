import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactSelect, { SingleValue } from 'react-select'

import { useCatalogs } from '@/hooks'
import { useMenuFilterStore, useThemeStore } from '@/stores'

const TOP_SELL_CATALOG_VALUE = '__top_sell__'
const NEW_PRODUCT_CATALOG_VALUE = '__new_product__'

export default function ClientCatalogSelect() {
  const { t } = useTranslation('menu')
  const { t: tProduct } = useTranslation('product')
  const { getTheme } = useThemeStore()
  const { menuFilter, setMenuFilter } = useMenuFilterStore()
  const [allCatalogs, setAllCatalogs] = useState<
    { value: string; label: string }[]
  >([{ value: '', label: t('menu.all') }])
  const [selectedCatalog, setSelectedCatalog] = useState<{
    value: string
    label: string
  } | null>({ value: '', label: t('menu.all') })
  const { data } = useCatalogs()

  const capitalizeFirstLetter = (str: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1) : ''

  useEffect(() => {
    if (data?.result) {
      const newCatalogs = data.result.map((item) => ({
        value: item.slug || '',
        label: capitalizeFirstLetter(item.name || ''),
      }))
      setAllCatalogs([
        { value: '', label: capitalizeFirstLetter(t('menu.all')) },
        { value: TOP_SELL_CATALOG_VALUE, label: capitalizeFirstLetter(tProduct('product.isTopSell')) },
        { value: NEW_PRODUCT_CATALOG_VALUE, label: capitalizeFirstLetter(tProduct('product.isNew')) },
        ...newCatalogs,
      ])
    }
  }, [data, t, tProduct])

  useEffect(() => {
    if (menuFilter.isTopSell) {
      const topSellOption = allCatalogs.find(
        (catalog) => catalog.value === TOP_SELL_CATALOG_VALUE,
      )
      if (topSellOption) {
        setSelectedCatalog(topSellOption)
        return
      }
    }
    if (menuFilter.isNewProduct) {
      const newProductOption = allCatalogs.find(
        (catalog) => catalog.value === NEW_PRODUCT_CATALOG_VALUE,
      )
      if (newProductOption) {
        setSelectedCatalog(newProductOption)
        return
      }
    }
    if (menuFilter.catalog && allCatalogs.length > 0) {
      const defaultOption = allCatalogs.find(
        (catalog) => catalog.value === menuFilter.catalog,
      )
      if (defaultOption) {
        setSelectedCatalog(defaultOption)
      }
    } else {
      setSelectedCatalog({ value: '', label: t('menu.all') })
    }
  }, [menuFilter.catalog, menuFilter.isTopSell, menuFilter.isNewProduct, allCatalogs, t])

  const handleChange = (
    selectedOption: SingleValue<{ value: string; label: string }>,
  ) => {
    if (selectedOption) {
      setSelectedCatalog(selectedOption)
      if (selectedOption.value === TOP_SELL_CATALOG_VALUE) {
        setMenuFilter({ ...menuFilter, catalog: undefined, isTopSell: true, isNewProduct: false })
        return
      }

      if (selectedOption.value === NEW_PRODUCT_CATALOG_VALUE) {
        setMenuFilter({ ...menuFilter, catalog: undefined, isTopSell: false, isNewProduct: true })
        return
      }

      setMenuFilter({ ...menuFilter, catalog: selectedOption.value, isTopSell: false, isNewProduct: false })
    }
  }

  return (
    <ReactSelect
      className="w-full text-sm"
      value={selectedCatalog}
      options={allCatalogs}
      onChange={handleChange}
      defaultValue={selectedCatalog}
      styles={{
        control: (baseStyles) => ({
          ...baseStyles,
          backgroundColor: getTheme() === 'light' ? 'white' : '',
          borderColor: getTheme() === 'light' ? '#e2e8f0' : '#2d2d2d',
        }),
        menu: (baseStyles) => ({
          ...baseStyles,
          backgroundColor: getTheme() === 'light' ? 'white' : '#121212',
        }),
        option: (baseStyles, state) => ({
          ...baseStyles,
          backgroundColor: state.isFocused
            ? getTheme() === 'light'
              ? '#e2e8f0'
              : '#2d2d2d'
            : getTheme() === 'light'
              ? 'white'
              : '#121212',
          color: getTheme() === 'light' ? 'black' : 'white',
          '&:hover': {
            backgroundColor: getTheme() === 'light' ? '#e2e8f0' : '#2d2d2d',
          },
        }),
        singleValue: (baseStyles) => ({
          ...baseStyles,
          color: getTheme() === 'light' ? 'black' : 'white',
        }),
      }}
    />
  )
}
