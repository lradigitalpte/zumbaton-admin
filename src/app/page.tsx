"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_ROLES = ['super_admin', 'admin', 'instructor', 'staff', 'receptionist'];

export default function RootPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  
  useEffect(() => {
    let hasRedirected = false;
    
    // Safety timeout: always redirect after 2 seconds max
    const safetyTimeout = setTimeout(() => {
      if (!hasRedirected) {
        console.warn('[Root] Safety timeout - forcing redirect to signin');
        hasRedirected = true;
        router.replace("/signin");
      }
    }, 2000);
    
    // Quick check: look for session in localStorage first (fast path)
    const checkSession = async () => {
      try {
        // Check localStorage directly for Supabase session
        // Supabase stores session as: sb-{project-ref}-auth-token
        const storageKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('sb-') && key.includes('-auth-token')
        );
        
        if (storageKeys.length > 0) {
          // Session exists in storage, try to get it (with timeout)
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 1000)
          );
          
          try {
            const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;
            
            if (error) {
              console.warn('[Root] Session error:', error);
              if (!hasRedirected) {
                hasRedirected = true;
                clearTimeout(safetyTimeout);
                router.replace("/signin");
              }
              return;
            }
            
            if (session?.user) {
              // Check if user has admin role from metadata
              const appRole = session.user.app_metadata?.role;
              const userRole = session.user.user_metadata?.role;
              const role = appRole || userRole;
              
              if (role && ADMIN_ROLES.includes(role)) {
                // User is authenticated and has admin role - redirect to dashboard
                if (!hasRedirected) {
                  hasRedirected = true;
                  clearTimeout(safetyTimeout);
                  router.replace("/dashboard");
                }
                return;
              } else {
                // User is authenticated but doesn't have admin role
                console.warn('[Root] User does not have admin role:', role);
                if (!hasRedirected) {
                  hasRedirected = true;
                  clearTimeout(safetyTimeout);
                  router.replace("/signin");
                }
                return;
              }
            }
          } catch (error) {
            // Timeout or error - treat as no session
            console.warn('[Root] Session check timed out, redirecting to signin');
          }
        }
        
        // No session found - redirect to signin
        if (!hasRedirected) {
          hasRedirected = true;
          clearTimeout(safetyTimeout);
          router.replace("/signin");
        }
      } catch (error) {
        console.error('[Root] Error checking session:', error);
        if (!hasRedirected) {
          hasRedirected = true;
          clearTimeout(safetyTimeout);
          router.replace("/signin");
        }
      } finally {
        setIsChecking(false);
      }
    };

    checkSession();
    
    return () => {
      clearTimeout(safetyTimeout);
    };
  }, [router]);

  // Show minimal loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
    </div>
  );
}

