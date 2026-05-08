-- CreateTable
CREATE TABLE "TemplateList" (
    "email" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateList_email_key" ON "TemplateList"("email");
