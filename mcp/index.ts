import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { apiRequest } from "@/lib/api-client.ts"

const server = new McpServer({
  name: "bedrock",
  version: "0.1.0",
})

// ---------------------------------------------------------------------------
// Performance Goals
// ---------------------------------------------------------------------------

server.tool(
  "performance_goals_list",
  "List performance goals. Supports filtering by period, scope, employee, and department.",
  {
    period: z.string().optional().describe("Filter by evaluation period (e.g. 2025-H1)"),
    scope: z
      .enum(["reports", "department", "all"])
      .optional()
      .describe("Scope of goals to list (default: own goals)"),
    employee_id: z.string().optional().describe("Filter by employee ID (admin)"),
    department_code: z.string().optional().describe("Filter by department code"),
    limit: z.number().optional().describe("Maximum number of results"),
    offset: z.number().optional().describe("Offset for pagination"),
  },
  async ({ period, scope, employee_id, department_code, limit, offset }) => {
    const data = await apiRequest("/performance-goals", {
      query: { period, scope, employee_id, department_code, limit, offset },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "performance_goals_mine",
  "List my own performance goals.",
  {
    limit: z.number().optional().describe("Maximum number of results"),
    offset: z.number().optional().describe("Offset for pagination"),
  },
  async ({ limit, offset }) => {
    const data = await apiRequest("/performance-goals/me", { query: { limit, offset } })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "performance_goals_show",
  "Get a single performance goal by ID.",
  {
    goal_id: z.string().regex(/^\d+$/).describe("The goal ID to retrieve"),
  },
  async ({ goal_id }) => {
    const data = await apiRequest(`/performance-goals/${goal_id}`)

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "performance_goals_tree",
  "Get the goal tree for a period, showing hierarchy of company/department/individual goals.",
  {
    period: z.string().optional().describe("Evaluation period (e.g. 2025-H1)"),
  },
  async ({ period }) => {
    const data = await apiRequest("/performance-goals/tree", { query: { period } })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "performance_goals_create",
  "Create a new performance goal.",
  {
    period: z.string().describe("Evaluation period (e.g. 2025-H1)"),
    title: z.string().describe("Goal title"),
    weight: z.number().optional().describe("Weight of this goal (default: 10)"),
    kpi: z.string().optional().describe("Key performance indicator"),
    owner_type: z
      .enum(["individual", "department", "company"])
      .optional()
      .describe("Goal ownership type (default: individual)"),
    parent_goal_id: z.number().optional().describe("Parent goal ID for hierarchy"),
    department_code: z.string().optional().describe("Department code (for department goals)"),
    evaluation_sheet_id: z.number().optional().describe("Link to evaluation sheet"),
  },
  async ({
    period,
    title,
    weight,
    kpi,
    owner_type,
    parent_goal_id,
    department_code,
    evaluation_sheet_id,
  }) => {
    const data = await apiRequest("/performance-goals", {
      method: "POST",
      json: {
        period,
        title,
        weight,
        kpi,
        owner_type,
        parent_goal_id,
        department_code,
        evaluation_sheet_id,
      },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "performance_goals_update",
  "Update an existing performance goal.",
  {
    goal_id: z.string().regex(/^\d+$/).describe("The goal ID to update"),
    period: z.string().optional().describe("New evaluation period"),
    title: z.string().optional().describe("New title"),
    weight: z.number().optional().describe("New weight"),
    kpi: z.string().optional().describe("New KPI"),
  },
  async ({ goal_id, period, title, weight, kpi }) => {
    const data = await apiRequest(`/performance-goals/${goal_id}`, {
      method: "PUT",
      json: { period, title, weight, kpi },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "performance_goals_delete",
  "Delete a performance goal.",
  {
    goal_id: z.string().regex(/^\d+$/).describe("The goal ID to delete"),
  },
  async ({ goal_id }) => {
    const data = await apiRequest(`/performance-goals/${goal_id}`, { method: "DELETE" })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "performance_goals_evaluate",
  "Submit an evaluation for a performance goal.",
  {
    goal_id: z.string().regex(/^\d+$/).describe("The goal ID to evaluate"),
    kind: z.enum(["self", "manager", "final"]).describe("Evaluation kind"),
    score: z.number().min(0).max(100).describe("Score from 0 to 100"),
    comment: z.string().optional().describe("Evaluation comment"),
  },
  async ({ goal_id, kind, score, comment }) => {
    const data = await apiRequest(`/performance-goals/${goal_id}/evaluations`, {
      method: "POST",
      json: { kind, score, comment },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

// ---------------------------------------------------------------------------
// Evaluation Sheets
// ---------------------------------------------------------------------------

server.tool(
  "evaluation_sheets_list",
  "List evaluation sheets (admin only). Supports filtering by period, status, and employee.",
  {
    period: z.string().optional().describe("Filter by evaluation period"),
    status: z
      .string()
      .optional()
      .describe(
        "Filter by status (draft, pending_approval, approved, self_eval, primary_eval, secondary_eval, finalized, archived)",
      ),
    employee_id: z.string().optional().describe("Filter by employee ID"),
    limit: z.number().optional().describe("Maximum number of results"),
    offset: z.number().optional().describe("Offset for pagination"),
  },
  async ({ period, status, employee_id, limit, offset }) => {
    const data = await apiRequest("/evaluation-sheets", {
      query: { period, status, employee_id, limit, offset },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "evaluation_sheets_mine",
  "List my own evaluation sheets.",
  {
    period: z.string().optional().describe("Filter by evaluation period"),
    status: z.string().optional().describe("Filter by status"),
    limit: z.number().optional().describe("Maximum number of results"),
    offset: z.number().optional().describe("Offset for pagination"),
  },
  async ({ period, status, limit, offset }) => {
    const data = await apiRequest("/evaluation-sheets/me", {
      query: { period, status, limit, offset },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "evaluation_sheets_show",
  "Get a single evaluation sheet by ID. Returns details including status, evaluators, and linked goals.",
  {
    sheet_id: z.string().regex(/^\d+$/).describe("The evaluation sheet ID"),
  },
  async ({ sheet_id }) => {
    const data = await apiRequest(`/evaluation-sheets/${sheet_id}`)

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "evaluation_sheets_create",
  "Create a new evaluation sheet (admin only).",
  {
    employee_id: z.number().describe("Employee ID for the sheet"),
    period: z.string().describe("Evaluation period (e.g. 2025-H1)"),
    template_id: z.number().optional().describe("Evaluation template ID"),
    primary_evaluator_id: z.number().optional().describe("Primary evaluator employee ID"),
    secondary_evaluator_id: z.number().optional().describe("Secondary evaluator employee ID"),
  },
  async ({ employee_id, period, template_id, primary_evaluator_id, secondary_evaluator_id }) => {
    const data = await apiRequest("/evaluation-sheets", {
      method: "POST",
      json: { employee_id, period, template_id, primary_evaluator_id, secondary_evaluator_id },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "evaluation_sheets_transition",
  "Transition an evaluation sheet to a new status. Requires expected_revision for optimistic concurrency.",
  {
    sheet_id: z.string().regex(/^\d+$/).describe("The evaluation sheet ID"),
    status: z
      .enum([
        "pending_approval",
        "approved",
        "rejected",
        "draft",
        "self_eval",
        "primary_eval",
        "secondary_eval",
        "finalized",
        "reopened",
        "archived",
      ])
      .describe("Target status"),
    expected_revision: z.number().describe("Expected revision number for optimistic locking"),
    note: z.string().optional().describe("Note for the transition (e.g. rejection reason)"),
  },
  async ({ sheet_id, status, expected_revision, note }) => {
    const data = await apiRequest(`/evaluation-sheets/${sheet_id}/transition`, {
      method: "POST",
      json: { status, expected_revision, note: note ?? null },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

server.tool(
  "evaluation_sheets_evaluators",
  "Update evaluators for an evaluation sheet (admin only).",
  {
    sheet_id: z.string().regex(/^\d+$/).describe("The evaluation sheet ID"),
    primary_evaluator_id: z.number().describe("Primary evaluator employee ID"),
    secondary_evaluator_id: z.number().optional().describe("Secondary evaluator employee ID"),
    expected_revision: z.number().describe("Expected revision number for optimistic locking"),
  },
  async ({ sheet_id, primary_evaluator_id, secondary_evaluator_id, expected_revision }) => {
    const data = await apiRequest(`/evaluation-sheets/${sheet_id}/evaluators`, {
      method: "PUT",
      json: { primary_evaluator_id, secondary_evaluator_id, expected_revision },
    })

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
  },
)

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport()

await server.connect(transport)
