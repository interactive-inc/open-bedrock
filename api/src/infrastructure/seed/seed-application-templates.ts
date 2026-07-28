type SeedApplicationTemplate = {
  id: number
  code: string
  name: string
  category: string
  description: string | null
  schemaJson: unknown
  approverRoles: ReadonlyArray<string>
}

export const seedApplicationTemplates: ReadonlyArray<SeedApplicationTemplate> = [
  {
    id: 1,
    code: "paid_leave",
    name: "Paid Leave Request",
    category: "attendance",
    description: "Request for paid leave",
    schemaJson: {
      type: "object",
      properties: {
        start_date: { type: "string", format: "date" },
        end_date: { type: "string", format: "date" },
        reason: { type: "string" },
      },
      required: ["start_date", "end_date"],
    },
    approverRoles: ["manager", "root"],
  },
  {
    id: 2,
    code: "expense",
    name: "Expense Reimbursement",
    category: "accounting",
    description: "Request for reimbursement of paid expenses",
    schemaJson: {
      type: "object",
      properties: {
        amount: { type: "number" },
        category: { type: "string" },
        note: { type: "string" },
      },
      required: ["amount", "category"],
    },
    approverRoles: ["manager", "root"],
  },
  {
    id: 3,
    code: "remote_work",
    name: "Remote Work Request",
    category: "attendance",
    description: "Advance request for remote work",
    schemaJson: {
      type: "object",
      properties: {
        date: { type: "string", format: "date" },
        reason: { type: "string" },
      },
      required: ["date"],
    },
    approverRoles: ["manager"],
  },
  {
    id: 4,
    code: "equipment",
    name: "Equipment Purchase Request",
    category: "general_affairs",
    description: "Request to purchase work equipment",
    schemaJson: {
      type: "object",
      properties: {
        item: { type: "string" },
        amount: { type: "number" },
        reason: { type: "string" },
      },
      required: ["item", "amount"],
    },
    approverRoles: ["manager", "root"],
  },
]
