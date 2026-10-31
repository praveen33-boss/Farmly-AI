import type { Metadata } from "next"
import { FarmlyAuthExperience } from "@/components/farmly/auth-experience"

export const metadata: Metadata = { title: "Set up your farm · Farmly.AI", description: "Personalize Farmly.AI with a few details about you and your farm." }

export default function OnboardingPage() {
  return <FarmlyAuthExperience mode="onboarding" />
}
