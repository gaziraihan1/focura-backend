import { v2 as cloudinary } from "cloudinary";
import { prisma } from "../../index.js";
import { AttachmentAccess } from "./attachment.access.js";
import {
  checkAndConsumeUploadQuota,
  rollbackUploadQuota,
  incrementWorkspaceStorage,
  decrementWorkspaceStorage,
  seedWorkspaceStorageFromDb,
} from "./attatchment.quota.service.js";
import type { AddAttachmentInput } from "./attachment.types.js";
import { WorkspacePlan } from "./attachment.quota.types.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function ensureStorageSeeded(workspaceId: string): Promise<void> {
  const agg = await prisma.file.aggregate({
    where: { workspaceId },
    _sum:  { size: true },
  });
  await seedWorkspaceStorageFromDb(workspaceId, agg._sum.size ?? 0);
}

export const AttachmentMutation = {
  async addAttachment(input: AddAttachmentInput) {
    const { workspaceId, workspacePlan } = await AttachmentAccess.assertCanAttach(
      input.taskId,
      input.userId,
    );

    await ensureStorageSeeded(workspaceId);

    const check = await checkAndConsumeUploadQuota(
      input.userId,
      workspaceId,
      workspacePlan as WorkspacePlan,
      input.file.size,
    );

    if (!check.allowed) {
      throw Object.assign(new Error(check.reason), {
        code:         check.code,
        retryAfterMs: check.retryAfterMs,
      });
    }

    const base64  = input.file.buffer.toString("base64");
    const dataURI = `data:${input.file.mimetype};base64,${base64}`;

    let cloudinaryResult: any;
    try {
      cloudinaryResult = await cloudinary.uploader.upload(dataURI, {
        folder:        "focura/attachments",
        resource_type: "auto",
      });
    } catch (uploadError) {
      await rollbackUploadQuota(input.userId, workspaceId);
      console.error("Cloudinary upload failed:", uploadError);
      throw new Error("Failed to upload file to storage");
    }

    let file: any;
    try {
      file = await prisma.file.create({
        data: {
          name:         cloudinaryResult.public_id,
          originalName: input.file.originalname,
          size:         cloudinaryResult.bytes,
          mimeType:     input.file.mimetype,
          url:          cloudinaryResult.secure_url,
          thumbnail:    cloudinaryResult.thumbnail_url ?? null,
          uploadedById: input.userId,
          workspaceId,
          taskId:       input.taskId,
        },
        include: {
          uploadedBy: { select: { id: true, name: true, image: true } },
        },
      });
    } catch (dbError) {
      await Promise.allSettled([
        cloudinary.uploader.destroy(cloudinaryResult.public_id),
        rollbackUploadQuota(input.userId, workspaceId),
      ]);
      throw new Error("Failed to save file record");
    }

    incrementWorkspaceStorage(workspaceId, cloudinaryResult.bytes).catch((err) =>
      console.error("Failed to increment storage counter:", err),
    );

    // ── Activity log (best-effort, non-blocking) ──────────────────────────────
    prisma.activity.create({
      data: {
        action:      'UPLOADED',
        entityType:  'FILE',
        entityId:    file.id,
        userId:      input.userId,
        workspaceId,
        taskId:      input.taskId,
        metadata: {
          fileName:     file.originalName,
          fileSize:     cloudinaryResult.bytes,
          mimeType:     file.mimeType,
          fileUrl:      file.url,
        },
      },
    }).catch((err) => console.error("Failed to log upload activity:", err));

    console.log(
      `📎 File uploaded: "${file.originalName}" (${cloudinaryResult.bytes} bytes) → workspace ${workspaceId}`,
    );

    return file;
  },

  async deleteAttachment(fileId: string, userId: string): Promise<void> {
    const file = await AttachmentAccess.assertCanDelete(fileId, userId);

    // Snapshot metadata before deletion for the activity log
    const taskId      = file.taskId ?? undefined;
    const workspaceId = file.workspaceId ?? undefined;

    await prisma.file.delete({ where: { id: fileId } });

    cloudinary.uploader.destroy(file.name).catch((err) =>
      console.error("Failed to delete from Cloudinary:", err),
    );

    if (workspaceId) {
      decrementWorkspaceStorage(workspaceId, file.size).catch((err) =>
        console.error("Failed to decrement storage counter:", err),
      );

      // ── Activity log (best-effort, non-blocking) ────────────────────────────
      prisma.activity.create({
        data: {
          action:      'DELETED',
          entityType:  'FILE',
          entityId:    fileId,
          userId,
          workspaceId,
          taskId,
          metadata: {
            fileName: file.originalName,
            fileSize: file.size,
          },
        },
      }).catch((err) => console.error("Failed to log delete activity:", err));
    }

    console.log(`🗑️  File deleted: "${file.name}" (${file.size} bytes)`);
  },
};