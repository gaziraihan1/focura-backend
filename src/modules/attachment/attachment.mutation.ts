/**
 * attachment.mutation.ts
 * Responsibility: Write operations for attachments with Cloudinary upload.
 */

import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '../../index.js';
import { AttachmentAccess } from './attachment.access.js';
import { AttachmentValidation } from './attachment.validation.js';
import type { AddAttachmentInput } from './attachment.types.js';

// Cloudinary config (should be in env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const AttachmentMutation = {
  /**
   * Adds an attachment to a task.
   * 
   * Flow:
   *  1. Verify task access
   *  2. Check tier-based upload limits
   *  3. Upload to Cloudinary
   *  4. Save to database
   *  5. Update storage stats
   */
  async addAttachment(input: AddAttachmentInput) {
    // Step 1: Verify access
    const { workspaceId, workspacePlan } = await AttachmentAccess.assertCanAttach(
      input.taskId,
      input.userId,
    );

    // Step 2: Check tier limits
    const uploadCheck = await AttachmentValidation.canUpload(
      input.userId,
      workspaceId,
      workspacePlan,
      input.file.size,
    );

    if (!uploadCheck.allowed) {
      throw new Error(uploadCheck.reason);
    }

    // Step 3: Upload to Cloudinary
    const base64 = input.file.buffer.toString('base64');
    const dataURI = `data:${input.file.mimetype};base64,${base64}`;

    let cloudinaryResult;
    try {
      cloudinaryResult = await cloudinary.uploader.upload(dataURI, {
        folder: 'focura/attachments',
        resource_type: 'auto',
      });
    } catch (error) {
      console.error('Cloudinary upload failed:', error);
      throw new Error('Failed to upload file to storage');
    }

    // Step 4: Save to database
    try {
      const file = await prisma.file.create({
        data: {
          name: cloudinaryResult.public_id,
          originalName: input.file.originalname,
          size: cloudinaryResult.bytes,
          mimeType: input.file.mimetype,
          url: cloudinaryResult.secure_url,
          thumbnail: cloudinaryResult.thumbnail_url,
          uploadedById: input.userId,
          workspaceId,
          taskId: input.taskId,
        },
        include: {
          uploadedBy: {
            select: { id: true, name: true, image: true },
          },
        },
      });

      return file;
    } catch (dbError) {
      // Rollback: delete from Cloudinary
      await cloudinary.uploader.destroy(cloudinaryResult.public_id).catch(console.error);
      throw new Error('Failed to save file record');
    }
  },

  /**
   * Deletes an attachment.
   * Removes from both database and Cloudinary.
   */
  async deleteAttachment(fileId: string, userId: string): Promise<void> {
    const file = await AttachmentAccess.assertCanDelete(fileId, userId);

    // Delete from database first
    await prisma.file.delete({ where: { id: fileId } });

    // Then delete from Cloudinary (fire-and-forget)
    cloudinary.uploader.destroy(file.name).catch((error) => {
      console.error('Failed to delete from Cloudinary:', error);
    });
  },
};