import type { Metadata } from "next"
import { FarmlyAuthExperience } from "@/components/farmly/auth-experience"

export const metadata: Metadata = { title: "My farm dashboard · Farmly.AI", description: "Your farm insights, crop recommendations, weather, and support in one place." }

export default function DashboardPage() {
  return <FarmlyAuthExperience mode="dashboard" />
}
