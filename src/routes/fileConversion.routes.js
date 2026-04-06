import express from 'express';
import multer from 'multer';
import { convertWordToPdf, getFilePageCount } from '../controllers/fileConversion.controller.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow Word documents and PDFs
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/pdf',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    const allowedExtensions = ['.doc', '.docx', '.pdf', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExt = '.' + file.originalname.split('.').pop().toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

// Convert Word document to PDF
router.post('/convert-word-to-pdf', upload.single('file'), convertWordToPdf);

// Get page count for any supported file
router.post('/get-page-count', upload.single('file'), getFilePageCount);

export default router;