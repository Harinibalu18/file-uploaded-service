const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Middleware for file upload
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter(req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

// JWT Middleware
const authenticateJWT = (req, res, next) => {
  const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Upload file to S3
app.post('/upload', authenticateJWT, upload.single('file'), (req, res) => {
  const file = req.file;
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: file.originalname,
    Body: file.buffer,
    ContentType: file.mimetype,
  };
  
  s3.upload(params, (err, data) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.send(`File uploaded successfully. ${data.Location}`);
  });
});

// Download file from S3
app.get('/download/:filename', authenticateJWT, (req, res) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: req.params.filename,
  };
  
  s3.getObject(params, (err, data) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.attachment(req.params.filename);
    res.send(data.Body);
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
