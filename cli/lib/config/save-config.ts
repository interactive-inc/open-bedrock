import { chmod, mkdir, writeFile } from "node:fs/promises"
import { configPaths } from "@/lib/config/load-config"
import type { KarteConfig } from "@/lib/config/load-config"

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
