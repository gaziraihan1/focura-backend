/**
 * workspace.utils.ts
 */
import { prisma } from "../../index.js";
import * as slugifyModule from "slugify";
const slugify = (slugifyModule as any).default || slugifyModule;

export const WORKSPACE_LIMITS: Record<string, number> = {
  FREE: 1,
  PRO: 5,
  BUSINESS: 15,
  ENTERPRISE: Infinity,
};

export async function generateUniqueSlug(name: string): Promise<string> {
  let slug = slugify(name, { lower: true, strict: true });
  let counter = 1;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${slugify(name, { lower: true, strict: true })}-${counter}`;
    counter++;
  }
  return slug;
}
