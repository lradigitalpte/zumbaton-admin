import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Sign Up | One Step Fitness",
  description: "Create a One Step Fitness Admin account",
  // other metadata
};

export default function SignUp() {
  return <SignUpForm />;
}
