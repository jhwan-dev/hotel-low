type ClassValue = string | number | bigint | null | undefined | false | ClassValue[];

function flatten(input: ClassValue, out: string[]) {
  if (!input && input !== 0) return;
  if (Array.isArray(input)) {
    for (const item of input) flatten(item, out);
    return;
  }
  out.push(String(input));
}

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) flatten(input, out);
  return out.join(" ");
}
