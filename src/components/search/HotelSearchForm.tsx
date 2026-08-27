"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { Button, Input } from "@/components/ui";
import { supportedDestinations } from "@/lib/hotels";

export interface HotelSearchFormProps {
  defaultDestination?: string;
  defaultCheckIn: string;
  defaultCheckOut: string;
}

export function HotelSearchForm({
  defaultDestination = "",
  defaultCheckIn,
  defaultCheckOut,
}: HotelSearchFormProps) {
  const [checkIn, setCheckIn] = useState(defaultCheckIn);

  return (
    <form
      action="/search"
      method="get"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-end sm:gap-3"
    >
      <div className="flex-1">
        <Input
          label="목적지"
          name="destination"
          list="hotelow-destinations"
          defaultValue={defaultDestination}
          placeholder="도시 또는 호텔명"
          leftIcon={<SearchIcon width={18} height={18} />}
          autoComplete="off"
        />
        <datalist id="hotelow-destinations">
          {supportedDestinations.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:flex-none">
        <Input
          label="체크인"
          name="checkIn"
          type="date"
          defaultValue={defaultCheckIn}
          onChange={(e) => setCheckIn(e.target.value)}
        />
        <Input
          label="체크아웃"
          name="checkOut"
          type="date"
          min={checkIn}
          defaultValue={defaultCheckOut}
        />
      </div>
      <Button type="submit" size="md" className="sm:w-32">
        검색
      </Button>
    </form>
  );
}
