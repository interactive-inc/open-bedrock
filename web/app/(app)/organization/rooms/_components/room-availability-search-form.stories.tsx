import type { Meta, StoryObj } from "@storybook/react-vite"
import { RoomAvailabilitySearchForm } from "@/app/(app)/organization/rooms/_components/room-availability-search-form"

const meta = {
  title: "rooms/RoomAvailabilitySearchForm",
  component: RoomAvailabilitySearchForm,
} satisfies Meta<typeof RoomAvailabilitySearchForm>

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    search: {
      startAt: null,
      endAt: null,
      capacity: null,
    },
  },
}

export const WithFilters: Story = {
  args: {
    search: {
      startAt: "2026-06-12T10:00",
      endAt: "2026-06-12T11:00",
      capacity: 6,
    },
  },
}
