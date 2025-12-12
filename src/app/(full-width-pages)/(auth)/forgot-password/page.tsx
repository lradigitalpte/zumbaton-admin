import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password | Zumbaton",
  description: "Reset your Zumbaton account password",
};

export default function ForgotPassword() {
  return <ForgotPasswordForm />;
}
