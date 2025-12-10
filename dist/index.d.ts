import { Application } from 'express';
import { PrismaClient } from '@prisma/client';
export declare const prisma: PrismaClient<{
    log: ("query" | "warn" | "error")[];
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
declare const app: Application;
export default app;
