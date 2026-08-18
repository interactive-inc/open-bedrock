import type {
  WorkforceInvariantCode,
  WorkforceInvariantViolation,
} from "@/contexts/company/domain/workforce/workforce-invariant"

export function createWorkforceInvariantViolation(
  code: WorkforceInvariantCode,
  message: string,
): WorkforceInvariantViolation {
  return { code, message }
}
