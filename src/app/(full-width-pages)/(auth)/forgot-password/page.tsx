import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password | Zumbathon",
  description: "Reset your Zumbathon account password",
};

export default function ForgotPassword() {
  return <ForgotPasswordForm />;
}
