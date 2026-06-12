import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile, UserRole } from "@/types/database";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isTeacher: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (args: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
  }) => Promise<{ needsConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) console.error("[auth] loadProfile:", error.message);
      setProfile((data as Profile) ?? null);
    } catch (e) {
      console.error("[auth] loadProfile error:", e);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Carga inicial (fuera del callback de auth → sin riesgo de deadlock).
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user) await loadProfile(data.session.user.id);
      } catch (e) {
        console.error("[auth] getSession error:", e);
      } finally {
        if (mounted) setLoading(false); // garantiza que nunca quede colgado
      }
    })();

    // IMPORTANTE: no usar await de consultas a Supabase DENTRO de este
    // callback (bloquea el lock interno de supabase-js → deadlock).
    // Diferimos loadProfile con setTimeout(0).
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        if (newSession?.user) {
          const uid = newSession.user.id;
          setTimeout(() => {
            if (mounted) loadProfile(uid);
          }, 0);
        } else {
          setProfile(null);
        }
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const signUp = useCallback<AuthState["signUp"]>(
    async ({ email, password, fullName, role }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw error;
      // Si no hay sesión, Supabase requiere confirmar el correo.
      return { needsConfirmation: !data.session };
    },
    [],
  );

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) throw error;
  }, []);

  // Envía el correo con el enlace para crear una nueva contraseña.
  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }, []);

  // Define la nueva contraseña (tras llegar por el enlace de recuperación).
  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        isTeacher: profile?.role === "teacher",
        isAdmin: profile?.is_admin === true,
        signIn,
        signUp,
        resendConfirmation,
        resetPassword,
        updatePassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
