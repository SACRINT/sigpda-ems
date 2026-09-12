/**
 * Sistema Centralizado de Logging Estructurado y Seguro (FASE 6)
 * Redacta automáticamente información sensible (tokens, secrets, passwords, api keys)
 * para evitar fugas de datos en logs de consola y plataformas de observabilidad.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'authorization',
  'auth_secret',
  'cookie',
  'session_token',
  'stripe_secret_key',
  'gemini_api_key',
  'database_url',
]);

const BEARER_REGEX = /Bearer\s+[A-Za-z0-9\-_.]+/gi;
const JWT_REGEX = /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g;
const GEMINI_KEY_REGEX = /AIzaSy[A-Za-z0-9\-_]{33}/g;

/**
 * Sanitiza recursivamente cualquier objeto o string removiendo información sensible
 */
export function sanitizeLogData(data: any, depth = 0): any {
  if (depth > 5) return '[Max Depth]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return data
      .replace(BEARER_REGEX, 'Bearer [REDACTED]')
      .replace(JWT_REGEX, '[JWT_REDACTED]')
      .replace(GEMINI_KEY_REGEX, '[API_KEY_REDACTED]');
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: sanitizeLogData(data.message, depth + 1),
      stack: process.env.NODE_ENV === 'production' ? undefined : sanitizeLogData(data.stack, depth + 1),
    };
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = sanitizeLogData(value, depth + 1);
      }
    }
    return clean;
  }

  return data;
}

class Logger {
  private moduleName: string;

  constructor(moduleName = 'App') {
    this.moduleName = moduleName;
  }

  public child(moduleName: string): Logger {
    return new Logger(`${this.moduleName}:${moduleName}`);
  }

  public debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      console.debug(`[DEBUG][${this.moduleName}] ${message}`, context ? sanitizeLogData(context) : '');
    }
  }

  public info(message: string, context?: LogContext) {
    console.info(`[INFO][${this.moduleName}] ${message}`, context ? sanitizeLogData(context) : '');
  }

  public warn(message: string, context?: LogContext) {
    console.warn(`[WARN][${this.moduleName}] ${message}`, context ? sanitizeLogData(context) : '');
  }

  public error(message: string, error?: any, context?: LogContext) {
    const cleanError = error ? sanitizeLogData(error) : undefined;
    const cleanContext = context ? sanitizeLogData(context) : undefined;
    console.error(
      `[ERROR][${this.moduleName}] ${message}`,
      cleanError ?? '',
      cleanContext ?? ''
    );
  }
}

export const logger = new Logger('SIGPDA');
export default logger;
