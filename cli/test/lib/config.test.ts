import { loadConfig, saveConfig } from "@/lib/config/config"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

// config は KARTE_CONFIG_DIR を実行時に参照するので、一時ディレクトリへ隔離して検証する。
// （os.homedir() は Bun が起動時にキャッシュするため実行時の HOME 変更では隔離できない）
describe("config", () => {
  let originalConfigDir: string | undefined

  let tempDir: string

  beforeEach(async () => {
    originalConfigDir = process.env.KARTE_CONFIG_DIR
    tempDir = await mkdtemp(join(tmpdir(), "karte-config-"))
    process.env.KARTE_CONFIG_DIR = tempDir
  })

  afterEach(async () => {
    if (originalConfigDir === undefined) {
      delete process.env.KARTE_CONFIG_DIR
    } else {
      process.env.KARTE_CONFIG_DIR = originalConfigDir
    }

    await rm(tempDir, { recursive: true, force: true })
  })

  test("saveConfig creates the directory and writes the file with 0600 perms", async () => {
    await saveConfig({ base_url: "http://example.test", token: "secret-token" })

    const fileStat = await stat(join(tempDir, "config.json"))

    // 所有者のみ読み書き可（world-readable にしない）。
    expect(fileStat.mode & 0o777).toBe(0o600)

    const loaded = await loadConfig()

    expect(loaded.base_url).toBe("http://example.test")
    expect(loaded.token).toBe("secret-token")
  })

  test("saveConfig re-hardens an existing world-readable file to 0600", async () => {
    // 旧 CLI・復元・手動作成などで緩い権限のファイルが先に存在するケースを再現する。
    await mkdir(tempDir, { recursive: true })

    const file = join(tempDir, "config.json")

    await writeFile(file, "{}\n")
    await chmod(file, 0o644)

    await saveConfig({ base_url: "http://example.test", token: "secret-token" })

    const fileStat = await stat(file)

    expect(fileStat.mode & 0o777).toBe(0o600)
  })

  test("loadConfig returns defaults when the file does not exist", async () => {
    const loaded = await loadConfig()

    expect(loaded.token).toBeNull()
  })

  test("loadConfig falls back to defaults on malformed JSON", async () => {
    await mkdir(tempDir, { recursive: true })

    await Bun.write(join(tempDir, "config.json"), "{ this is not valid json")

    const loaded = await loadConfig()

    expect(loaded.token).toBeNull()
  })
})
