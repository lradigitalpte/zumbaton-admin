import SetPasswordForm from "@/components/auth/SetPasswordForm";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Set Password | Zumbaton",
  description: "Set your Zumbaton account password",
};

function SetPasswordFormFallback() {
  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <div className="flex items-center justify-center gap-2">
          <div className="h-32 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
        </div>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 animate-pulse rounded w-3/4" />
          <div className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          <div className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}

export default function SetPassword() {
  return (
    <Suspense fallback={<SetPasswordFormFallback />}>
      <SetPasswordForm />
    </Suspense>
  );
}
