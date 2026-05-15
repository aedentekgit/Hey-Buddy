const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Allowed extensions
    const filetypes = /jpeg|jpg|png|gif|webp|svg|json/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime - be very permissive for GIF and SVG
    const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'application/json',
        'text/plain' // some browsers send SVG as text/plain
    ];
    const mimetype = allowedMimes.includes(file.mimetype) || filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error(`Invalid file type "${file.mimetype}". Only images (PNG, JPG, GIF, WebP, SVG) and JSON are allowed.`));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 200 * 1024 * 1024 } // 200MB limit - no restriction for logos/gifs
});

module.exports = upload;
