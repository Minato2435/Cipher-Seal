import { useEffect, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { auth } from "./firebase";

export interface Claims {
  role?: string;
  status?: string;
}

export interface AuthState {
  user: User | null;
  claims: Claims;
  loading: boolean;
  /** Force an ID-token refresh so a just-changed role/status claim is visible. */
  refreshClaims: () => Promise<void>;
}

export function useAuthUser(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claims>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onIdTokenChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const res = await u.getIdTokenResult();
        setClaims({
          role: res.claims.role as string | undefined,
          status: res.claims.status as string | undefined,
        });
      } else {
        setClaims({});
      }
      setLoading(false);
    });
  }, []);

  const refreshClaims = async () => {
    if (auth.currentUser) await auth.currentUser.getIdToken(true);
  };

  return { user, claims, loading, refreshClaims };
}
