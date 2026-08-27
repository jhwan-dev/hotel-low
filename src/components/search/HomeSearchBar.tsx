"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { Button, Input } from "@/components/ui";
import { supportedDestinations } from "@/lib/hotels/destinations";
import { defaultStayQuery, type StayQuery } from "@/lib/search/stay-query";
import { DateRangeGuestPicker } from "./DateRangeGuestPicker";

/** Home screen's entry point: destination on its own line, dates + guest count below. */
export function HomeSearchBar() {
  const [stay, setStay] = useState<StayQuery>(defaultStayQuery);

  return (
    <form
      action="/search"
      method="get"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <div>
        <Input
          name="destination"
          list="hotelow-home-destinations"
          placeholder="지역, 호텔명으로 검색"
          leftIcon={<SearchIcon width={18} height={18} />}
          autoComplete="off"
        />
        <datalist id="hotelow-home-destinations">
          {supportedDestinations.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
      </div>

      <DateRangeGuestPicker value={stay} onChange={setStay} />

      <input type="hidden" name="checkIn" value={stay.checkIn} />
      <input type="hidden" name="checkOut" value={stay.checkOut} />
      <input type="hidden" name="rooms" value={stay.rooms} />
      <input type="hidden" name="adults" value={stay.adults} />
      <input type="hidden" name="children" value={stay.children} />
      {stay.childrenAges.map((age, i) => (
        <input key={i} type="hidden" name="childrenAges" value={age} />
      ))}

      <Button type="submit" size="lg" fullWidth>
        호텔 찾기
      </Button>
    </form>
  );
}
