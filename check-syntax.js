try {
    console.log("Checking descriptions.js...");
    require('./lib/descriptions.js');
    console.log("✅ descriptions.js is OK");
} catch (e) {
    console.error("❌ Syntax Error in descriptions.js:", e.message);
}

try {
    console.log("Checking folder-manager.js...");
    require('./lib/folder-manager.js');
    console.log("✅ folder-manager.js is OK");
} catch (e) {
    console.error("❌ Syntax Error in folder-manager.js:", e.message);
}
