const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (['serviceAccountJson', 'gcsKeyJson', 'file'].includes(file.fieldname)) {
        const isJson = ext === '.json' && ['application/json', 'text/plain'].includes(file.mimetype);
        if (isJson) return cb(null, true);
        return cb(new Error('Only JSON key files are allowed for this upload field.'));
    }

    const allowedImageExtensions = new Set(['.jpeg', '.jpg', '.png', '.gif', '.webp']);
    const allowedImageMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
    ];

    if (allowedImageExtensions.has(ext) && allowedImageMimes.includes(file.mimetype)) {
        return cb(null, true);
    }

    cb(new Error(`Invalid file type "${file.mimetype}". Only PNG, JPG, GIF, WebP images are allowed.`));
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = upload;
