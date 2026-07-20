export function greet({ name }: { name: string }): string {
  return `Hello ${name}!`;
}

export default function add({ a, b }: { a: number; b: number }): number {
  return a + b;
}
