import MFAVerificationForm from "@/components/auth/MFAVerificationForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "MFA Verification | Zumbathon",
  description: "Enter your verification code",
};

export default function MFAPage() {
  return <MFAVerificationForm />;
}
