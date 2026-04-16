import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { HttpStatus } from "../constants/http-status";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB max
  },
  fileFilter: (req, file, cb) => {
    // if (file.originalname !== "README.md") {
    //   return cb(new Error("Only README.md file is allowed"));
    // }
    cb(null, true);
  },
});

export const uploadReadme = upload.single("file");

export function uploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  uploadReadme(req, res, (err: any) => {
    if (err) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: err.message || "File upload failed",
      });
    }
    next();
  });
}
