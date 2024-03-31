const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const MIN_ZINS = 6;
const CURRENCY = 'EUR';

const url = `https://www.finanzen.net/anleihen/suche?anwi=&abti=&aw=${CURRENCY}%2C&arendv=&arendb=&arlv=&arlb=&arlfv=&arlfb=&absti=&aemvv=&aemvb=&aei=&al=&alion=&anr=a&arv=&arb=&arak=a&arad=a&aboe=al&anmk=j&astkv=&astkb=5000&aakv=&aakb=&aums=&aspd=&anem=n&akv=${MIN_ZINS}&akb=&akt=&aszv=&aszb=&azfv=&azfb=&adv=&adb=&amdv=&amdb=&s=1&pkSortT=8&pkSortR=2`

function convertJSONtoCSV(obj) {
    const keys = Object.keys(obj[0]);

    const csvRows = obj.map((item) => {
        return keys.map(key => {
            let field = item[key];
            if (typeof field === 'string' && field.includes(',')) {
                field = `"${field}"`; // Enclose fields containing commas in quotes
            }
            return field;
        }).join(',');
    });

    const csv = [keys.join(','), ...csvRows].join('\n');
    return csv;
}

async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading file from disk: ${error}`);
        throw error;
    }
}

async function getAnleihen() {
    const branchenPath = path.join(__dirname, 'branchen.json');
    const branchen = readJsonFile(branchenPath)
    const anleihen = []
    const branchenlos = []
    let page = 1;

    while (true) {
        const response = await fetch(`${url}&p=${page}`);
        const body = await response.text();
        const $ = cheerio.load(body);
        console.log(`Loaded Page ${page}`)

        const tableRows = $('main > section > article > div > table > tbody > tr');

        if (tableRows.length === 0) {
            break;
        }

        tableRows.each((_, row) => {
            const anleihe = {};
            const firstTd = $(row).find('td:first');
            anleihe.name = firstTd.find('div:first').text().trim();
            if (!branchen.hasOwnProperty(anleihe.name) && !branchenlos.some((a) => a.name === anleihe.name)){
                branchenlos.push(anleihe)
            }
            anleihe.id = firstTd.find('div:eq(1) a').text().trim();
            anleihe.link = `https://www.finanzen.net${firstTd.find('div:eq(1) a').attr('href')}`;
            anleihen.push(anleihe)
            return;
        })
        page++;
    }

    fs.writeFile('aktuelleAnleihen.json', JSON.stringify(anleihen, null, 2))
    console.log('Exported Anleihen')
    if (branchenlos.length > 0) {
        fs.writeFile('branchenlos.csv', convertJSONtoCSV(branchenlos))
        console.log(`${branchenlos.length} Anleihen ohne Branche gefunden!`)
    }
}

getAnleihen()