import dotenv from 'dotenv'
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config()
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "images",
    transformation: [{ width: 1000, height: 800, crop: "limit" }],
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

export default storage;