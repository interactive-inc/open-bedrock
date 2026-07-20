import { ApplicationError } from "@/lib/errors"
import { expect } from "bun:test"

/**
 * テストで application 層が返したカスタムエラーを検証する。
 * result が指定クラスのインスタンスであることを instanceof で絞ってから、code の一致を必ず確認する
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
