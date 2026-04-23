import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Login | One Step Fitness",
  description: "Sign in to your One Step Fitness Admin Dashboard",
};

export default function SignIn() {
  return <SignInForm />;
}
