const fs = require('fs');
const lines = fs.readFileSync('components/storefront.tsx', 'utf8').split('\n');
lines.forEach((line, i) => {
  if (line.includes('customerExists')) {
    console.log((i + 1) + ': ' + line.trim());
  }
});
