import { SoftwareLicenseInputError } from "@/contexts/software-license/interface/errors"

/** 表示した版を指定するclientでは、古い版による上書きを拒否できるようにする。 */
export function parseLicenseRevision(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  if (!/^(?:"\d+"|\d+)$/.test(value))
    throw new SoftwareLicenseInputError({ message: "invalid If-Match" })
  const revision = Number(value.replaceAll('"', ""))
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new SoftwareLicenseInputError({ message: "invalid If-Match" })
  return revision
}
