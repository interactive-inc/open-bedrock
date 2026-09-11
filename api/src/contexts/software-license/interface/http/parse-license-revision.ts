import { SoftwareLicenseInputError } from "@/contexts/software-license/interface/errors"

/** 表示した契約の版を必須とし、未確認の変更を拒否する。 */
export function parseLicenseRevision(value: string | undefined): number {
  if (value === undefined) throw new SoftwareLicenseInputError({ message: "required If-Match" })
  if (!/^(?:"\d+"|\d+)$/.test(value))
    throw new SoftwareLicenseInputError({ message: "invalid If-Match" })
  const revision = Number(value.replaceAll('"', ""))
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new SoftwareLicenseInputError({ message: "invalid If-Match" })
  return revision
}
