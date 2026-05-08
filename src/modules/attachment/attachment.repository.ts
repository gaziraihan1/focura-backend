import { prisma } from "../../lib/prisma.js";

export const AttachmentRepository = {
  aggregateWorkspaceSize(workspaceId: string) {
    return prisma.file.aggregate({
      where: { workspaceId },
      _sum: { size: true },
    });
  },

  createFile(data: any) {
    return prisma.file.create({
      data,
      include: {
        uploadedBy: { select: { id: true, name: true, image: true } },
      },
    });
  },

  deleteFile(fileId: string) {
    return prisma.file.deleteMany({
      where: { id: fileId },
    });
  },

  createActivity(data: any) {
    return prisma.activity.create({ data });
  },
};