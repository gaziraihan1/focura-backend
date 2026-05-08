// src/lib/prisma.ts
import { PrismaClient, type Prisma } from '@prisma/client';

// Fix: don't use `as const` — Prisma expects a mutable array type
const logLevel: Prisma.LogLevel[] =
  process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'];

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({ log: logLevel });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}