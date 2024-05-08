const fs = require('fs').promises;
const { appendEntryToCSV, readJsonFromSheet } = require('./fileManager.js');
const { getAktuellenKurs } = require('./requestManager.js');

async function checkKaufkurse() {
    const outputPath = 'checkKaufkurse.csv';

    let table = await readJsonFromSheet('FiMa.xlsx', 'Anleihen(ver)käufe', 1, 19)

    const keyNames = ['Unternehmensname', 'Kaufkurs', 'Tagesendkurs', 'Kaufdatum', 'ISIN', 'Börse', 'Quelle']

    fs.writeFile(outputPath, keyNames.join(',')+ '\n')

    for (const row of table) {
        row['Tagesendkurs'] = await getAktuellenKurs({anleihe: row, date: row['Kaufdatum']});
        appendEntryToCSV(outputPath, row, keyNames);
    }
}

checkKaufkurse()