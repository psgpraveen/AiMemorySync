const sharp = require('sharp');
const path = require('path');

const svgIcon = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="50%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#4f46e5" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background Card -->
  <rect x="16" y="16" width="224" height="224" rx="52" fill="url(#grad)" filter="url(#shadow)"/>
  
  <!-- Subtle Inner Border -->
  <rect x="16" y="16" width="224" height="224" rx="52" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>

  <!-- Core "M" Geometry -->
  <path d="M72 176 V88 L128 140 L184 88 V176" 
        fill="none" 
        stroke="#ffffff" 
        stroke-width="20" 
        stroke-linecap="round" 
        stroke-linejoin="round"/>

  <!-- Glowing Synchronized Memory Node -->
  <circle cx="128" cy="80" r="14" fill="#38bdf8" stroke="#ffffff" stroke-width="4"/>
</svg>
`;

const outputPath = path.join(__dirname, '../packages/vscode-extension/media/icon.png');

sharp(Buffer.from(svgIcon))
  .resize(256, 256)
  .png()
  .toFile(outputPath)
  .then(() => {
    console.log('Generated icon.png at ' + outputPath);
  })
  .catch((err) => {
    console.error('Failed to generate icon:', err);
    process.exit(1);
  });
