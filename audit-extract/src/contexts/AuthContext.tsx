import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../config/supabase';

export interface SessionUser {
  id: string;
  nome: string;
  email: string;
  papel: string;
}

interface AuthContextType {
  user: SessionUser | null;
  ip: string | null;
  userAgent: string;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_USER: SessionUser = {
  id: 'system',
  nome: 'Operador do Sistema',
  email: 'sistema@localhost',
  papel: 'Administrador Principal',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          if (session?.user) {
            setUser({
              id: session.user.id,
              nome: (session.user.user_metadata?.nome as string) || session.user.email || 'Usuário',
              email: session.user.email || '',
              papel: (session.user.app_metadata?.papel as string) || 'Operador Financeiro',
            });
          } else {
            setUser(DEFAULT_USER);
          }
        }
      } catch {
        if (mounted) setUser(DEFAULT_USER);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          nome: (session.user.user_metadata?.nome as string) || session.user.email || 'Usuário',
          email: session.user.email || '',
          papel: (session.user.app_metadata?.papel as string) || 'Operador Financeiro',
        });
      } else {
        setUser(DEFAULT_USER);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(DEFAULT_USER);
  }, []);

  const ip = null;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  return (
    <AuthContext.Provider value={{ user, ip, userAgent, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return ctx;
};
