import type {
  SystemProposalStatus,
  SystemProposalView,
} from "@system/application/workflow/system-proposal-query"

export function toApplicationStatus(
  status: SystemProposalStatus,
): "pending" | "approved" | "rejected" {
  if (status === "approved" || status === "executed") return "approved"
  if (status === "rejected") return "rejected"
  return "pending"
}

export function toApplicationCurrentStep(proposal: SystemProposalView): string | null {
  if (proposal.status === "returned") return `returned:${proposal.lastTaskKey}`
  return proposal.status === "pending" ? proposal.currentTaskKey : null
}

export function parseSystemApplicationBody(
  proposal: SystemProposalView,
): Readonly<{ value: unknown }> | Error {
  try {
    return { value: JSON.parse(proposal.bodyJson) }
  } catch (cause) {
    return new Error("invalid System proposal body", { cause })
  }
}

export function toSystemStatuses(
  status: "pending" | "approved" | "rejected" | undefined,
): ReadonlyArray<SystemProposalStatus> | null {
  if (status === "pending") return ["pending", "returned"]
  if (status === "approved") return ["approved", "executed"]
  if (status === "rejected") return ["rejected"]
  return null
}
