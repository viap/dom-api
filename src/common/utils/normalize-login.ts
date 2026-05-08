export function normalizeLogin(login: string | null | undefined): string {
  if (typeof login !== 'string') {
    return '';
  }

  return login.trim().toLowerCase();
}
