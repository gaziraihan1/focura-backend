import { v2 as cloudinary } from 'cloudinary';
import { StorageService } from '../services/storage.service.js';
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
export const uploadFile = async (req, res) => {
    try {
        if (!req.user?.id) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: 'No file provided',
            });
            return;
        }
        // Check storage space
        const storageCheck = await StorageService.hasStorageSpace(req.user.id, req.file.size);
        if (!storageCheck.allowed) {
            res.status(413).json({
                success: false,
                message: storageCheck.message,
                storageInfo: storageCheck.storageInfo,
            });
            return;
        }
        const base64 = req.file.buffer.toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${base64}`;
        const uploadType = req.body.uploadType || 'file';
        let folder = uploadType === 'profile' ? 'focura/profiles' : 'focura/files';
        const uploadOptions = {
            folder,
            resource_type: 'auto',
        };
        if (uploadType === 'profile' && req.file.mimetype.startsWith('image/')) {
            uploadOptions.transformation = [
                { width: 500, height: 500, crop: 'fill', gravity: 'face' },
                { quality: 'auto' },
                { fetch_format: 'auto' },
            ];
        }
        const result = await cloudinary.uploader.upload(dataURI, uploadOptions);
        // If profile upload, return immediately
        if (uploadType === 'profile') {
            res.status(200).json({
                success: true,
                data: {
                    url: result.secure_url,
                    publicId: result.public_id,
                    format: result.format,
                    size: result.bytes,
                },
                message: 'Profile picture uploaded successfully',
            });
            return;
        }
        // Workspace/project file upload
        const workspaceId = req.body.workspaceId;
        if (!workspaceId) {
            res.status(400).json({
                success: false,
                message: 'Workspace ID is required for workspace/project file uploads',
            });
            return;
        }
        const fileRecord = await StorageService.recordFileUpload(req.user.id, workspaceId, {
            name: result.public_id,
            originalName: req.file.originalname,
            size: result.bytes,
            mimeType: req.file.mimetype,
            url: result.secure_url,
            thumbnail: result.thumbnail_url,
            folder: req.body.folder,
            projectId: req.body.projectId,
            taskId: req.body.taskId,
        });
        if (!fileRecord.success) {
            await cloudinary.uploader.destroy(result.public_id);
            res.status(507).json({
                success: false,
                message: fileRecord.message,
            });
            return;
        }
        const storageInfo = await StorageService.getStorageInfo(req.user.id);
        res.status(200).json({
            success: true,
            data: {
                file: fileRecord.file,
                url: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                size: result.bytes,
            },
            storageInfo,
            message: 'File uploaded successfully',
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload file',
        });
    }
};
//# sourceMappingURL=upload.controller.js.map