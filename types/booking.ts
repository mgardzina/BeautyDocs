import { SALON_CONFIG } from "@/app/config/salon";

export type FormType =
  | 'LIP_AUGMENTATION'
  | 'FACIAL_VOLUMETRY'
  | 'NEEDLE_MESOTHERAPY'
  | 'INJECTION_LIPOLYSIS'
  | 'PERMANENT_MAKEUP'
  | 'LASER_HAIR_REMOVAL'
  | 'LASER_TATTOO_REMOVAL'
  | 'WRINKLE_REDUCTION';

export interface ConsentFormData {
  type: FormType;

  // Dane personalne
  imieNazwisko: string;
  ulica: string;
  kodPocztowy: string;
  miasto: string;
  pesel: string;
  telefon: string;
  email?: string;
  miejscowoscData: string;
  osobaPrzeprowadzajacaZabieg?: string;

  // Szczegóły zabiegu
  nazwaProduktu: string;
  obszarZabiegu: string;
  celEfektu: string;
  numerZabiegu?: string; // "zabieg pierwszy" / "zabieg kolejny"

  // Przeciwwskazania (Słownik klucz -> wartość, wartość może być boolean dla checkboxów lub string dla pól follow-up)
  przeciwwskazania: Record<string, boolean | string | null>;

  // Zgody
  zgodaPrzetwarzanieDanych: boolean;
  zgodaMarketing: boolean;
  zgodaFotografie: boolean;
  zgodaPomocPrawna: boolean;
  miejscaPublikacjiFotografii: string;

  // Podpisy
  podpisDane: string;
  podpisMarketing: string;
  podpisFotografie: string;
  podpisRodo: string | null;
  podpisRodo2: string | null;

  // Informacja dodatkowa
  informacjaDodatkowa?: string;
  zastrzeniaKlienta?: string;
  wykazLekow?: string;
  inneSchorzenia?: string;
}

export const mezoterapiaIglowaCategoryBreaks: Record<number, string> = {
  0: "BEZWZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU",
  11: "WZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU",
  18: "CZASOWE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU",
};

export const mezoterapiaIglowaContraindications: Record<
  string,
  string | ContraindicationWithFollowUp
> = {
  // Bezwzględne
  ciazaLaktacja: "Czy jest Pani w ciąży lub w okresie laktacji?",
  chemoRadioTerapia:
    "Czy w ciągu ostatniego roku był/a Pan/i poddawana chemioterapii lub radioterapii?",
  kortykosteroidy: "Czy stosuje Pan/i terapię kortykosteroidami?",
  nowotwor: "Czy choruje Pan/i na nowotwór?",
  hivZoltaczka: "Czy choruje Pan/i na HIV lub żółtaczkę?",
  luszczyca: "Czy choruje Pan/i na łuszczycę?",
  epilepsja: "Czy choruje Pan/i na epilepsję?",
  hemofilia: "Czy ma Pan/i stwierdzoną hemofilie?",
  gojenieRan: "Czy ma Pan/i problem/trudności z gojeniem ran?",
  alergiaZnieczulenie:
    "Czy ma Pan/i alergie na preparaty stosowane do miejscowego znieczulenia?",
  alkoholSrodki:
    "Czy w ciągu ostatnich 2 dni przyjmował/a Pan/i alkohol lub inne środku odurzające?",

  // Względne
  cukrzyca: "Czy choruje Pan/i na cukrzycę?",
  serce: "Czy choruje Pan/i na zaburzenie pracy serca?",
  anemia: "Czy ma Pan/i anemie?",
  problemyKrazenie: "Czy ma Pan/i problemy z krążeniem?",
  autoimmunologiczne: "Czy choruje Pan/i na choroby autoimmunologiczne?",
  zmianySkorne:
    "Czy ma Pan/i zmiany skórne w obszarze poddawanym zabiegowi (trądzik, stany ropne, alergiczne lub grzybicze zmiany w okolicach podlegających zabiegowi, naczyniaki, liszaje, brodawczaki, przerwania ciągłości naskórka, poparzenia słoneczne)?",
  lekiKrzepliwosc:
    "Czy w ostatnich 7 dniach przyjmowała Pan/i leki zmniejszające krzepliwość krwi m.in. kwas acetylosalicylowy, heparynę, acenokumarol?",

  // Czasowe
  opryszczka: "Czy ma Pan/i aktywną opryszczkę? (ust/oka)",
  wypelniacze:
    "Czy korzystał/a Pan/i z wypełniaczy skórnych - kwasu hialuronowego?",
  botoks: "Czy korzystał/a Pan/i z zastrzyków z botoksu?",
  zabiegiChirurgiczne: {
    text:
      "Czy korzystał/a Pan/i z zabiegów chirurgicznych w okolicy twarzy?",
    hasFollowUp: true,
    followUpPlaceholder: "Jeżeli tak, to z jakich?",
  },
  zluszczanie4tygodnie:
    "Czy miał/a Pan/i robiony zabieg złuszczania naskórka przez okres 4 tygodni przed zabiegiem?",
  chorobySkory:
    "Czy posiada Pan/i choroby skóry (łojotokowe/atopowe zapalenie)",
  sterydy: "Czy jest Pan/i w trakcie kuracji sterydowej?",
  antybiotyki: "Czy jest Pan/i w trakcie stosowania antybiotykoterapii?",
  lekiRozrzedzajace:
    "Czy stosuje Pan/ i leki rozrzedzające krew? (aspiryna, paracetamol, witamina E, inne)",
  lekiMiejscowe:
    "Czy stosuje Pan/i leki do aplikacji miejscowej w obszarze objętym zabiegiem?",
  zluszczanie4tygodnie2:
    "Czy w okresie 4 tyg. przed zabiegiem miał/a Pan/i zabieg złuszczania naskórka?",
  temperatura:
    "Czy ma Pan/i podniesioną temperaturę ciała lub jest przeziębiona w dniu zabiegu?",
  tarczyca: "Czy posiada Pan/i zaburzenia funkcji tarczycy?",
  sinceKrwawienia: "Czy ma Pan/i skłonności do sińców lub krwawienia?",
  tatuaze: "Czy posiada Pan/i tatuaże?",
  makijazPermanentny: "Czy posiada Pani makijaż permanentny?",
};

// RODO Information - Dane administratora
export const rodoInfo = {
  administrator: SALON_CONFIG.owner,
  firmaNazwa: SALON_CONFIG.fullName,
  nip: SALON_CONFIG.nip,
  regon: '383931003',
  adres: `${SALON_CONFIG.address}, ${SALON_CONFIG.zipCode} ${SALON_CONFIG.city}`,
  consentTitle: 'ZGODA NA PRZETWARZANIE DANYCH OSOBOWYCH RODO',
  consentText: `Ja, niżej podpisana, zgodnie z art. 6 ust 1 pkt a w zw. z 7 ust. 2 Rozporządzenia Parlamentu Europejskiego i Rady Unii Europejskiej z dnia 27 kwietnia 2016 r. 2016/679 (Dz.U.UE.L.2018.127.2 t.j.) w sprawie ochrony osób fizycznych w związku z przetwarzaniem danych osobowych i w sprawie swobodnego przepływu takich danych oraz uchylenia dyrektywy 95/46/WE (ogólne rozporządzenie o ochronie danych), zwane dalej RODO, wyrażam dobrowolną zgodę na przetwarzanie przez Administratora – Malwinę Zięba, prowadzącą działalność gospodarczą pod firmą: PowderBrows Academy Malwina Zięba, ul. Siedlanowskiego 3/12 , 37 – 450 Stalowa Wola, NIP: 8652314272, REGON: 383931003, moich danych osobowych w postaci:
● imienia i nazwiska
● numeru telefonu
● adresu e-mail
● daty urodzenia
● numeru PESEL
● wizerunku utrwalonego w celu prowadzenia dokumentacji zabiegowej
● informacji o stanie zdrowia, schorzeniach, przebytych zabiegach`,
  clauseTitle: 'KLAUZULA INFORMACYJNA DOTYCZĄCA PRZETWARZANIA DANYCH OSOBOWYCH',
  clauseText: `Oświadczam, że zgodnie z art. 13 ust. 1 i ust. 2 RODO zostałam poinformowana, iż:
a) podanie danych osobowych jest dobrowolne, ale w przypadku odmowy ich podania, Administrator jest uprawniony do odmowy realizacji usługi,
b) posiadam prawo do cofnięcia zgody w dowolnym momencie, jednak rozumiem, iż nie wpłynie to na zgodność z prawem przetwarzania, którego dokonano na podstawie zgody przed jej cofnięciem,
c) dane w postaci: imienia i nazwiska, daty urodzenia, numeru PESEL, informacji o stanie zdrowia, schorzeniach, przebytych zabiegach oraz wizerunku utrwalonego w celu prowadzenia dokumentacji zabiegowej, są przetwarzane na podstawie upoważnienia ustawowego, o którym mowa w art. 9 ust. 2 a RODO, w celu prawidłowej realizacji usługi - do której niezbędne jest pozyskanie danych wrażliwych,
d) dane w postaci: numeru telefonu oraz adresu mailowego, będą wykorzystywane w celu dokonania rezerwacji, realizacji usługi oraz informowania o usługach świadczonych przez Administratora (terminy wizyt, oferty, zakres usług),
e) dane w postaci wizerunku utrwalonego w celach promocyjno-marketingowych będą wykorzystywane na potrzeby działalności promocyjno-marketingowej Administratora (zamieszczenie fotografii na stronie internetowej salonu, portalu Facebook, portalu Instagram),
f) odbiorcami danych osobowych będą upoważnione przez Administratora osoby, które przetwarzają dane osobowe w ramach powierzonych im zadań służbowych,
g) w przypadku uprawnionego żądania odbiorcami danych mogą stać się również organy kontroli, organy ścigania oraz inne organy publiczne działające na podstawie upoważnienia ustawowego,
h) dane osobowe będą przetwarzane do momentu: cofnięcia zgody, wygaśnięcia ciążącego na Administratorze obowiązku przechowywania danych wynikającego z aktualnie obowiązujących przepisów prawa lub upływu terminu wygaśnięcia roszczeń związanych z wykonaną usługą,
i) posiadam prawo do żądania od Administratora: dostępu do swoich danych osobowych, prawo do ich sprostowania, do ich przenoszenia lub ograniczenia przetwarzania, a także usunięcia danych osobowych,
j) dane osobowe będą poddane zautomatyzowanym procesom związanym z podejmowaniem decyzji, w tym profilowaniu zwykłemu, wyłącznie w celu dopasowania oferty marketingowej Administratora do indywidualnych potrzeb klienta, a także przypominania o umówionych wizytach,
k) Administrator nie będzie przekazywał danych osobowych do państwa trzeciego lub organizacji międzynarodowych,
l) w przypadku uznania, że dane osobowe są przetwarzane nieprawidłowo lub niezgodnie z przepisami przysługuje mi prawo do wniesienia skargi do organu nadzoru – Prezesa Urzędu Ochrony Danych Osobowych.`,
  pelnyTekst: `Obowiązek informacyjny RODO

Zgodnie z art. 13 ogólnego rozporządzenia o ochronie danych osobowych Dz. Urz. UE L 119 z 04.05.2016 informuję, iż:

1) administratorem Pani/Pana danych osobowych jest PowderBrows Academy Malwina Zięba,
2) Pani/Pana dane osobowe przetwarzane będą w celu korzystania z usług hotelowych/kosmetycznych - na podstawie Art. 6 ust. 1 lit. b ogólnego rozporządzenia o ochronie danych osobowych z dnia 27 kwietnia 2016 r.
3) odbiorcami Pani/Pana danych osobowych będą wyłącznie podmioty uprawnione do uzyskania danych osobowych na podstawie przepisów prawa oraz podmioty uczestniczące w realizacji usług
4) Pani/Pana dane osobowe przechowywane będą przez okres 10 lat
5) posiada Pani/Pan prawo do żądania od administratora dostępu do danych osobowych, prawo do ich sprostowania, usunięcia lub ograniczenia przetwarzania oraz prawo do przenoszenia danych
6) ma Pani/Pan prawo wniesienia skargi do organu nadzorczego
7) podanie danych osobowych jest dobrowolne, jednakże odmowa podania danych może skutkować odmową realizacji usługi/umowy`,
};

// Nowa struktura przeciwwskazań - wspólna dla wszystkich formularzy
export interface ContraindicationQuestion {
  key: string;
  text: string;
  hasFollowUp?: boolean; // Czy pytanie ma pole tekstowe "Jeżeli tak, to..."
  followUpPlaceholder?: string;
}

export interface ContraindicationCategory {
  title: string;
  questions: ContraindicationQuestion[];
}

// Wspólne przeciwwskazania dla wszystkich zabiegów
export const commonContraindications = {
  absolute: {
    title: 'BEZWZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU',
    questions: [
      { key: 'ciazaLaktacja', text: 'Czy jest Pani w ciąży lub w okresie laktacji?' },
      { 
        key: 'zmianySkorne', 
        text: 'Czy ma Pani/Pan zapalenie lub zakażenie skóry (trądzik, opryszczka, zapalenia skórne, alergiczne lub grzybicze zmiany w okolicach podlegających zabiegowi, naczyniaki, liszaje, brodawczaki, przerwania ciągłości naskórka, poparzenia słoneczne?)' 
      },
      { key: 'chemioRadioterapia', text: 'Czy w ciągu ostatniego roku była/był Pan poddawana chemioterapii lub radioterapii?' },
      { key: 'chorobaNowotwrowa', text: 'Czy choruje Pani/Pan na nowotwór?' },
      { key: 'hivZoltaczka', text: 'Czy choruje Pani/Pan na HIV lub żółtaczkę?' },
      { key: 'luszczycaAktywna', text: 'Czy choruje Pani/Pan na łuszczycę?' },
      { key: 'epilepsja', text: 'Czy choruje Pani/Pan na epilepsję?' },
      { key: 'gojenieRan', text: 'Czy ma Pani/Pan problem/trudności z gojeniem ran?' },
      { key: 'alergiaSkładniki', text: 'Czy posiada Pani/Pan alergie na składniki preparatu?' },
      { key: 'alergiaZnieczulenie', text: 'Czy ma Pani/Pan alergie na preparaty stosowane do miejscowego znieczulenia?' },
      { 
        key: 'chorobyImmunologiczne', 
        text: 'Czy choruje Pani/Pan na choroby immunologiczne (reumatoidalne zapalenie stawów, łuszczycowe zapalenie stawów, wrzodziejące zapalenie jelita grubego, chorobę Crohna, zesztywniające zapalenie stawów etc.)' 
      },
      { key: 'bielactwo', text: 'Czy choruje Pani/Pan na bielactwo?' },
      { key: 'porfiriaSkorna', text: 'Czy choruje Pani/Pan na portfirie skórną?' },
      { key: 'podatnoscBlizny', text: 'Czy ma Pani/Pan podatność na przerost blizn?' },
      { key: 'alkoholSrodkiOdurzajace', text: 'Czy w ciągu ostatnich 2 dni przyjmowała Pani/Pan alkohol lub inne środki odurzające?' },
      { key: 'izotretinoina', text: 'Czy jest Pani/Pan w trakcie leczenia izotretinoiną (Izotek, Roaccutane, Aknenormin)' },
      { key: 'lekiPrzeciwbolowe', text: 'Czy przyjmuje Pani/Pan leki przeciwbólowe i przeciwzapalne (np. ibuprofen)' },
      { key: 'utrataSwiadomosci', text: 'Czy podczas zabiegu med. estetycznej miała Pani/Pan utratę świadomości?' },
      { key: 'uczulenieSrodkiZnieczulajace', text: 'Czy jest Pani/Pan uczulona na środki znieczulające?' },
    ]
  } as ContraindicationCategory,
  
  relative: {
    title: 'WZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU',
    questions: [
      { key: 'problemyKrazenie', text: 'Czy ma Pani/Pan problemy z krążeniem?' },
      { key: 'chorobyAutoimmunologiczne', text: 'Czy choruje Pani/Pan na choroby autoimmunologiczne?' },
      { key: 'antykoagulanty', text: 'Czy przyjmuje Pani/Pan antykoagulanty lub leki rozrzedzające krew (np. acard)' },
      { key: 'szczepieniWzw', text: 'Czy było wykonywane szczepienie na wzw?' },
      { key: 'lekIglyKrew', text: 'Czy ma Pani/Pan lęk na igły/krew' },
    ]
  } as ContraindicationCategory,
  
  temporary: {
    title: 'CZASOWE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU',
    questions: [
      { key: 'leczenieStomatologiczne', text: 'Czy jest Pani/Pan w trakcie leczenia stomatologicznego?' },
      { 
        key: 'wypelniaczeSkorne', 
        text: 'Czy korzystała Pani/Pan z wypełniaczy skórnych - kwasu hialuronowego?',
        hasFollowUp: true,
        followUpPlaceholder: 'Jeżeli tak, to z jakich?'
      },
      { 
        key: 'botoks', 
        text: 'Czy korzystała Pani/Pan z zastrzyków z użyciem botoksu?',
        hasFollowUp: true,
        followUpPlaceholder: 'Jeżeli tak, to z jakich?'
      },
      { 
        key: 'zabiegiChirurgiczne', 
        text: 'Czy korzystała Pani/Pan z zabiegów chirurgicznych w okolicy twarzy?',
        hasFollowUp: true,
        followUpPlaceholder: 'Jeżeli tak, to z jakich?'
      },
      { key: 'antybiotykoterapia', text: 'Czy jest Pani/Pan w trakcie stosowania antybiotykoterapii?' },
      { key: 'lekiRozrzedzajaceKrew', text: 'Czy stosuje Pani/Pan leki rozrzedzające krew? (aspiryna, paracetamol, witamina E, inne)' },
      { key: 'lekiMiejscowe', text: 'Czy stosuje Pani/Pan leki do aplikacji miejscowej w obszarze objętym zabiegiem?' },
      { key: 'temperaturaPrzeziebienie', text: 'Czy ma Pani/Pan podniesioną temperaturę ciała lub jest przeziębiona w dniu zabiegu?' },
    ]
  } as ContraindicationCategory,
  
  other: {
    title: 'INNE',
    questions: [
      { key: 'sklonnosciSiniacyKrwawienie', text: 'Czy ma Pani/Pan skłonności do sińców lub krwawienia?' },
      { key: 'tatuaze', text: 'Czy posiada Pani/Pan tatuaże?' },
      { 
        key: 'makijazPermanentny', 
        text: 'Czy posiada Pani/Pan makijaż permanentny?',
        hasFollowUp: true,
        followUpPlaceholder: 'Jeżeli tak, to kiedy został wykonany i jaką techniką?'
      },
      { 
        key: 'inneSchorzenia', 
        text: 'Czy posiada Pani/Pan inne schorzenia, proszę podać jakie:',
        hasFollowUp: true,
        followUpPlaceholder: 'Proszę opisać'
      },
    ]
  } as ContraindicationCategory,
};

// Stała dla Kwasu Hialuronowego / Wolumetria Twarzy
export const hyaluronicContraindications: Record<string, string | ContraindicationWithFollowUp> = {
  // BEZWZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  ciazaLaktacja: 'Czy jest Pani w ciąży lub w okresie laktacji?',
  zmianySkorne: 'Czy ma Pani/Pan zapalenie lub zakażenie skóry (trądzik, opryszczka, zapalenia skórne, alergiczne lub grzybicze zmiany w okolicach podlegających zabiegowi, naczyniaki, liszaje, brodawczaki, przerwania ciągłości naskórka, poparzenia słoneczne?)',
  chemioRadioterapia: 'Czy w ciągu ostatniego roku była/był Pan poddawana chemioterapii lub radioterapii?',
  chorobaNowotwrowa: 'Czy choruje Pani/Pan na nowotwór?',
  hivZoltaczka: 'Czy choruje Pani/Pan na HIV lub żółtaczkę?',
  luszczycaAktywna: 'Czy choruje Pani/Pan na łuszczycę?',
  epilepsja: 'Czy choruje Pani/Pan na epilepsję?',
  gojenieRan: 'Czy ma Pani/Pan problem/trudności z gojeniem ran?',
  alergiaSkladniki: 'Czy posiada Pani/Pan alergie na składniki preparatu?',
  alergiaZnieczulenie: 'Czy ma Pani/Pan alergie na preparaty stosowane do miejscowego znieczulenia?',
  chorobyImmunologiczne: {
    text: 'Czy choruje Pani/Pan na choroby immunologiczne (reumatoidalne zapalenie stawów, łuszczycowe zapalenie stawów, wrzodziejące zapalenie jelita grubego, chorobę Crohna, zesztywniające zapalenie stawów etc.)',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to jakie?'
  },
  bielactwo: 'Czy choruje Pani/Pan na bielactwo?',
  porfiriaSkorna: 'Czy choruje Pani/Pan na portfirie skórną?',
  podatnoscBlizny: 'Czy ma Pani/Pan podatność na przerost blizn?',
  alkoholNarkotyki: 'Czy w ciągu ostatnich 2 dni przyjmowała Pani/Pan alkohol lub inne środki odurzające?',
  izotretinoina: 'Czy jest Pani/Pan w trakcie leczenia izotretinoiną (Izotek, Roaccutane, Aknenormin)',
  lekiPrzeciwbolowe: 'Czy przyjmuje Pani/Pan leki przeciwbólowe i przeciwzapalne (np. ibuprofen)',
  utrataSwiadomosci: 'Czy podczas zabiegu med. estetycznej miała Pani/Pan utratę świadomości?',
  uczulenieSrodkiZnieczulajace: 'Czy jest Pani/Pan uczulona na środki znieczulające?',
  
  // WZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  problemyKrazenie: 'Czy ma Pani/Pan problemy z krążeniem?',
  chorobaAutoimmunologiczna: 'Czy choruje Pani/Pan na choroby autoimmunologiczne?',
  antykoagulanty: 'Czy przyjmuje Pani/Pan antykoagulanty lub leki rozrzedzające krew (np. acard)',
  szczepieniWzw: 'Czy było wykonywane szczepienie na wzw?',
  lekIglyKrew: 'Czy ma Pani/Pan lęk na igły/krew',
  
  // CZASOWE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  leczenieStomatologiczne: 'Czy jest Pani/Pan w trakcie leczenia stomatologicznego?',
  wypelniaczeSkorne: {
    text: 'Czy korzystała Pani/Pan z wypełniaczy skórnych - kwasu hialuronowego?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?'
  },
  botoks: {
    text: 'Czy korzystała Pani/Pan z zastrzyków z użyciem botoksu?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?'
  },
  zabiegiChirurgiczne: {
    text: 'Czy korzystała Pani/Pan z zabiegów chirurgicznych w okolicy twarzy?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?'
  },
  antybiotykoterapia: 'Czy jest Pani/Pan w trakcie stosowania antybiotykoterapii?',
  lekiRozrzedzajaceKrew: 'Czy stosuje Pani/Pan leki rozrzedzające krew? (aspiryna, paracetamol, witamina E, inne)',
  lekiMiejscowe: 'Czy stosuje Pani/Pan leki do aplikacji miejscowej w obszarze objętym zabiegiem?',
  temperaturaPrzeziebienie: 'Czy ma Pani/Pan podniesioną temperaturę ciała lub jest przeziębiona w dniu zabiegu?',
  
  // INNE
  sklonnosciSiniaki: 'Czy ma Pani/Pan skłonności do sińców lub krwawienia?',
  tatuaze: 'Czy posiada Pani/Pan tatuaże?',
  makijazPermanentny: {
    text: 'Czy posiada Pani/Pan makijaż permanentny?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to kiedy został wykonany i jaką techniką?'
  },
  inneSchorzenia: {
    text: 'Czy posiada Pani/Pan inne schorzenia?',
    hasFollowUp: true,
    followUpPlaceholder: 'Proszę podać jakie'
  },
};

// Naturalne reakcje dla kwasu hialuronowego
export const hyaluronicNaturalReactions = [
  'obrzęk i szczypanie okolicy pozabiegowej utrzymujący się do 2 tygodni',
  'zaczerwienienie i/lub zasinienie okolicy pozabiegowej utrzymujące się do tygodnia',
  'wylewy, krwiaki, siniaki okolicy pozabiegowej utrzymujące się do 2 tygodni',
  'tkliwość tkanek objętych zabiegiem utrzymująca się do około miesiąca',
  'możliwe wyczuwanie materiału zabiegowego (grudki) przez okres do 2 tygodni',
  'swędzenia w okresie gojenia',
];

// Powikłania dla kwasu hialuronowego
export const hyaluronicComplications = {
  czeste: [
    'przedłużający się obrzęk',
    'przedłużający się rumień',
    'zgrubienie w miejscu wprowadzenia preparatu',
    'wylewy krwawe',
    'migracja kwasu hialuronowego',
    'efekt Tyndalla',
    'przebarwienia w miejscu iniekcji',
  ],
  rzadkie: [
    'zakażenie wirusowe',
    'zakażenie bakteryjne',
    'zakażenia grzybicze',
    'nieregularna powierzchnia skóry zniekształcenie',
    'guzki na skórze',
    'opóźnione stany zapalne',
    'ropnie i owrzodzenia',
    'widoczna asymetria',
  ],
  bardzoRzadkie: [
    'martwica skóry',
    'zatory w obrębie naczyń krwionośnych i limfatycznych',
    'tworzenie się ziarniaków',
    'ucisk na lokalne naczynia krwionośne',
    'obrzęk naczynioruchowy',
  ],
};

// Zalecenia pozabiegowe dla kwasu hialuronowego
export const hyaluronicPostCare = [
  'Stosowanie preparatu pozabiegowego: MAŚĆ ARNIKOWA',
  'Miejsce poddane zabiegowi traktować ze szczególną ostrożnością',
  'Nie dotykać ani nie masować miejsc poddanych zabiegowi',
  'Zachować wysoką higienę dłoni, istnieje bowiem duże ryzyko wtórnego zakażenia',
  'Nie przemywać mydłem i środkami złuszczającymi miejsc poddanych wypełnieniu przez min. 2 tygodni',
  'Unikać silnej ekspozycji słonecznej przez 6 tygodni i stosować kremy z wysokim filtrem UV',
  'Nie korzystać z solarium przez okres 2 tygodni',
  'Nie korzystać z sauny, basenu czy krioterapii przez okres 1 tygodnia',
  'Unikać alkoholu przez okres min. 48 godzin po zabiegu',
  'Unikać gorących napojów w dniu zabiegu (dotyczy modelowania ust)',
  'Unikać wzmożonego wysiłku fizycznego przez około dwie doby',
  'Unikać spania przez kilka dni w pozycji mogącej spowodować uciśnięcie miejsca podania kwasu hialuronowego, a co za tym idzie przemieszczenia preparatu',
  'Nie poddawać się zabiegom peelingu chemicznego i mechanicznego przez okres 2 tygodni od zabiegu',
  'UWAGA: Stosować się ściśle do zaleceń pozabiegowych. Przez 4 doby po zabiegu należy pić dużo wody, minimum 2,5 litra dziennie.',
  'UWAGA: Utrzymywanie się reakcji zapalnych przez okres dłuższy niż 7 dni lub wystąpienie jakichkolwiek reakcji niepożądanych należy niezwłocznie zgłosić.',
];

// Stała dla PMU (Makijaż Permanentny)
export const pmuContraindications: Record<string, string | ContraindicationWithFollowUp> = {
  // BEZWZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  ciazaLaktacja: 'Czy jest Pani w ciąży lub w okresie laktacji?',
  zmianySkorne: 'Czy ma Pani/Pan zapalenie lub zakażenie skóry (trądzik, opryszczka, zapalenia skórne, alergiczne lub grzybicze zmiany w okolicach podlegających zabiegowi, naczyniaki, liszaje, brodawczaki, przerwania ciągłości naskórka, poparzenia słoneczne?)',
  chemioRadioterapia: 'Czy w ciągu ostatniego roku była/był Pan poddawana chemioterapii lub radioterapii?',
  chorobaNowotwrowa: 'Czy choruje Pani/Pan na nowotwór?',
  hivZoltaczka: 'Czy choruje Pani/Pan na HIV lub żółtaczkę?',
  luszczycaAktywna: 'Czy choruje Pani/Pan na łuszczycę?',
  epilepsja: 'Czy choruje Pani/Pan na epilepsję?',
  gojenieRan: 'Czy ma Pani/Pan problem/trudności z gojeniem ran?',
  alergiaBarwniki: 'Czy posiada Pani/Pan alergie na barwniki stosowane do pigmentacji?',
  alergiaZnieczulenie: 'Czy ma Pani/Pan alergie na preparaty stosowane do miejscowego znieczulenia?',
  chorobyImmunologiczne: {
    text: 'Czy choruje Pani/Pan na choroby immunologiczne (reumatoidalne zapalenie stawów, łuszczycowe zapalenie stawów, wrzodziejące zapalenie jelita grubego, chorobę Crohna, zesztywniające zapalenie stawów etc.)',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to jakie?'
  },
  bielactwo: 'Czy choruje Pani/Pan na bielactwo?',
  porfiriaSkorna: 'Czy choruje Pani/Pan na portfirie skórną?',
  podatnoscBlizny: 'Czy ma Pani/Pan podatność na przerost blizn?',
  alkoholNarkotyki: 'Czy w ciągu ostatnich 2 dni przyjmowała Pani/Pan alkohol lub inne środki odurzające?',
  izotretinoina: 'Czy jest Pani/Pan w trakcie leczenia izotretinoiną (Izotek, Roaccutane, Aknenormin)',
  lekiPrzeciwbolowe: 'Czy przyjmuje Pani/Pan leki przeciwbólowe i przeciwzapalne (np. ibuprofen)',
  utrataSwiadomosci: 'Czy podczas zabiegu med. estetycznej miała Pani/Pan utratę świadomości?',
  uczulenieSrodkiZnieczulajace: 'Czy jest Pani/Pan uczulona na środki znieczulające?',
  
  // WZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  problemyKrazenie: 'Czy ma Pani/Pan problemy z krążeniem?',
  chorobaAutoimmunologiczna: 'Czy choruje Pani/Pan na choroby autoimmunologiczne?',
  antykoagulanty: 'Czy przyjmuje Pani/Pan antykoagulanty lub leki rozrzedzające krew (np. acard)',
  szczepieniWzw: 'Czy było wykonywane szczepienie na wzw?',
  lekIglyKrew: 'Czy ma Pani/Pan lęk na igły/krew',
  
  // CZASOWE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  leczenieStomatologiczne: 'Czy jest Pani/Pan w trakcie leczenia stomatologicznego? (dotyczy makijażu ust)',
  wypelniaczeUst: {
    text: 'Czy korzystała Pani/Pan z wypełniaczy skórnych - kwasu hialuronowego? (dotyczy makijażu ust)',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?'
  },
  zabiegiChirurgiczne: {
    text: 'Czy korzystała Pani/Pan z zabiegów chirurgicznych w okolicy twarzy?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?'
  },
  antybiotykoterapia: 'Czy jest Pani/Pan w trakcie stosowania antybiotykoterapii?',
  lekiRozrzedzajaceKrew: 'Czy stosuje Pani/Pan leki rozrzedzające krew? (aspiryna, paracetamol, witamina E, inne)',
  lekiMiejscowe: 'Czy stosuje Pani/Pan leki do aplikacji miejscowej w obszarze objętym zabiegiem?',
  temperaturaPrzeziebienie: 'Czy ma Pani/Pan podniesioną temperaturę ciała lub jest przeziębiona w dniu zabiegu?',
  chorobaGalkiOcznej: 'Czy choruje Pani/Pan na chorobę gałki ocznej? (dotyczy makijażu powiek)',
  stanyZapalneSpojowek: 'Czy ma Pani/Pan stany zapalne spojówek i oczu? (dotyczy makijażu powiek)',
  operacjeOczu: 'Czy przebył/a Pani/Pan zabiegi operacyjne oczu? (dotyczy makijażu powiek)',
  
  // INNE
  sklonnosciSiniaki: 'Czy ma Pani/Pan skłonności do sińców lub krwawienia?',
  tatuaze: 'Czy posiada Pani/Pan tatuaże?',
  makijazPermanentny: {
    text: 'Czy posiada Pani/Pan makijaż permanentny?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to kiedy został wykonany i jaką techniką?'
  },
  inneSchorzenia: {
    text: 'Czy posiada Pani/Pan inne schorzenia?',
    hasFollowUp: true,
    followUpPlaceholder: 'Proszę podać jakie'
  },
};

// Naturalne reakcje dla PMU
export const pmuNaturalReactions = [
  'swędzenie w okresie gojenia',
  'pojawienia się strupków i złuszczania naskórka w miejscu zabiegu',
  'makijaż w pierwszych dniach po zabiegu będzie znacząco ciemniejszy',
];

// Powikłania dla PMU
export const pmuComplications = {
  czeste: ['obrzęk', 'rumień'],
  rzadkie: ['zakażenie wirusowe', 'zakażenie bakteryjne'],
  bardzoRzadkie: ['bliznowce', 'migracja pigmentu'],
};

// Zalecenia pozabiegowe dla PMU
export const pmuPostCare = [
  'Miejsce poddane zabiegowi traktować ze szczególną ostrożnością',
  'WAŻNE: Strupków ani złuszczającego się naskórka nie wolno usuwać mechanicznie!',
  'Zachować wysoką higienę dłoni, istnieje bowiem duże ryzyko wtórnego zakażenia',
  'Nie przemywać wodą z mydłem i środkami złuszczającymi miejsc poddanych pigmentacji przez min. 2 tygodnie',
  'Unikać silnej ekspozycji słonecznej przez 6 tygodni i stosować kremy z wysokim filtrem UV',
  'Nie korzystać z solarium przez okres 6 tygodni',
  'Nie korzystać z sauny, basenu przez okres min. 3 tygodni',
  'Unikać mechanicznego odrywania strupków',
  'Unikać gorących napojów, ostrych potraw i alkoholu',
  'Przyjmować płyny przez słomkę w pierwszych dniach po zabiegu (makijaż ust)',
  'Nie używać pomadek, błyszczyków przez okres gojenia się ust (makijaż ust)',
  'Zachować szczególną higienę jamy ustnej (makijaż ust)',
  'Nie poddawać się zabiegom mezoterapii i wstrzyknięciom toksyny botulinowej w 2-3 tygodniu po zabiegu',
  'Nie poddawać się zabiegom peelingu chemicznego i mechanicznego przez okres 3 tygodni od zabiegu',
  'Zabieg przebiega w dwóch etapach: drugi zabieg tzw. dopigmentowanie (korekta) wykonany będzie do 2 miesięcy od pierwszotnego zabiegu',
  'W przypadku utrzymywanie się reakcji zapalnych przez okres dłuższy niż tydzień lub wystąpienie jakichkolwiek reakcji niepożądanych należy niezwłocznie zgłosić',
];

// Stała dla Lasera Q-Switch
export const laserContraindications: Record<string, string | ContraindicationWithFollowUp> = {
  // BEZWZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  ciazaLaktacja: 'Czy jest Pani w ciąży lub w okresie laktacji?',
  zmianySkorne: 'Czy ma Pani/Pan zapalenie lub zakażenie skóry (trądzik, opryszczka, zapalenia skórne, alergiczne lub grzybicze zmiany w okolicach podlegających zabiegowi, naczyniaki, liszaje, brodawczaki, przerwania ciągłości naskórka, poparzenia słoneczne?)',
  chemioRadioterapia: 'Czy w ciągu ostatniego roku była/był Pan poddawana chemioterapii lub radioterapii?',
  chorobaNowotwrowa: 'Czy choruje Pani/Pan na nowotwór?',
  hivZoltaczka: 'Czy choruje Pani/Pan na HIV lub żółtaczkę?',
  luszczycaAktywna: 'Czy choruje Pani/Pan na łuszczycę?',
  epilepsja: 'Czy choruje Pani/Pan na epilepsję?',
  gojenieRan: 'Czy ma Pani/Pan problem/trudności z gojeniem ran?',
  alergiaSkładniki: 'Czy posiada Pani/Pan alergie na składniki preparatu?',
  alergiaZnieczulenie: 'Czy ma Pani/Pan alergie na preparaty stosowane do miejscowego znieczulenia?',
  chorobyImmunologiczne: {
    text: 'Czy choruje Pani/Pan na choroby immunologiczne (reumatoidalne zapalenie stawów, łuszczycowe zapalenie stawów, wrzodziejące zapalenie jelita grubego, chorobę Crohna, zesztywniające zapalenie stawów etc.)',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to jakie?'
  },
  bielactwo: 'Czy choruje Pani/Pan na bielactwo?',
  porfiriaSkorna: 'Czy choruje Pani/Pan na portfirie skórną?',
  podatnoscBlizny: 'Czy ma Pani/Pan podatność na przerost blizn?',
  alkoholNarkotyki: 'Czy w ciągu ostatnich 2 dni przyjmowała Pani/Pan alkohol lub inne środki odurzające?',
  izotretinoina: 'Czy jest Pani/Pan w trakcie leczenia izotretinoiną (Izotek, Roaccutane, Aknenormin)',
  lekiPrzeciwbolowe: 'Czy przyjmuje Pani/Pan leki przeciwbólowe i przeciwzapalne (np. ibuprofen)',
  utrataSwiadomosci: 'Czy podczas zabiegu med. estetycznej miała Pani/Pan utratę świadomości?',
  uczulenieSrodkiZnieczulajace: 'Czy jest Pani/Pan uczulona na środki znieczulające?',
  rozrusznikSerca: 'Czy posiada Pani/Pan rozrusznik serca?',
  
  // WZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  problemyKrazenie: 'Czy ma Pani/Pan problemy z krążeniem?',
  chorobaAutoimmunologiczna: 'Czy choruje Pani/Pan na choroby autoimmunologiczne?',
  antykoagulanty: 'Czy przyjmuje Pani/Pan antykoagulanty lub leki rozrzedzające krew (np. acard)',
  szczepieniWzw: 'Czy było wykonywane szczepienie na wzw?',
  lekIglyKrew: 'Czy ma Pani/Pan lęk na igły/krew',
  
  // CZASOWE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  leczenieStomatologiczne: 'Czy jest Pani/Pan w trakcie leczenia stomatologicznego?',
  wypelniaczeSkorne: {
    text: 'Czy korzystała Pani/Pan z wypełniaczy skórnych - kwasu hialuronowego?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?'
  },
  botoks: {
    text: 'Czy korzystała Pani/Pan z zastrzyków z użyciem botoksu?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?'
  },
  zabiegiChirurgiczne: {
    text: 'Czy korzystała Pani/Pan z zabiegów chirurgicznych w okolicy twarzy?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?'
  },
  antybiotykoterapia: 'Czy jest Pani/Pan w trakcie stosowania antybiotykoterapii?',
  lekiRozrzedzajaceKrew: 'Czy stosuje Pani/Pan leki rozrzedzające krew? (aspiryna, paracetamol, witamina E, inne)',
  lekiMiejscowe: 'Czy stosuje Pani/Pan leki do aplikacji miejscowej w obszarze objętym zabiegiem?',
  temperaturaPrzeziebienie: 'Czy ma Pani/Pan podniesioną temperaturę ciała lub jest przeziębiona w dniu zabiegu?',
  chorobaGalkiOcznej: 'Czy choruje Pani/Pan na chorobę gałki ocznej? (dotyczy zabiegu na powiekach)',
  stanyZapalneSpojowek: 'Czy ma Pani/Pan stany zapalne spojówek i oczu? (dotyczy zabiegu na powiekach)',
  operacjeOczu: 'Czy przebył/a Pani/Pan zabiegi operacyjne oczu? (dotyczy zabiegu na powiekach)',
  
  // INNE
  sklonnosciSiniaki: 'Czy ma Pani/Pan skłonności do sińców lub krwawienia?',
  tatuaze: 'Czy posiada Pani/Pan tatuaże?',
  makijazPermanentny: {
    text: 'Czy posiada Pani/Pan makijaż permanentny?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to kiedy został wykonany i jaką techniką?'
  },
  inneSchorzenia: {
    text: 'Czy posiada Pani/Pan inne schorzenia?',
    hasFollowUp: true,
    followUpPlaceholder: 'Proszę podać jakie'
  },
};

// Naturalne reakcje dla Lasera
export const laserNaturalReactions = [
  'dyskomfort podczas zabiegu',
  'swędzenie w okresie gojenia',
  'pojawienia się strupków i złuszczania naskórka w miejscu zabiegu',
  'przemijające przebarwienia skóry',
];

// Powikłania dla Lasera
export const laserComplications = {
  czeste: ['obrzęk', 'rumień', 'strupki', 'pęcherzyki', 'reakcje alergiczne'],
  rzadkie: ['zakażenie wirusowe', 'bliznowacenie', 'zakażenie bakteryjne'],
  bardzoRzadkie: ['tymczasowe lub trwałe zmiany w kolorze i strukturze skóry'],
};

// Zalecenia pozabiegowe dla Lasera
export const laserPostCare = [
  'Miejsce poddane zabiegowi traktować ze szczególną ostrożnością',
  'Zachować wysoką higienę dłoni, istnieje bowiem duże ryzyko wtórnego zakażenia',
  'Unikać silnej ekspozycji słonecznej przez 4 tygodnie i stosować kremy z wysokim filtrem UV',
  'Nie korzystać z solarium przez okres 4 tygodnie',
  'Nie korzystać z sauny, basenu przez okres min. 3 tygodni',
  'Unikać mechanicznego odrywania strupków',
  'Unikać alkoholu przez około 48 godzin po zabiegu',
  'Nie poddawać się zabiegom peelingu chemicznego i mechanicznego przez okres 2 tygodni od zabiegu',
];

// =====================================================
// NOWE TYPY FORMULARZY
// =====================================================

// MODELOWANIE_UST - Modelowanie ust kwasem hialuronowym
export interface ContraindicationWithFollowUp {
  text: string;
  hasFollowUp?: boolean;
  followUpPlaceholder?: string;
}

export const modelowanieUstContraindications: Record<string, string | ContraindicationWithFollowUp> = {
  // BEZWZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  ciazaLaktacja: 'Czy jest Pani w ciąży lub w okresie laktacji?',
  zapalenieZakazenieSkory: 'Czy ma Pani/Pan zapalenie lub zakażenie skóry (trądzik, opryszczka, zapalenia skórne, alergiczne lub grzybicze zmiany w okolicach podlegających zabiegowi, naczyniaki, liszaje, brodawczaki, przerwania ciągłości naskórka, poparzenia słoneczne?)',
  chemioterapiaRadioterapia: 'Czy w ciągu ostatniego roku była/był Pan poddawana chemioterapii lub radioterapii?',
  nowotwor: 'Czy choruje Pani/Pan na nowotwór?',
  hivZoltaczka: 'Czy choruje Pani/Pan na HIV lub żółtaczkę?',
  luszczycaAktywna: 'Czy choruje Pani/Pan na łuszczycę?',
  epilepsja: 'Czy choruje Pani/Pan na epilepsję?',
  problemyGojenieRan: 'Czy ma Pani/Pan problem/trudności z gojeniem ran?',
  alergiaSkładnikiPreparatu: 'Czy posiada Pani/Pan alergie na składniki preparatu?',
  alergiaZnieczulenie: 'Czy ma Pani/Pan alergie na preparaty stosowane do miejscowego znieczulenia?',
  chorobyImmunologiczne: {
    text: 'Czy choruje Pani/Pan na choroby immunologiczne (reumatoidalne zapalenie stawów, łuszczycowe zapalenie stawów, wrzodziejące zapalenie jelita grubego, chorobę Crohna, zesztywniające zapalenie stawów etc.)',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to jakie?'
  },
  bielactwo: 'Czy choruje Pani/Pan na bielactwo?',
  porfiriaSkorna: 'Czy choruje Pani/Pan na portfirie skórną?',
  podatnoscBlizny: 'Czy ma Pani/Pan podatność na przerost blizn?',
  alkoholNarkotyki: 'Czy w ciągu ostatnich 2 dni przyjmowała Pani/Pan alkohol lub inne środki odurzające?',
  leczenieIzotretinina: 'Czy jest Pani/Pan w trakcie leczenia izotretinoiną (Izotek, Roaccutane, Aknenormin)',
  lekiPrzeciwbolowe: 'Czy przyjmuje Pani/Pan leki przeciwbólowe i przeciwzapalne (np. ibuprofen)',
  utrataSwiadomosci: 'Czy podczas zabiegu med. estetycznej miała Pani/Pan utratę świadomości?',
  uczulenieSrodkiZnieczulajace: 'Czy jest Pani/Pan uczulona na środki znieczulające?',
  
  // WZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  problemyKrazeniem: 'Czy ma Pani/Pan problemy z krążeniem?',
  chorobyAutoimmunologiczne: 'Czy choruje Pani/Pan na choroby autoimmunologiczne?',
  antykoagulantyLekiRozrzedzajace: 'Czy przyjmuje Pani/Pan antykoagulanty lub leki rozrzedzające krew (np. acard)',
  szczepienieWzw: 'Czy było wykonywane szczepienie na wzw?',
  lekIglyKrew: 'Czy ma Pani/Pan lęk na igły/krew',
  
  // CZASOWE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  leczenieStomatologiczne: 'Czy jest Pani/Pan w trakcie leczenia stomatologicznego?',
  wypelniaczeSkorneKwasHialuronowy: {
    text: 'Czy korzystała Pani/Pan z wypełniaczy skórnych - kwasu hialuronowego?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?'
  },
  zastrzykiBotoks: {
    text: 'Czy korzystała Pani/Pan z zastrzyków z użyciem botoksu?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?'
  },
  zabiegiChirurgiczneTwarz: {
    text: 'Czy korzystała Pani/Pan z zabiegów chirurgicznych w okolicy twarzy?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?'
  },
  antybiotykoterapia: 'Czy jest Pani/Pan w trakcie stosowania antybiotykoterapii?',
  lekiRozrzedzajaceKrew: 'Czy stosuje Pani/Pan leki rozrzedzające krew? (aspiryna, paracetamol, witamina E, inne)',
  lekiMiejscowe: 'Czy stosuje Pani/Pan leki do aplikacji miejscowej w obszarze objętym zabiegiem?',
  temperaturaPrzeziebienie: 'Czy ma Pani/Pan podniesioną temperaturę ciała lub jest przeziębiona w dniu zabiegu?',
  
  // INNE
  sklonnosciSinceKrwawienie: 'Czy ma Pani/Pan skłonności do sińców lub krwawienia?',
  tatuaze: 'Czy posiada Pani/Pan tatuaże?',
  makijazPermanentny: {
    text: 'Czy posiada Pani/Pan makijaż permanentny?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to kiedy został wykonany i jaką techniką?'
  },
  inneSchorzenia: {
    text: 'Czy posiada Pani/Pan inne schorzenia?',
    hasFollowUp: true,
    followUpPlaceholder: 'Proszę podać jakie'
  },
};

export const modelowanieUstNaturalReactions = [
  'zaczerwienienie',
  'obrzęk',
  'krwawienie',
  'krwiaki',
  'zasinienie',
  'rumień',
  'swędzenie',
  'ból',
  'zgrubienie lub grudki',
  'reakcje alergiczne na wprowadzony preparat',
];

export const modelowanieUstComplications = {
  czeste: [
    'zaczerwienienie',
    'obrzęk',
    'krwawienie',
    'krwiaki',
    'zasinienie',
    'rumień',
    'swędzenie',
    'ból',
    'zgrubienie lub grudki',
    'reakcje alergiczne na wprowadzony preparat',
  ],
  rzadkie: [
    'zakażenie wirusowe',
    'powstanie blizn',
    'reakcje alergiczne',
    'zakażenie bakteryjne',
    'asymetria twarzy',
    'przebarwienia w miejscu iniekcji',
    'infekcja',
    'grudki',
    'reaktywacja opryszczki',
    'świąd',
    'niedokrwienie',
    'zapalenie skóry',
    'pęcherzyki',
    'stwardnienie',
    'obrzęk twarzy',
  ],
  bardzoRzadkie: [
    'bliznowce',
    'martwica',
    'zaburzenia widzenia',
    'zapalenie i obrzęk',
  ],
};

export const modelowanieUstPostCare = [
  'Miejsce poddane zabiegowi traktować ze szczególną ostrożnością',
  'Przez 2 tyg. unikać uciskania i masażu ust',
  'Po zabiegu należy unikać picia alkoholu i palenia papierosów, a także wzmożonego wysiłku fizycznego – przez około 3-7 dni',
  'Zachować wysoką higienę dłoni, istnieje bowiem duże ryzyko wtórnego zakażenia',
  'Nie przemywać wodą, mydłem i środkami złuszczającymi miejsc poddanych zabiegowi przez min. 7 dni',
  'Unikać silnej ekspozycji słonecznej przez 6 tygodni i stosować kremy z wysokim filtrem UV',
  'Nie korzystać z solarium i zabiegów krioterapii przez okres 3 dni',
  'Nie korzystać z sauny, basenu przez okres min. 3 dni',
  'Unikać mechanicznego odrywania strupów',
  'Unikać spożywania gorących napojów, potraw przez okres 4 dni',
  'Przyjmować płyny przez słomkę w pierwszych 5 dniach po zabiegu',
  'Nie używać pomadek, błyszczyków przez okres gojenia się ust',
  'Zachować szczególną higienę jamy ustnej',
  'Nie poddawać się zabiegom mezoterapii oraz iniekcji z zastosowaniem toksyny botulinowej po zabiegu',
  'Nie poddawać się zabiegom peelingu chemicznego i mechanicznego przez okres 3 tygodni od zabiegu',
  'Jeżeli w ciągu 3-6 miesięcy od zabiegu będziesz musiał(a) poddać się badaniu rezonansem magnetycznym - zobowiązujesz się do poinformowania swojego lekarza o wykonanych zabiegach z zastosowaniem kwasu hialuronowego',
];

// WOLUMETRIA_TWARZY - Wolumetria twarzy kwasem hialuronowym
export const wolumetriaTwarzyContraindications: Record<string, string | ContraindicationWithFollowUp> = {
  ciazaLaktacja: 'Czy jest Pani w ciąży lub w okresie laktacji?',
  zapalenieZakazenieSkory: 'Czy ma Pani/Pan zapalenie lub zakażenie skóry (trądzik, opryszczka, zapalenia skórne, alergiczne lub grzybicze zmiany w okolicach podlegających zabiegowi, naczyniaki, liszaje, brodawczaki, przerwania ciągłości naskórka, poparzenia słoneczne?)',
  chorobySerca: 'Czy choruje Pani/Pan na choroby serca?',
  chorobyAutoimmunologiczne: 'Czy choruje Pani/Pan na choroby autoimmunologiczne?',
  cukrzyca: 'Czy choruje Pani/Pan na cukrzycę?',
  chemioterapiaRadioterapia: 'Czy w ciągu ostatniego roku była/był Pan poddawana chemioterapii lub radioterapii?',
  nowotwor: 'Czy choruje Pani/Pan na nowotwór?',
  hivZoltaczka: 'Czy choruje Pani/Pan na HIV lub żółtaczkę?',
  zaburzeniaTarczycy: 'Czy choruje Pani/Pan na zaburzenia pracy tarczycy?',
  luszczycaAktywna: 'Czy choruje Pani/Pan na łuszczycę?',
  epilepsja: 'Czy choruje Pani/Pan na epilepsję?',
  problemyGojenieRan: 'Czy ma Pani/Pan problem/trudności z gojeniem ran?',
  alergiaSkładnikiPreparatu: 'Czy posiada Pani/Pan alergie na składniki preparatu?',
  alergiaZnieczulenie: 'Czy ma Pani/Pan alergie na preparaty stosowane do miejscowego znieczulenia?',
  chorobyImmunologiczne: {
    text: 'Czy choruje Pani/Pan na choroby immunologiczne (reumatoidalne zapalenie stawów, łuszczycowe zapalenie stawów, wrzodziejące zapalenie jelita grubego, chorobę Crohna, zesztywniające zapalenie stawów etc.)',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to jakie?'
  },
  bielactwo: 'Czy choruje Pani/Pan na bielactwo?',
  porfiriaSkorna: 'Czy choruje Pani/Pan na portfirie skórną?',
  podatnoscBlizny: 'Czy ma Pani/Pan podatność na przerost blizn?',
  alkoholNarkotyki: 'Czy w ciągu ostatnich 2 dni przyjmowała Pani/Pan alkohol lub inne środki odurzające?',
  lekiRyzykoKrwawienia: 'Czy stosuje Pani/Pan leki zwiększające ryzyko krwawienia? (aspiryna, paracetamol, witamina E, inne)',
  problemyKrzepliwoscKrwi: 'Czy występują problemy z krzepliwością krwi?',
  
  // WZGLĘDNE PRZECIWSKAZANIA
  problemyKrazeniem: 'Czy ma Pani/Pan problemy z krążeniem?',

  // CZASOWE PRZECIWSKAZANIA
  wypelniaczeSkorneKwasHialuronowy: 'Czy korzystała Pani/Pan z wypełniaczy skórnych - kwasu hialuronowego?',
  zastrzykiBotoks: 'Czy korzystała Pani/Pan z zastrzyków z użyciem botoksu?',
  antybiotykoterapia: 'Czy jest Pani/Pan w trakcie stosowania antybiotykoterapii?',
  lekiMiejscowe: 'Czy stosuje Pani/Pan leki do aplikacji miejscowej w obszarze objętym zabiegiem?',
  temperaturaPrzeziebienie: 'Czy ma Pani/Pan podniesioną temperaturę ciała lub jest przeziębiona w dniu zabiegu?',
  sklonnosciSinceKrwawienie: 'Czy ma Pani/Pan skłonności do sińców lub krwawienia?',

  // INNE
  tatuaze: 'Czy posiada Pani/Pan tatuaże?',
  makijazPermanentny: {
    text: 'Czy posiada Pani/Pan makijaż permanentny?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to kiedy został wykonany i jaką techniką?'
  },
  zabiegiChirurgiczneTwarz: {
    text: 'Czy korzystała Pani/Pan z zabiegów chirurgicznych w okolicy twarzy?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?'
  },
  inneSchorzenia: {
    text: 'Czy posiada Pani/Pan inne schorzenia niewymienione?',
    hasFollowUp: true,
    followUpPlaceholder: 'Proszę podać jakie'
  },
};

export const wolumetriaTwarzyNaturalReactions = [
  'zaczerwienienie',
  'obrzęk',
  'krwawienie',
  'krwiaki',
  'zasinienie',
  'rumień',
  'swędzenie',
  'ból',
  'zgrubienie lub grudki',
  'hiperkorekcja',
];

export const wolumetriaTwarzyComplications = {
  czeste: [
    'zaczerwienienie',
    'obrzęk',
    'krwawienie',
    'krwiaki',
    'zasinienie',
    'rumień',
    'swędzenie',
    'ból',
    'zgrubienie lub grudki',
    'hiperkorekcja',
  ],
  rzadkie: [
    'zakażenie wirusowe',
    'powstanie blizn',
    'reakcje alergiczne',
    'zakażenie bakteryjne',
    'asymetria twarzy',
    'przebarwienia w miejscu iniekcji',
  ],
  bardzoRzadkie: [
    'bliznowce',
    'torbiele',
    'pokrzywka',
    'ziarniaki',
    'martwica',
  ],
};

export const wolumetriaTwarzyPostCare = [
  'Powierzchnię zabiegową przemywać czystą wodą ewentualnie żelem bezmydłowym/tonikiem bezalkoholowym minimum przez 24h od zabiegu',
  'Stosować kosmetyki łagodzące Bepanten, Alantan, Panthenol, Arnika',
  'Unikać aktywności fizycznej minimum 2 dni od zabiegu',
  'Nie zdrapywać strupków',
  'Nie wykonywać zabiegów na partię ciała, która została poddana zabiegowi',
  'Miejsce poddane zabiegowi traktować ze szczególną ostrożnością',
  'Unikać uciskania i masażu miejsca poddanemu zabiegowi oraz twarzy',
  'Zachować wysoką higienę dłoni, istnieje bowiem duże ryzyko wtórnego zakażenia',
  'Nie stosować kosmetyków na obszar objętych zabiegiem przez 2 dni',
  'Delikatnie osuszać skórę ręcznikiem i nie trzeć miejsc poddanych zabiegowi',
  'Unikać silnej ekspozycji słonecznej przez 6 tygodni i stosować kremy z wysokim filtrem UV',
  'Nie korzystać z sauny, basenu przez okres min. 7 dni',
  'Nie poddawać się zabiegom mezoterapii i z zastosowaniem toksyny botulinowej po zabiegu',
  'Nie poddawać się zabiegom peelingu chemicznego i mechanicznego przez okres 3 tygodni od zabiegu',
];

// MEZOTERAPIA_IGLOWA - Mezoterapia igłowa
export const mezoterapiaIglowaNaturalReactions = [
  "miejscowy ból w punktach wkłucia",
  "rumień",
  "obrzęk i szczypanie okolicy po zabiegowej utrzymujący się do tygodnia",
  "zaczerwienienie i/ lub zasinienie okolicy po zabiegowej utrzymujące się do tygodnia",
  "wylewy, krwiaki, siniaki okolicy po zabiegowej utrzymujące się do tygodnia",
  "tkliwość tkanek objętych zabiegiem utrzymująca się do 2 tygodni",
  "swędzenia w okresie gojenia",
];

export const mezoterapiaIglowaComplications = [
  "nawrót infekcji opryszczki",
  "zakażenia wirusowe",
  "zakażenia bakteryjne",
  "reakcje alergiczne",
];

export const mezoterapiaIglowaComplicationsVeryRare = [
  "wylewy krwawe i krwiaki",
];

export const mezoterapiaIglowaPreCare = [
  "Na 7 dni przed zabiegiem nie należy przyjmować leków zmniejszających krzepliwość krwi (np. aspiryny)",
  "Co najmniej 24h przed zabiegiem nie spożywać alkoholu",
  "W dniu zabiegu skóra nie powinna być opalona ani podrażniona",
];

export const mezoterapiaIglowaPostCare = [
  "Stosować zalecony preparat do pielęgnacji domowej (regenerujący/ochronny) ściśle według instrukcji przekazanych przez Specjalistę, przez wskazany okres czasu.",
  "miejsce poddane zabiegowi traktować ze szczególną ostrożnością",
  "zachować wysoką higienę dłoni, istnieje bowiem duże ryzyko wtórnego zakażenia",
  "nie wykonywać makijażu w miejscach objętych zabiegiem przez 24 godz.",
  "nie traktować środkami złuszczającymi miejsc poddanych zabiegowi przez około 14 dni",
  "nie dotykać ani nie masować miejsc poddanych zabiegowi",
  "unikać silnej ekspozycji słonecznej przez 4 tygodnie i stosować kremy z wysokim filtrem UV",
  "nie korzystać z solarium przez okres 4 tygodni",
  "nie korzystać z sauny, basenu przez okres 4 tygodni",
  "unikać długotrwałego przebywania na mrozie",
  "unikać mechanicznego odrywania strupów",
  "unikać spożywania alkoholu przez 24 godziny po zabiegu",
  "nie poddawać się zabiegom peelingu chemicznego i mechanicznego przez okres 3 tygodni od zabiegu",
  "UWAGA!!! Należy stosować się ściśle do zaleceń pozabiegowych!",
  "UWAGA!!! Wystąpienie jakichkolwiek reakcji niepożądanych należy niezwłocznie zgłosić Specjaliście wykonującemu zabieg.",
];

// LIPOLIZA_INIEKCYJNA - Lipoliza iniekcyjna
export const lipolizaIniekcyjnaContraindications: Record<string, string | ContraindicationWithFollowUp> = {
  // BEZWZGLĘDNE
  ciazaLaktacja: 'Czy jest Pani w ciąży lub w okresie laktacji?',
  zapalenieZakazenieSkory: 'Czy ma Pani/Pan zapalenie lub zakażenie skóry (trądzik, opryszczka, zapalenia skórne, alergiczne lub grzybicze zmiany w okolicach podlegających zabiegowi, naczyniaki, liszaje, brodawczaki, przerwania ciągłości naskórka, poparzenia słoneczne?)',
  chorobySerca: 'Czy choruje Pani/Pan na choroby serca?',
  chorobyAutoimmunologiczne: 'Czy choruje Pani/Pan na choroby autoimmunologiczne?',
  cukrzycaZaburzeniamiNaczyniowymi: 'Czy choruje Pani/Pan na cukrzycę z zaburzeniami naczyniowymi?',
  chemioterapiaRadioterapia: 'Czy w ciągu ostatniego roku była /Pan poddawana chemioterapii lub radioterapii?',
  nowotwor: 'Czy choruje Pani/Pan na nowotwór?',
  zoltaczkaChorobyWatrobyNerek: 'Czy choruje Pani/Pan na żółtaczkę lub ciężki choroby wątroby lub nerek?',
  zaburzeniaTarczycy: 'Czy choruje Pani/Pan na zaburzenia pracy tarczycy?',
  epilepsja: 'Czy choruje Pani/Pan na epilepsję?',
  alergiaSkladnikiPreparatu: 'Czy posiada Pani/Pan alergie na składniki preparatu?',
  nadwrazliwoscKwasBenzoesowy: 'Czy posiada Pani/Pan nadwrażliwość na kwas benzoesowy, soję lub witaminę E, B?',
  alergiaZnieczulenie: 'Czy ma Pani/Pan alergie na preparaty stosowane do miejscowego znieczulenia?',
  chorobyImmunologiczne: 'Czy choruje Pani/Pan na choroby immunologiczne?',
  lekiRyzykoKrwawienia: 'Czy stosuje Pani/Pan leki zwiększające ryzyko krwawienia? (aspiryna, paracetamol, witamina E, inne)',
  problemyKrzepliwoscKrwi: 'Czy występują problemy z krzepliwością krwi?',
  zakrzepoweZapalenieZyl: 'Czy choruje Pani/Pan na zakrzepowe zapalenie żył?',
  preparatyIzotretynoina: 'Czy przed upływem ostatnich 3 miesięcy były przyjmowane doustnie preparaty z izotretynoiną? (np. Acnenormin, Roacutan, Izotek, Curacne)?',
  niewydolnoscMarskoscWatroby: 'Czy choruje Pani/Pan na niewydolność lub marskość wątroby bądź inne choroby wątroby?',

  // WZGLĘDNE
  problemyKrazeniem: 'Czy ma Pani/Pan problemy z krążeniem?',

  // CZASOWE
  antybiotykoterapia: 'Czy jest Pani/Pan w trakcie stosowania antybiotykoterapii?',
  lekiMiejscowe: 'Czy stosuje Pani/Pan leki do aplikacji miejscowej w obszarze objętym zabiegiem?',
  temperaturaPrzeziebienie: 'Czy ma Pani/Pan podniesioną temperaturę ciała lub jest przeziębiona w dniu zabiegu?',

  // INNE
  tatuaze: 'Czy posiada Pani/Pan tatuaże?',
  makijazPermanentny: {
    text: 'Czy posiada Pani/Pan makijaż permanentny?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to kiedy został wykonany i jaką techniką?',
  },
  zabiegiKwasHialuronowyToksynaBotulinowa: 'Czy w ciągu ostatnich 6 miesięcy były wykonywane zabiegi z zastosowaniem kwasu hialuronowego lub toksyny botulinowej?',
  zabiegiChirurgiczneTwarz: {
    text: 'Czy korzystała Pani/Pan z zabiegów chirurgicznych w okolicy twarzy?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich?',
  },
  inneSchorzenia: {
    text: 'Czy posiada Pani/Pan inne schorzenia niewymienione, proszę podać jakie:',
    hasFollowUp: true,
    followUpPlaceholder: 'Proszę podać jakie',
  },
};

export const lipolizaIniekcyjnaNaturalReactions = [
  'zaczerwienienie',
  'obrzęk',
  'krwawienie',
  'krwiaki',
  'zasinienie',
  'rumień',
  'swędzenie',
  'ból',
  'zgrubienie lub grudki',
];

export const lipolizaIniekcyjnaComplications = {
  czeste: [
    'zaczerwienienie',
    'obrzęk',
    'krwawienie',
    'krwiaki',
    'zasinienie',
    'rumień',
    'swędzenie',
    'ból',
    'zgrubienie lub grudki',
  ],
  rzadkie: [
    'zakażenie wirusowe',
    'powstanie blizn',
    'reakcje alergiczne',
    'zakażenie bakteryjne',
    'nierówności widoczne na powierzchni skóry',
    'przebarwienia w miejscu iniekcji',
  ],
  bardzoRzadkie: [
    'bliznowce',
    'torbiele',
    'wstrząs',
    'asymetria',
    'martwica',
  ],
};

export const lipolizaIniekcyjnaPreCare = [
  '7 dni przed zabiegiem należy odstawić leki zwiększające ryzyko krwawienia (Aspiryna, Polopiryna, Acard)',
  'ograniczyć spożywanie alkoholu na 24h przed planowanym zabiegiem',
  '7 dni przed zabiegiem spożywać co najmniej 2 l wody dziennie',
];

export const lipolizaIniekcyjnaPostCare = [
  'miejsce poddane zabiegowi traktować ze szczególną ostrożnością',
  'do 24h po zabiegu nie spożywać alkoholu',
  'spożywać co najmniej 2 l wody na dobę',
  'unikać stosowania środków przeciwbólowych hamujących reakcje zapalne',
  'nie zażywać leków zmniejszających krzepliwość krwi, np. Apiryny',
  'nie stosować gorących kąpieli – tylko krótki chłodny prysznic',
  'unikać ekspozycji na słońce i solarium przez ok 4 tyg. po zabiegu',
  'nie stosować inwazyjnych kosmetyków na obszar objętych zabiegiem przez 7 dni',
  'delikatnie osuszać skórę ręcznikiem i nie trzeć',
  'nie korzystać z sauny przez okres min. 14 dni',
  'nie poddawać się zabiegom peelingu chemicznego i mechanicznego przez okres 4 tyg. od zabiegu',
  'UWAGA!!! Należy stosować się ściśle do zaleceń pozabiegowych.',
  'UWAGA!!! Wystąpienie jakichkolwiek reakcji niepożądanych należy niezwłocznie zgłosić Specjaliście wykonującemu zabieg.',
];

// MAKIJAZ_PERMANENTNY - Makijaż permanentny
export const makijazPermanentnyContraindications: Record<string, string | ContraindicationWithFollowUp> = {
  // BEZWZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  ciazaLaktacja: 'Czy jest Pani w ciąży lub w okresie laktacji?',
  chemioterapiaRadioterapia: 'Czy w ciągu ostatniego roku była Pani poddawana chemioterapii lub radioterapii?',
  nowotwor: 'Czy choruje Pani na nowotwór?',
  hivZoltaczka: 'Czy choruje Pani na HIV lub żółtaczkę?',
  luszczycaAktywna: 'Czy choruje Pani na łuszczycę?',
  epilepsja: 'Czy choruje Pani na epilepsję?',
  hemofilia: 'Czy ma Pani stwierdzoną hemofilię?',
  problemyGojenieRan: 'Czy ma Pani problem/trudności z gojeniem ran?',
  alergiaBarwniki: 'Czy posiada Pani alergie na barwniki stosowane do pigmentacji?',
  alergiaZnieczulenie: 'Czy ma Pani alergie na preparaty stosowane do miejscowego znieczulenia?',
  alkoholNarkotyki: 'Czy w ciągu ostatnich 2 dni przyjmowała Pani alkohol lub inne środki odurzające?',
  nadpobudliwoscGalkiOcznej: 'Czy ma Pani nadpobudliwość gałki ocznej?',
  stanyZapalneSpojowekOczu: 'Czy ma Pani stany zapalne spojówek oczu?',
  stwardnienieSiatkowki: 'Czy ma Pani stwardnienie siatkówki?',
  skoraTendencjeKeloidyBlizny: 'Czy ma Pani skórę z tendencjami do keloidów i blizn?',
  lekiPrzeciwzapalne: 'Czy przyjmuje Pani niesteroidowe leki przeciwzapalne?',
  // WZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU
  cukrzyca: 'Czy choruje Pani na cukrzycę?',
  zaburzeniaSerca: 'Czy choruje Pani na zaburzenie pracy serca?',
  anemia: 'Czy ma Pani anemię?',
  problemyKrazeniem: 'Czy ma Pani problemy z krążeniem?',
  chorobyAutoimmunologiczne: 'Czy choruje Pani na choroby autoimmunologiczne?',
  zmianySkorne: 'Czy ma Pani zmiany skórne w obszarze poddawanym zabiegowi (trądzik, stany ropne, alergiczne lub grzybicze zmiany w okolicach podlegających zabiegowi, naczyniaki, liszaje, brodawczaki, przerwania ciągłości naskórka, poparzenia słoneczne)?',
  skoraTlustaPorowata: 'Czy ma Pani skórę tłustą lub porowatą?',
  // CZASOWE PRZECIWWSKAZANIA DO WYKONANIA ZABIEGU
  aktywnaOpryszczka: 'Czy ma Pani aktywną opryszczkę? (ust/oka)',
  leczenieStomatologiczne: 'Czy jest Pani w trakcie leczenia stomatologicznego?',
  peelingChemicznyLaserowy: 'Czy w ciągu 6 miesięcy korzystała Pani z peelingu chemicznego czy laserowego?',
  wypelniaczeSkorneKwasHialuronowy: 'Czy korzystała Pani z wypełniaczy skórnych - kwasu hialuronowego?',
  zastrzykiBotoks: 'Czy korzystała Pani z zastrzyków z botoksu?',
  zabiegiChirurgiczneTwarz: {
    text: 'Czy korzystała Pani z zabiegów chirurgicznych w okolicy twarzy?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to z jakich i kiedy?',
  },
  chorobySkory: 'Czy posiada Pani choroby skóry (łojotokowe/atopowe zapalenie)?',
  kuracjaSterydowa: 'Czy jest Pani w trakcie kuracji sterydowej?',
  antybiotykoterapia: 'Czy jest Pani w trakcie stosowania antybiotykoterapii?',
  lekiRozrzedzajaceKrew: 'Czy stosuje Pani leki rozrzedzające krew? (aspiryna, paracetamol, witamina E, inne)',
  lekiMiejscowe: 'Czy stosuje Pani leki do aplikacji miejscowej w obszarze objętym zabiegiem?',
  zabiegZluszczania: 'Czy w okresie 4 tyg. przed zabiegiem miała Pani zabieg złuszczania naskórka?',
  odzywkiRewitalizacjaBrwiRzesy: 'Czy stosowała Pani odżywki do rewitalizacji, stymulacji wzrostu brwi i rzęs w okresie miesiąca przed zabiegiem?',
  temperaturaPrzeziebienie: 'Czy ma Pani podniesioną temperaturę ciała lub jest przeziębiona w dniu zabiegu?',
  zaburzeniaTarczycy: 'Czy posiada Pani zaburzenia funkcji tarczycy?',
  sklonnosciSinceKrwawienie: 'Czy ma Pani skłonności do sińców lub krwawienia?',
  uczulenieLidokaina: 'Czy posiada Pani uczulenie na lidokainę?',
  tatuaze: 'Czy posiada Pani inne tatuaże?',
  makijazPermanentny: {
    text: 'Czy posiada Pani makijaż permanentny?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeżeli tak, to kiedy został wykonany i jaką techniką?',
  },
  inneSchorzenia: {
    text: 'Inne schorzenia',
    hasFollowUp: true,
    followUpPlaceholder: 'Proszę podać jakie',
  },
};

export const makijazPermanentnyCategoryBreaks: Record<number, string> = {
  0: 'BEZWZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU',
  16: 'WZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU',
  23: 'CZASOWE PRZECIWWSKAZANIA DO WYKONANIA ZABIEGU',
};

export const makijazPermanentnyNaturalReactions = [
  'swędzenia w okresie gojenia',
  'zaczerwienienie',
  'krwawienie',
  'pojawienia się strupów i złuszczania naskórka w miejscu zabiegu',
  'ciemniejszy makijaż w pierwszych dniach po zabiegu',
  'obrzęk',
  'zasinienie',
  'rumień',
];

export const makijazPermanentnyComplications = {
  czeste: [
    'swędzenia w okresie gojenia',
    'zaczerwienienie',
    'krwawienie',
    'pojawienia się strupów i złuszczania naskórka',
    'ciemniejszy makijaż w pierwszych dniach po zabiegu',
    'obrzęk',
    'zasinienie',
    'rumień',
  ],
  rzadkie: [
    'zakażenie wirusowe',
    'powstanie blizn',
    'reakcje alergiczne',
    'zakażenie bakteryjne',
  ],
  bardzoRzadkie: [
    'bliznowce',
    'migracja pigmentu',
  ],
};

export const makijazPermanentnyPostCare = [
  'Miejsce poddane zabiegowi traktować ze szczególną ostrożnością',
  'Obszar zabiegowy należy przecierać wilgotnym wacikiem zmywając warstwę wydzielającego się osocza. Przez pierwsze 3 dni od zabiegu pielęgnujemy skórę na sucho, dopiero po 4 dniach można użyć preparaty łagodzące (np. neomycyna-okolice oczu, linomag-usta brwi) chronimy szczególnie przed kontaktem z wodą',
  'Nie przemywać wodą, mydłem i środkami złuszczającymi lub z zawartością alkoholu miejsc poddanych pigmentacji przez min. tydzień',
  'Zachować wysoką higienę dłoni, istnieje bowiem duże ryzyko wtórnego zakażenia',
  'Unikać ekspozycji słonecznej przez 6 tygodni i stosować kremy z wysokim filtrem UV',
  'Nie korzystać z solarium przez okres 1 tygodnia',
  'Nie korzystać z sauny, basenu przez okres min. 1 tygodnia',
  'Unikać mechanicznego odrywania strupów',
  'W pierwszej dobie po zabiegu unikać gorących napojów, potraw i spożywania alkoholu',
  'Przyjmować płyny przez słomkę w pierwszych dniach po zabiegu (makijaż ust)',
  'Nie używać pomadek, błyszczyków przez okres gojenia się ust (makijaż ust)',
  'Zachować szczególną higienę jamy ustnej (makijaż ust)',
  'Nie poddawać się zabiegom mezoterapii oraz zabiegom z zastosowaniem toksyny botulinowej w okresie 2-3 tygodni po zabiegu',
  'Nie poddawać się zabiegom peelingu chemicznego i mechanicznego przez okres 3 tygodni od zabiegu',
  'Do 3 doby od zabiegu unikać ćwiczeń fizycznych',
  'Do 3 doby od zabiegu unikać stosowania kosmetyków kolorowych oraz kremów pielęgnacyjnych',
  'W przypadku makijażu ust, może pojawić się opryszczka, należy zastosować preparaty: hascovir, zovirax lub udać się do lekarza po receptę na lek heviran',
  'UWAGA!!! Należy stosować się ściśle do zaleceń pozabiegowych. Strupów ani złuszczającego się naskórka nie wolno usuwać mechanicznie.',
  'UWAGA!!! Utrzymujące się reakcje zapalne przez okres dłuższy niż tydzień lub wystąpienie jakichkolwiek reakcji niepożądanych należy niezwłocznie zgłosić do Specjalisty wykonującego zabieg.',
];

// LASEROWE_USUWANIE - Laserowe usuwanie makijażu permanentnego lub tatuażu
export const laseroweUsuwanieContraindications: Record<string, string | ContraindicationWithFollowUp> = {
  ciazaLaktacja: 'Czy jest Pani w ciąży lub w okresie laktacji?',
  zapalenieZakazenieSkory: 'Czy ma Pani/Pan zapalenie lub zakażenie skóry (trądzik, opryszczka, zapalenia skórne, alergiczne lub grzybicze zmiany w okolicach podlegających zabiegowi, naczyniaki, liszaje, brodawczaki, przerwania ciągłości naskórka, poparzenia słoneczne?)',
  chorobySerca: 'Czy choruje Pani/Pan na choroby serca?',
  chorobyAutoimmunologiczne: 'Czy choruje Pani/Pan na choroby autoimmunologiczne?',
  wysokieCisnienieKrwi: 'Czy ma Pani/Pan wysokie ciśnienie krwi?',
  cukrzycaZaburzeniamiNaczyniowymi: 'Czy choruje Pani/Pan na cukrzycę z zaburzeniami naczyniowymi?',
  chemioterapiaRadioterapia: 'Czy w ciągu ostatniego roku była /Pan poddawana chemioterapii lub radioterapii?',
  nowotwor: 'Czy choruje Pani/Pan na nowotwór?',
  zoltaczkaChorobyWatrobyNerek: 'Czy choruje Pani/Pan na żółtaczkę lub ciężkie choroby wątroby lub nerek?',
  zaburzeniaTarczycy: 'Czy choruje Pani/Pan na zaburzenia pracy tarczycy?',
  epilepsja: 'Czy choruje Pani/Pan na epilepsję?',
  chorobyImmunologiczne: 'Czy choruje Pani/Pan na choroby immunologiczne?',
  luszczycaBielactwo: 'Czy choruje Pani/Pan na łuszczycę lub bielactwo?',
  chorobyTkankiLacznej: 'Czy choruje Pani/Pan na choroby tkanki łącznej?',
  problemyKrazeniem: 'Czy ma Pani/Pan problemy z krążeniem?',
  lekiMiejscowe: 'Czy stosuje Pani/Pan leki do aplikacji miejscowej w obszarze objętym zabiegiem?',
  temperaturaPrzeziebienie: 'Czy ma Pani/Pan podniesioną temperaturę ciała lub jest przeziębiona w dniu zabiegu?',
  lekiSwiatlouczulajace: 'Czy przyjmuje Pani/Pan leki światłouczulające lub suplementy diety: nagietek, dziurawiec, pokrzywa, czystek, skrzyp polny',
  lekiAntydepresyjneSterydy: 'Czy przyjmuje Pani/Pan leki antydepresyjne, sterydy?',
  kuracjaAntybiotykowa: 'Czy jest Pani/Pan w trakcie kuracji antybiotykowej w tym retinoidy?',
  leczenieStomatologiczne: 'Czy była Pani/Pan w ciągu ostatniego tygodnia na leczeniu stomatologicznym?',
  inneSchorzenia: {
    text: 'Czy posiada Pani/Pan inne schorzenia niewymienione, proszę podać jakie:',
    hasFollowUp: true,
  },
};

export const laseroweUsuwanieNaturalReactions = [
  'zaczerwienienie',
  'strupki',
  'obrzęk',
  'przebarwienia',
  'odbarwienia',
  'zblednięcie skóry',
  'zmiana struktury',
  'pęcherzyki',
];

export const laseroweUsuwanieComplications = {
  czeste: [
    'zaczerwienienie',
    'strupki',
    'obrzęk',
    'przebarwienia',
    'odbarwienia',
    'zblednięcie skóry',
    'zmiana struktury',
    'pęcherzyki',
  ],
  rzadkie: [
    'reakcje alergiczne',
    'zakażenie bakteryjne',
    'infekcje',
    'bąble opuchnięcia',
    'zmiana koloru włosa na odcień siwy czy biały (w przypadku brwi)',
    'hiperpigmentacja (może wystąpić jako skutek zwiększonej produkcji melaniny przez melanocyty, w odpowiedzi na ciepło generowane przez laser. Ryzyko hiperpigmentacji zależy w dużej mierze od rodzaju skóry, osoby o ciemnej karnacji (fototyp III i IV wg Fitzpatricka) są bardziej narażone na wystąpienie tego powikłania. Klienci z wysokim ryzykiem hiperpigmentacji powinni unikać ekspozycji na słońce przed i po zabiegu)',
    'hipopigmentacja (najczęstszym przewlekłym powikłaniem laseroterapii jest hipopigmentacja, ryzyko wystąpienia tego powikłania jest wyższe u osób o ciemnej karnacji)',
  ],
  bardzoRzadkie: [
    'bliznowce',
  ],
};

export const laseroweUsuwaniePreCare = [
  'zaniechanie ekspozycji na promienie UV (SŁOŃCE, SOLARIUM) – na 1,5 miesiąca przed planowanym zabiegiem',
  '1 tydzień przed zabiegiem nie wykonywać peelingów mechanicznych i depilacji w miejscu, które ma zostać poddane zabiegowi',
  'w dniu zabiegu należy natomiast precyzyjnie ogolić i dokładnie oczyścić skórę',
];

export const laseroweUsuwaniePostCare = [
  'miejsce poddane zabiegowi traktować ze szczególną ostrożnością',
  'nie dotykać ani nie masować miejsc poddanych zabiegowi',
  'zachować wysoką higienę dłoni, istnieje bowiem duże ryzyko wtórnego zakażenia',
  'unikać wzmożonego wysiłku fizycznego oraz gorących kąpieli w wannie',
  'ochładzać powierzchni gdzie był wykonywany zabieg, suchymi okładami',
  'unikać spożywania alkoholu',
  'nie nakładać makijażu w obszarze objętym zabiegiem',
  'pod żadnym pozorem nie należy zdrapywać strupków',
  'nie korzystać z basenu i sauny przez okres wykonywania zabiegów oraz pomiędzy zabiegami. Mycie obszaru na których wykonywano zabieg możliwe jest dopiero po upływie 24 godzin',
  'bezwzględny zakaz opalania na słońcu oraz w solarium przez okres wykonywania zabiegów oraz pomiędzy zabiegami',
  'miejsce poddane zabiegowi należy zabezpieczać kremem z filtrem',
  'zakaz poddawania się zabiegom peelingu chemicznego i mechanicznego',
  'nie stosować toników na bazie alkoholu oraz kremów z kwasami owocowymi i witaminą A,C przez okres 4 tygodni od zabiegu',
  'nie przemywać obszaru objętego zabiegiem preparatami z zawartością alkoholu (dopuszczalny jest Octanisept)',
  'UWAGA!!! Należy stosować się ściśle do zaleceń pozabiegowych.',
  'UWAGA!!! Wystąpienie jakichkolwiek reakcji niepożądanych należy niezwłocznie zgłosić Specjaliście wykonującemu zabieg.',
];

// DEPILACJA_LASEROWA - Depilacja laserowa
export const depilacjaLaserowaContraindications: Record<string, string | ContraindicationWithFollowUp> = {
  ciazaLaktacja: 'Czy jest Pani/Pan w ciąży lub karmi piersią?',
  chorobyNowotworowe: 'Czy choruje Pani/Pan lub chorowała/-ł na choroby nowotworowe?',
  epilepsja: 'Czy choruje Pani/Pan na epilepsję?',
  cukrzycaNiewyrownana: 'Czy choruje Pani/Pan na cukrzycę (szczególnie niewyrównaną)?',
  chorobyHormonalne: 'Czy występują choroby hormonalne (np. tarczyca, PCOS)?',
  chorobyAutoimmunologiczne: 'Czy występują choroby autoimmunologiczne?',
  sklonnoscBliznowce: 'Czy ma Pani/Pan skłonność do powstawania bliznowców (keloidów)?',
  stanyZapalneRanyInfekcje: 'Czy w miejscu zabiegowym występują: stany zapalne, rany, infekcje, choroby skóry?',
  tatuazeZnamionaMakijazPermanentny: 'Czy posiada Pani/Pan tatuaże, znamiona lub makijaż permanentny w obszarze zabiegowym?',
  swiezaOpalenizna: 'Czy w ciągu ostatnich 14 dni była świeża opalenizna (słońce/solarium)?',
  lekiSwiatlouczulajace: 'Czy przyjmuje Pani/Pan leki, zioła lub suplementy światłouczulające?',
  antybiotyki: 'Czy w ciągu ostatnich 14 dni przyjmowała/-ł Pani/Pan antybiotyki?',
  retinoidy: 'Czy stosuje lub stosowała/-ł Pani/Pan retinoidy lub witaminę A?',
  kosmetykiRetinolKwasySamoopalacz: {
    text: 'Czy w ciągu ostatnich 2 tygodni stosowała/-ł Pani/Pan kosmetyki z: retinolem, kwasami, samoopalaczem?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeśli odpowiedź TAK – proszę podać szczegóły...',
  },
  inneChorobyLeki: {
    text: 'Czy choruje Pani/Pan na inne choroby niewymienione powyżej lub przyjmuje na stałe jakiekolwiek leki, zioła bądź suplementy diety (w tym leki dostępne bez recepty)?',
    hasFollowUp: true,
    followUpPlaceholder: 'Jeśli tak, proszę wymienić jakie...',
  },
};

export const depilacjaLaserowaPreCare = [
  '14 dni przed zabiegiem nie opalać się ani nie korzystać z solarium',
  '4–6 tygodni przed zabiegiem nie wyrywać włosów (wosk, depilator, pęseta)',
  'Włosy można usuwać wyłącznie maszynką',
  '14 dni przed zabiegiem nie stosować: leków i ziół światłouczulających, retinoidów, witaminy A, antybiotyków',
  'Nie stosować kosmetyków z retinolem, kwasami i samoopalaczy',
];

export const depilacjaLaserowaPostCare = [
  'Przez minimum 14 dni unikać słońca i stosować SPF 30–50',
  'Przez 24–48 godzin unikać sauny, basenu i gorących kąpieli',
  'Przez kilka dni nie stosować peelingów ani kosmetyków z alkoholem',
  'Między zabiegami usuwać włosy wyłącznie maszynką',
];

export const depilacjaLaserowaNaturalReactions = [
  'Zaczerwienienie',
  'Obrzęk',
  'Pieczenie',
  'Przebarwienia',
  'Strupki',
  'Pęcherze',
];

export const depilacjaLaserowaComplications = {
  czeste: [
    'Zaczerwienienie',
    'Obrzęk',
    'Pieczenie',
  ],
  rzadkie: [
    'Przebarwienia',
    'Strupki',
    'Pęcherze',
  ],
  bardzoRzadkie: [
    'Bliznowce',
  ],
};



// Mapowanie typów na zestawy pytań
export const contraindicationsByFormType: Record<FormType, Record<string, string | ContraindicationWithFollowUp>> = {
  LIP_AUGMENTATION: modelowanieUstContraindications,
  FACIAL_VOLUMETRY: wolumetriaTwarzyContraindications,
  NEEDLE_MESOTHERAPY: mezoterapiaIglowaContraindications,
  INJECTION_LIPOLYSIS: lipolizaIniekcyjnaContraindications,
  PERMANENT_MAKEUP: makijazPermanentnyContraindications,

  LASER_HAIR_REMOVAL: depilacjaLaserowaContraindications,
  LASER_TATTOO_REMOVAL: laseroweUsuwanieContraindications,
  WRINKLE_REDUCTION: wolumetriaTwarzyContraindications,
};

// Zachowanie kompatybilności wstecznej (dla starych importów)
export const defaultContraindications = {};
export const contraindicationLabels = hyaluronicContraindications;

