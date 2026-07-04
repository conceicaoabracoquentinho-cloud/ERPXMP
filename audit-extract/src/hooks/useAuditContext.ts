import { useAuth } from '../contexts/AuthContext';

export interface AuditContext {
  usuario: string;
  ip: string | null;
  navegador: string;
}

export function useAuditContext(): AuditContext {
  const { user, ip, userAgent } = useAuth();
  return {
    usuario: user?.nome || 'Sistema',
    ip,
    navegador: userAgent,
  };
}
