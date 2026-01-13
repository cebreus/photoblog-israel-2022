import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createLogger } from "./lib/core/cli-logger";

const CS_MESSAGES_PATH = "messages/cs.json";
const EN_MESSAGES_PATH = "messages/en.json";
const logger = createLogger("migrate");

function run() {
  if (!existsSync(CS_MESSAGES_PATH)) {
    logger.error({}, `Error: ${CS_MESSAGES_PATH} not found.`);
    process.exit(1);
  }

  const csContent = readFileSync(CS_MESSAGES_PATH, "utf-8");
  const csMessages = JSON.parse(csContent);

  let enMessages: Record<string, string> = {};
  if (existsSync(EN_MESSAGES_PATH)) {
    const enContent = readFileSync(EN_MESSAGES_PATH, "utf-8");
    enMessages = JSON.parse(enContent);
  }

  let updated = false;

  // Check for missing keys in English
  for (const key in csMessages) {
    if (!enMessages[key]) {
      logger.info({}, `Adding missing key to English: ${key}`);
      enMessages[key] = csMessages[key]; // Copy Czech as placeholder
      updated = true;
    }
  }

  if (updated) {
    writeFileSync(EN_MESSAGES_PATH, JSON.stringify(enMessages, null, 2));
    logger.info({}, `Updated ${EN_MESSAGES_PATH}`);
  } else {
    logger.info({}, "English messages are up to date.");
  }
}

run();
