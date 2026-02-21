/**
 * notification.selects.ts
 */

export const senderSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

export const notificationInclude = {
  sender: { select: senderSelect },
} as const;