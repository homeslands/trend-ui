import { useState, useEffect, memo } from "react";
import { Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
    Button,
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui";
import { RevenueTypeSelect } from "../select";
import { RevenueFilterForm } from "../form";
import { RevenueTypeQuery } from "@/constants";
import { IRevenueQuery } from "@/types";
import { useOverviewFilterStore } from "@/stores";

interface RevenueFilterPopoverProps {
    onApply: (data: IRevenueQuery) => void;
    initialValue?: {
        type?: RevenueTypeQuery;
        startDate?: string;
        endDate?: string
    }
}

const RevenueFilterPopover = memo(function RevenueFilterPopover({ onApply, initialValue }: RevenueFilterPopoverProps) {
    const { t } = useTranslation(["revenue"]);
    const [open, setOpen] = useState(false);
    const [localType, setLocalType] = useState<RevenueTypeQuery>(initialValue?.type || RevenueTypeQuery.HOURLY);
    const { overviewFilter } = useOverviewFilterStore();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    useEffect(() => {
        if (initialValue?.type) {
            setLocalType(initialValue.type);
            return;
        }

        if (overviewFilter.type) {
            setLocalType(overviewFilter.type);
        } else {
            // Reset to default if no store value
            setLocalType(RevenueTypeQuery.HOURLY);
        }

    }, [overviewFilter.type]);

    const handleFilterRevenue = (data: IRevenueQuery) => {
        const finalData = {
            ...data,
            type: localType
        }

        onApply(finalData)
        setOpen(false)
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline">
                    <Settings2 />
                    {t("revenue.filter")}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[32rem]">
                <div className="flex flex-col gap-1 w-full">
                    <div className="space-y-2">
                        <span className="font-bold leading-none text-md">{t("revenue.exportRevenue")}</span>
                    </div>
                    <RevenueTypeSelect value={localType} onChange={(value) => setLocalType(value as RevenueTypeQuery)} />
                    <RevenueFilterForm
                        startDate={initialValue?.startDate}
                        endDate={initialValue?.endDate}
                        onSubmit={handleFilterRevenue}
                        type={localType}
                        onSuccess={() => setOpen(false)}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
})

export default RevenueFilterPopover;
