const fs = require('fs');
const csv = require('csv-parser');

function updateBranchenStorage() {
    let branchen = JSON.parse(fs.readFileSync('storage/branchen.json', 'utf8'));
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
            fs.writeFileSync('storage/branchen.json', JSON.stringify(branchen, null, 4))
            console.log(`Added ${newEntriesAmount} to branchen.json!`);
        });
}
//TODO Wenn keine branche spalte da ist Fehlermeldung
module.exports = {
    updateBranchenStorage
};