import { todayISO } from "@/lib/date";
import { mockHotels, type MockHotel } from "@/lib/hotels/mock-data";
import {
  dayIndexOf,
  hashString,
  nightlyRatesForStay,
  priceCheckedOn,
  seededUnit,
} from "@/lib/hotels/mock-pricing";
import type { AgodaRepository } from "./repository";
import type {
  AgodaContentHotel,
  AgodaProperty,
  AgodaRoom,
  AgodaSearchRequest,
  AgodaSearchResponse,
} from "./types";

/** Approximate city centers — Agoda's real Content API would give exact per-hotel coordinates. */
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  서울: { lat: 37.5665, lng: 126.978 },
  도쿄: { lat: 35.6762, lng: 139.6503 },
  오사카: { lat: 34.6937, lng: 135.5023 },
  방콕: { lat: 13.7563, lng: 100.5018 },
};

function toContentHotel(mock: MockHotel): AgodaContentHotel {
  const coords = CITY_COORDS[mock.location.city] ?? { lat: 0, lng: 0 };

  return {
    hotelId: mock.agodaHotelId,
    hotelName: mock.name,
    starRating: Math.round(mock.rating),
    ratingAverage: mock.rating,
    numberOfReviews: mock.reviewCount,
    continentId: 1,
    countryId: hashString(mock.location.country) % 1000,
    cityId: hashString(mock.location.city) % 100_000,
    longitude: coords.lng,
    latitude: coords.lat,
    address: {
      addressLine1: mock.location.address,
      city: mock.location.city,
      country: mock.location.country,
    },
    pictures: mock.images.map((url, i) => ({
      pictureId: mock.agodaHotelId * 100 + i,
      url,
      pictureGroup: i === 0 ? "EXTERIOR" : "ROOM",
    })),
    facilities: mock.amenities.map((name, i) => ({
      propertyId: mock.agodaHotelId * 100 + i,
      propertyName: name,
    })),
  };
}

/** Deterministic 1–15, skewed low so a handful of hotels are reliably "almost sold out" for the home page. */
function remainingRoomsFor(mock: MockHotel, checkIn: string, checkOut: string): number {
  const seed = hashString(`${mock.id}-${checkIn}-${checkOut}-rooms`);
  const ratio = seededUnit(seed, dayIndexOf(checkIn));
  return 1 + Math.floor(ratio * ratio * 14);
}

function toRoom(mock: MockHotel, checkIn: string, checkOut: string, rooms: number): AgodaRoom {
  // rate.* is always PER ROOM PER NIGHT (method: "PRPN"); totalPayment.* is
  // for the whole booking, so it scales with how many rooms were requested —
  // a real Agoda response would already reflect that server-side.
  const nightlyPrice = priceCheckedOn(mock.id, mock.basePrice, checkIn, checkOut, todayISO());
  const nights = nightlyRatesForStay(mock.id, mock.basePrice, checkIn, checkOut).length;
  const exclusive = Math.round((nightlyPrice / 1.1) / 100) * 100;

  return {
    roomId: mock.agodaHotelId * 10 + 1,
    blockId: `BLOCK-${mock.agodaHotelId}`,
    parentRoomId: mock.agodaHotelId * 10 + 1,
    ratePlanId: mock.agodaHotelId * 10 + 2,
    freeBreakfast: mock.amenities.some((a) => a.includes("조식")),
    freeCancellation: true,
    paymentModel: "MerchantCommission",
    rate: {
      currency: "KRW",
      exclusive,
      inclusive: nightlyPrice,
      tax: nightlyPrice - exclusive,
      fees: 0,
      method: "PRPN",
    },
    totalPayment: {
      inclusive: nightlyPrice * nights * rooms,
      exclusive: exclusive * nights * rooms,
      minSellPrice: nightlyPrice * nights * rooms,
    },
    landingUrl: `https://example.com/mock-booking/agoda/${mock.id}?checkIn=${checkIn}&checkOut=${checkOut}`,
    remainingRooms: remainingRoomsFor(mock, checkIn, checkOut),
  };
}

/**
 * Fabricates Agoda-shaped responses from our own mock-data.ts — no network
 * calls. Swap this out for a RealAgodaRepository (actual HTTP + auth) once
 * API credentials are available; AgodaRepository's shape stays the contract
 * either way.
 */
export class MockAgodaRepository implements AgodaRepository {
  async getHotelContent(hotelIds: number[]): Promise<AgodaContentHotel[]> {
    return mockHotels
      .filter((mock) => hotelIds.includes(mock.agodaHotelId))
      .map(toContentHotel);
  }

  async searchAvailability(request: AgodaSearchRequest): Promise<AgodaSearchResponse> {
    const { propertyIds, checkIn, checkOut, rooms } = request.criteria;

    const properties: AgodaProperty[] = mockHotels
      .filter((mock) => propertyIds.includes(mock.agodaHotelId))
      .map((mock) => ({
        propertyId: mock.agodaHotelId,
        rooms: [toRoom(mock, checkIn, checkOut, rooms)],
      }));

    return {
      searchId: hashString(`${propertyIds.join(",")}-${checkIn}-${checkOut}`),
      properties,
    };
  }
}
