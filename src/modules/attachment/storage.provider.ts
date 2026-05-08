import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const StorageProvider = {
  async upload(dataURI: string) {
    return cloudinary.uploader.upload(dataURI, {
      folder: "focura/attachments",
      resource_type: "auto",
    });
  },

  async destroy(publicId: string) {
    return cloudinary.uploader.destroy(publicId);
  },
};