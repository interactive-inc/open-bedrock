import type { Meta, StoryObj } from "@storybook/react-vite"
import { AssetKindLabel } from "@/components/asset-kind-label"

const meta = {
  title: "components/AssetKindLabel",
  component: AssetKindLabel,
} satisfies Meta<typeof AssetKindLabel>

export default meta

type Story = StoryObj<typeof meta>

export const Pc: Story = {
  args: { kind: "pc" },
}

export const Monitor: Story = {
  args: { kind: "monitor" },
}

export const Furniture: Story = {
  args: { kind: "furniture" },
}

export const Other: Story = {
  args: { kind: "other" },
}

export const Unknown: Story = {
  args: { kind: "custom_device" },
}
