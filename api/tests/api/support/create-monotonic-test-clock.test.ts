import { afterEach, expect, test } from "bun:test"
import { createMonotonicTestClock } from "@tests/api/support/create-monotonic-test-clock"

const wallClock = Date.now

afterEach(() => {
  Date.now = wallClock
})

test("実時計が巻き戻っても、前に返した時刻より前を返さない", () => {
  let wall = 1_000
  Date.now = () => wall
  const clock = createMonotonicTestClock()
  expect(clock().getTime()).toBe(1_000)
  wall = 997
  expect(clock().getTime()).toBe(1_000)
  wall = 1_005
  expect(clock().getTime()).toBe(1_005)
})

test("時計ごとに独立して実時計を読む", () => {
  let wall = 2_000
  Date.now = () => wall
  const first = createMonotonicTestClock()
  expect(first().getTime()).toBe(2_000)
  wall = 1_990
  expect(createMonotonicTestClock()().getTime()).toBe(1_990)
  expect(first().getTime()).toBe(2_000)
})
