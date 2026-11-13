import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import {
  upsertTeacher,
  getTeacherByEmail,
  getTeacherAuthSnapshot,
  touchTeacherLastSeen,
} from './db';
import { isEnvAdmin } from './admin-env';
import { logger } from './logger';

const JWT_REFRESH_TTL_MS = 15 * 60 * 1000;

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
if (!authSecret) {
  throw new Error('AUTH_SECRET or NEXTAUTH_SECRET environment variable is required');
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: authSecret,
  trustHost: true,
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Correo', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const teacher = await getTeacherByEmail(email);
        if (!teacher) {
          return null;
        }

        if (teacher.is_blocked) {
          throw new Error('Cuenta suspendida temporalmente');
        }

        if (!teacher.password_hash) {
          throw new Error('Esta cuenta fue registrada con Google. Por favor inicia sesión con Google.');
        }

        const isValid = await bcrypt.compare(password, teacher.password_hash);
        if (!isValid) {
          return null;
        }

        try {
          await touchTeacherLastSeen(teacher.id);
        } catch (error) {
          logger.warn('No se pudo actualizar last_seen_at en login:', { error, email });
        }

        return {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          role: teacher.role,
          school_name: teacher.school_name,
          cct: teacher.cct,
          subsystem: teacher.subsystem,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      if (account?.provider === 'google') {
        try {
          const teacher = await upsertTeacher({
            name: user.name || user.email,
            email: user.email.toLowerCase().trim(),
          });
          if (teacher?.is_blocked) {
            logger.warn('Google sign-in rechazado para cuenta bloqueada:', { email: user.email });
            return false;
          }
          if (teacher?.id) {
            try {
              await touchTeacherLastSeen(teacher.id as string);
            } catch (touchError) {
              logger.warn('No se pudo actualizar last_seen_at en Google sign-in:', {
                error: touchError,
                email: user.email,
              });
            }
          }
          return true;
        } catch (error) {
          logger.error('Error upserting teacher on sign in:', { error, email: user.email });
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role || 'docente';
        token.school_name = user.school_name || '';
        token.cct = user.cct || '';
        token.subsystem = user.subsystem || '';
      }

      const lastRefresh = Number(token.refreshedAt || 0);
      const shouldRefresh =
        Boolean(user) ||
        trigger === 'update' ||
        !lastRefresh ||
        Date.now() - lastRefresh > JWT_REFRESH_TTL_MS;

      if (token.email && shouldRefresh) {
        try {
          const t = await getTeacherAuthSnapshot(token.email);
          if (t) {
            token.id = t.id;
            token.role = t.role || 'docente';
            token.school_name = t.school_name || '';
            token.cct = t.cct || '';
            token.subsystem = t.subsystem || '';
            token.profile_completed = Boolean(t.profile_completed);
            token.has_active_subscription = Boolean(t.has_active_subscription);
            token.is_admin = Boolean(t.is_admin) || isEnvAdmin(token.email);
            token.is_blocked = Boolean(t.is_blocked);
            token.is_premium = Boolean(t.is_premium);
            token.planning_count = Number(t.planning_count ?? 0);
            token.refreshedAt = Date.now();
          }
        } catch (error) {
          logger.error('Failed to enrich JWT token with teacher snapshot from DB:', {
            error,
            email: token.email,
          });
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id as string) || '';
        session.user.role = (token.role as string) || 'docente';
        session.user.school_name = (token.school_name as string) || '';
        session.user.cct = (token.cct as string) || '';
        session.user.subsystem = (token.subsystem as string) || '';
        session.user.profile_completed = Boolean(token.profile_completed);
        session.user.has_active_subscription = Boolean(token.has_active_subscription);
        session.user.is_admin = Boolean(token.is_admin) || isEnvAdmin(session.user.email);
        session.user.is_blocked = Boolean(token.is_blocked);
        session.user.is_premium = Boolean(token.is_premium);
        session.user.planning_count = Number(token.planning_count ?? 0);
      }
      return session;
    },
  },
  pages: {
    signIn: '/es/login',
    error: '/es/login',
  },
});
