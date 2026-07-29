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
    name: "有給休暇申請",
    category: "attendance",
    description: "有給休暇の取得を申請します",
    schemaJson: {
      fields: [
        {
          id: "start_date",
          label: "開始日",
          type: "date",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "end_date",
          label: "終了日",
          type: "date",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "reason",
          label: "理由",
          type: "text",
          required: false,
          description: null,
          options: null,
        },
      ],
    },
    approverRoles: ["manager", "root"],
  },
  {
    id: 2,
    code: "expense",
    name: "経費精算申請",
    category: "accounting",
    description: "立て替えた経費の精算を申請します",
    schemaJson: {
      fields: [
        {
          id: "amount",
          label: "金額",
          type: "number",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "category",
          label: "内訳",
          type: "text",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "note",
          label: "備考",
          type: "text",
          required: false,
          description: null,
          options: null,
        },
      ],
    },
    approverRoles: ["manager", "root"],
  },
  {
    id: 3,
    code: "remote_work",
    name: "在宅勤務申請",
    category: "attendance",
    description: "在宅勤務の事前申請をします",
    schemaJson: {
      fields: [
        {
          id: "date",
          label: "対象日",
          type: "date",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "reason",
          label: "理由",
          type: "text",
          required: false,
          description: null,
          options: null,
        },
      ],
    },
    approverRoles: ["manager"],
  },
  {
    id: 4,
    code: "equipment",
    name: "備品購入申請",
    category: "general_affairs",
    description: "業務用備品の購入を申請します",
    schemaJson: {
      fields: [
        {
          id: "item",
          label: "品目",
          type: "text",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "amount",
          label: "金額",
          type: "number",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "reason",
          label: "理由",
          type: "text",
          required: false,
          description: null,
          options: null,
        },
      ],
    },
    approverRoles: ["manager", "root"],
  },
]
