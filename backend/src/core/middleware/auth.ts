import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

// Caché en memoria del usuario autenticado (evita 1 round-trip a Supabase por request).
// El frontend manda el GUID en X-User-ID, así que cambiar el perfil es infrecuente;
// se invalida automáticamente al cabo de 60s.
const MEMO_TTL_MS = 60 * 1000;
const userMemo = new Map<string, { user: any; expiresAt: number }>();

export function getCachedUser(userId: string): any | undefined {
  const entry = userMemo.get(userId);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    userMemo.delete(userId);
    return undefined;
  }
  return entry.user;
}

export async function fetchUser(userId: string): Promise<any | null> {
  const cached = getCachedUser(userId);
  if (cached) return cached;

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) return null;

  userMemo.set(userId, { user, expiresAt: Date.now() + MEMO_TTL_MS });
  return user;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    organization_id: string;
    email: string;
    full_name: string;
    role: string;
  };
}

/**
 * Authentication + multi-tenant isolation middleware.
 *
 * Resolves the user from the X-User-ID header and enforces that the
 * requested organization (X-Organization-ID) matches the user's own
 * organization. The super_admin role is allowed to operate on any
 * organization (it manages every company).
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const requestedOrgId = req.headers['x-organization-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', hint: 'Incluye el header X-User-ID' });
    }

    const user = await fetchUser(userId);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', hint: 'Usuario no encontrado' });
    }

    // If an organization was explicitly requested, enforce tenant isolation
    if (requestedOrgId) {
      const isSuperAdmin = user.role === 'super_admin';
      if (!isSuperAdmin && user.organization_id !== requestedOrgId) {
        return res.status(403).json({
          error: 'Forbidden',
          hint: 'No tienes acceso a esta organización'
        });
      }
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Error:', error);
    next(error);
  }
};
