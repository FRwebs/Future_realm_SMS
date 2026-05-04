import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const activeEnvPath = join(cwd, ".env");
const activeProfilePath = join(cwd, ".env.active");
const profileArg = process.argv[2];

function readEnvFile(path) {
  return readFileSync(path, "utf8");
}

function extractDbKeys(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const match = line.match(/^(DATABASE_URL|DIRECT_URL)=(.*)$/);
    if (!match) continue;
    values.set(match[1], match[2]);
  }
  return values;
}

function replaceEnvKey(source, key, value) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(source)) {
    return source.replace(pattern, `${key}=${value}`);
  }
  return `${source.trimEnd()}\n${key}=${value}\n`;
}

function inferActiveProfile() {
  if (!existsSync(activeEnvPath)) return "unknown";
  const active = extractDbKeys(readEnvFile(activeEnvPath));
  const databaseUrl = active.get("DATABASE_URL");
  const directUrl = active.get("DIRECT_URL");
  for (const profile of ["local", "remote"]) {
    const profilePath = join(cwd, `.env.db.${profile}`);
    if (!existsSync(profilePath)) continue;
    const candidate = extractDbKeys(readEnvFile(profilePath));
    if (candidate.get("DATABASE_URL") === databaseUrl && candidate.get("DIRECT_URL") === directUrl) {
      return profile;
    }
  }
  return "custom";
}

function switchProfile(profile) {
  const profilePath = join(cwd, `.env.db.${profile}`);
  if (!existsSync(profilePath)) {
    throw new Error(`Missing ${profilePath}. Create it from .env.db.${profile}.example first.`);
  }
  if (!existsSync(activeEnvPath)) {
    throw new Error("Missing .env. Create your main environment file first.");
  }

  const activeText = readEnvFile(activeEnvPath);
  const profileValues = extractDbKeys(readEnvFile(profilePath));
  const databaseUrl = profileValues.get("DATABASE_URL");
  const directUrl = profileValues.get("DIRECT_URL");

  if (!databaseUrl || !directUrl) {
    throw new Error(`${profilePath} must contain both DATABASE_URL and DIRECT_URL.`);
  }

  let nextText = replaceEnvKey(activeText, "DATABASE_URL", databaseUrl);
  nextText = replaceEnvKey(nextText, "DIRECT_URL", directUrl);

  writeFileSync(activeEnvPath, nextText);
  writeFileSync(activeProfilePath, `${profile}\n`);

  console.log(`Active database profile: ${profile}`);
}

if (profileArg === "status") {
  console.log(`Current database profile: ${inferActiveProfile()}`);
  process.exit(0);
}

if (profileArg !== "local" && profileArg !== "remote") {
  console.error("Usage: node scripts/switch-db-profile.mjs <local|remote|status>");
  process.exit(1);
}

switchProfile(profileArg);
