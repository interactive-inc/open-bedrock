import { ApplicationError } from "@/lib/errors"
import { expect } from "bun:test"

// テストで application 層が返したカスタムエラーのクラスと code を検証する。
// instanceof で ApplicationError に絞ってから code を必ず確認する。

/**
 * result が指定クラスのインスタンスで、code が一致することを検証する
 */
export function expectApplicationError(
  result: unknown,
  errorClass: new (...args: never[]) => ApplicationError,
  code: string,
): void {
  expect(result).toBeInstanceOf(errorClass)

  if (result instanceof ApplicationError) {
    expect(result.code).toBe(code)
  }
}
