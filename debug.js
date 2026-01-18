const folderManager = require('./lib/folder-manager');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log("=== Debug Info ===");
console.log("Home Dir:", os.homedir());
console.log("Agent Root:", path.join(os.homedir(), '.agent'));

const skillsDir = path.join(os.homedir(), '.agent', 'skills');
console.log("Skills Dir:", skillsDir);

if (fs.existsSync(skillsDir)) {
    console.log("Skills directory exists.");
    try {
        const files = fs.readdirSync(skillsDir);
        console.log("Files found in skills:", files);

        files.forEach(f => {
            const fullPath = path.join(skillsDir, f);
            const stat = fs.statSync(fullPath);
            console.log(`- ${f}: ${stat.isDirectory() ? 'DIR' : 'FILE'}`);
        });

    } catch (e) {
        console.error("Error reading skills dir:", e);
    }
} else {
    console.error("Skills directory DOES NOT EXIST!");
}

console.log("\n=== Scan Result ===");
try {
    const assets = folderManager.scanAssets();
    console.log("Assets found:", JSON.stringify(assets, null, 2));
} catch (e) {
    console.error("Scan failed:", e);
}
