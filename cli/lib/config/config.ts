import { chmod, mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

const DEFAULT_BASE_URL = process.env.KARTE_API ?? "http://127.0.0.1:8787"

export type KarteConfig = {
  base_url: string
  token: string | null
}

// 設定ディレクトリ/ファイルのパスを都度解決する。
// KARTE_CONFIG_DIR があれば優先（CI・コンテナでの再配置やテスト隔離に使う）。
function configPaths(): { dir: string; file: string } {
  const dir = process.env.KARTE_CONFIG_DIR ?? join(homedir(), ".karte")
  return { dir, file: join(dir, "config.json") }
}

export async function loadConfig(): Promise<KarteConfig> {
  const file = Bun.file(configPaths().file)
  if (await file.exists()) {
    try {
      return (await file.json()) as KarteConfig
    } catch {
      // 設定ファイルが壊れていても CLI を起動できるよう既定値にフォールバックし、
      // raw stack trace でなく警告を stderr に出す。
      process.stderr.write(
        "warning: ~/.karte/config.json を解析できませんでした。既定設定で続行します\n",
      )
      return { base_url: DEFAULT_BASE_URL, token: null }
    }
  }
  return { base_url: DEFAULT_BASE_URL, token: null }
}

export async function saveConfig(config: KarteConfig): Promise<void> {
  const paths = configPaths()
  // 初回ログイン時に ~/.karte が無いと ENOENT になるため先に作成する（dir は 0700）。
  await mkdir(paths.dir, { recursive: true, mode: 0o700 })
  await Bun.write(paths.file, `${JSON.stringify(config, null, 2)}\n`)
  // トークンを含むため所有者のみ読み書き可（0600）にする。
  await chmod(paths.file, 0o600)
}
