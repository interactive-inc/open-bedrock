import { homedir } from "node:os"
import { join } from "node:path"

const DEFAULT_BASE_URL = process.env.KARTE_API ?? "http://127.0.0.1:18787"

export type KarteConfig = {
  base_url: string
  token: string | null
  refresh_token: string | null
}

/**
 * 設定ディレクトリ/ファイルのパスを都度解決する。
 * KARTE_CONFIG_DIR があれば優先（CI・コンテナでの再配置やテスト隔離に使う）。
 */
export function configPaths(): { dir: string; file: string } {
  const dir = process.env.KARTE_CONFIG_DIR ?? join(homedir(), ".karte")
  return { dir, file: join(dir, "config.json") }
}

export async function loadConfig(): Promise<KarteConfig> {
  const file = Bun.file(configPaths().file)
  if (await file.exists()) {
    try {
      return (await file.json()) as KarteConfig
    } catch (error) {
      // JSON パース失敗のみ既定値にフォールバックする。読み取り権限・I/O エラーは
      // 「JSON 解析失敗」と誤表示して握り潰さないよう、そのまま伝播させる。
      if (error instanceof SyntaxError === false) {
        throw error
      }

      // 壊れた設定でも CLI を起動できるよう既定値で続行し、raw stack trace でなく警告を出す。
      process.stderr.write(
        `warning: ${configPaths().file} を解析できませんでした。既定設定で続行します\n`,
      )
      return { base_url: DEFAULT_BASE_URL, token: null, refresh_token: null }
    }
  }
  return { base_url: DEFAULT_BASE_URL, token: null, refresh_token: null }
}
