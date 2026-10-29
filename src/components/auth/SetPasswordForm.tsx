"use client";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import BrandLogo from "@/components/common/BrandLogo";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { studioButton, studioError, studioInputIcon, studioLead, studioLink, studioOutline, studioTitle } from "./studio";

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
            const refreshToken = hashParams.get("refresh_token") || '';
            console.log('[SetPassword] Setting session with recovery token', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
            
            const { data: { session }, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) {
              console.error('[SetPassword] Error setting session:', error);
              setIsValidToken(false);
              return;
            }
            
            if (session && !error) {
              console.log('[SetPassword] Session set successfully');
              setIsValidToken(true);
              // Clear hash to avoid re-processing on refresh
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
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
    <div className="flex h-full w-full flex-1 flex-col overflow-y-auto px-6 py-8 lg:w-1/2">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <BrandLogo
            alt="One Step Fitness Logo"
            width={400}
            height={133}
            className="h-16 w-auto"
            priority
          />
        </div>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className={studioTitle}>
              {isValidToken === false ? "Invalid reset link" : "Set your password"}
            </h1>
            <p className={studioLead}>
              {isValidToken === false
                ? "This link has expired. Request a new one."
                : "Create a password with 8 characters, mixed case, a number, and a symbol."}
            </p>
          </div>

          {isValidToken === false ? (
            <div className="space-y-4">
              <div className={studioError}>
                <p>
                  This reset link is no longer valid. Links expire for security.
                </p>
              </div>
              <Link href="/forgot-password">
                <Button className={studioButton} size="sm">
                  Request a new link
                </Button>
              </Link>
              <Link href="/signin" className="mt-3 block">
                <Button className={studioOutline} size="sm" variant="outline">
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {error && (
                <div className={studioError}>
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-800 dark:text-white/90">New password</label>
                <div className="relative">
                  <Input
                    className={studioInputIcon}
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
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="mb-2 text-xs font-medium text-neutral-700 dark:text-white/80">Password must contain:</p>
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
                          <svg className="h-4 w-4 text-neutral-950 dark:text-[#E4F56C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className={passwordChecks[key as keyof typeof passwordChecks] ? "text-neutral-950 dark:text-white" : "text-neutral-400"}>
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-800 dark:text-white/90">Confirm password</label>
                <div className="relative">
                  <Input
                    className={studioInputIcon}
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
                  <p className="mt-1 text-xs text-neutral-950 dark:text-[#E4F56C]">Passwords match</p>
                )}
              </div>

              <div>
                <Button
                  className={studioButton}
                  size="sm"
                  disabled={isSubmitting || !isPasswordValid || password !== confirmPassword}
                >
                  {isSubmitting ? "Saving…" : "Save password"}
                </Button>
              </div>
            </div>
          </form>
          )}

          <div className="mt-5">
            <p className="text-center text-sm text-neutral-500 sm:text-start">
              Already have an account?{" "}
              <Link href="/signin" className={studioLink}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
