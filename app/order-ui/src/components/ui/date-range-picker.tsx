import { MoveRightIcon } from "lucide-react";
import { SimpleDatePicker } from "../app/picker";
import moment from "moment";
import { PeriodOfTimeSelect } from "../app/select";
import { memo, useMemo } from "react";
import { timeChange } from "./utils/data-table.utils";

interface IDateRangePickerProps {
    startDate: string;
    endDate: string;
    onDateRangeChange: ({ startDate, endDate }: { startDate: string; endDate: string }) => void
}

export const DateRangePicker = memo(function DateRangePicker({ startDate, endDate, onDateRangeChange }: IDateRangePickerProps) {
    // const [startDate, setStartDate] = useState<string>(moment().format('YYYY-MM-DD'))
    // const [endDate, setEndDate] = useState<string>(moment().format('YYYY-MM-DD'))
    const today = useMemo(() => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }, []);

    const handlePeriodOfTimeChange = ((periodOfTime: string) => {
        const result = timeChange(periodOfTime, today);
        onDateRangeChange({
            ...result
        })
    })

    const handleDateRangeChange = (dateRange: { startDate: string; endDate: string }) => {
        onDateRangeChange({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
        })
    }

    return < div className="flex gap-2 items-center" >
        <div className="flex gap-2 items-center">
            <div className="">
                <SimpleDatePicker
                    value={startDate}
                    onChange={(date) => handleDateRangeChange({ startDate: date, endDate })}
                    disabledDates={endDate ? (date: Date) => {
                        const endDateObj = moment(endDate.split('/').reverse().join('-'), 'YYYY-MM-DD').startOf('day').toDate();
                        return date > endDateObj
                    } : undefined}
                    disableFutureDates={true}
                />
            </div>
            <MoveRightIcon className="icon" />
            <div className="">
                <SimpleDatePicker
                    value={endDate}
                    onChange={(date) => handleDateRangeChange({ startDate, endDate: date })}
                    disabledDates={startDate ? (date: Date) => {
                        const startDateObj = moment(startDate.split('/').reverse().join('-'), 'YYYY-MM-DD').startOf('day').toDate();
                        return date < startDateObj
                    } : undefined}
                    disableFutureDates={true}
                />
            </div>
        </div>
        <PeriodOfTimeSelect onChange={handlePeriodOfTimeChange} />
    </div >
})
