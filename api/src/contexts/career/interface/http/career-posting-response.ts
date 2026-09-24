import type { CareerPosting } from "@/contexts/career/domain/entities/career-posting.entity"
import { CareerOrganizationUnitAdapter } from "@/contexts/career/infrastructure/adapters/career-organization-unit.adapter"
import { zAppCareerPosting } from "@/contexts/career/interface/http/response-schemas"
import type { Context } from "@/env"
import { UnavailableError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import type { z } from "zod"

/** 単一の公募をレスポンス用に整形する。 */
export async function toCareerPostingResponse(
  c: Context,
  posting: CareerPosting,
): Promise<z.infer<typeof zAppCareerPosting>> {
  const [responseBody] = await toCareerPostingResponses(c, [posting])
  if (responseBody === undefined) throw new Error("career posting response is missing")
  return responseBody
}

/**
 * 公募をレスポンス用の snake_case に整形し、募集部署の表示名を Company の組織から解決する。
 * 組織単位を参照する公募があるのに組織を読めないときは、名前を空にせず 503 で失敗する。
 */
export async function toCareerPostingResponses(
  c: Context,
  postings: ReadonlyArray<CareerPosting>,
): Promise<Array<z.infer<typeof zAppCareerPosting>>> {
  const needsNames = postings.some((posting) => posting.organizationUnitId !== null)
  const units = needsNames ? await new CareerOrganizationUnitAdapter(c).load() : null

  if (units instanceof Error) {
    throw toHttpException(
      new UnavailableError("failed to resolve organization unit", "organization_unavailable", {
        cause: units,
      }),
    )
  }

  return postings.map((posting) =>
    zAppCareerPosting.parse({
      id: posting.id,
      title: posting.title,
      organization_unit_id: posting.organizationUnitId,
      organization_unit_name:
        posting.organizationUnitId === null || units === null
          ? null
          : units.nameOf(posting.organizationUnitId),
      legacy_dept_name: posting.legacyDeptName,
      required_skills: posting.requiredSkills,
      status: posting.status,
    }),
  )
}
