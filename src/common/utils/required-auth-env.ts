const REQUIRED_AUTH_ENV_KEYS = [
  'JWT_SECRET',
  'BOT_CLIENT_NAME',
  'BOT_CLIENT_PASSWORD',
  'WEB_CLIENT_NAME',
  'WEB_CLIENT_PASSWORD',
] as const;

export function assertRequiredAuthEnv(): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const missing = REQUIRED_AUTH_ENV_KEYS.filter(
    (key) => !process.env[key] || !process.env[key]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required auth environment variables: ${missing.join(', ')}`,
    );
  }
}
