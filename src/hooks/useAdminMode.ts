/**
 * Admin Mode Hook
 * 
 * Lightweight admin mode guard using localStorage.
 * Uses shizu_admin_mode key for persistence.
 * TODO: Replace with real authentication in production.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const ADMIN_MODE_KEY = "shizu_admin_mode";

export function useAdminMode() {
  const router = useRouter();
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ADMIN_MODE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_MODE_KEY, isAdminMode ? "true" : "false");
    } catch (e) {
      console.error("Failed to save admin mode:", e);
    }
  }, [isAdminMode]);

  const toggleAdminMode = useCallback(() => {
    setIsAdminMode(prev => !prev);
  }, []);

  const enableAdminMode = useCallback(() => {
    setIsAdminMode(true);
  }, []);

  const disableAdminMode = useCallback(() => {
    setIsAdminMode(false);
  }, []);

  const exitAdmin = useCallback(() => {
    try {
      localStorage.setItem(ADMIN_MODE_KEY, "false");
    } catch (e) {
      console.error("Failed to save admin mode:", e);
    }
    setIsAdminMode(false);
    router.push("/");
  }, [router]);

  return {
    isAdminMode,
    toggleAdminMode,
    enableAdminMode,
    disableAdminMode,
    exitAdmin,
  };
}
