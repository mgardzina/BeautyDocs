export interface CountryDialCode {
  readonly code: string; // e.g. "+48"
  readonly flag: string; // emoji flag
  readonly label: string; // e.g. "PL"
  /** How many digits total in local number (null = flexible) */
  readonly digits: number | null;
  /** Group sizes for formatting, e.g. [3,3,3] for PL */
  readonly groups: readonly number[];
}

export const COUNTRY_CODES: readonly CountryDialCode[] = [
  // --- Polska na górze ---
  { code: "+48", flag: "🇵🇱", label: "Polska", digits: 9, groups: [3, 3, 3] },

  // --- Europa ---
  { code: "+355", flag: "🇦🇱", label: "Albania", digits: 9, groups: [3, 3, 3] },
  { code: "+376", flag: "🇦🇩", label: "Andora", digits: null, groups: [3, 3, 3] },
  { code: "+43", flag: "🇦🇹", label: "Austria", digits: null, groups: [4, 4, 4] },
  { code: "+375", flag: "🇧🇾", label: "Białoruś", digits: 9, groups: [2, 3, 2, 2] },
  { code: "+32", flag: "🇧🇪", label: "Belgia", digits: null, groups: [3, 2, 2] },
  { code: "+387", flag: "🇧🇦", label: "Bośnia i Hercegowina", digits: 8, groups: [2, 3, 3] },
  { code: "+359", flag: "🇧🇬", label: "Bułgaria", digits: 9, groups: [3, 3, 3] },
  { code: "+385", flag: "🇭🇷", label: "Chorwacja", digits: 9, groups: [3, 3, 3] },
  { code: "+420", flag: "🇨🇿", label: "Czechy", digits: 9, groups: [3, 3, 3] },
  { code: "+45", flag: "🇩🇰", label: "Dania", digits: 8, groups: [2, 2, 2, 2] },
  { code: "+372", flag: "🇪🇪", label: "Estonia", digits: null, groups: [4, 4, 4] },
  { code: "+358", flag: "🇫🇮", label: "Finlandia", digits: null, groups: [3, 4, 4] },
  { code: "+33", flag: "🇫🇷", label: "Francja", digits: 9, groups: [2, 2, 2, 2, 2] },
  { code: "+30", flag: "🇬🇷", label: "Grecja", digits: 10, groups: [3, 3, 4] },
  { code: "+34", flag: "🇪🇸", label: "Hiszpania", digits: 9, groups: [3, 3, 3] },
  { code: "+31", flag: "🇳🇱", label: "Holandia", digits: 9, groups: [3, 3, 3] },
  { code: "+353", flag: "🇮🇪", label: "Irlandia", digits: null, groups: [3, 4, 4] },
  { code: "+354", flag: "🇮🇸", label: "Islandia", digits: 7, groups: [3, 4] },
  { code: "+39", flag: "🇮🇹", label: "Włochy", digits: null, groups: [3, 3, 4] },
  { code: "+7", flag: "🇰🇿", label: "Kazachstan", digits: 10, groups: [3, 3, 4] },
  { code: "+371", flag: "🇱🇻", label: "Łotwa", digits: 8, groups: [2, 3, 3] },
  { code: "+370", flag: "🇱🇹", label: "Litwa", digits: 8, groups: [3, 2, 3] },
  { code: "+352", flag: "🇱🇺", label: "Luksemburg", digits: null, groups: [3, 3, 3] },
  { code: "+389", flag: "🇲🇰", label: "Macedonia Płn.", digits: 8, groups: [2, 3, 3] },
  { code: "+356", flag: "🇲🇹", label: "Malta", digits: 8, groups: [4, 4] },
  { code: "+373", flag: "🇲🇩", label: "Mołdawia", digits: 8, groups: [2, 3, 3] },
  { code: "+377", flag: "🇲🇨", label: "Monako", digits: null, groups: [2, 2, 2, 2] },
  { code: "+49", flag: "🇩🇪", label: "Niemcy", digits: null, groups: [4, 4, 4] },
  { code: "+47", flag: "🇳🇴", label: "Norwegia", digits: 8, groups: [3, 2, 3] },
  { code: "+351", flag: "🇵🇹", label: "Portugalia", digits: 9, groups: [3, 3, 3] },
  { code: "+40", flag: "🇷🇴", label: "Rumunia", digits: 9, groups: [3, 3, 3] },
  { code: "+7", flag: "🇷🇺", label: "Rosja", digits: 10, groups: [3, 3, 4] },
  { code: "+381", flag: "🇷🇸", label: "Serbia", digits: 9, groups: [3, 3, 3] },
  { code: "+421", flag: "🇸🇰", label: "Słowacja", digits: 9, groups: [3, 3, 3] },
  { code: "+386", flag: "🇸🇮", label: "Słowenia", digits: 8, groups: [2, 3, 3] },
  { code: "+41", flag: "🇨🇭", label: "Szwajcaria", digits: 9, groups: [2, 3, 2, 2] },
  { code: "+46", flag: "🇸🇪", label: "Szwecja", digits: null, groups: [3, 3, 4] },
  { code: "+380", flag: "🇺🇦", label: "Ukraina", digits: 9, groups: [3, 3, 3] },
  { code: "+36", flag: "🇭🇺", label: "Węgry", digits: 9, groups: [3, 3, 3] },
  { code: "+44", flag: "🇬🇧", label: "Wielka Brytania", digits: 10, groups: [4, 3, 3] },

  // --- Ameryki ---
  { code: "+54", flag: "🇦🇷", label: "Argentyna", digits: 10, groups: [4, 3, 3] },
  { code: "+55", flag: "🇧🇷", label: "Brazylia", digits: 11, groups: [2, 5, 4] },
  { code: "+1", flag: "🇨🇦", label: "Kanada", digits: 10, groups: [3, 3, 4] },
  { code: "+56", flag: "🇨🇱", label: "Chile", digits: 9, groups: [3, 3, 3] },
  { code: "+57", flag: "🇨🇴", label: "Kolumbia", digits: 10, groups: [3, 3, 4] },
  { code: "+52", flag: "🇲🇽", label: "Meksyk", digits: 10, groups: [3, 3, 4] },
  { code: "+51", flag: "🇵🇪", label: "Peru", digits: 9, groups: [3, 3, 3] },
  { code: "+1", flag: "🇺🇸", label: "USA", digits: 10, groups: [3, 3, 4] },

  // --- Azja ---
  { code: "+880", flag: "🇧🇩", label: "Bangladesz", digits: 10, groups: [4, 3, 3] },
  { code: "+86", flag: "🇨🇳", label: "Chiny", digits: 11, groups: [3, 4, 4] },
  { code: "+91", flag: "🇮🇳", label: "Indie", digits: 10, groups: [5, 5] },
  { code: "+62", flag: "🇮🇩", label: "Indonezja", digits: null, groups: [4, 4, 4] },
  { code: "+81", flag: "🇯🇵", label: "Japonia", digits: 10, groups: [3, 4, 4] },
  { code: "+82", flag: "🇰🇷", label: "Korea Płd.", digits: 10, groups: [3, 4, 4] },
  { code: "+60", flag: "🇲🇾", label: "Malezja", digits: null, groups: [3, 4, 4] },
  { code: "+977", flag: "🇳🇵", label: "Nepal", digits: 10, groups: [3, 4, 3] },
  { code: "+92", flag: "🇵🇰", label: "Pakistan", digits: 10, groups: [3, 3, 4] },
  { code: "+63", flag: "🇵🇭", label: "Filipiny", digits: 10, groups: [3, 4, 4] },
  { code: "+65", flag: "🇸🇬", label: "Singapur", digits: 8, groups: [4, 4] },
  { code: "+66", flag: "🇹🇭", label: "Tajlandia", digits: 9, groups: [3, 3, 3] },
  { code: "+84", flag: "🇻🇳", label: "Wietnam", digits: 10, groups: [4, 3, 3] },

  // --- Bliski Wschód i Afryka Płn. ---
  { code: "+20", flag: "🇪🇬", label: "Egipt", digits: 10, groups: [3, 4, 3] },
  { code: "+972", flag: "🇮🇱", label: "Izrael", digits: 9, groups: [3, 3, 4] },
  { code: "+964", flag: "🇮🇶", label: "Irak", digits: 10, groups: [3, 4, 3] },
  { code: "+98", flag: "🇮🇷", label: "Iran", digits: 10, groups: [3, 4, 3] },
  { code: "+965", flag: "🇰🇼", label: "Kuwejt", digits: 8, groups: [4, 4] },
  { code: "+961", flag: "🇱🇧", label: "Liban", digits: 8, groups: [2, 3, 3] },
  { code: "+212", flag: "🇲🇦", label: "Maroko", digits: 9, groups: [3, 3, 3] },
  { code: "+966", flag: "🇸🇦", label: "Arabia Saudyjska", digits: 9, groups: [3, 3, 3] },
  { code: "+90", flag: "🇹🇷", label: "Turcja", digits: 10, groups: [3, 3, 4] },
  { code: "+971", flag: "🇦🇪", label: "ZEA", digits: 9, groups: [3, 3, 3] },

  // --- Afryka ---
  { code: "+27", flag: "🇿🇦", label: "RPA", digits: 9, groups: [3, 3, 3] },
  { code: "+234", flag: "🇳🇬", label: "Nigeria", digits: 10, groups: [4, 3, 3] },
  { code: "+254", flag: "🇰🇪", label: "Kenia", digits: 9, groups: [3, 3, 3] },
  { code: "+233", flag: "🇬🇭", label: "Ghana", digits: 9, groups: [3, 3, 3] },
  { code: "+251", flag: "🇪🇹", label: "Etiopia", digits: 9, groups: [3, 3, 3] },

  // --- Oceania ---
  { code: "+61", flag: "🇦🇺", label: "Australia", digits: 9, groups: [3, 3, 3] },
  { code: "+64", flag: "🇳🇿", label: "Nowa Zelandia", digits: null, groups: [3, 3, 4] },
];

/** Unique key per entry so duplicate dial codes (e.g. +1 CA/US, +7 RU/KZ) stay distinct. */
export function makeCountryUid(c: CountryDialCode): string {
  return `${c.flag}-${c.code}`;
}

/** Groups raw digits into the country's display pattern, e.g. "500 600 700". */
export function formatPhoneDigits(digits: string, groups: readonly number[]): string {
  let result = "";
  let pos = 0;
  for (let i = 0; i < groups.length; i++) {
    const chunk = digits.slice(pos, pos + groups[i]!);
    if (!chunk) break;
    result += (i > 0 ? " " : "") + chunk;
    pos += groups[i]!;
  }
  // append any remaining digits that don't fit the pattern
  if (pos < digits.length) {
    result += " " + digits.slice(pos);
  }
  return result;
}
