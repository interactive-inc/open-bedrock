import { expect, test } from "bun:test"
import { isHTTPErrorBody } from "@system/interface/lib/http-error-body/is-http-error-body"

test("公開HTTPエラー本文だけを判別する", () => {
  expect(isHTTPErrorBody({ error: "forbidden", message: "権限がありません。" })).toBeTrue()
  expect(isHTTPErrorBody({ error: "forbidden" })).toBeFalse()
  expect(isHTTPErrorBody(null)).toBeFalse()
})
