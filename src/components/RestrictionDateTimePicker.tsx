import { CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDate,
  parseBrazilDateTimeInput,
  toBrazilDateTimeInputValue,
} from "@/lib/phone-utils";
import { cn } from "@/lib/utils";

type RestrictionDateTimePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

export function RestrictionDateTimePicker({ id, value, onChange }: RestrictionDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseBrazilDateTimeInput(value), [value]);
  const timeValue = selectedDate
    ? `${String(selectedDate.getHours()).padStart(2, "0")}:${String(
        selectedDate.getMinutes(),
      ).padStart(2, "0")}`
    : "09:00";
  const [selectedHour, selectedMinute] = timeValue.split(":");

  function updateDateTime(nextDate: Date, nextTime = timeValue) {
    const [hour = "0", minute = "0"] = nextTime.split(":");
    const merged = new Date(nextDate);
    merged.setHours(Number(hour), Number(minute), 0, 0);
    onChange(toBrazilDateTimeInputValue(merged.toISOString()));
  }

  function handleHourChange(nextHour: string) {
    const baseDate = selectedDate ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    updateDateTime(baseDate, `${nextHour}:${selectedMinute}`);
  }

  function handleMinuteChange(nextMinute: string) {
    const baseDate = selectedDate ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    updateDateTime(baseDate, `${selectedHour}:${nextMinute}`);
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_176px]">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? formatDate(selectedDate.toISOString()) : "Selecionar data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={(date) => {
              if (!date) return;
              updateDateTime(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      <div className="flex items-center gap-1">
        <Select value={selectedHour} onValueChange={handleHourChange}>
          <SelectTrigger className="w-[78px]" aria-label="Hora do fim da restrição">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOUR_OPTIONS.map((hour) => (
              <SelectItem key={hour} value={hour}>
                {hour}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="shrink-0 text-sm text-muted-foreground">:</span>
        <Select value={selectedMinute} onValueChange={handleMinuteChange}>
          <SelectTrigger className="w-[78px]" aria-label="Minuto do fim da restrição">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MINUTE_OPTIONS.map((minute) => (
              <SelectItem key={minute} value={minute}>
                {minute}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="text-xs text-muted-foreground sm:col-span-2">
        Formato brasileiro: {selectedDate ? formatDate(selectedDate.toISOString()) : "dd/mm/aaaa"}{" "}
        {timeValue}
      </div>
    </div>
  );
}
