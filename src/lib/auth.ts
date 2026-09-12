import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { sql, upsertTeacher, getTeacherByEmail } from './db';

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

        return {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          role: teacher.role || 'docente',
          school_name: teacher.school_name || '',
          cct: teacher.cct || '',
          subsystem: teacher.subsystem || 'bge',
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      if (account?.provider === 'google') {
        try {
          await upsertTeacher({
            name: user.name || user.email,
            email: user.email.toLowerCase().trim(),
          });
          return true;
        } catch (error) {
          console.error('Error upserting teacher on sign in:', error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'docente';
        token.school_name = (user as any).school_name || '';
        token.cct = (user as any).cct || '';
        token.subsystem = (user as any).subsystem || '';
      }
      if (token.email) {
        try {
          const t = await getTeacherByEmail(token.email);
          if (t) {
            token.id = t.id;
            token.role = t.role || 'docente';
            token.school_name = t.school_name || '';
            token.cct = t.cct || '';
            token.subsystem = t.subsystem || '';
          }
        } catch {}
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).school_name = token.school_name;
        (session.user as any).cct = token.cct;
        (session.user as any).subsystem = token.subsystem;
      }
      return session;
    },
  },
  pages: {
    signIn: '/es/login',
    error: '/es/login',
  },
});
