import { homedir } from "node:os"
import { join } from "node:path"

const CONFIG_DIR = join(homedir(), ".karte")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")
const DEFAULT_BASE_URL = process.env.KARTE_API ?? "http://127.0.0.1:8787"

export type KarteConfig = {
  base_url: string
  token: string | null
}

export async function loadConfig(): Promise<KarteConfig> {
  const file = Bun.file(CONFIG_FILE)
  if (await file.exists()) {
    return (await file.json()) as KarteConfig
  }
  return { base_url: DEFAULT_BASE_URL, token: null }
}

export async function saveConfig(config: KarteConfig): Promise<void> {
  await Bun.write(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`)
}
