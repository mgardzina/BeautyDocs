const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

export function normalizePolishNip(value: string): string {
  return value.replace(/[\s-]/g, "");
}

export function isValidPolishNip(value: string): boolean {
  const nip = normalizePolishNip(value);
  if (!/^\d{10}$/.test(nip)) return false;

  const checksum = NIP_WEIGHTS.reduce(
    (sum, weight, index) => sum + Number(nip[index]) * weight,
    0,
  ) % 11;

  return checksum !== 10 && checksum === Number(nip[9]);
}

export function formatPolishNipInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  return [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
  ]
    .filter(Boolean)
    .join("-");
}
