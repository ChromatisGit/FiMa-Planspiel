const fs = require('fs');

function setupFiles() {
    const storageDir = 'storage';
    const dataDir = 'generated';
    const anleihenDatenFile = 'storage/anleihenDaten.json';
    const branchenFile = 'storage/branchen.json';

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const createDir = (dirPath) => {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    };

    createDir(storageDir);
    createDir(dataDir);

    const createEmptyJsonFile = (filePath) => {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({}), 'utf8');
        }
    };

    createEmptyJsonFile(anleihenDatenFile);
    createEmptyJsonFile(branchenFile);
}

module.exports = {
    setupFiles
};