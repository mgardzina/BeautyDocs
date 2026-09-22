export interface SalonService {
  name: string;
  description: string;
  price: number; // PLN grosze
  priceFrom: boolean;
  durationMinutes: number | null;
}
export interface SalonProfileDraft {
  introduction: string;
  about: string;
  photos: { dataUrl: string; caption: string }[];
  services: SalonService[];
  latitude: number | null;
  longitude: number | null;
}
export interface PublicSalon extends Omit<SalonProfileDraft, "photos"> {
  logoUrl: string | null;
  slug: string;
  displayName: string;
  city: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  phone: string | null;
  websiteUrl: string | null;
  photos: { url: string; caption: string }[];
}
export interface SalonSearchResult { items: PublicSalon[]; nextOffset: number | null }
export const salonPrice = (service: SalonService) => `${service.priceFrom ? "od " : ""}${new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: service.price % 100 ? 2 : 0 }).format(service.price / 100)}`;
