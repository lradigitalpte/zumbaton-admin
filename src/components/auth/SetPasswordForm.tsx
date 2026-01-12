"use client";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if we have a valid password reset token
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check for hash fragments (Supabase recovery links use hash fragments)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const type = hashParams.get("type");
        
        // Check for query params (alternative format)
        const token = searchParams.get('token');
        const typeParam = searchParams.get('type');
        
        // If we have a recovery token in hash or query, exchange it for a session
        if ((accessToken && type === 'recovery') || (token && typeParam === 'recovery')) {
          if (accessToken) {
            // Exchange hash token for session
            const { data: { session }, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: hashParams.get("refresh_token") || '',
            });
            
            if (session && !error) {
              setIsValidToken(true);
              return;
            }
          }
        }
        
        // Check existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        // If there's a token in the URL or a session, we're good
        if (token || session) {
          setIsValidToken(true);
        } else {
          setIsValidToken(false);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setIsValidToken(false);
      }
    };

    checkSession();
  }, [searchParams]);

  const validatePassword = (pwd: string) => {
    const checks = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    };
    return checks;
  };

  const passwordChecks = validatePassword(password);
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not meet all requirements");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Update password using Supabase
      // This works when the user has a valid reset token in their session
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error('Error updating password:', updateError);
        
        if (updateError.message.includes('session') || updateError.message.includes('token')) {
          setError('This password reset link has expired or is invalid. Please request a new one.');
        } else {
          setError(updateError.message || 'Failed to update password. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      // Success - redirect to sign in
      router.push("/signin?password-reset=success");
    } catch (err) {
      console.error('Error resetting password:', err);
      setError('Something went wrong. Please try again.');
    setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <Image
            src="/images/logo/zumbaton logo (transparent).png"
            alt="Zumbaton Logo"
            width={400}
            height={133}
            className="h-32 w-auto dark:invert"
            priority
          />
        </div>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              {isValidToken === false ? 'Invalid Reset Link' : 'Set Your Password'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isValidToken === false 
                ? 'This password reset link has expired or is invalid. Please request a new one.'
                : 'Create a secure password to complete your password reset.'}
            </p>
          </div>

          {isValidToken === false ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">
                  This password reset link is no longer valid. Password reset links expire after a certain time for security reasons.
                </p>
              </div>
              <Link href="/forgot-password">
                <Button className="w-full" size="sm">
                  Request New Reset Link
                </Button>
              </Link>
              <Link href="/signin">
                <Button className="w-full" size="sm" variant="outline">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                  {error}
                </div>
              )}

              <div>
                <Label>
                  New Password <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
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

              {/* Password Requirements */}
              {password && (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Password must contain:</p>
                  <ul className="space-y-1">
                    {[
                      { key: 'length', label: 'At least 8 characters' },
                      { key: 'uppercase', label: 'One uppercase letter' },
                      { key: 'lowercase', label: 'One lowercase letter' },
                      { key: 'number', label: 'One number' },
                      { key: 'special', label: 'One special character' },
                    ].map(({ key, label }) => (
                      <li key={key} className="flex items-center gap-2 text-xs">
                        {passwordChecks[key as keyof typeof passwordChecks] ? (
                          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className={passwordChecks[key as keyof typeof passwordChecks] ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}>
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <Label>
                  Confirm Password <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <span
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showConfirmPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                    )}
                  </span>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                )}
                {confirmPassword && password === confirmPassword && (
                  <p className="mt-1 text-xs text-emerald-500">Passwords match</p>
                )}
              </div>

              <div>
                <Button 
                  className="w-full" 
                  size="sm" 
                  disabled={isSubmitting || !isPasswordValid || password !== confirmPassword}
                >
                  {isSubmitting ? "Setting Password..." : "Set Password & Continue"}
                </Button>
              </div>
            </div>
          </form>
          )}

          <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
              Already have an account?{" "}
              <Link
                href="/signin"
                className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
