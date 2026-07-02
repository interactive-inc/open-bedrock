import { chmod, mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

const DEFAULT_BASE_URL = process.env.KARTE_API ?? "http://127.0.0.1:8787"

export type KarteConfig = {
  base_url: string
  token: string | null
  refresh_token: string | null
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

export async function saveConfig(config: KarteConfig): Promise<void> {
  const paths = configPaths()
  // 初回ログイン時に ~/.karte が無いと ENOENT になるため先に作成する（dir は 0700）。
  await mkdir(paths.dir, { recursive: true, mode: 0o700 })
  // トークンを含むため、作成時点から所有者のみ読み書き可（0600）にする。
  // Bun.write + 後追い chmod だと作成〜chmod の間に world-readable な TOCTOU 窓があった。
  await writeFile(paths.file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  // writeFile / mkdir の mode は新規作成時のみ有効で、既存ファイル・既存ディレクトリの
  // パーミッションは据え置かれる。緩い権限で先に存在していたケースでも確実に締めるため、
  // 書き込み後に明示的に chmod する（排他書き込み直後なので新たな TOCTOU リスクはない）。
  await chmod(paths.dir, 0o700)
  await chmod(paths.file, 0o600)
}
