import { describe, expect, test } from "bun:test"
import { AccountTokenCollectionValue } from "@/contexts/system/domain/auth/account-token-collection.value"

describe("AccountTokenCollectionValue", () => {
  test("同じ user の古い token を置換し、最新を先頭へ置く", () => {
    expect(
      AccountTokenCollectionValue.upsert(
        [
          { userId: "u1", token: "old" },
          { userId: "u2", token: "two" },
        ],
        { userId: "u1", token: "new" },
      ),
    ).toEqual(["new", "two"])
  })

  test("上限件数で切り詰める", () => {
    expect(
      AccountTokenCollectionValue.upsert(
        [
          { userId: "u1", token: "one" },
          { userId: "u2", token: "two" },
        ],
        { userId: "u3", token: "three" },
        2,
      ),
    ).toEqual(["three", "one"])
  })

  test("指定 token だけを取り除く", () => {
    expect(AccountTokenCollectionValue.remove(["one", "two"], "one")).toEqual(["two"])
  })

  test("Cookie 文字列を token 配列へ戻す", () => {
    expect(AccountTokenCollectionValue.parse("one,,two")).toEqual(["one", "two"])
    expect(AccountTokenCollectionValue.parse(undefined)).toEqual([])
  })
})
