'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { TimeRange } from '@/types/billing';

interface TimeRangeFilterProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  onCustomRangeChange?: (start: string, end: string) => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'custom', label: 'Custom' },
];

export function TimeRangeFilter({ value, onChange, onCustomRangeChange }: TimeRangeFilterProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const handleRangeChange = (range: TimeRange) => {
    if (range === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
    }
    onChange(range);
  };

  const handleApplyCustom = () => {
    if (startDate && endDate && onCustomRangeChange) {
      // Format as ISO date strings (YYYY-MM-DD)
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      onCustomRangeChange(startStr, endStr);
      setShowCustom(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TIME_RANGES.map((range) => (
          <Button
            key={range.value}
            variant={value === range.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleRangeChange(range.value)}
            className={cn(
              value === range.value && 'bg-green-500 hover:bg-green-600 text-black'
            )}
          >
            {range.value === 'custom' && <CalendarIcon className="mr-2 h-4 w-4" />}
            {range.label}
          </Button>
        ))}
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
          {/* Start Date Picker */}
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="start-date"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  disabled={(date) => {
                    // Disable future dates
                    const today = new Date();
                    today.setHours(23, 59, 59, 999);
                    return date > today;
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date Picker */}
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="end-date"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  disabled={(date) => {
                    // Disable dates before start date and future dates
                    const today = new Date();
                    today.setHours(23, 59, 59, 999);
                    if (date > today) return true;
                    if (startDate) {
                      return date < startDate;
                    }
                    return false;
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Apply Button */}
          <Button
            onClick={handleApplyCustom}
            disabled={!startDate || !endDate}
            className="bg-green-500 hover:bg-green-600 text-black"
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
