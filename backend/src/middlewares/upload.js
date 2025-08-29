import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import ApiError from '../utils/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directories exist
const createUploadDirs = async () => {
  const dirs = [
    'uploads',
    'uploads/avatars',
    'uploads/documents',
    'uploads/temp',
  ];

  for (const dir of dirs) {
    const fullPath = path.join(__dirname, '..', dir);
    try {
      await fs.access(fullPath);
    } catch {
      await fs.mkdir(fullPath, { recursive: true });
      console.log(`Created directory: ${fullPath}`);
    }
  }
};

// Initialize upload directories
createUploadDirs().catch(console.error);

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/temp';

    // Determine upload path based on file type or route
    if (file.fieldname === 'avatar') {
      uploadPath = 'uploads/avatars';
    } else if (file.fieldname === 'document') {
      uploadPath = 'uploads/documents';
    }

    const fullPath = path.join(__dirname, '..', uploadPath);
    cb(null, fullPath);
  },

  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, extension);

    // Sanitize filename
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${sanitizedBaseName}_${uniqueSuffix}${extension}`;

    cb(null, filename);
  },
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = {
    avatar: {
      mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    },
    document: {
      mimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      extensions: ['.pdf', '.doc', '.docx'],
    },
    general: {
      mimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
      ],
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'],
    },
  };

  const fieldName = file.fieldname;
  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Get allowed types for this field
  const allowedConfig = allowedTypes[fieldName] || allowedTypes.general;

  // Check MIME type and extension
  const isMimeTypeAllowed = allowedConfig.mimeTypes.includes(file.mimetype);
  const isExtensionAllowed = allowedConfig.extensions.includes(fileExtension);

  if (isMimeTypeAllowed && isExtensionAllowed) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        400,
        `File type not allowed. Allowed types: ${allowedConfig.extensions.join(', ')}`
      ),
      false
    );
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5, // Maximum 5 files
    fields: 10, // Maximum 10 non-file fields
    fieldNameSize: 50, // Maximum field name size
    fieldSize: 1024 * 1024, // Maximum field value size (1MB)
  },
  fileFilter: fileFilter,
});

// Avatar upload configuration
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '..', 'uploads', 'avatars');
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const extension = path.extname(file.originalname).toLowerCase();
      const filename = `avatar_${userId}_${Date.now()}${extension}`;
      cb(null, filename);
    },
  }),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for avatars
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (
      allowedMimeTypes.includes(file.mimetype) &&
      allowedExtensions.includes(fileExtension)
    ) {
      cb(null, true);
    } else {
      cb(
        new ApiError(
          400,
          'Only image files (JPEG, PNG, GIF, WebP) are allowed for avatars'
        ),
        false
      );
    }
  },
});

// Document upload configuration
const documentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '..', 'uploads', 'documents');
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname).toLowerCase();
      const baseName = path
        .basename(file.originalname, extension)
        .replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `doc_${baseName}_${uniqueSuffix}${extension}`;
      cb(null, filename);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for documents
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (
      allowedMimeTypes.includes(file.mimetype) &&
      allowedExtensions.includes(fileExtension)
    ) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Only PDF, DOC, and DOCX files are allowed'), false);
    }
  },
});

// Helper function to delete file
export const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    console.log(`File deleted: ${filePath}`);
  } catch (error) {
    console.error(`Failed to delete file: ${filePath}`, error);
  }
};

// Helper function to clean up old files
export const cleanupOldFiles = async (directory, maxAgeInDays = 30) => {
  try {
    const fullPath = path.join(__dirname, '..', directory);
    const files = await fs.readdir(fullPath);
    const cutoffDate = new Date(
      Date.now() - maxAgeInDays * 24 * 60 * 60 * 1000
    );

    for (const file of files) {
      const filePath = path.join(fullPath, file);
      const stats = await fs.stat(filePath);

      if (stats.mtime < cutoffDate) {
        await deleteFile(filePath);
      }
    }
  } catch (error) {
    console.error(`Failed to cleanup old files in ${directory}:`, error);
  }
};

// Schedule periodic cleanup (run every 24 hours)
setInterval(
  () => {
    cleanupOldFiles('uploads/temp', 1); // Delete temp files older than 1 day
    cleanupOldFiles('uploads/avatars', 90); // Delete old avatars after 90 days
    cleanupOldFiles('uploads/documents', 365); // Delete old documents after 1 year
  },
  24 * 60 * 60 * 1000
);

// Middleware to handle upload errors
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return next(new ApiError(400, 'File size too large'));
      case 'LIMIT_FILE_COUNT':
        return next(new ApiError(400, 'Too many files uploaded'));
      case 'LIMIT_UNEXPECTED_FILE':
        return next(new ApiError(400, 'Unexpected file field'));
      case 'LIMIT_FIELD_COUNT':
        return next(new ApiError(400, 'Too many fields'));
      case 'LIMIT_FIELD_SIZE':
        return next(new ApiError(400, 'Field value too large'));
      default:
        return next(new ApiError(400, 'File upload error'));
    }
  }
  next(error);
};

export { avatarUpload, documentUpload, upload };
