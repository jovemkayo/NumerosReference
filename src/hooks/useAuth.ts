import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logWarn, logError } from "@/lib/logger";

export type AppRole = "admin" | "user";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        logWarn("Failed to get auth session", {
          action: "auth.get_session",
          error,
        });
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          logError("Failed to load user role", {
            action: "auth.load_user_role",
            userId: user.id,
            error,
          });
        }

        setRole((data?.role as AppRole) ?? "user");
      });
  }, [user]);

  return { session, user, role, loading, isAdmin: role === "admin" };
}
