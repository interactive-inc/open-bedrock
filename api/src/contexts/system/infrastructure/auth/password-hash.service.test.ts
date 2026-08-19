import { PasswordHashService } from "@/contexts/system/infrastructure/auth/password-hash.service"
import { describe, expect, test } from "bun:test"

const TEST_PEPPER = "test-pepper-fixed-value"

describe("hashPassword", () => {
  test("PBKDF2 形式 (pbkdf2$sha256$<iter>$<salt>$<hash>) で 4 つの $ 区切りを返す", async () => {
    const stored = await PasswordHashService.hash("hunter2", TEST_PEPPER)

    expect(stored.startsWith("pbkdf2$sha256$100000$")).toBe(true)
    expect(stored.split("$").length).toBe(5)
  })

  test("同じ入力でも salt が変わるため毎回違う文字列になる", async () => {
    const first = await PasswordHashService.hash("hunter2", TEST_PEPPER)
    const second = await PasswordHashService.hash("hunter2", TEST_PEPPER)

    expect(first).not.toBe(second)
  })
})

describe("verifyPassword", () => {
  test("hash と同じパスワードを verify すると true", async () => {
    const stored = await PasswordHashService.hash("hunter2", TEST_PEPPER)

    expect(await PasswordHashService.verify("hunter2", stored, TEST_PEPPER)).toBe(true)
  })

  test("違うパスワードは false", async () => {
    const stored = await PasswordHashService.hash("hunter2", TEST_PEPPER)

    expect(await PasswordHashService.verify("hunter3", stored, TEST_PEPPER)).toBe(false)
  })

  test("pepper が違うと false (DB 漏洩しても pepper なしでは突破できない)", async () => {
    const stored = await PasswordHashService.hash("hunter2", TEST_PEPPER)

    expect(await PasswordHashService.verify("hunter2", stored, "different-pepper")).toBe(false)
  })

  test("旧 bcrypt 形式 ($2b$...) は常に false", async () => {
    const legacy = "$2b$10$2wMXD.dXFMSnRxs7TF7fgeatiZHR7o9jZtmo4eqn19D7LSxn1AV82"

    expect(await PasswordHashService.verify("password", legacy, TEST_PEPPER)).toBe(false)
  })

  test("空文字 / 形式不正は false (timing 揃え用の DUMMY 検証など)", async () => {
    expect(await PasswordHashService.verify("anything", "", TEST_PEPPER)).toBe(false)
    expect(await PasswordHashService.verify("anything", "garbage", TEST_PEPPER)).toBe(false)
    expect(await PasswordHashService.verify("anything", "pbkdf2$sha256$x$y", TEST_PEPPER)).toBe(
      false,
    )
  })

  test("セグメント数が想定外 (6 セグメント等) も false", async () => {
    expect(
      await PasswordHashService.verify("p", "pbkdf2$sha256$1000$AAAA$BBBB$CCCC", TEST_PEPPER),
    ).toBe(false)
  })

  test("iter が上限 (2_000_000) を超える保管文字列は false (DoS 防止)", async () => {
    /**
     * 正規 hash の iter 部分だけ書き換える。salt/hash 長は正規のまま。
     */
    const stored = await PasswordHashService.hash("hunter2", TEST_PEPPER)
    const parts = stored.split("$")
    const tampered = `${parts[0]}$${parts[1]}$2000001$${parts[3]}$${parts[4]}`

    expect(await PasswordHashService.verify("hunter2", tampered, TEST_PEPPER)).toBe(false)
  })

  test("salt 長が SALT_BYTES と異なる保管文字列は false", async () => {
    /**
     * salt を 8 byte (本来 16 byte) にした不正データ。
     */
    const shortSaltBase64 = btoa("\x00\x00\x00\x00\x00\x00\x00\x00")
    const validHashBase64 = btoa("\x00".repeat(32))
    const stored = `pbkdf2$sha256$100000$${shortSaltBase64}$${validHashBase64}`

    expect(await PasswordHashService.verify("anything", stored, TEST_PEPPER)).toBe(false)
  })

  test("hash 長が HASH_BYTES と異なる保管文字列は false", async () => {
    const validSaltBase64 = btoa("\x00".repeat(16))
    /**
     * hash を 8 byte (本来 32 byte) にした不正データ。
     */
    const shortHashBase64 = btoa("\x00\x00\x00\x00\x00\x00\x00\x00")
    const stored = `pbkdf2$sha256$100000$${validSaltBase64}$${shortHashBase64}`

    expect(await PasswordHashService.verify("anything", stored, TEST_PEPPER)).toBe(false)
  })

  test("壊れた base64 で構成された保管文字列は false", async () => {
    expect(
      await PasswordHashService.verify("anything", "pbkdf2$sha256$100000$$$$$", TEST_PEPPER),
    ).toBe(false)
  })
})

describe("needsRehash", () => {
  test("PBKDF2 形式 + iter が現行ポリシー (100000) なら false", async () => {
    const stored = await PasswordHashService.hash("hunter2", TEST_PEPPER)

    expect(PasswordHashService.needsRehash(stored)).toBe(false)
  })

  test("旧 bcrypt 形式は true", () => {
    const legacy = "$2b$10$2wMXD.dXFMSnRxs7TF7fgeatiZHR7o9jZtmo4eqn19D7LSxn1AV82"

    expect(PasswordHashService.needsRehash(legacy)).toBe(true)
  })

  test("iter が現行ポリシー未満なら true", () => {
    const lowIter =
      "pbkdf2$sha256$100$AAAAAAAAAAAAAAAAAAAAAA==$BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBA="

    expect(PasswordHashService.needsRehash(lowIter)).toBe(true)
  })

  test("形式不正 (空文字 / garbage) も true", () => {
    expect(PasswordHashService.needsRehash("")).toBe(true)
    expect(PasswordHashService.needsRehash("garbage")).toBe(true)
  })

  test("iter が DoS 上限超 (Number.MAX_SAFE_INTEGER) は parseStored が弾くので true", () => {
    /**
     * iter 上限超は parseStored が null を返す → 形式不正扱いで needsRehash=true。
     */
    const oversized = `pbkdf2$sha256$${Number.MAX_SAFE_INTEGER}$AAAAAAAAAAAAAAAAAAAAAA==$BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBA=`

    expect(PasswordHashService.needsRehash(oversized)).toBe(true)
  })
})
