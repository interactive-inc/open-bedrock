import { describe, expect, test } from "vite-plus/test"
import { toFormSchema } from "@/lib/application/form-schema"

describe("toFormSchema", () => {
  test("adapts legacy JSON Schema object fields", () => {
    expect(
      toFormSchema({
        type: "object",
        properties: {
          amount: { type: "number", title: "Amount", description: "Before tax" },
          incurred_on: { type: "string", format: "date", title: "Incurred on" },
          category: { type: "string", enum: ["travel", "supplies"] },
          note: { type: "string" },
        },
        required: ["amount", "category"],
      }),
    ).toEqual({
      fields: [
        {
          id: "amount",
          label: "Amount",
          type: "number",
          required: true,
          description: "Before tax",
          options: null,
        },
        {
          id: "incurred_on",
          label: "Incurred on",
          type: "date",
          required: false,
          description: null,
          options: null,
        },
        {
          id: "category",
          label: "category",
          type: "select",
          required: true,
          description: null,
          options: ["travel", "supplies"],
        },
        {
          id: "note",
          label: "note",
          type: "text",
          required: false,
          description: null,
          options: null,
        },
      ],
    })
  })
})
