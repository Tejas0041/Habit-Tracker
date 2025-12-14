const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Submit payment screenshot
router.post('/submit-payment', auth, upload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Compress image to 150KB
    const compressedBuffer = await sharp(req.file.buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    // Check if still too large, compress more
    let finalBuffer = compressedBuffer;
    if (compressedBuffer.length > 150 * 1024) {
      finalBuffer = await sharp(req.file.buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 60 })
        .toBuffer();
    }

    // Upload to Cloudinary
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'habit-tracker-payments',
          resource_type: 'image'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(finalBuffer);
    });

    const result = await uploadPromise;

    // Update user with payment screenshot and pending status
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        paymentScreenshot: result.secure_url,
        subscriptionStatus: 'pending'
      },
      { new: true }
    );

    res.json({ 
      message: 'Payment screenshot submitted successfully',
      user,
      screenshotUrl: result.secure_url
    });
  } catch (err) {
    console.error('Payment submission error:', err);
    res.status(500).json({ error: 'Failed to submit payment' });
  }
});

// Check subscription status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiry: user.subscriptionExpiry,
      paymentScreenshot: user.paymentScreenshot
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});

module.exports = router;
