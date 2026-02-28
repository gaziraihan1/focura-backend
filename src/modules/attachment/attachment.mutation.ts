
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '../../index.js';
import { AttachmentAccess } from './attachment.access.js';
import { AttachmentValidation } from './attachment.validation.js';
import type { AddAttachmentInput } from './attachment.types.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const AttachmentMutation = {
  async addAttachment(input: AddAttachmentInput) {
    const { workspaceId, workspacePlan } = await AttachmentAccess.assertCanAttach(
      input.taskId,
      input.userId,
    );

    const uploadCheck = await AttachmentValidation.canUpload(
      input.userId,
      workspaceId,
      workspacePlan,
      input.file.size,
    );

    if (!uploadCheck.allowed) {
      throw new Error(uploadCheck.reason);
    }

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
      await cloudinary.uploader.destroy(cloudinaryResult.public_id).catch(console.error);
      throw new Error('Failed to save file record');
    }
  },

  async deleteAttachment(fileId: string, userId: string): Promise<void> {
    const file = await AttachmentAccess.assertCanDelete(fileId, userId);

    await prisma.file.delete({ where: { id: fileId } });

    cloudinary.uploader.destroy(file.name).catch((error) => {
      console.error('Failed to delete from Cloudinary:', error);
    });
  },
};