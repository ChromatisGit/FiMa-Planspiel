const fs = require('fs');
const csv = require('csv-parser');

let branchen = JSON.parse(fs.readFileSync('branchen.json', 'utf8'));
let newEntries = 0

fs.createReadStream('branchen.csv')
    .pipe(csv())
    .on('data', (row) => {
        if (row.name && row.branche) {
            if (!branchen[row.name]) {
                newEntries++;
                branchen[row.name] = row.branche;
            }
        }
    })
    .on('end', () => {
        fs.writeFileSync('branchen.json', JSON.stringify(branchen, null, 4))
        console.log(`Added ${newEntries} to branchen.json!`);
    });
