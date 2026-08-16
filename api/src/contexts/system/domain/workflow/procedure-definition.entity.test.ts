import { describe, expect, test } from "bun:test"
import { zAccountId } from "@system/domain/auth/account-id"
import { InvalidSystemProposalError } from "@system/domain/workflow/invalid-system-proposal.error"
import { ProcedureDefinition } from "@system/domain/workflow/procedure-definition.entity"

const accountId = zAccountId.parse("account-1")

describe("ProcedureDefinition", () => {
  test("入力契約と判断方針をcanonical JSONへ固定する", () => {
    const definition = ProcedureDefinition.create({
      key: "change",
      revision: 1,
      title: "Change",
      category: "operation",
      description: null,
      inputSchema: { required: ["reason"], type: "object" },
      decisionPolicy: { steps: [{ key: "review", owner: "authority" }] },
      completionOperationKey: "apply-change",
      createdByAccountId: accountId,
      createdAt: new Date(100),
    })

    expect(definition).toBeInstanceOf(ProcedureDefinition)
    if (!(definition instanceof ProcedureDefinition)) return
    expect(definition.inputSchemaJson).toBe('{"required":["reason"],"type":"object"}')
    expect(definition.decisionPolicyJson).toBe('{"steps":[{"key":"review","owner":"authority"}]}')
  })

  test("不正なkeyと時刻を拒否する", () => {
    const definition = ProcedureDefinition.create({
      key: "Invalid Key",
      revision: 1,
      title: "Change",
      category: "operation",
      description: null,
      inputSchema: {},
      decisionPolicy: {},
      completionOperationKey: null,
      createdByAccountId: accountId,
      createdAt: new Date(Number.NaN),
    })

    expect(definition).toBeInstanceOf(InvalidSystemProposalError)
  })
})
