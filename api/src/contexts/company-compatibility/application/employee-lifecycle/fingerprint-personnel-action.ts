import type { PersonnelActionInput } from "@/contexts/company-compatibility/domain/employee-lifecycle/lifecycle-types"
import { lifecycleSha256 } from "@/contexts/company-compatibility/application/employee-lifecycle/lifecycle-sha256"
import { stableLifecycleJson } from "@/contexts/company-compatibility/application/employee-lifecycle/stable-lifecycle-json"

/**
 * 人事発令入力のフィンガープリント。冪等性判定で申請内容の同一性を照合する純粋関数
 */
export function fingerprintPersonnelAction(
  employeeId: number | string,
  input: PersonnelActionInput,
): Promise<string> {
  return lifecycleSha256(stableLifecycleJson({ employeeId, input }))
}
