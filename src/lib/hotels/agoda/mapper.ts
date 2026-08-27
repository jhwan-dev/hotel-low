import { nightsBetween } from "@/lib/date";
import type { Currency, Hotel, RoomPrice } from "@/types/hotel";
import type { AgodaContentHotel, AgodaProperty } from "./types";

/**
 * The only place Agoda's wire format touches our domain types. Anything that
 * looks like "Agoda calls it X, we call it Y" belongs here, not scattered
 * across the app.
 */
export function mapContentToHotel(
  content: AgodaContentHotel,
  appHotelId: string,
  aliases: string[],
  description: string,
): Hotel {
  return {
    id: appHotelId,
    name: content.hotelName,
    location: {
      city: content.address.city,
      country: content.address.country,
      address: [content.address.addressLine1, content.address.addressLine2]
        .filter(Boolean)
        .join(" "),
    },
    rating: content.ratingAverage,
    reviewCount: content.numberOfReviews,
    images: content.pictures.map((p) => p.url),
    amenities: content.facilities.map((f) => f.propertyName),
    description,
    aliases,
  };
}

/** Picks the cheapest room off a property — what "the price" means on a search results card. */
export function mapPropertyToRoomPrice(
  property: AgodaProperty,
  appHotelId: string,
  checkIn: string,
  checkOut: string,
): RoomPrice | null {
  const cheapest = property.rooms.reduce<AgodaProperty["rooms"][number] | null>(
    (best, room) =>
      !best || room.totalPayment.inclusive < best.totalPayment.inclusive ? room : best,
    null,
  );
  if (!cheapest) return null;

  const nights = nightsBetween(checkIn, checkOut);

  return {
    hotelId: appHotelId,
    provider: "agoda",
    currency: cheapest.rate.currency as Currency,
    checkIn,
    checkOut,
    nights,
    nightlyPrice: cheapest.rate.inclusive,
    totalPrice: cheapest.totalPayment.inclusive,
    deepLink: cheapest.landingUrl,
    remainingRooms: cheapest.remainingRooms,
  };
}
