const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'HTML to Image service is running' });
});

// Convert HTML to image endpoint
app.post('/convert-html-to-image', async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    console.log('🎨 Converting HTML to image...');
    
    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({
      width: 400,
      height: 800,
      deviceScaleFactor: 2
    });
    
    // Set HTML content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 10000
    });
    
    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');
    
    // Take screenshot of the receipt element
    const receiptElement = await page.$('.receipt');
    if (!receiptElement) {
      throw new Error('Receipt element not found in HTML');
    }
    
    const imageBuffer = await receiptElement.screenshot({
      type: 'png',
      quality: 90
    });
    
    await browser.close();
    
    // Convert to base64
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    
    console.log('✅ HTML converted to image successfully');
    
    res.json({
      success: true,
      imageUrl: base64Image,
      size: imageBuffer.length
    });
    
  } catch (error) {
    console.error('❌ Error converting HTML to image:', error);
    res.status(500).json({
      error: 'Failed to convert HTML to image',
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 HTML to Image service running on port ${PORT}`);
  console.log(`📸 Ready to convert HTML receipts to images`);
});

module.exports = app;
