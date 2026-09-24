import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { Survey } from "@/contexts/survey/domain/entities/survey.entity"
import { SurveyResponse } from "@/contexts/survey/domain/entities/survey-response.entity"
import { SurveyRepository } from "@/contexts/survey/infrastructure/repositories/survey.repository"
import type { Context } from "@/env"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"
import { seedD1 } from "@tests/api/support/seed-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "delete-with-responses",
      "delete-guard",
      "update-if-no-responses",
      "findbyid-returns-the-seeded-survey",
      "findbyid-returns-null-for-an-unknown-id",
      "createresponse-then",
      "findresponsebysurveyidandrespondentid-returns",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

async function seedSurveyWithResponse(context: Context): Promise<Survey> {
  const repository = new SurveyRepository(context)

  const survey = await repository.create(
    Survey.create({ title: "Test Survey", status: "open", questionsJson: [{ q: "How are you?" }] }),
  )

  if (survey instanceof Error || survey.id === null) throw new Error("seed survey failed")

  const response = await repository.createResponse(
    SurveyResponse.create({
      surveyId: survey.id,
      respondentId: toWorkforceEmployeeId(1),
      answersJson: { a: "fine" },
      submittedAt: "2026-01-01T00:00:00.000Z",
    }),
  )

  if (response instanceof Error || "reason" in response) throw new Error("seed response failed")

  return survey
}

describe("SurveyRepository on local D1", () => {
  test("deleteWithResponses removes a closed survey and its responses", async () => {
    const { context, db } = await createLocalD1Context(local, "delete-with-responses")

    const survey = await seedSurveyWithResponse(context)

    if (survey.id === null) throw new Error("id should not be null")

    await db.prepare("UPDATE surveys SET status = 'closed' WHERE id = ?1").bind(survey.id).run()

    const repository = new SurveyRepository(context)

    expect(await repository.deleteWithResponses(survey)).toBe(true)
    expect(await repository.findById(survey.id)).toBe(null)
    expect(await repository.countResponsesBySurveyId(survey.id)).toBe(0)
  })

  // D1 の json_extract('', '$') を使ったガード。
  // 親 DELETE が 0 行のとき malformed JSON エラーでバッチを中断し、
  // 後続の survey_responses 削除を防ぐ（レースコンディション対策）。
  test("guard aborts batch so responses survive when survey delete matches no rows", async () => {
    const { context, db } = await createLocalD1Context(local, "delete-guard")

    const survey = await seedSurveyWithResponse(context)

    if (survey.id === null) throw new Error("id should not be null")

    // deleteWithResponses と同一の 3 ステートメント列を直接実行する。
    // 親 DELETE は status != 'open' に一致せず 0 行になり、ガードで中断される。
    let aborted = false

    try {
      await db.batch([
        db.prepare("DELETE FROM surveys WHERE id = ?1 AND status != 'open'").bind(survey.id),
        abortWhenPreviousStatementChangedNoRows(db),
        db.prepare("DELETE FROM survey_responses WHERE survey_id = ?1").bind(survey.id),
      ])
    } catch (error) {
      aborted = isAbortedByGuard(error)
    }

    expect(aborted).toBe(true)

    const repository = new SurveyRepository(context)

    expect(await repository.findById(survey.id)).not.toBe(null)
    expect(await repository.countResponsesBySurveyId(survey.id)).toBe(1)
    expect(await repository.deleteWithResponses(survey)).toEqual({ reason: "not_deletable" })
    expect(await repository.countResponsesBySurveyId(survey.id)).toBe(1)
  })

  test("updateIfNoResponses leaves questions unchanged once a response exists", async () => {
    const { context } = await createLocalD1Context(local, "update-if-no-responses")

    const repository = new SurveyRepository(context)

    const survey = await seedSurveyWithResponse(context)

    const blocked = await repository.updateIfNoResponses(
      survey.withDetails({ title: "Test Survey", status: "open", questionsJson: [{ q: "x" }] }),
    )

    expect(blocked).toBe(null)

    const fresh = await repository.create(
      Survey.create({ title: "Fresh", status: "open", questionsJson: [] }),
    )

    if (fresh instanceof Error) throw fresh

    const updated = await repository.updateIfNoResponses(
      fresh.withDetails({ title: "Fresh", status: "open", questionsJson: [{ q: "New question" }] }),
    )

    if (!(updated instanceof Survey)) throw new Error("expected Survey")

    expect(updated.questionsJson).toEqual([{ q: "New question" }])
  })
})

describe("SurveyRepository", () => {
  test("findById returns the seeded survey", async () => {
    const { context, db } = await createLocalD1Context(local, "findbyid-returns-the-seeded-survey")

    await seedD1(db, "surveys", [
      {
        id: 1,
        title: "従業員満足度調査",
        status: "open",
        questions_json: JSON.stringify([{ id: "q1", label: "満足度" }]),
      },
    ])

    const repository = new SurveyRepository(context)

    const found = await repository.findById(1)

    expect(found).toBeInstanceOf(Survey)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.title).toBe("従業員満足度調査")
    expect(found.status).toBe("open")
  })

  test("findById returns null for an unknown id", async () => {
    const { context } = await createLocalD1Context(local, "findbyid-returns-null-for-an-unknown-id")

    const repository = new SurveyRepository(context)

    const found = await repository.findById(9999)

    expect(found).toBeNull()
  })

  test("createResponse then findResponseBySurveyIdAndRespondentId round-trips the response", async () => {
    const { context, db } = await createLocalD1Context(local, "createresponse-then")

    await seedD1(db, "surveys", [
      {
        id: 1,
        title: "テスト調査",
        status: "open",
        questions_json: JSON.stringify([{ id: "q1", label: "満足度" }]),
      },
    ])

    const repository = new SurveyRepository(context)

    const created = await repository.createResponse(
      SurveyResponse.create({
        surveyId: 1,
        respondentId: toWorkforceEmployeeId(2),
        answersJson: { q1: 5 },
        submittedAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(SurveyResponse)

    if (created instanceof Error || "reason" in created || created.id === null) {
      throw new Error("createResponse failed")
    }

    const found = await repository.findResponseBySurveyIdAndRespondentId(
      1,
      toWorkforceEmployeeId(2),
    )

    expect(found).toBeInstanceOf(SurveyResponse)

    if (found instanceof Error || found === null) {
      throw new Error("findResponseBySurveyIdAndRespondentId failed")
    }

    expect(found.surveyId).toBe(1)
    expect(found.respondentId).toBe(toWorkforceEmployeeId(2))
  })

  test("findResponseBySurveyIdAndRespondentId returns null when none matches", async () => {
    const { context } = await createLocalD1Context(
      local,
      "findresponsebysurveyidandrespondentid-returns",
    )

    const repository = new SurveyRepository(context)

    const found = await repository.findResponseBySurveyIdAndRespondentId(
      9999,
      toWorkforceEmployeeId(9999),
    )

    expect(found).toBeNull()
  })
})
