const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix trailing spaces
  content = content.replace(/[ \t]+$/gm, '');
  
  // Add trailing commas
  content = content.replace(/([{,\[]\s*\n\s*[a-zA-Z0-9"']+:\s*[^,\n]+\n\s*)([}\]])/g, '$1,$2');
  
  // Fix arrow function parentheses
  content = content.replace(/(\w+)\s*=>/g, '($1) =>');
  
  // Add button types
  content = content.replace(/<button(\s+(?!type=)[^>]*)>/g, '<button type="button"$1>');
  
  // Fix empty components
  content = content.replace(/<(\w+)><\/\1>/g, '<$1 />');
  
  // Remove unused variables (basic pattern)
  content = content.replace(/const\s+(\w+)\s*=\s*[^;]+;\s*\/\/\s*no-unused-vars/g, '');
  
  // Fix operator linebreak
  content = content.replace(/\|\|\s*\n/g, '\n  || ');
  content = content.replace(/\?\s*\n/g, '\n  ? ');
  content = content.replace(/:\s*\n/g, '\n  : ');
  
  // Add newline at end of file
  if (!content.endsWith('\n')) {
    content += '\n';
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed: ${filePath}`);
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !file.includes('node_modules')) {
      processDirectory(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fixFile(fullPath);
    }
  });
}

// Process all problematic directories
['src/pages/Dashboard', 'src/pages/Requests', 'src/pages/Store', 'src/pages/Users', 'src/components']
  .forEach(dir => {
    if (fs.existsSync(dir)) {
      processDirectory(dir);
    }
  });

console.log('ESLint fixes applied!');