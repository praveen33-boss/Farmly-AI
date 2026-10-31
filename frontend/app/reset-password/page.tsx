import type { Metadata } from "next"
import { FarmlyAuthExperience } from "@/components/farmly/auth-experience"

export const metadata: Metadata = { title: "Reset your password · Farmly.AI", description: "Choose a new password for the Farmly.AI demo flow." }

export default function ResetPasswordPage() {
  return <FarmlyAuthExperience mode="reset-password" />
}
