const TREATMENT_GOAL_SUGGESTIONS: Readonly<Record<string, readonly string[]>> = {
  "modelowanie-ust": [
    "Delikatne powiększenie ust",
    "Nawilżenie ust",
    "Wyrównanie asymetrii ust",
    "Podkreślenie konturu ust",
    "Naturalny i subtelny efekt",
  ],
  "wolumetria-twarzy": [
    "Poprawa owalu twarzy",
    "Wypełnienie ubytków objętości",
    "Redukcja zmarszczek",
    "Poprawa jędrności skóry",
    "Modelowanie policzków, brody lub linii żuchwy",
  ],
  "mezoterapia-iglowa": [
    "Głębokie nawilżenie skóry",
    "Regeneracja i odżywienie skóry",
    "Poprawa elastyczności skóry",
    "Rozświetlenie i wyrównanie kolorytu",
    "Redukcja drobnych zmarszczek",
  ],
  "lipoliza-iniekcyjna": [
    "Redukcja miejscowej tkanki tłuszczowej",
    "Wymodelowanie sylwetki",
    "Redukcja podwójnego podbródka",
    "Wyszczuplenie brzucha, ud lub ramion",
    "Poprawa konturu wybranego obszaru",
  ],
  "makijaz-permanentny": [
    "Trwałe podkreślenie brwi",
    "Korekta koloru i konturu ust",
    "Podkreślenie linii rzęs",
    "Wyrównanie asymetrii",
    "Naturalny i subtelny efekt makijażu",
  ],
  "depilacja-laserowa": [
    "Trwała redukcja owłosienia",
    "Gładka skóra bez konieczności golenia",
    "Ograniczenie wrastających włosków",
    "Zmniejszenie podrażnień po goleniu",
    "Redukcja owłosienia w wybranym obszarze",
  ],
  "usuwanie-tatuazu": [
    "Całkowite usunięcie tatuażu",
    "Rozjaśnienie tatuażu",
    "Przygotowanie tatuażu do cover-upu",
    "Usunięcie makijażu permanentnego",
    "Wyrównanie koloru skóry po zabiegu",
  ],
  "niwelowanie-zmarszczek": [
    "Wygładzenie zmarszczek mimicznych",
    "Redukcja lwiej zmarszczki",
    "Wygładzenie zmarszczek na czole",
    "Redukcja kurzych łapek",
    "Naturalne odmłodzenie wyglądu twarzy",
  ],
  "lifting-powiek": [
    "Napięcie skóry powiek",
    "Uniesienie górnych powiek",
    "Wygładzenie zmarszczek wokół oczu",
    "Poprawa wyglądu okolicy oka",
    "Odmłodzenie spojrzenia",
  ],
  "stymulacja-tkankowa": [
    "Poprawa jędrności i elastyczności skóry",
    "Stymulacja produkcji kolagenu",
    "Głębokie nawilżenie skóry",
    "Poprawa owalu twarzy",
    "Redukcja zmarszczek i oznak starzenia",
  ],
  "farbowanie-rzes-brwi": [
    "Przyciemnienie brwi i rzęs",
    "Podkreślenie kształtu brwi",
    "Naturalne podkreślenie oprawy oka",
    "Wyrównanie koloru brwi",
    "Wyrazistszy wygląd bez makijażu",
  ],
  "przedluzanie-rzes": [
    "Wydłużenie i zagęszczenie rzęs",
    "Naturalny efekt przedłużenia",
    "Wyrazista objętość rzęs",
    "Optyczne otwarcie oka",
    "Podkreślenie oprawy oka",
  ],
  "laminacja-rzes-brwi": [
    "Ułożenie i ujarzmienie brwi",
    "Uniesienie i podkręcenie rzęs",
    "Optyczne zagęszczenie brwi",
    "Podkreślenie naturalnego kształtu",
    "Zdrowy połysk i uporządkowany wygląd",
  ],
  "oczyszczanie-twarzy": [
    "Głębokie oczyszczenie skóry",
    "Redukcja zaskórników",
    "Ograniczenie nadmiaru sebum",
    "Wygładzenie struktury skóry",
    "Odświeżenie i rozświetlenie cery",
  ],
};

export function getTreatmentGoalSuggestions(formCode: string): readonly string[] {
  return TREATMENT_GOAL_SUGGESTIONS[formCode] ?? [];
}

export function filterTreatmentGoalSuggestions(
  suggestions: readonly string[],
  query: string,
  limit = 6,
): string[] {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return [];
  const words = normalizedQuery.split(/\s+/).filter(Boolean);

  return suggestions
    .map((suggestion, index) => ({
      suggestion,
      index,
      normalized: normalizeSearchValue(suggestion),
    }))
    .filter(({ normalized }) => words.every((word) => normalized.includes(word)))
    .sort((left, right) => {
      const leftStarts = left.normalized.startsWith(normalizedQuery) ? 0 : 1;
      const rightStarts = right.normalized.startsWith(normalizedQuery) ? 0 : 1;
      return leftStarts - rightStarts || left.index - right.index;
    })
    .slice(0, limit)
    .map(({ suggestion }) => suggestion);
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLocaleLowerCase("pl-PL")
    .trim();
}
