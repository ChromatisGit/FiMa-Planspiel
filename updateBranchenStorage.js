const fs = require('fs');
const csv = require('csv-parser');

function updateBranchenStorage() {
    let branchen = JSON.parse(fs.readFileSync('data/storage/branchen.json', 'utf8'));
    let newEntriesAmount = 0

    fs.createReadStream('branchen.csv')
        .pipe(csv())
        .on('data', (row) => {
            if (row.name && row.branche) {
                if (!branchen[row.name]) {
                    newEntriesAmount++;
                    branchen[row.name] = row.branche;
                }
            }
        })
        .on('end', () => {
            fs.writeFileSync('data/storage/branchen.json', JSON.stringify(branchen, null, 4))
            console.log(`Added ${newEntriesAmount} to branchen.json!`);
        });
}

module.exports = {
    updateBranchenStorage
};