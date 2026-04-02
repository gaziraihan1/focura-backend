// Focura admins — hardcoded user IDs from env
export function getFocuraAdminIds(): string[] {
  const raw = process.env.FOCURA_ADMIN_IDS ?? '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isFocuraAdmin(userId: string): boolean {
  return getFocuraAdminIds().includes(userId);
}
