import { prisma } from '../index.js';
export class StorageService {
    static DEFAULT_STORAGE_MB = 1024;
    static async getTotalStorage(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                ownedWorkspaces: {
                    select: {
                        maxStorage: true,
                    },
                },
            },
        });
        if (!user) {
            return this.DEFAULT_STORAGE_MB;
        }
        const workspaceStorage = user.ownedWorkspaces.reduce((max, workspace) => Math.max(max, workspace.maxStorage), 0);
        return workspaceStorage || this.DEFAULT_STORAGE_MB;
    }
    static async getUsedStorage(userId) {
        const filesAggregation = await prisma.file.aggregate({
            where: {
                uploadedById: userId,
            },
            _sum: {
                size: true,
            },
        });
        const usedStorageBytes = filesAggregation._sum.size || 0;
        const usedStorageMB = usedStorageBytes / (1024 * 1024);
        return Math.ceil(usedStorageMB);
    }
    static async getStorageInfo(userId) {
        const totalMB = await this.getTotalStorage(userId);
        const usedMB = await this.getUsedStorage(userId);
        const remainingMB = Math.max(0, totalMB - usedMB);
        const percentage = (usedMB / totalMB) * 100;
        return {
            totalMB,
            usedMB,
            remainingMB,
            percentage: Math.min(100, percentage),
        };
    }
    static async hasStorageSpace(userId, fileSizeBytes) {
        const storageInfo = await this.getStorageInfo(userId);
        const fileSizeMB = fileSizeBytes / (1024 * 1024);
        if (fileSizeMB > storageInfo.remainingMB) {
            return {
                allowed: false,
                message: `Insufficient storage. You need ${fileSizeMB.toFixed(2)} MB but only have ${storageInfo.remainingMB.toFixed(2)} MB remaining.`,
                storageInfo,
            };
        }
        return {
            allowed: true,
            storageInfo,
        };
    }
    static async recordFileUpload(userId, workspaceId, fileData) {
        const storageCheck = await this.hasStorageSpace(userId, fileData.size);
        if (!storageCheck.allowed) {
            return {
                success: false,
                message: storageCheck.message,
            };
        }
        const file = await prisma.file.create({
            data: {
                name: fileData.name,
                originalName: fileData.originalName,
                size: fileData.size,
                mimeType: fileData.mimeType,
                url: fileData.url,
                thumbnail: fileData.thumbnail,
                folder: fileData.folder || '/',
                workspaceId,
                uploadedById: userId,
                projectId: fileData.projectId,
                taskId: fileData.taskId,
            },
        });
        return {
            success: true,
            file,
        };
    }
    static async deleteFile(fileId, userId) {
        const file = await prisma.file.findUnique({
            where: { id: fileId },
            select: {
                uploadedById: true,
                size: true,
            },
        });
        if (!file) {
            return {
                success: false,
                message: 'File not found',
            };
        }
        if (file.uploadedById !== userId) {
            return {
                success: false,
                message: 'Unauthorized to delete this file',
            };
        }
        await prisma.file.delete({
            where: { id: fileId },
        });
        const freedMB = file.size / (1024 * 1024);
        return {
            success: true,
            freedMB: Math.ceil(freedMB),
            message: 'File deleted successfully',
        };
    }
}
//# sourceMappingURL=storage.service.js.map