import { testSerialId } from "@system/test/system-test-id.test-support"

/**
 * テストの社員の ID を UUID にそろえる。数字の ID は seed と同じ規則（社員は `01900062-…` に番号の 16 進）で写す。
 * Account と導出の ID は共通の System のテスト部品（system-test-id.test-support）を使う。
 */
export function testEmployeeId(value: number | string): string {
  return testSerialId("01900062", value)
}
