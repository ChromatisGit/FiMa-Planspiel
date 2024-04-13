const fs = require('fs').promises;
const cheerio = require('cheerio');
const { format, isSameDay } = require('date-fns');
const { appendEntryToCSV, readJsonFromSheet, readJsonFile } = require('./fileManager.js');
const { fetchDataWithRetry } = require('./fetchManager.js');
const { toNumber, calcLetzterZinstermin } = require('./dataTransformer.js');

const BoersenCodeMap = {
    'Berlin': 'BER',
    'Düsseldorf': 'DUS',
    'Frankfurt': 'FSE',
    'Hamburg': 'HAM',
    'Hannover': 'HAN',
    'Lang & Schwarz': 'L&S',
    'München': 'MUN',
    'Stuttgart': 'STU',
    'Tradegate': 'TGT',
    'Baader Bank': 'BAE',
    'Gettex': 'BMN',
    'Ste Generale': 'SCGP',
    'Wien': 'WIEN',
    'Quotrix': 'XQTX',
    'BNP Zuerich': 'PAR',
    'Amsterdam': 'ASX'
}

async function getAktuellenKurs(anleihe, date) {
    const currDate = new Date(date)
    const prefixLength = 'https://www.finanzen.net/anleihen/'.length;
    const suffixLength = '-anleihe'.length;
    const id = anleihe['Quelle'].slice(prefixLength, -suffixLength)
    const code = BoersenCodeMap[anleihe['Börse']];
    const to = format(currDate, "yyyy-MM-dd")
    currDate.setDate(currDate.getDate() - 7)
    const from = format(currDate, "yyyy-MM-dd")
    const url = `https://www.finanzen.net/Ajax/BondController_HistoricPriceList/${id}/${code}/${from}_${to}`

    await new Promise(resolve => setTimeout(resolve, 500))
    const body = await fetchDataWithRetry(url, { method: 'POST' });
    const $ = cheerio.load(body);

    if ($('p').first().text() === 'Keine Daten verfügbar') {
        console.log(`Couldn't find any data for ${anleihe['Unternehmensname']} on ${date} for ${anleihe['Börse']}.`)
        console.log($.html())
        return null
    }

    return toNumber($('td').eq(2).text().trim()) / 100
}

async function getUnsereAnleihen(appendFile) {
    const wechselkursePath = 'data/currentWechselkurse.json';
    const outputPath = 'data/unsereAnleihen.csv';
    const today = new Date()

    const wechselkurse = await readJsonFile(wechselkursePath);

    let table = await readJsonFromSheet('FiMa.xlsx', 'Anleihenkäufe', 1, 19)
    table = table.filter((row) => {
        return row['Im Besitz']
    })

    const keyNames = ['Unternehmensname', 'Branche des Hauptkonzern', 'Coupon', 'Aktueller Kurs', ' ', 'Dirty Kaufpreis', 'Clean Kaufpreis', 'Kaufkurs', 'Wechselkurs am Kauftag', 'Aktueller Wechselkurs', 'Währung', 'Kaufdatum', 'Anteile', 'Stückelung', 'Letzte Zinszahlung', 'Zinszahlungen pro Jahr', 'ISIN']

    let rowCount = 0;
    if (appendFile) {
        fs.createReadStream(outputPath)
            .pipe(csv())
            .on('data', (row) => {
                rowCount++;
            })
    }
    else {
        fs.writeFile(outputPath, keyNames.join(',')+ '\n')
    }

    let processedCount = 1;

    for (const row of table) {
        if (rowCount > 0) {
            rowCount--;
            continue;
        }

        if (isSameDay(today, row['Kaufdatum'])) {
            row['Aktueller Kurs'] = row['Kaufkurs'];
        }
        else {
            row['Aktueller Kurs'] = await getAktuellenKurs(row, today);
        }
        row['Letzte Zinszahlung'] = calcLetzterZinstermin(row['Zinszahlungen pro Jahr'], row['Letzter Zinstermin'], today);

        row['Aktueller Wechselkurs'] = wechselkurse[row['Währung']]

        appendEntryToCSV(outputPath, row, keyNames)

        console.log(`Processed entry ${processedCount}`);
        processedCount++;
    }
}

getUnsereAnleihen(false)
