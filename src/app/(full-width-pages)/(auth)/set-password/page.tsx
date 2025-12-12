import SetPasswordForm from "@/components/auth/SetPasswordForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set Password | Zumbaton",
  description: "Set your Zumbaton account password",
};

export default function SetPassword() {
  return <SetPasswordForm />;
}
