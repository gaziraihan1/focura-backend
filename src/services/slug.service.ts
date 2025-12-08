
import slugify from "slugify";
import { prisma } from "../index.js";

export class SlugService {
  static async generateUniqueSlug(name: string) {
    const base = slugify(name, { lower: true, strict: true });
    const matches = await prisma.workspace.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true }
    });

    if (matches.length === 0) return base;

    return `${base}-${matches.length + 1}`;
  }
}
