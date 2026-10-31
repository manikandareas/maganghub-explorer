import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

export function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find(value => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

export function integerArgument(name: string, fallback: number, maximum = 10000): number {
  const value = Number(argument(name) ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`--${name} harus 1-${maximum}`);
  return value;
}

export function reportError(error: unknown) {
  // Provider/driver errors may contain credentials or request bodies. Log only safe classifications.
  const detail = error instanceof Error ? error.name : "UnknownError";
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
  const safeMessage = error instanceof Error && ["ServiceError", "AssertionError"].includes(error.name) ? error.message : "Operasi gagal; kredensial dan payload tidak dicetak.";
  console.error(JSON.stringify({ event: "failed", type: detail, code, message: safeMessage }));
  process.exitCode = 1;
}
