interface StorageInfo {
    totalMB: number;
    usedMB: number;
    remainingMB: number;
    percentage: number;
}
export declare class StorageService {
    private static readonly DEFAULT_STORAGE_MB;
    static getTotalStorage(userId: string): Promise<number>;
    static getUsedStorage(userId: string): Promise<number>;
    static getStorageInfo(userId: string): Promise<StorageInfo>;
    static hasStorageSpace(userId: string, fileSizeBytes: number): Promise<{
        allowed: boolean;
        message?: string;
        storageInfo?: StorageInfo;
    }>;
    static recordFileUpload(userId: string, workspaceId: string, fileData: {
        name: string;
        originalName: string;
        size: number;
        mimeType: string;
        url: string;
        thumbnail?: string;
        folder?: string;
        projectId?: string;
        taskId?: string;
    }): Promise<{
        success: boolean;
        file?: unknown;
        message?: string;
    }>;
    static deleteFile(fileId: string, userId: string): Promise<{
        success: boolean;
        message?: string;
        freedMB?: number;
    }>;
}
export {};
