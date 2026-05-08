ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "slug" TEXT;

UPDATE "Project" SET "slug" = 'project-' || LOWER(REPLACE(id::text, '-', ''))
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "Project" ALTER COLUMN "slug" SET NOT NULL;

ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_slug_key" UNIQUE ("workspaceId", "slug");