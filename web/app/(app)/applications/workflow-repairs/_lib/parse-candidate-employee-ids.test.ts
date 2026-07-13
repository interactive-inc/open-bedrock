import { describe, expect, test } from "vite-plus/test"
import { parseCandidateEmployeeIds } from "@/app/(app)/applications/workflow-repairs/_lib/parse-candidate-employee-ids"

describe("parseCandidateEmployeeIds", () => {
  test("parses comma or whitespace separated positive IDs and removes duplicates", () => {
    expect(parseCandidateEmployeeIds("2, 3\n2  4")).toEqual([2, 3, 4])
  })

  test("rejects invalid, empty, or over-limit candidate sets", () => {
    expect(parseCandidateEmployeeIds("")).toBeNull()
    expect(parseCandidateEmployeeIds("1,zero")).toBeNull()
    expect(parseCandidateEmployeeIds("0,2")).toBeNull()
    expect(
      parseCandidateEmployeeIds(Array.from({ length: 21 }, (_, index) => index + 1).join(",")),
    ).toBeNull()
  })
})
