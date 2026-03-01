/** Minimum age required to fill out forms */
const MIN_AGE = 16;

/** Returns true if a given year is a leap year */
const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** Returns the max number of days in a given month/year */
const daysInMonth = (month: number, year: number): number => {
  const days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) return 29;
  return days[month] ?? 31;
};

/**
 * Validates a full DD.MM.YYYY date string.
 * Returns null if valid, or a human-readable error string.
 */
export const validateBirthDate = (dateString: string): string | null => {
  if (!dateString || dateString.length !== 10) return null; // incomplete, no error yet

  const parts = dateString.split(".");
  if (parts.length !== 3) return "Nieprawidłowy format daty.";

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);

  if (isNaN(day) || isNaN(month) || isNaN(year))
    return "Nieprawidłowy format daty.";

  if (month < 1 || month > 12)
    return "Miesiąc musi być w zakresie 01–12.";

  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear)
    return `Rok musi być w zakresie 1900–${currentYear}.`;

  const maxDays = daysInMonth(month, year);
  if (day < 1 || day > maxDays)
    return `Dzień musi być w zakresie 01–${String(maxDays).padStart(2, "0")} dla podanego miesiąca.`;

  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

  if (age < MIN_AGE)
    return `Musisz mieć ukończone ${MIN_AGE} lat, aby wypełnić formularz.`;

  return null;
};

export const isAdult = (dateString: string): boolean =>
  validateBirthDate(dateString) === null;

export const getTodayDate = (): string => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  return `${day}.${month}.${year}`;
};

// Format birth date (dd.mm.rrrr) with clamping of day/month
// Format birth date (dd.mm.rrrr) with clamping of day/month
export const formatBirthDate = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    // Clamp day to 01-31
    const day = Number(digits);
    if (digits.length === 2 && day > 31) return "31";
    if (digits.length === 2 && day === 0) return "01";
    return digits;
  }

  const dayPart = digits.slice(0, 2);
  const restPart = digits.slice(2);

  // Clamp day
  const day = Number(dayPart);
  const clampedDay = day === 0 ? "01" : day > 31 ? "31" : dayPart;

  if (digits.length <= 4) {
    const month = Number(restPart);
    if (restPart.length === 2 && month > 12) return `${clampedDay}.12`;
    if (restPart.length === 2 && month === 0) return `${clampedDay}.01`;
    return `${clampedDay}.${restPart}`;
  }

  const monthPart = digits.slice(2, 4);
  const yearPart = digits.slice(4);

  // Clamp month
  const month = Number(monthPart);
  const clampedMonth =
    month === 0 ? "01" : month > 12 ? "12" : monthPart;

  return `${clampedDay}.${clampedMonth}.${yearPart}`;
};

// Calculate age from birth date (format: dd.mm.rrrr)
export const calculateAge = (birthDate: string): number => {
  if (!birthDate || birthDate.length < 10) return 0;
  const parts = birthDate.split(".");
  if (parts.length !== 3) return 0;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year || year < 1900) return 0;
  const today = new Date();
  const birth = new Date(year, month - 1, day);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
};
