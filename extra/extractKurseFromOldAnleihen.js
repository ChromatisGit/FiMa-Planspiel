const { readJsonFromSheet } = require('./fileManager.js');
const fs = require('fs').promises;
const { parse } = require('date-fns');
const { updateKurseUnsereAnleihen } = require('./updateKurseUnsereAnleihen.js');


async function extractKurseFromOldFiles({dollar,date,filename}) {
    const bufferPath = 'generated/kurseAnleihenBuffer.json';
    const sheetPath = `${filename}.xlsx`

    parsedDate = parse(date, 'yyyy-MM-dd', new Date())

    buffer = {
            date: date,
            usd: dollar,
            kurse: {}
    }

    let anleihen = await readJsonFromSheet(sheetPath, 'Aktuelle Anleihen', 1, 25)
    anleihen.forEach((entry) => {
        buffer.kurse[entry.ISIN] = entry['Aktueller Kurs']
    })

    fs.writeFile(bufferPath, JSON.stringify(buffer, null, 2))

    updateKurseUnsereAnleihen(parsedDate)
}

extractKurseFromOldFiles({
    date: '2024-04-17',
    dollar: 1.0617,
    filename: 'KW15'
})