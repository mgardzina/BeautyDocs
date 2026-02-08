import { SALON_CONFIG } from "@/app/config/salon";

export default function Footer() {
  return (
    <footer className="bg-gradient-to-b from-neutral-800 to-black text-white py-12 border-t-2 border-[#D4AF37]">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
        {/* Lewa strona - Dane firmy */}
        <div className="text-center md:text-left space-y-4">
          <p className="font-serif text-2xl tracking-wide text-brand">
            {SALON_CONFIG.fullName}
          </p>
          <div className="text-sm space-y-2 text-white">
            <p>{SALON_CONFIG.address}</p>
            <p>
              {SALON_CONFIG.zipCode} {SALON_CONFIG.city}
            </p>
            <p>NIP: {SALON_CONFIG.nip}</p>
            <p className="flex items-center gap-3 justify-center md:justify-start">
              <a
                href={`tel:${SALON_CONFIG.phone.replace(/\s/g, "")}`}
                className="hover:text-brand transition-colors border-b border-transparent hover:border-brand pb-0.5"
              >
                +48 {SALON_CONFIG.phone}
              </a>
              <span className="text-brand">•</span>
              <a
                href={`mailto:${SALON_CONFIG.email}`}
                className="hover:text-brand transition-colors border-b border-transparent hover:border-brand pb-0.5"
              >
                {SALON_CONFIG.email}
              </a>
            </p>
          </div>
          <p className="text-xs text-white/40 mt-6 uppercase tracking-widest">
            &copy; {new Date().getFullYear()} {SALON_CONFIG.name}. Wszelkie
            prawa zastrzeżone.
          </p>
        </div>

        {/* Prawa strona - Linki */}
        <div className="flex gap-6 text-sm">
          <a
            href="/polityka-prywatnosci"
            className="hover:text-white transition-colors uppercase tracking-wider text-xs"
          >
            Polityka Prywatności
          </a>
          <span className="text-brand">•</span>
          <a
            href="/regulamin"
            className="hover:text-white transition-colors uppercase tracking-wider text-xs"
          >
            Regulamin
          </a>
        </div>
      </div>
    </footer>
  );
}
