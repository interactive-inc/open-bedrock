/** 不採用へ遷移できるか（hired/rejected 以外なら可）。 */
export function canReject(stage: string): boolean {
  return stage !== "hired" && stage !== "rejected"
}
