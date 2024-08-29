const express = require('express');
const path = require('path');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const mongoose = require('mongoose');
const Grid = require('gridfs-stream');
const { upload, uploadToGridFS } = require('./fileController');
const { authenticateToken } = require('./authMiddleware');

const router = express.Router();

// Google Cloud Storage setup
const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET);

// MongoDB GridFS setup
const conn = mongoose.createConnection(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
let gfs;
conn.once('open', () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// Local Storage Routes
router.post('/upload/local', authenticateToken, upload.single('file'), (req, res) => {
  res.json({ file: req.file });
});

router.get('/download/local/:filename', authenticateToken, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads', filename);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    });
  });
});

// Google Cloud Storage Routes
router.post('/upload/gcs', authenticateToken, upload.single('file'), (req, res) => {
  res.json({ file: req.file });
});

router.get('/download/gcs/:filename', authenticateToken, (req, res) => {
  const filename = req.params.filename;
  const file = bucket.file(filename);

  file.createReadStream()
    .on('error', (err) => {
      res.status(404).json({ error: 'File not found' });
    })
    .pipe(res);
});

// MongoDB GridFS Routes
router.post('/upload/gridfs', authenticateToken, upload.single('file'), (req, res) => {
  uploadToGridFS(req, res);
});

router.get('/download/gridfs/:filename', authenticateToken, (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).json({ error: 'No file exists' });
    }

    const readstream = gfs.createReadStream({ filename: file.filename });
    readstream.pipe(res).on('error', () => {
      res.status(500).json({ error: 'Error reading file' });
    });
  });
});

module.exports = router;
