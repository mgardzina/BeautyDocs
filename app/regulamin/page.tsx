import { SALON_CONFIG } from "@/app/config/salon";
import {
  BeautyDocsLegalPage,
  type BeautyDocsLegalSection,
} from "@/components/beautydocs/legal/BeautyDocsLegalPage";

const termsSections: readonly BeautyDocsLegalSection[] = [
  {
    id: "postanowienia-ogolne",
    title: "Postanowienia ogólne",
    content: (
      <>
        <p>
          Niniejszy regulamin określa zasady świadczenia drogą elektroniczną usług
          dostępnych w platformie <strong>BeautyDocs</strong>. Usługodawcą i operatorem
          platformy jest <strong>{SALON_CONFIG.fullName}</strong>, adres: {" "}
          {SALON_CONFIG.address}, {SALON_CONFIG.zipCode} {SALON_CONFIG.city}, NIP: {" "}
          {SALON_CONFIG.nip}, e-mail: {" "}
          <a href={`mailto:${SALON_CONFIG.email}`}>{SALON_CONFIG.email}</a>.
        </p>
        <p>
          BeautyDocs jest platformą do obsługi salonów beauty, ich zespołów i
          klientek. Umożliwia między innymi prowadzenie kalendarza, kartotek,
          formularzy, zgód, podpisów, powiadomień i komunikacji związanej z wizytą.
        </p>
        <p>
          BeautyDocs nie jest salonem, podmiotem leczniczym ani stroną umowy o
          wykonanie zabiegu. Warunki zabiegu, jego kwalifikacja, cena, przebieg i
          reklamacje wobec usługi salonu są ustalane bezpośrednio pomiędzy salonem a
          klientką.
        </p>
      </>
    ),
  },
  {
    id: "definicje",
    title: "Użytkownicy i role",
    content: (
      <>
        <ul>
          <li>
            <strong>Salon</strong> — przedsiębiorca, który zakłada przestrzeń
            organizacji w BeautyDocs i odpowiada za jej konfigurację.
          </li>
          <li>
            <strong>Właściciel lub administrator</strong> — osoba uprawniona do
            zarządzania kontem salonu, zespołem i ustawieniami.
          </li>
          <li>
            <strong>Pracownik</strong> — osoba zaproszona przez salon i korzystająca z
            funkcji zgodnie z przydzieloną rolą.
          </li>
          <li>
            <strong>Klientka lub klient</strong> — osoba korzystająca z konta
            konsumenckiego, zapisów, formularzy lub komunikacji z salonem.
          </li>
        </ul>
        <p>
          Osoba tworząca konto salonu potwierdza, że działa jako przedsiębiorca lub z
          jego upoważnienia i może zaakceptować regulamin w jego imieniu.
        </p>
      </>
    ),
  },
  {
    id: "warunki-techniczne",
    title: "Wymagania techniczne i zawarcie umowy",
    content: (
      <>
        <p>
          Do korzystania z platformy potrzebne są urządzenie z dostępem do internetu,
          aktualna przeglądarka obsługująca JavaScript i bezpieczne połączenia HTTPS,
          aktywny adres e-mail lub numer telefonu oraz włączone niezbędne pliki
          cookies. Starsze konfiguracje mogą nie obsługiwać wszystkich funkcji.
        </p>
        <p>
          Umowa o świadczenie usługi elektronicznej zostaje zawarta z chwilą
          utworzenia konta albo rozpoczęcia korzystania z funkcji dostępnej bez konta.
          Przed rejestracją użytkownik otrzymuje możliwość zapoznania się z regulaminem
          i polityką prywatności.
        </p>
        <p>
          Użytkownik powinien podawać dane prawdziwe i aktualne. W przypadku konta
          salonu dane firmy mogą zostać sprawdzone w publicznym rejestrze na podstawie
          numeru NIP.
        </p>
      </>
    ),
  },
  {
    id: "konto-i-bezpieczenstwo",
    title: "Konto i bezpieczeństwo dostępu",
    content: (
      <>
        <p>
          Konto jest indywidualne. Nie wolno udostępniać hasła, kodów jednorazowych ani
          dostępu do aplikacji osobie nieuprawnionej. Użytkownik powinien niezwłocznie
          zgłosić podejrzenie przejęcia konta i korzystać z dodatkowej weryfikacji,
          jeżeli ją włączył.
        </p>
        <p>
          Salon odpowiada za prawidłowe przydzielanie ról, odbieranie dostępu osobom,
          które zakończyły współpracę, oraz za działania wykonane przez członków
          zespołu w ramach udzielonych uprawnień.
        </p>
        <p>
          Możemy czasowo zablokować dostęp, gdy jest to konieczne do ochrony konta,
          danych innych użytkowników albo infrastruktury. W miarę możliwości
          poinformujemy o przyczynie i sposobie odzyskania dostępu.
        </p>
      </>
    ),
  },
  {
    id: "obowiazki-salonu",
    title: "Obowiązki salonu",
    content: (
      <>
        <p>Salon samodzielnie odpowiada za:</p>
        <ul>
          <li>legalność świadczonych zabiegów i kwalifikacje swojego personelu;</li>
          <li>
            treść informacji przekazywanych klientkom oraz dobór właściwego formularza
            i podstawy prawnej;
          </li>
          <li>
            prawidłowość danych wizyt, cen, czasu trwania usług i godzin dostępności;
          </li>
          <li>
            obsługę rezerwacji, odwołań, reklamacji zabiegowych i kontaktów
            pozabiegowych;
          </li>
          <li>
            wykonanie obowiązków administratora danych, w tym udzielanie odpowiedzi na
            żądania klientek.
          </li>
        </ul>
        <p>
          Szablony BeautyDocs wspierają prowadzenie dokumentacji, ale nie zastępują
          indywidualnej oceny prawnej, medycznej ani zawodowej salonu.
        </p>
      </>
    ),
  },
  {
    id: "wizyty-formularze-podpisy",
    title: "Wizyty, formularze i podpisy",
    content: (
      <>
        <p>
          Rezerwacja w BeautyDocs przekazuje salonowi prośbę o wizytę na wybrany
          termin. Ostateczne potwierdzenie, zmiana lub odwołanie zależą od zasad salonu
          pokazanych użytkownikowi w procesie rezerwacji.
        </p>
        <p>
          Odpowiedzi w formularzu należy sprawdzić przed wysłaniem. Salon może wymagać
          potwierdzenia danych przed zabiegiem oraz podpisu osoby wykonującej zabieg.
          Użytkownik nie powinien pomijać informacji istotnych dla bezpieczeństwa.
        </p>
        <p>
          Platforma może utrwalać podpis odręczny na ekranie, kod jednorazowy, czas,
          wersję dokumentu i dane techniczne operacji jako elementy pakietu dowodowego.
          Taki mechanizm nie jest kwalifikowanym podpisem elektronicznym. Skutek prawny
          konkretnego dokumentu zależy od jego treści, wymaganej formy i okoliczności
          złożenia oświadczenia.
        </p>
      </>
    ),
  },
  {
    id: "komunikacja",
    title: "Czat i komunikacja",
    content: (
      <>
        <p>
          Czat służy komunikacji organizacyjnej i pozabiegowej między salonem a
          klientką. Nie jest kanałem ratunkowym ani narzędziem do diagnozy. W nagłym
          stanie użytkownik powinien skontaktować się z odpowiednimi służbami lub
          personelem medycznym.
        </p>
        <p>
          Zabronione jest wysyłanie treści bezprawnych, obraźliwych, naruszających
          prywatność, zawierających złośliwe oprogramowanie lub niezwiązanych z
          uzasadnionym celem komunikacji. Salon odpowiada za terminowość i merytoryczną
          jakość odpowiedzi swojego zespołu.
        </p>
      </>
    ),
  },
  {
    id: "platnosci",
    title: "Plany, opłaty i rozliczenia",
    content: (
      <>
        <p>
          Zakres planów i aktualne ceny dla salonów są prezentowane w cenniku albo w
          ofercie przekazanej przed zakupem. Przed złożeniem płatnego zamówienia salon
          otrzymuje informację o cenie, okresie rozliczeniowym, podatkach i zasadach
          odnowienia.
        </p>
        <p>
          Konto klientki jest bezpłatne, o ile przy konkretnej funkcji wyraźnie nie
          wskazano inaczej. BeautyDocs nie pobiera w imieniu salonu płatności za zabieg,
          chyba że odrębna funkcja i jej warunki stanowią inaczej.
        </p>
        <p>
          Zmiana cennika nie wpływa wstecz na opłacony okres. O zmianie ceny kolejnego
          okresu poinformujemy z wyprzedzeniem pozwalającym zrezygnować z odnowienia.
        </p>
      </>
    ),
  },
  {
    id: "dane-i-powierzenie",
    title: "Dane salonu i umowa powierzenia",
    content: (
      <>
        <p>
          Salon zachowuje kontrolę nad dokumentacją swoich klientek i jest jej
          administratorem. BeautyDocs przetwarza te dane jako podmiot przetwarzający w
          zakresie opisanym w umowie powierzenia zawartej z salonem.
        </p>
        <p>
          Dane kont użytkowników, rozliczeń, bezpieczeństwa platformy i kontaktu z
          operatorem przetwarzamy jako odrębny administrator. Szczegóły opisuje {" "}
          <a href="/polityka-prywatnosci">Polityka prywatności</a>.
        </p>
        <p>
          Salon nie może umieszczać w platformie danych, których nie ma prawa
          przetwarzać, ani wykorzystywać BeautyDocs do celów niezgodnych z prawem.
        </p>
      </>
    ),
  },
  {
    id: "dostepnosc",
    title: "Dostępność i rozwój platformy",
    content: (
      <>
        <p>
          Rozwijamy platformę i stosujemy środki służące utrzymaniu jej dostępności,
          ale nie gwarantujemy działania bez każdej przerwy. Możemy wykonywać prace
          techniczne, instalować aktualizacje lub czasowo ograniczać funkcję ze
          względów bezpieczeństwa.
        </p>
        <p>
          Istotne planowane przerwy komunikujemy z wyprzedzeniem, o ile jest to
          możliwe. Funkcje mogą się zmieniać, jeżeli nie pozbawia to użytkownika
          uzgodnionych głównych cech usługi w trwającym opłaconym okresie albo zmiana
          jest konieczna ze względów prawnych lub bezpieczeństwa.
        </p>
      </>
    ),
  },
  {
    id: "odpowiedzialnosc",
    title: "Odpowiedzialność",
    content: (
      <>
        <p>
          Odpowiadamy za zgodne z umową udostępnienie platformy w granicach
          obowiązującego prawa. Nie odpowiadamy za przebieg lub rezultat zabiegu,
          decyzje personelu, treści wprowadzone przez salon ani brak kontaktu ze strony
          salonu.
        </p>
        <p>
          Użytkownik odpowiada za skutki podania nieprawdziwych danych, naruszenia
          praw osób trzecich, udostępnienia konta lub korzystania z platformy niezgodnie
          z regulaminem. Żadne postanowienie nie ogranicza praw konsumenta ani
          odpowiedzialności, której nie można wyłączyć na mocy prawa.
        </p>
      </>
    ),
  },
  {
    id: "reklamacje",
    title: "Wsparcie i reklamacje dotyczące platformy",
    content: (
      <>
        <p>
          Problem techniczny lub reklamację dotyczącą BeautyDocs można zgłosić na {" "}
          <a href={`mailto:${SALON_CONFIG.email}`}>{SALON_CONFIG.email}</a>. Zgłoszenie
          powinno zawierać dane pozwalające zidentyfikować konto, opis problemu i — o
          ile to bezpieczne — kroki prowadzące do jego wystąpienia. Nie należy wysyłać
          hasła ani pełnego kodu jednorazowego.
        </p>
        <p>
          Odpowiadamy bez zbędnej zwłoki, nie później niż w terminie wymaganym przez
          obowiązujące przepisy. Reklamacje dotyczące zabiegu, płatności za zabieg lub
          zachowania personelu należy kierować do właściwego salonu.
        </p>
      </>
    ),
  },
  {
    id: "zakonczenie-umowy",
    title: "Rezygnacja, usunięcie konta i dane po zakończeniu",
    content: (
      <>
        <p>
          Użytkownik konta klientki może zrezygnować z usługi i złożyć dyspozycję
          usunięcia konta w ustawieniach. Usunięcie konta platformy nie zawsze oznacza
          usunięcie dokumentacji przechowywanej przez salon na odrębnej podstawie
          prawnej.
        </p>
        <p>
          Właściciel może zamknąć wybrany salon bez usuwania własnego konta. Zamknięcie
          salonu wyłącza dostęp do jego panelu i formularzy publicznych, lecz nie usuwa
          dostępu użytkownika do innych salonów. Usunięcie całego konta jest osobną
          operacją i wymaga wcześniejszego zamknięcia albo przekazania wszystkich
          aktywnych salonów, których użytkownik jest właścicielem.
        </p>
        <p>
          Salon może zakończyć płatny plan zgodnie z warunkami wybranego okresu
          rozliczeniowego. Przed trwałym usunięciem danych udostępnimy rozsądny sposób
          eksportu, o ile nie sprzeciwia się temu prawo, bezpieczeństwo lub prawa osób
          trzecich.
        </p>
        <p>
          Możemy rozwiązać umowę z powodu istotnego lub powtarzającego się naruszenia
          regulaminu, po uprzednim wezwaniu do zaprzestania naruszeń, chyba że
          natychmiastowe działanie jest konieczne z powodów prawnych lub bezpieczeństwa.
        </p>
      </>
    ),
  },
  {
    id: "postanowienia-koncowe",
    title: "Zmiany regulaminu i postanowienia końcowe",
    content: (
      <>
        <p>
          Regulamin może zostać zmieniony z ważnej przyczyny, takiej jak rozwój
          funkcji, zmiana modelu rozliczeń, wymogów bezpieczeństwa lub przepisów. O
          zmianach wpływających na trwającą umowę poinformujemy w aplikacji lub
          wiadomości e-mail i wskażemy datę wejścia w życie.
        </p>
        <p>
          Do umowy stosuje się prawo polskie, z zachowaniem bezwzględnie obowiązujących
          praw konsumenta. Ewentualne spory strony w pierwszej kolejności starają się
          rozwiązać polubownie, a właściwość sądu określają obowiązujące przepisy.
        </p>
        <p>Regulamin obowiązuje od 15 sierpnia 2026 r.</p>
      </>
    ),
  },
] as const;

export default function RegulaminPage() {
  return (
    <BeautyDocsLegalPage
      activeDocument="terms"
      description="Zasady korzystania z platformy BeautyDocs przez salony, ich zespoły oraz klientki — od założenia konta po formularze, wizyty i komunikację."
      lastUpdated="15 sierpnia 2026 r."
      notice={
        <p>
          <strong>Ten regulamin dotyczy platformy BeautyDocs.</strong> Nie zastępuje
          regulaminu konkretnego salonu ani warunków wykonania zabiegu, płatności,
          odwołania wizyty lub reklamacji usługi salonu.
        </p>
      }
      sections={termsSections}
      title="Regulamin platformy"
    />
  );
}
