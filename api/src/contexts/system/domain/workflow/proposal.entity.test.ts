import { describe, expect, test } from "bun:test"
import { zAccountId } from "@system/domain/auth/account-id"
import { InvalidSystemProposalError } from "@system/domain/workflow/invalid-system-proposal.error"
import { Proposal } from "@system/domain/workflow/proposal.entity"

const accountId = zAccountId.parse("account-1")

describe("Proposal", () => {
  test("同じJSON意味を同じcanonical bodyとSHA-256 digestへ固定する", async () => {
    const left = await Proposal.create({
      id: "proposal-1",
      seriesId: "series-1",
      version: 1,
      procedureKey: "change",
      procedureRevision: 3,
      body: { z: 2, a: { y: true, x: null } },
      createdByAccountId: accountId,
      supersedesProposalId: null,
      createdAt: new Date(100),
    })
    const right = await Proposal.create({
      id: "proposal-2",
      seriesId: "series-2",
      version: 1,
      procedureKey: "change",
      procedureRevision: 3,
      body: { a: { x: null, y: true }, z: 2 },
      createdByAccountId: accountId,
      supersedesProposalId: null,
      createdAt: new Date(100),
    })

    expect(left).toBeInstanceOf(Proposal)
    expect(right).toBeInstanceOf(Proposal)
    if (!(left instanceof Proposal) || !(right instanceof Proposal)) return
    expect(left.bodyJson).toBe('{"a":{"x":null,"y":true},"z":2}')
    expect(left.digest).toBe(right.digest)
    expect(left.digest).toMatch(/^[0-9a-f]{64}$/)
  })

  test("restore時にbody差替えとdigest不一致を拒否する", async () => {
    const result = await Proposal.restore({
      id: "proposal-1",
      seriesId: "series-1",
      version: 1,
      procedureKey: "change",
      procedureRevision: 1,
      bodyJson: '{"safe":true}',
      digest: "a".repeat(64),
      createdByAccountId: accountId,
      supersedesProposalId: null,
      createdAt: new Date(100),
    })

    expect(result).toBeInstanceOf(InvalidSystemProposalError)
    if (result instanceof InvalidSystemProposalError) expect(result.code).toBe("digest_mismatch")
  })

  test("版とsupersedesのshapeを検査する", async () => {
    const result = await Proposal.create({
      id: "proposal-1",
      seriesId: "series-1",
      version: 0,
      procedureKey: "change",
      procedureRevision: 1,
      body: {},
      createdByAccountId: accountId,
      supersedesProposalId: "",
      createdAt: new Date(100),
    })

    expect(result).toBeInstanceOf(InvalidSystemProposalError)
  })
})
