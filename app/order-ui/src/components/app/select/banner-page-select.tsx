import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

import { BannerPage } from "@/constants/banner";

interface BannerPageSelectProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export default function BannerPageSelect({ value, defaultValue, onChange }: BannerPageSelectProps) {
  const { t } = useTranslation('banner');

  // Tạo danh sách các trang từ enum BannerPage
  const pageOptions = useMemo(() => [
    {
      value: BannerPage.HOME,
      label: t('banner.pages.home'),
    },
    {
      value: BannerPage.BOOKING,
      label: t('banner.pages.booking'),
    },
    {
      value: BannerPage.ABOUT,
      label: t('banner.pages.about'),
    },
    {
      value: BannerPage.MENU,
      label: t('banner.pages.menu'),
    },
  ], [t]);

  // Tính toán giá trị ban đầu: value > defaultValue > giá trị đầu tiên
  const initialValue = useMemo(() => {
    if (value !== undefined) return value;
    if (defaultValue !== undefined) return defaultValue;
    return pageOptions[0]?.value;
  }, [value, defaultValue, pageOptions]);

  const [selectedValue, setSelectedValue] = useState<string | undefined>(initialValue);

  // Sync with controlled value from form
  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    } else if (!selectedValue) {
      // Nếu không có controlled value và chưa có selectedValue, set default
      setSelectedValue(initialValue);
      if (initialValue && !value) {
        onChange?.(initialValue);
      }
    }
  }, [value, initialValue, onChange, selectedValue]);

  const handleChange = (value: string) => {
    setSelectedValue(value);
    onChange?.(value);
  };

  return (
    <Select onValueChange={handleChange} value={selectedValue}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t('banner.pages.selectPage')} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>
            {t('banner.pages.title')}
          </SelectLabel>
          {pageOptions.map((page) => (
            <SelectItem key={page.value} value={page.value}>
              {page.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}