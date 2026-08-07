import { describe, expect, test } from "bun:test";
import { seedEmployees } from "@/infrastructure/seed/seed-employees";
import { createTestToken } from "@/interface/test-helpers/create-test-token";
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database";
import { loadSchema } from "@/interface/test-helpers/load-schema";
import { requestWithContext } from "@/interface/test-helpers/request-with-context";
import { seedD1 } from "@/interface/test-helpers/seed-d1";
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees";

const jwtSecret = "transition-permissions-test-secret";

/**
 * テスト構成:
 * - employee 5 (member): 被評価者 (owner)
 * - employee 4 (manager): 一次評価者 (primary evaluator) — evaluation:administer なし
 * - employee 6 (member): 二次評価者 (secondary evaluator) — evaluation:administer なし
 * - employee 1 (root): 管理者 (admin) — evaluation:administer あり
 */
async function createTestDb(): Promise<D1Database> {
	const db = createD1TestDatabase(loadSchema());

	await seedD1(
		db,
		"employees",
		seedEmployees.map((employee) => ({
			id: employee.id,
			code: employee.code,
			name: employee.name,
			dept_id: employee.deptId,
			dept_name: employee.deptName,
			position: employee.position,
			status: employee.status,
		})),
	);

	await seedIamForEmployees(db);

	await seedD1(db, "org_memberships", [
		{
			employee_code: seedEmployees[4].code,
			department_code: "D001",
			manager_employee_code: seedEmployees[3].code,
		},
	]);

	return db;
}

function tokenFor(employeeId: number): Promise<string> {
	return createTestToken(jwtSecret, {
		employeeId,
		email: `e${employeeId}@example.com`,
	});
}

async function createSheetWithEvaluators(
	db: D1Database,
	opts?: { secondaryEvaluatorId?: number | null },
): Promise<{ id: number; revision: number }> {
	const token = await createTestToken(jwtSecret, {
		employeeId: 1,
		email: "admin@example.com",
	});

	const secondaryId =
		opts?.secondaryEvaluatorId !== undefined ? opts.secondaryEvaluatorId : 6;

	const response = await requestWithContext({
		db,
		jwtSecret,
		path: "/evaluation-sheets",
		token,
		method: "POST",
		body: {
			employee_id: 5,
			period: "2026-H1",
			primary_evaluator_id: 4,
			...(secondaryId !== null ? { secondary_evaluator_id: secondaryId } : {}),
		},
	});

	if (response.status !== 201) {
		throw new Error(`Failed to create sheet: ${response.status}`);
	}

	return (await response.json()) as { id: number; revision: number };
}

async function transition(
	db: D1Database,
	sheetId: number,
	targetStatus: string,
	expectedRevision: number,
	token: string,
): Promise<Response> {
	return requestWithContext({
		db,
		jwtSecret,
		path: `/evaluation-sheets/${sheetId}/transition`,
		token,
		method: "POST",
		body: {
			status: targetStatus,
			expected_revision: expectedRevision,
		},
	});
}

/** ヘルパー: シートを指定ステータスまで遷移させる */
async function advanceTo(
	db: D1Database,
	sheetId: number,
	revision: number,
	target: string,
): Promise<number> {
	const steps: Array<{ status: string; actor: number }> = [];

	const path: Record<string, Array<{ status: string; actor: number }>> = {
		pending_approval: [{ status: "pending_approval", actor: 5 }],
		approved: [
			{ status: "pending_approval", actor: 5 },
			{ status: "approved", actor: 4 },
		],
		self_eval: [
			{ status: "pending_approval", actor: 5 },
			{ status: "approved", actor: 4 },
			{ status: "self_eval", actor: 5 },
		],
		primary_eval: [
			{ status: "pending_approval", actor: 5 },
			{ status: "approved", actor: 4 },
			{ status: "self_eval", actor: 5 },
			{ status: "primary_eval", actor: 5 },
		],
		secondary_eval: [
			{ status: "pending_approval", actor: 5 },
			{ status: "approved", actor: 4 },
			{ status: "self_eval", actor: 5 },
			{ status: "primary_eval", actor: 5 },
			{ status: "secondary_eval", actor: 4 },
		],
		finalized: [
			{ status: "pending_approval", actor: 5 },
			{ status: "approved", actor: 4 },
			{ status: "self_eval", actor: 5 },
			{ status: "primary_eval", actor: 5 },
			{ status: "secondary_eval", actor: 4 },
			{ status: "finalized", actor: 6 },
		],
	};

	steps.push(...(path[target] ?? []));

	let rev = revision;

	for (const step of steps) {
		const tk = await tokenFor(step.actor);
		const res = await transition(db, sheetId, step.status, rev, tk);

		if (res.status !== 200) {
			const body = await res.text();
			throw new Error(
				`advanceTo failed at ${step.status}: ${res.status} ${body}`,
			);
		}

		const json = (await res.json()) as { revision: number };
		rev = json.revision;
	}

	return rev;
}

// ---------------------------------------------------------------------------
// currentStatus × targetStatus × role マトリクス
// ---------------------------------------------------------------------------
describe("transition permissions matrix", () => {
	// draft → pending_approval: owner only
	test("owner can submit (draft → pending_approval)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const res = await transition(
			db,
			sheet.id,
			"pending_approval",
			sheet.revision,
			await tokenFor(5),
		);
		expect(res.status).toBe(200);
	});

	test("admin cannot submit on behalf of owner (draft → pending_approval)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const res = await transition(
			db,
			sheet.id,
			"pending_approval",
			sheet.revision,
			await tokenFor(1),
		);
		expect(res.status).toBe(403);
	});

	test("primary evaluator cannot submit (draft → pending_approval)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const res = await transition(
			db,
			sheet.id,
			"pending_approval",
			sheet.revision,
			await tokenFor(4),
		);
		expect(res.status).toBe(403);
	});

	// pending_approval → approved: primary evaluator only
	test("primary evaluator can approve (pending_approval → approved)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(
			db,
			sheet.id,
			sheet.revision,
			"pending_approval",
		);
		const res = await transition(
			db,
			sheet.id,
			"approved",
			rev,
			await tokenFor(4),
		);
		expect(res.status).toBe(200);
	});

	test("admin (non-evaluator) cannot approve (pending_approval → approved)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(
			db,
			sheet.id,
			sheet.revision,
			"pending_approval",
		);
		const res = await transition(
			db,
			sheet.id,
			"approved",
			rev,
			await tokenFor(1),
		);
		expect(res.status).toBe(403);
	});

	test("owner cannot approve their own sheet", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(
			db,
			sheet.id,
			sheet.revision,
			"pending_approval",
		);
		const res = await transition(
			db,
			sheet.id,
			"approved",
			rev,
			await tokenFor(5),
		);
		expect(res.status).toBe(403);
	});

	// pending_approval → rejected: primary evaluator only
	test("primary evaluator can reject (pending_approval → rejected)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(
			db,
			sheet.id,
			sheet.revision,
			"pending_approval",
		);
		const res = await transition(
			db,
			sheet.id,
			"rejected",
			rev,
			await tokenFor(4),
		);
		expect(res.status).toBe(200);
	});

	// approved → self_eval: owner only
	test("owner can start self-eval (approved → self_eval)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(db, sheet.id, sheet.revision, "approved");
		const res = await transition(
			db,
			sheet.id,
			"self_eval",
			rev,
			await tokenFor(5),
		);
		expect(res.status).toBe(200);
	});

	test("admin cannot start self-eval on behalf of owner (approved → self_eval)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(db, sheet.id, sheet.revision, "approved");
		const res = await transition(
			db,
			sheet.id,
			"self_eval",
			rev,
			await tokenFor(1),
		);
		expect(res.status).toBe(403);
	});

	// self_eval → primary_eval: owner only
	test("owner can complete self-eval (self_eval → primary_eval)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(db, sheet.id, sheet.revision, "self_eval");
		const res = await transition(
			db,
			sheet.id,
			"primary_eval",
			rev,
			await tokenFor(5),
		);
		expect(res.status).toBe(200);
	});

	// primary_eval → secondary_eval: primary evaluator
	test("primary evaluator can forward to secondary (primary_eval → secondary_eval)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(db, sheet.id, sheet.revision, "primary_eval");
		const res = await transition(
			db,
			sheet.id,
			"secondary_eval",
			rev,
			await tokenFor(4),
		);
		expect(res.status).toBe(200);
	});

	// primary_eval → finalized: primary evaluator only when no secondary
	test("primary evaluator can finalize when no secondary (primary_eval → finalized)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db, {
			secondaryEvaluatorId: null,
		});
		const rev = await advanceTo(db, sheet.id, sheet.revision, "primary_eval");
		const res = await transition(
			db,
			sheet.id,
			"finalized",
			rev,
			await tokenFor(4),
		);
		expect(res.status).toBe(200);
	});

	test("primary evaluator cannot finalize when secondary exists (primary_eval → finalized)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(db, sheet.id, sheet.revision, "primary_eval");
		const res = await transition(
			db,
			sheet.id,
			"finalized",
			rev,
			await tokenFor(4),
		);
		// Entity rejects this transition (primary_eval→finalized requires secondary_eval first when secondary exists)
		// Route should return 403 or entity should return 409
		expect([403, 409]).toContain(res.status);
	});

	// secondary_eval → finalized: secondary evaluator or admin
	test("secondary evaluator can finalize (secondary_eval → finalized)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(db, sheet.id, sheet.revision, "secondary_eval");
		const res = await transition(
			db,
			sheet.id,
			"finalized",
			rev,
			await tokenFor(6),
		);
		expect(res.status).toBe(200);
	});

	test("admin can finalize (secondary_eval → finalized)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(db, sheet.id, sheet.revision, "secondary_eval");
		const res = await transition(
			db,
			sheet.id,
			"finalized",
			rev,
			await tokenFor(1),
		);
		expect(res.status).toBe(200);
	});

	// finalized → reopened/archived: admin only
	test("admin can reopen (finalized → reopened)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(db, sheet.id, sheet.revision, "finalized");
		const res = await transition(
			db,
			sheet.id,
			"reopened",
			rev,
			await tokenFor(1),
		);
		expect(res.status).toBe(200);
	});

	test("non-admin cannot reopen (finalized → reopened)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(db, sheet.id, sheet.revision, "finalized");
		const res = await transition(
			db,
			sheet.id,
			"reopened",
			rev,
			await tokenFor(5),
		);
		expect(res.status).toBe(403);
	});

	test("admin can archive (finalized → archived)", async () => {
		const db = await createTestDb();
		const sheet = await createSheetWithEvaluators(db);
		const rev = await advanceTo(db, sheet.id, sheet.revision, "finalized");
		const res = await transition(
			db,
			sheet.id,
			"archived",
			rev,
			await tokenFor(1),
		);
		expect(res.status).toBe(200);
	});
});

// ---------------------------------------------------------------------------
// createWithAuditLog readback: ID の正当性
// ---------------------------------------------------------------------------
describe("createWithAuditLog readback", () => {
	test("returned id can be used to GET the same sheet", async () => {
		const db = await createTestDb();
		const adminTk = await tokenFor(1);

		const createRes = await requestWithContext({
			db,
			jwtSecret,
			path: "/evaluation-sheets",
			token: adminTk,
			method: "POST",
			body: {
				employee_id: 5,
				period: "2026-H1",
				primary_evaluator_id: 4,
			},
		});

		expect(createRes.status).toBe(201);

		const created = (await createRes.json()) as {
			id: number;
			employee_id: number;
		};

		expect(created.id).toBeGreaterThan(0);
		expect(created.employee_id).toBe(5);

		// GET with the returned ID
		const getRes = await requestWithContext({
			db,
			jwtSecret,
			path: `/evaluation-sheets/${created.id}`,
			token: adminTk,
			method: "GET",
		});

		expect(getRes.status).toBe(200);

		const fetched = (await getRes.json()) as {
			id: number;
			employee_id: number;
		};

		expect(fetched.id).toBe(created.id);
		expect(fetched.employee_id).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// weight sum 検証
// ---------------------------------------------------------------------------
describe("weight sum validation", () => {
	test("rejects goal when total weight would exceed 100%", async () => {
		const db = await createTestDb();
		const adminTk = await tokenFor(1);

		// Create sheet
		const sheetRes = await requestWithContext({
			db,
			jwtSecret,
			path: "/evaluation-sheets",
			token: adminTk,
			method: "POST",
			body: {
				employee_id: 5,
				period: "2026-H1",
				primary_evaluator_id: 4,
			},
		});

		const sheet = (await sheetRes.json()) as { id: number };
		const ownerTk = await tokenFor(5);

		// Create first goal at 60%
		const goal1Res = await requestWithContext({
			db,
			jwtSecret,
			path: "/performance-goals",
			token: ownerTk,
			method: "POST",
			body: {
				period: "2026-H1",
				title: "Goal 1",
				weight: 60,
				evaluation_sheet_id: sheet.id,
			},
		});

		expect(goal1Res.status).toBe(201);

		// Create second goal at 50% — should fail (60 + 50 > 100)
		const goal2Res = await requestWithContext({
			db,
			jwtSecret,
			path: "/performance-goals",
			token: ownerTk,
			method: "POST",
			body: {
				period: "2026-H1",
				title: "Goal 2",
				weight: 50,
				evaluation_sheet_id: sheet.id,
			},
		});

		expect(goal2Res.status).toBe(400);

		const body = (await goal2Res.json()) as { code: string };

		expect(body.code).toBe("weight_exceeded");
	});

	test("allows goals totaling exactly 100%", async () => {
		const db = await createTestDb();
		const adminTk = await tokenFor(1);

		const sheetRes = await requestWithContext({
			db,
			jwtSecret,
			path: "/evaluation-sheets",
			token: adminTk,
			method: "POST",
			body: {
				employee_id: 5,
				period: "2026-H1",
				primary_evaluator_id: 4,
			},
		});

		const sheet = (await sheetRes.json()) as { id: number };
		const ownerTk = await tokenFor(5);

		const goal1Res = await requestWithContext({
			db,
			jwtSecret,
			path: "/performance-goals",
			token: ownerTk,
			method: "POST",
			body: {
				period: "2026-H1",
				title: "Goal 1",
				weight: 60,
				evaluation_sheet_id: sheet.id,
			},
		});

		expect(goal1Res.status).toBe(201);

		const goal2Res = await requestWithContext({
			db,
			jwtSecret,
			path: "/performance-goals",
			token: ownerTk,
			method: "POST",
			body: {
				period: "2026-H1",
				title: "Goal 2",
				weight: 40,
				evaluation_sheet_id: sheet.id,
			},
		});

		expect(goal2Res.status).toBe(201);
	});
});

// ---------------------------------------------------------------------------
// sheet status guard for goal mutations
// ---------------------------------------------------------------------------
describe("sheet status guard for goals", () => {
	test("rejects goal creation when sheet is not in draft/rejected", async () => {
		const db = await createTestDb();
		const adminTk = await tokenFor(1);

		// Create sheet and advance to pending_approval
		const sheetRes = await requestWithContext({
			db,
			jwtSecret,
			path: "/evaluation-sheets",
			token: adminTk,
			method: "POST",
			body: {
				employee_id: 5,
				period: "2026-H1",
				primary_evaluator_id: 4,
			},
		});

		const sheet = (await sheetRes.json()) as { id: number; revision: number };

		// Owner submits → pending_approval
		const ownerTk = await tokenFor(5);
		const submitRes = await transition(
			db,
			sheet.id,
			"pending_approval",
			sheet.revision,
			ownerTk,
		);

		expect(submitRes.status).toBe(200);

		// Try to create a goal on a pending_approval sheet — should fail
		const goalRes = await requestWithContext({
			db,
			jwtSecret,
			path: "/performance-goals",
			token: ownerTk,
			method: "POST",
			body: {
				period: "2026-H1",
				title: "Late goal",
				weight: 10,
				evaluation_sheet_id: sheet.id,
			},
		});

		expect(goalRes.status).toBe(400);

		const body = (await goalRes.json()) as { code: string };

		expect(body.code).toBe("sheet_not_editable");
	});

	test("allows goal creation when sheet is rejected (back to editable)", async () => {
		const db = await createTestDb();
		const adminTk = await tokenFor(1);

		const sheetRes = await requestWithContext({
			db,
			jwtSecret,
			path: "/evaluation-sheets",
			token: adminTk,
			method: "POST",
			body: {
				employee_id: 5,
				period: "2026-H1",
				primary_evaluator_id: 4,
			},
		});

		const sheet = (await sheetRes.json()) as { id: number; revision: number };
		const ownerTk = await tokenFor(5);

		// Submit → pending_approval
		const submitRes = await transition(
			db,
			sheet.id,
			"pending_approval",
			sheet.revision,
			ownerTk,
		);
		const submitted = (await submitRes.json()) as { revision: number };

		// Reject → rejected
		const evaluatorTk = await tokenFor(4);
		const rejectRes = await transition(
			db,
			sheet.id,
			"rejected",
			submitted.revision,
			evaluatorTk,
		);

		expect(rejectRes.status).toBe(200);

		// Now create a goal on rejected sheet — should succeed
		const goalRes = await requestWithContext({
			db,
			jwtSecret,
			path: "/performance-goals",
			token: ownerTk,
			method: "POST",
			body: {
				period: "2026-H1",
				title: "Revised goal",
				weight: 20,
				evaluation_sheet_id: sheet.id,
			},
		});

		expect(goalRes.status).toBe(201);
	});
});
