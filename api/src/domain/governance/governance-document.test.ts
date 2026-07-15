import { describe, expect, test } from "bun:test"
import { parseGovernanceMarkdown, sha256Hex } from "./governance-document"

const base = `---
id: procedure.access-lifecycle
title: アクセス権変更手続き
kind: procedure
version: 1.0.0
classification: internal
owner_capability: information-security
steward_org_role: ciso
publication:
  mode: direct
audience:
  all_employees: true
procedure:
  execution: sequence
  steps:
    - key: confirm-change
      name: 異動又は退職を確認する
      kind: checklist
      assignee:
        type: department_manager
    - key: revoke-access
      name: アクセス権を変更する
      kind: evidence
      evidence_required: true
      assignee:
        type: org_role
        code: ciso
---
# アクセス権変更手続き

責任者は [[org-role:ciso]] とする。`

describe("parseGovernanceMarkdown", () => {
  test("parses an approval-free procedure and collects stable references", () => {
    const result = parseGovernanceMarkdown(base)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.metadata.procedure?.steps.map((step) => step.kind)).toEqual([
      "checklist",
      "evidence",
    ])
    expect(result.references).toContainEqual({ kind: "capability", code: "information-security" })
    expect(result.references).toContainEqual({ kind: "org_role", code: "ciso" })
  })

  test("rejects an approval publication without approver roles", () => {
    const result = parseGovernanceMarkdown(base.replace("mode: direct", "mode: approval"))
    expect(result).toBeInstanceOf(Error)
  })

  test("rejects duplicate step keys", () => {
    const result = parseGovernanceMarkdown(
      base.replace("key: revoke-access", "key: confirm-change"),
    )
    expect(result).toBeInstanceOf(Error)
  })

  test("parses every governance Markdown original in the repository", async () => {
    const files = new Bun.Glob("{policies,procedures}/**/*.md")
    const parsed: string[] = []
    for await (const relativePath of files.scan("../.docs/governance")) {
      const path = `../.docs/governance/${relativePath}`
      const result = parseGovernanceMarkdown(await Bun.file(path).text())
      expect(result).not.toBeInstanceOf(Error)
      if (!(result instanceof Error)) parsed.push(result.metadata.id)
    }
    expect(parsed.sort()).toEqual([
      "policy.information-security",
      "policy.management-authority",
      "policy.privacy-protection",
      "procedure.access-lifecycle",
      "procedure.privacy-incident-response",
      "procedure.security-incident-response",
    ])
  })
})

test("sha256Hex is deterministic", async () => {
  expect(await sha256Hex("open-karte")).toHaveLength(64)
  expect(await sha256Hex("open-karte")).toBe(await sha256Hex("open-karte"))
})
