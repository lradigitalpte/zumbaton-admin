"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import BrandLogo from "@/components/common/BrandLogo";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { studioButton, studioError, studioInput, studioInputIcon, studioLead, studioLink, studioTitle } from "./studio";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!identifier || !password) {
      setError("Please enter both email and password");
      return;
    }

    // Validate email format
    const email = identifier.includes('@') ? identifier : `${identifier}@zumbaton.com`;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await signIn(email, password);
      
      if (result.success) {
        // Get the user's role to determine redirect destination
        const userRole = result.role;
        
        // Role-based redirect:
        // - Instructors go to /tutor portal
        // - Admins, super_admins, staff, receptionists go to /dashboard
        let redirectPath = '/dashboard';
        if (userRole === 'instructor') {
          redirectPath = '/tutor';
        }
        
        // Use router.push for client-side navigation (preserves state, no refresh)
        // This keeps the user state intact and allows instant name display
        router.push(redirectPath);
      } else {
        setError(result.error || "Sign in failed. Please check your credentials.");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-y-auto px-6 py-8 lg:w-1/2">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        {/* One Step Fitness Logo */}
        <div className="flex items-center justify-center">
          <BrandLogo
            alt="One Step Fitness Logo"
            width={280}
            height={93}
            className="h-16 w-auto"
            priority
          />
        </div>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className={studioTitle}>Sign in</h1>
            <p className={studioLead}>
              Use your studio email and password. A username without @ signs in as @zumbaton.com.
            </p>
          </div>
          <div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                {error && (
                  <div className={studioError}>
                    {error}
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-800 dark:text-white/90">
                    Email or username
                  </label>
                  <Input
                    className={studioInput}
                    placeholder="you@onestepfitness.sg"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-800 dark:text-white/90">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      className={studioInputIcon}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isChecked} onChange={setIsChecked} />
                    <span className="block text-sm text-neutral-600 dark:text-neutral-300">
                      Keep me logged in
                    </span>
                  </div>
                  <Link href="/forgot-password" className={`text-sm ${studioLink}`}>
                    Forgot password?
                  </Link>
                </div>
                <div>
                  <Button className={studioButton} size="sm" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Signing in…" : "Sign in"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
