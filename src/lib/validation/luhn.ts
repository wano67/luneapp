export function luhnCheck(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let toggle = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (toggle) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    toggle = !toggle;
  }
  return sum % 10 === 0;
}
