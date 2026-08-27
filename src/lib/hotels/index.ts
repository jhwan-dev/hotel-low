import { mockHotelProvider } from "./providers/mock";
import type { HotelProvider } from "@/types/hotel";

// Swap point: once Agoda/Booking.com API access is available, provide a
// matching HotelProvider implementation here instead of the mock one.
export const hotelProvider: HotelProvider = mockHotelProvider;

export const supportedDestinations = ["서울", "도쿄", "오사카", "방콕"];
