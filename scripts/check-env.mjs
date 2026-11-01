// npm run env:check: list the variables .env.local sets without revealing
// them. Long values show only their first and last 4 characters (enough to
// tell which key it is); shorter ones are hidden completely. Lines that aren't
// NAME=value are skipped without printing them, so a stray secret never shows.
import { existsSync, readFileSync } from "node:fs";

const file = process.argv[2] ?? ".env.local";
if (!existsSync(file)) {
  console.log(`${file} not found, so no variables are set locally.`);
  process.exit(1);
}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const REVEAL_FROM = 20; // shorter values would give away too much of themselves

function mask(value) {
  if (!value) return "(empty)";
  if (value.length < REVEAL_FROM) return `(hidden, ${value.length} characters)`;
  return `${value.slice(0, 4)}...${value.slice(-4)} (${value.length} characters)`;
}

const lines = readFileSync(file, "utf8").split(/\r?\n/);
let count = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  const name =
    eq === -1
      ? ""
      : line
          .slice(0, eq)
          .replace(/^export\s+/, "")
          .trim();
  if (!NAME.test(name)) {
    console.log(`(skipped line ${i + 1}: not NAME=value)`);
    continue;
  }
  let value = line.slice(eq + 1).trim();
  const quote = value[0];
  if (quote === '"' || quote === "'") {
    // A quoted value can span lines (a PEM key, say): read up to its closing quote.
    while (
      !(value.length > 1 && value.endsWith(quote)) &&
      i + 1 < lines.length
    ) {
      value += "\n" + lines[++i];
    }
    value = value.endsWith(quote) ? value.slice(1, -1) : value.slice(1);
  } else {
    value = value.replace(/\s+#.*$/, "");
  }
  console.log(`${name}=${mask(value)}`);
  count++;
}
console.log(`${count} variable${count === 1 ? "" : "s"} in ${file}`);
