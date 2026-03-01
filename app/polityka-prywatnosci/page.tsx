"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SALON_CONFIG } from "@/app/config/salon";
import BackButton from "@/app/components/BackButton";
import { useRouter } from "next/navigation";

export default function PolitykaPrywatnosciPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-emerald backdrop-blur-sm border-b border-brand/20 shadow-marble">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <Link href="/" className="flex items-center">
              <h1 className="text-xl md:text-3xl font-serif font-light text-marble-text tracking-widest uppercase">
                {SALON_CONFIG.name}
              </h1>
            </Link>
            <BackButton onClick={() => router.push("/")} />
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-40 pb-12 px-4 border-b border-marble-border">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-light text-marble-text mb-4 tracking-wider uppercase">
            POLITYKA PRYWATNOŚCI
          </h1>
          <p className="text-sm text-marble-textSecondary font-light italic">
            Ostatnia aktualizacja: Styczeń 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-emerald backdrop-blur-sm p-8 md:p-12 space-y-8 rounded-2xl shadow-marble-lg border border-brand/20">
            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §1. Administrator danych
              </h2>
              <p className="text-ui-textSecondary font-light leading-relaxed">
                Administratorem Twoich danych osobowych jest {SALON_CONFIG.name}{" "}
                - {SALON_CONFIG.owner}, z siedzibą przy {SALON_CONFIG.address},
                NIP:{SALON_CONFIG.nip}. Kontakt z administratorem możliwy jest
                pod adresem email: {SALON_CONFIG.email} lub telefonicznie:{" "}
                {SALON_CONFIG.phone}.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §2. Cele przetwarzania danych
              </h2>
              <p className="text-ui-textSecondary font-light leading-relaxed mb-4">
                Twoje dane osobowe przetwarzamy w następujących celach:
              </p>
              <ul className="list-disc list-inside text-ui-textSecondary font-light space-y-2 ml-4">
                <li>Realizacja rezerwacji i umówienie wizyty</li>
                <li>Kontakt w sprawie potwierdzenia terminu</li>
                <li>Przeprowadzenie wywiadu zdrowotnego przed zabiegiem</li>
                <li>Wysyłanie informacji marketingowych (za zgodą)</li>
                <li>Prowadzenie dokumentacji zabiegów</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §3. Zakres przetwarzanych danych
              </h2>
              <p className="text-ui-textSecondary font-light leading-relaxed mb-4">
                W celu realizacji usług przetwarzamy następujące kategorie
                danych:
              </p>
              <ul className="list-disc list-inside text-ui-textSecondary font-light space-y-2 ml-4">
                <li>Dane identyfikacyjne (imię, nazwisko, data urodzenia)</li>
                <li>
                  Dane kontaktowe (adres zamieszkania, numer telefonu, adres
                  e-mail)
                </li>
                <li>
                  Dane o stanie zdrowia (informacje o alergiach, chorobach,
                  przyjmowanych lekach, przebytych zabiegach - tzw. dane
                  szczególnej kategorii, niezbędne do bezpiecznego wykonania
                  usługi)
                </li>
                <li>Wizerunek (zdjęcia dokumentujące efekty zabiegu)</li>
                <li>Dane transakcyjne (historia płatności)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §4. Podstawa prawna
              </h2>
              <p className="text-ui-textSecondary font-light leading-relaxed">
                Przetwarzanie danych odbywa się na podstawie: Twojej zgody (art.
                6 ust. 1 lit. a RODO), wykonania umowy (art. 6 ust. 1 lit. b
                RODO), wypełnienia obowiązku prawnego (art. 6 ust. 1 lit. c
                RODO) oraz prawnie uzasadnionego interesu administratora (art. 6
                ust. 1 lit. f RODO).
              </p>
            </div>

            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §5. Okres przechowywania
              </h2>
              <p className="text-ui-textSecondary font-light leading-relaxed">
                Dane osobowe przechowujemy przez okres niezbędny do realizacji
                celów, dla których zostały zebrane, a następnie przez okres
                wymagany przepisami prawa (dokumentacja medyczna - 20 lat,
                dokumentacja księgowa - 5 lat).
              </p>
            </div>

            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §6. Twoje prawa
              </h2>
              <p className="text-ui-textSecondary font-light leading-relaxed mb-4">
                Przysługują Ci następujące prawa:
              </p>
              <ul className="list-disc list-inside text-ui-textSecondary font-light space-y-2 ml-4">
                <li>Prawo dostępu do swoich danych</li>
                <li>Prawo do sprostowania danych</li>
                <li>
                  Prawo do usunięcia danych ("prawo do bycia zapomnianym")
                </li>
                <li>Prawo do ograniczenia przetwarzania</li>
                <li>Prawo do przenoszenia danych</li>
                <li>Prawo do wniesienia sprzeciwu</li>
                <li>Prawo do cofnięcia zgody w dowolnym momencie</li>
                <li>Prawo do wniesienia skargi do organu nadzorczego (UODO)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §7. Odbiorcy danych
              </h2>
              <p className="text-ui-textSecondary font-light leading-relaxed">
                Twoje dane mogą być przekazywane podmiotom świadczącym usługi na
                rzecz administratora: hostingodawcy, dostawcy systemu
                rezerwacji, dostawcy usług email. Dane nie są przekazywane do
                państw trzecich.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §8. Pliki cookies
              </h2>
              <p className="text-ui-textSecondary font-light leading-relaxed">
                Strona wykorzystuje pliki cookies w celu zapewnienia
                prawidłowego działania, analizy ruchu oraz personalizacji
                treści. Możesz zarządzać ustawieniami cookies w swojej
                przeglądarce.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §9. Kontakt
              </h2>
              <p className="text-ui-textSecondary font-light leading-relaxed">
                W sprawach związanych z ochroną danych osobowych możesz
                skontaktować się z nami pod adresem: {SALON_CONFIG.email} lub
                telefonicznie: {SALON_CONFIG.phone}.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-emerald text-marble-text py-16 border-t border-brand/20 shadow-marble">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0 text-center md:text-left">
              <span className="text-xl font-serif font-light tracking-widest uppercase">
                {SALON_CONFIG.name}
              </span>
              <p className="text-xs text-ui-textSecondary mt-3 font-light tracking-wider uppercase">
                Profesjonalny makijaż permanentny
              </p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-xs text-ui-textSecondary font-light tracking-wider italic">
                © {new Date().getFullYear()} {SALON_CONFIG.name}. Wszystkie
                prawa zastrzeżone.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
