import Link from "next/link";
import { SALON_CONFIG } from "@/app/config/salon";
import {
  BeautyDocsLegalPage,
  type BeautyDocsLegalSection,
} from "@/components/beautydocs/legal/BeautyDocsLegalPage";

const privacySections: readonly BeautyDocsLegalSection[] = [
  {
    id: "administrator-i-role",
    title: "Administrator danych i role BeautyDocs",
    content: (
      <>
        <p>
          Operatorem platformy BeautyDocs i administratorem danych związanych z
          kontem użytkownika, bezpieczeństwem serwisu, rozliczeniami oraz kontaktem
          dotyczącym platformy jest <strong>{SALON_CONFIG.fullName}</strong>, adres: {" "}
          {SALON_CONFIG.address}, {SALON_CONFIG.zipCode} {SALON_CONFIG.city}, NIP: {" "}
          {SALON_CONFIG.nip}.
        </p>
        <p>
          W odniesieniu do dokumentacji klientek salonu — w szczególności wywiadów,
          informacji o zdrowiu, zgód, zdjęć i historii zabiegów — administratorem
          danych jest wybrany salon. BeautyDocs udostępnia mu narzędzie i przetwarza
          te dane na jego udokumentowane polecenie, zgodnie z umową powierzenia.
        </p>
        <p>
          Pytania dotyczące samego zabiegu, podstawy przechowywania dokumentacji lub
          decyzji personelu należy kierować bezpośrednio do salonu. Pytania dotyczące
          konta BeautyDocs można wysłać na {" "}
          <a href={`mailto:${SALON_CONFIG.email}`}>{SALON_CONFIG.email}</a>.
        </p>
      </>
    ),
  },
  {
    id: "zakres-danych",
    title: "Jakie dane przetwarzamy",
    content: (
      <>
        <p>Zakres danych zależy od sposobu korzystania z BeautyDocs i może obejmować:</p>
        <ul>
          <li>dane konta: imię, nazwisko, adres e-mail, numer telefonu i data urodzenia;</li>
          <li>
            dane salonu i zespołu: firma, NIP, REGON, KRS, adres, stanowisko, role i
            uprawnienia;
          </li>
          <li>
            dane wizyt i komunikacji: terminy, wybrany zabieg, wiadomości oraz
            powiadomienia;
          </li>
          <li>
            dokumentację przekazaną salonowi: odpowiedzi w formularzach, dane o
            zdrowiu, zgody, podpisy, zdjęcia i informacje pozabiegowe;
          </li>
          <li>
            dane techniczne i bezpieczeństwa: adres IP, identyfikatory sesji,
            informacje o urządzeniu, logi dostępu oraz rejestr istotnych operacji.
          </li>
        </ul>
        <p>
          Nie wymagamy podawania danych, które nie są potrzebne do utworzenia konta,
          realizacji wybranej funkcji lub spełnienia obowiązku prawnego.
        </p>
      </>
    ),
  },
  {
    id: "cele-i-podstawy",
    title: "Cele i podstawy przetwarzania",
    content: (
      <>
        <p>Dane przetwarzamy, gdy jest to potrzebne do:</p>
        <ul>
          <li>
            utworzenia i obsługi konta, udostępnienia kalendarza, formularzy, czatu i
            innych funkcji — w celu wykonania umowy lub podjęcia działań przed jej
            zawarciem;
          </li>
          <li>
            uwierzytelnienia użytkownika, ochrony kont, zapobiegania nadużyciom,
            obsługi błędów i dochodzenia roszczeń — na podstawie prawnie uzasadnionego
            interesu;
          </li>
          <li>
            realizacji obowiązków podatkowych, księgowych lub wynikających z żądania
            uprawnionego organu — na podstawie obowiązku prawnego;
          </li>
          <li>
            wysyłania dobrowolnej komunikacji marketingowej lub korzystania z
            opcjonalnych technologii — na podstawie zgody, którą można wycofać.
          </li>
        </ul>
        <p>
          Podstawę przetwarzania danych szczególnej kategorii zawartych w dokumentacji
          zabiegowej określa salon jako administrator. BeautyDocs nie wykorzystuje
          tych informacji do reklamy ani do samodzielnego profilowania klientek.
        </p>
      </>
    ),
  },
  {
    id: "zrodla-danych",
    title: "Skąd otrzymujemy dane",
    content: (
      <>
        <p>
          Dane otrzymujemy bezpośrednio od użytkownika, od salonu, z którym użytkownik
          jest powiązany, albo automatycznie podczas korzystania z platformy. Dane
          firmy mogą zostać uzupełnione na podstawie publicznych rejestrów, jeśli
          użytkownik skorzysta z funkcji pobrania danych po numerze NIP.
        </p>
        <p>
          Salon może udostępnić klientce formularz lub powiązać istniejącą kartotekę z
          jej kontem. Przed pokazaniem dokumentów stosujemy mechanizmy weryfikacji
          przewidziane w aplikacji.
        </p>
      </>
    ),
  },
  {
    id: "odbiorcy",
    title: "Odbiorcy i dostawcy usług",
    content: (
      <>
        <p>
          Dostęp do danych otrzymują wyłącznie osoby i podmioty, które potrzebują go
          do świadczenia usługi. Mogą to być upoważnieni członkowie zespołu salonu,
          dostawcy infrastruktury chmurowej i kopii zapasowych, komunikacji e-mail i
          SMS, uwierzytelniania, obsługi technicznej oraz doradcy związani obowiązkiem
          poufności.
        </p>
        <p>
          Dostawcy działają na podstawie odpowiednich umów. Nie sprzedajemy danych
          osobowych ani dokumentacji zabiegowej. Informacje mogą zostać udostępnione
          organom publicznym wyłącznie, gdy wynika to z prawa.
        </p>
      </>
    ),
  },
  {
    id: "transfery",
    title: "Przekazywanie danych poza EOG",
    content: (
      <>
        <p>
          W pierwszej kolejności wybieramy przetwarzanie danych w Europejskim Obszarze
          Gospodarczym. Jeżeli dostawca techniczny wymaga przekazania danych poza EOG,
          stosujemy mechanizm dopuszczony przez RODO, taki jak decyzja stwierdzająca
          odpowiedni stopień ochrony lub standardowe klauzule umowne, a także
          oceniamy potrzebę dodatkowych zabezpieczeń.
        </p>
      </>
    ),
  },
  {
    id: "retencja",
    title: "Jak długo przechowujemy dane",
    content: (
      <>
        <p>
          Samo zamknięcie salonu nie usuwa konta jego właściciela. Dostęp do salonu
          i jego formularzy publicznych wyłączamy niezwłocznie, a dane operacyjne,
          które nie są potrzebne do rozliczeń, obowiązków prawnych ani ochrony przed
          roszczeniami, usuwamy lub anonimizujemy bez zbędnej zwłoki. Usunięcie konta
          użytkownika jest osobną dyspozycją.
        </p>
        <p>
          Okres przechowywania dokumentacji klientki określa salon zgodnie z rodzajem
          świadczonych usług, podstawą prawną i własnymi obowiązkami. Po zakończeniu
          współpracy z salonem dane są zwracane lub usuwane zgodnie z umową powierzenia,
          z uwzględnieniem kopii zapasowych, terminów przedawnienia roszczeń i
          obowiązującego prawa. Okres 28 dni ani 2 miesięcy nie jest ogólnym minimalnym
          terminem wynikającym z RODO.
        </p>
        <p>
          Jeżeli salon jest podmiotem udzielającym świadczeń zdrowotnych, dokumentacja
          medyczna może podlegać szczególnym terminom ustawowym, co do zasady 20 lat od
          końca roku ostatniego wpisu. Zwykły formularz zabiegu kosmetycznego nie staje
          się jednak automatycznie dokumentacją medyczną tylko dlatego, że zawiera dane
          o zdrowiu.
        </p>
      </>
    ),
  },
  {
    id: "prawa",
    title: "Twoje prawa",
    content: (
      <>
        <p>
          W zależności od podstawy i okoliczności przysługuje Ci prawo dostępu do
          danych, sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia
          danych, wniesienia sprzeciwu oraz wycofania zgody bez wpływu na zgodność z
          prawem wcześniejszego przetwarzania.
        </p>
        <p>
          Żądanie dotyczące konta BeautyDocs wyślij na {" "}
          <a href={`mailto:${SALON_CONFIG.email}`}>{SALON_CONFIG.email}</a>. Jeżeli
          żądanie dotyczy dokumentacji zabiegowej, możesz zwrócić się do salonu,
          który jest jej administratorem. Pomożemy salonowi w technicznej realizacji
          praw osoby, której dane dotyczą.
        </p>
        <p>
          Masz również prawo złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych.
          Aktualne informacje znajdziesz na {" "}
          <Link href="https://uodo.gov.pl/" rel="noreferrer" target="_blank">
            stronie UODO
          </Link>.
        </p>
      </>
    ),
  },
  {
    id: "bezpieczenstwo",
    title: "Bezpieczeństwo i integralność dokumentów",
    content: (
      <>
        <p>
          Stosujemy środki adekwatne do ryzyka, w tym kontrolę dostępu według ról,
          izolację danych salonów, bezpieczne sesje, możliwość włączenia weryfikacji
          dwuetapowej, rejestrowanie istotnych operacji oraz zabezpieczenia kopii
          zapasowych i transmisji danych.
        </p>
        <p>
          Dla podpisanych dokumentów platforma utrwala wersję formularza, czas
          operacji i mechanizmy potwierdzające integralność. Żaden system nie usuwa
          jednak całkowicie ryzyka, dlatego monitorujemy zdarzenia i aktualizujemy
          zabezpieczenia.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Pliki cookies i technologie lokalne",
    content: (
      <>
        <p>
          Niezbędne pliki cookies służą utrzymaniu sesji, zapamiętaniu ustawień
          bezpieczeństwa i prawidłowemu działaniu platformy. Opcjonalne technologie
          analityczne lub marketingowe mogą być uruchamiane dopiero na podstawie
          właściwej zgody, jeśli zostaną wdrożone.
        </p>
        <p>
          Ustawieniami można zarządzać w banerze cookies oraz w przeglądarce.
          Wyłączenie niezbędnych plików może uniemożliwić logowanie lub korzystanie z
          części funkcji.
        </p>
      </>
    ),
  },
  {
    id: "zmiany-i-kontakt",
    title: "Zmiany polityki i kontakt",
    content: (
      <>
        <p>
          Polityka może być aktualizowana wraz z rozwojem platformy, zmianą dostawców
          lub przepisów. O istotnych zmianach poinformujemy w aplikacji albo na adres
          e-mail przypisany do konta, z odpowiednim wyprzedzeniem, gdy będzie to
          wymagane.
        </p>
        <p>
          Kontakt w sprawach prywatności: {" "}
          <a href={`mailto:${SALON_CONFIG.email}`}>{SALON_CONFIG.email}</a>, tel. {" "}
          <a href={`tel:+48${SALON_CONFIG.phone.replace(/\s/g, "")}`}>
            +48 {SALON_CONFIG.phone}
          </a>.
        </p>
      </>
    ),
  },
] as const;

export default function PolitykaPrywatnosciPage() {
  return (
    <BeautyDocsLegalPage
      activeDocument="privacy"
      description="Wyjaśniamy, jakie dane przetwarza platforma BeautyDocs, kiedy administratorem jest salon oraz jak możesz korzystać ze swoich praw."
      lastUpdated="15 sierpnia 2026 r."
      notice={
        <p>
          <strong>Najważniejsze rozróżnienie:</strong> BeautyDocs odpowiada za dane
          Twojego konta i działanie platformy. W zakresie dokumentacji zabiegowej
          administratorem danych pozostaje salon, któremu ją przekazujesz.
        </p>
      }
      sections={privacySections}
      title="Polityka prywatności"
    />
  );
}
