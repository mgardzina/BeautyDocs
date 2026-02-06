"use client";

import Link from "next/link";
import { SALON_CONFIG } from "@/app/config/salon";
import BackButton from "@/app/components/BackButton";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function RegulaminPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-emerald backdrop-blur-sm border-b border-emerald/30 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <Link href="/" className="flex items-center">
              <h1 className="text-2xl md:text-3xl font-serif font-light text-[#f8f6f3] tracking-widest">
                {SALON_CONFIG.name}
              </h1>
            </Link>
            <BackButton onClick={() => router.push("/")} />
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-40 pb-12 px-4 border-b border-emerald/30/10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-light text-white mb-2 tracking-wider uppercase">
            REGULAMIN
          </h1>
          <p className="text-lg text-brand font-light tracking-wide uppercase">
            Świadczenia Usług
          </p>
          <p className="text-sm text-ui-textSecondary font-light mt-2 italic">
            {SALON_CONFIG.name} – {SALON_CONFIG.owner}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-emerald backdrop-blur-sm p-8 md:p-12 space-y-10 rounded-2xl shadow-lg border border-emerald/20">
            {/* §1 */}
            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §1. Postanowienia ogólne
              </h2>
              <div className="text-ui-textSecondary font-light leading-relaxed space-y-3">
                <p>
                  Niniejszy Regulamin określa zasady korzystania z usług
                  kosmetycznych i makijażu permanentnego świadczonych przez
                  firmę
                  {SALON_CONFIG.name} – {SALON_CONFIG.owner}, z siedzibą przy{" "}
                  {SALON_CONFIG.address}, NIP: {SALON_CONFIG.nip} (zwaną dalej
                  „Salonem").
                </p>
                <p>
                  Klientem Salonu może być każda osoba pełnoletnia. Osoby
                  niepełnoletnie mogą korzystać z usług wyłącznie za pisemną
                  zgodą rodzica lub opiekuna prawnego.
                </p>
                <p>
                  Przystąpienie do zabiegu jest równoznaczne z akceptacją
                  postanowień niniejszego Regulaminu.
                </p>
                <p>
                  Ceny usług podane w cenniku (na stronie internetowej lub w
                  Salonie) są cenami brutto i wyrażone są w polskich złotych.
                </p>
              </div>
            </div>

            {/* §2 */}
            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §2. Rezerwacja wizyt i płatności
              </h2>
              <div className="text-ui-textSecondary font-light leading-relaxed space-y-3">
                <p>Rezerwacji wizyty można dokonać:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>telefonicznie,</li>
                  <li>poprzez media społecznościowe (Facebook/Instagram),</li>
                  <li>osobiście w Salonie.</li>
                </ul>
                <p>
                  Rezerwacja terminu na zabieg makijażu permanentnego wymaga
                  wpłaty zadatku w wysokości{" "}
                  <strong>50% wartości zabiegu</strong>.
                </p>
                <p>
                  Zadatek należy wpłacić w terminie <strong>3 dni</strong> od
                  momentu wstępnej rezerwacji. Brak wpłaty w tym terminie
                  skutkuje automatycznym anulowaniem rezerwacji.
                </p>
                <p>Wpłaty można dokonać przelewem na konto bankowe:</p>
                <div className="bg-black/20 p-4 rounded-xl border border-emerald/30/50 my-2 shadow-inner">
                  <p className="font-medium text-white">
                    {SALON_CONFIG.accountNumber}
                  </p>
                  <p className="text-sm mt-1">
                    Tytuł przelewu: Data zabiegu oraz Imię i Nazwisko Klientki.
                  </p>
                </div>
                <p>
                  W dniu zabiegu cena usługi pomniejszana jest o kwotę
                  wpłaconego zadatku. Pozostałą część kwoty Klient uiszcza na
                  miejscu gotówką lub kartą płatniczą.
                </p>
              </div>
            </div>

            {/* §3 */}
            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §3. Odwoływanie i zmiana terminu wizyty
              </h2>
              <div className="text-ui-textSecondary font-light leading-relaxed space-y-3">
                <p>
                  Klient ma prawo do bezkosztowej zmiany terminu wizyty
                  najpóźniej na <strong>3 dni</strong> przed planowanym
                  zabiegiem. W takim przypadku zadatek przechodzi na nowy
                  termin.
                </p>
                <p>
                  W przypadku odwołania wizyty lub chęci zmiany terminu na mniej
                  niż 3 dni przed zabiegiem, wpłacony zadatek przepada (zgodnie
                  z art. 394 Kodeksu Cywilnego jako rekompensata za utracony
                  czas pracy).
                </p>
                <p>
                  Wyjątek stanowią zdarzenia losowe i nagłe choroby,
                  potwierdzone odpowiednim dokumentem (np. zwolnieniem
                  lekarskim), które należy zgłosić niezwłocznie. W takich
                  sytuacjach Salon może wyrazić zgodę na przeniesienie zadatku
                  na inny termin.
                </p>
                <p>
                  W przypadku niestawienia się na wizytę bez wcześniejszego
                  powiadomienia, zadatek przepada w całości. Salon zastrzega
                  sobie również prawo do odmowy przyjęcia kolejnych rezerwacji
                  od takiej osoby lub wymagania przedpłaty 100% wartości usługi.
                </p>
                <p>
                  Spóźnienie Klienta powyżej 15 minut może skutkować skróceniem
                  czasu zabiegu lub koniecznością przełożenia go na inny termin
                  (co może wiązać się z przepadkiem zadatku, jeśli czas nie
                  pozwoli na wykonanie pełnej usługi).
                </p>
              </div>
            </div>

            {/* §4 */}
            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §4. Przeciwwskazania i kwalifikacja do zabiegu
              </h2>
              <div className="text-ui-textSecondary font-light leading-relaxed space-y-3">
                <p>
                  Przed przystąpieniem do zabiegu Klient zobowiązany jest do
                  wypełnienia Karty Klienta oraz ankiety zdrowotnej. Zatajenie
                  informacji o stanie zdrowia (przeciwwskazaniach) zwalnia Salon
                  z odpowiedzialności za ewentualne powikłania.
                </p>
                <p>Bezwzględnymi przeciwwskazaniami do zabiegu są m.in.:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>ciąża, karmienie piersią,</li>
                  <li>aktywna opryszczka,</li>
                  <li>choroby nowotworowe (bez zgody lekarza),</li>
                  <li>nieustabilizowana cukrzyca,</li>
                  <li>łuszczyca w miejscu zabiegu,</li>
                  <li>przyjmowanie leków rozrzedzających krew.</li>
                </ul>
                <p>
                  Klientki posiadające „stary" makijaż permanentny (wykonany w
                  innym salonie) są zobowiązane poinformować o tym fakcie przy
                  zapisie. Salon zastrzega sobie prawo do odmowy wykonania
                  pigmentacji naprawczej lub skierowania Klientki na zabieg
                  laserowego usuwania (dodatkowo płatny).
                </p>
                <p>
                  Korekty makijażu po innych salonach są traktowane jako nowy
                  zabieg i podlegają indywidualnej wycenie.
                </p>
              </div>
            </div>

            {/* §5 */}
            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §5. Przebieg zabiegu i efekty (gwarancja)
              </h2>
              <div className="text-ui-textSecondary font-light leading-relaxed space-y-3">
                <p>
                  Każdy zabieg poprzedzony jest bezpłatną konsultacją, podczas
                  której dobierana jest metoda, kolor oraz wykonywany jest
                  rysunek wstępny (wizualizacja).
                </p>
                <p>
                  Linergistka ma prawo odmówić wykonania zabiegu, jeśli
                  oczekiwania Klientki co do kształtu lub koloru są niezgodne z
                  estetyką, anatomią twarzy lub zasadami sztuki PMU.
                </p>
                <p>
                  W przypadku braku akceptacji przez Klientkę proponowanego
                  kształtu i rezygnacji z zabiegu w dniu wizyty, wpłacony
                  zadatek pokrywa koszt konsultacji i czasu zarezerwowanego dla
                  pracownika i nie podlega zwrotowi.
                </p>
                <p>
                  Efekt zabiegu jest kwestią indywidualną i zależy od rodzaju
                  skóry, wieku oraz przestrzegania zaleceń pozabiegowych. Salon
                  nie udziela gwarancji na trwałość makijażu (nie jest możliwe
                  przewidzenie dokładnego czasu utrzymywania się pigmentu w
                  skórze).
                </p>
              </div>
            </div>

            {/* §6 */}
            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §6. Korekta (dopigmentowanie)
              </h2>
              <div className="text-ui-textSecondary font-light leading-relaxed space-y-3">
                <p>
                  Pierwsza korekta (uzupełniająca) jest wliczona w cenę
                  podstawowego zabiegu (chyba że cennik stanowi inaczej) i
                  powinna zostać wykonana w terminie od{" "}
                  <strong>4 do 8 tygodni</strong> od pierwszego zabiegu.
                </p>
                <p>
                  Jeżeli Klientka nie stawi się na korektę w wyznaczonym
                  terminie (do 8 tygodni) lub odwoła ją później niż 24h przed
                  wizytą, korekta przepada. Wykonanie dopigmentowania w
                  późniejszym terminie jest płatne dodatkowo (każdy miesiąc
                  zwłoki to dopłata 100 zł lub wg aktualnej wyceny).
                </p>
                <p>
                  Dla Klientek mieszkających na stałe za granicą, termin
                  bezpłatnej korekty może zostać wydłużony do 3 miesięcy, pod
                  warunkiem zgłoszenia tego faktu podczas pierwszego zabiegu.
                </p>
                <div className="bg-black/20 p-4 rounded-xl border border-emerald/30/50 my-2 shadow-inner">
                  <p className="font-medium text-white mb-2">
                    Odświeżenie makijażu po roku (tzw. „Refresh"):
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>
                      Do 1,5 roku od zabiegu: 50% aktualnej ceny z cennika.
                    </li>
                    <li>
                      Powyżej 2 lat: 100% ceny (traktowane jako nowy zabieg).
                    </li>
                  </ul>
                </div>
                <p>
                  W przypadku ciąży wykrytej po pierwszym zabiegu, Klientka może
                  wykonać korektę po porodzie/karmieniu (np. po roku) za 50%
                  ceny aktualnej.
                </p>
              </div>
            </div>

            {/* §7 */}
            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §7. Reklamacje
              </h2>
              <div className="text-ui-textSecondary font-light leading-relaxed space-y-3">
                <p>
                  Klient ma prawo do złożenia reklamacji w przypadku
                  niezadowolenia z usługi.
                </p>
                <p>
                  Reklamacje należy składać pisemnie na adres e-mail:{" "}
                  <strong>{SALON_CONFIG.email}</strong> w terminie do{" "}
                  <strong>14 dni</strong> od wykonania usługi. Zgłoszenie
                  powinno zawierać opis problemu oraz dokumentację
                  fotograficzną.
                </p>
                <p>
                  Ewentualne poprawki w ramach reklamacji (jeśli są uzasadnione
                  błędami technicznymi) wykonywane są bezpłatnie w terminie do 2
                  miesięcy od zabiegu. Wszelkie uwagi zgłaszane po upływie 2
                  miesięcy będą traktowane jako nowe zlecenia płatne.
                </p>
              </div>
            </div>

            {/* §8 */}
            <div>
              <h2 className="text-xl font-serif font-light text-brand mb-4 tracking-wider uppercase">
                §8. Postanowienia końcowe
              </h2>
              <div className="text-ui-textSecondary font-light leading-relaxed space-y-3">
                <p>
                  Salon zastrzega sobie prawo do zmiany cennika oraz godzin
                  otwarcia. Zmiany nie dotyczą rezerwacji, na które został już
                  wpłacony zadatek (obowiązuje cena z dnia rezerwacji, chyba że
                  upłynęło ponad 6 miesięcy).
                </p>
                <p>
                  W sprawach nieuregulowanych niniejszym Regulaminem
                  zastosowanie mają przepisy Kodeksu Cywilnego.
                </p>
                <p>Regulamin wchodzi w życie z dniem publikacji.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-emerald text-white py-16 border-t border-emerald/30 shadow-lg">
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
