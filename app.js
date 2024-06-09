const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { parse, format, isValid } = require('date-fns');
const { setupFiles } = require('./setupFiles.js');
const { updateZinszahlungen } = require('./updateZinszahlungen.js');
const { updateKurseUnsereAnleihen } = require('./updateKurseUnsereAnleihen.js');
const { getAnleihen } = require('./getAnleihen.js');
const { updateAnleihenData } = require('./updateAnleihenData.js');
const { updateBranchenStorage } = require('./updateBranchenStorage.js');
const { updateKurseFromAnleihen } = require('./updateKurseFromAnleihen.js');


function userInput(query = '') {
    process.stdout.write(query);
    return new Promise(resolve => {
        process.stdin.once('data', data => {
            resolve(data.toString().trim());
        });
    });
}

async function validateInput({
    inputMsg,
    failedMsg,
    validator,
}) {
    while (true) {
        const input = await userInput(inputMsg)
        const validatedInput = validator(input)
        if (validatedInput !== undefined) {
            return validatedInput
        }
        console.log('\n'+failedMsg+'\n');
    }
}

async function main() {
    const sheetPath = 'FiMa.xlsx'
    if(!fs.existsSync(sheetPath)) {
        console.log(`Excel nicht gefunden! Die Excel muss im selben Ordner liegen wie dieses Programm und ${sheetPath} heißen!`)
        await userInput()
        process.exit();
    }

    setupFiles();
    process.stdin.setEncoding('utf8');

    while (true) {
        console.log(
        `Welcher Prozess soll ausgeführt werden? Tippe die Zahl ein:
        1 : Erfassen der Zinszahlungen
        2 : Verkaufskurse aktualisieren
        3 : Neue Anleihen auflisten
        4 : Programm schließen`);

        const command = await userInput()
        console.clear();
        switch (command) {
            case '1':
                await selectZinszahlungen();
                break;
            case '2':
                await selectVerkaufskurse();
                break;
            case '3':
                await selectNeueAnleihen();
                break;
            case '4':
                process.exit();
            default:
                console.log(`Unbekannter Befehl ${command}! Bitte tippe eine der folgenden Zahlen ein!`)
        }
        console.log('')
    }
}

async function selectZinszahlungen() {
    const zinszahlungenPath = 'storage/zinszahlungen.csv';
    const zinszahlungenExists = fs.existsSync(zinszahlungenPath);

    console.log('Gebe den Zeitraum an, von wann bis wann Zinszahlungen hinzugefügt werden sollen.')
    if (zinszahlungenExists) {
        console.log('(Falls kein Zeitraum angegeben wird, wird der letzte Zinszahlungstag bis einschließlich heute angenommen.)');
    }

    const startDatum = await validateInput({
        inputMsg: 'Startdatum (dd-MM-yyyy): ',
        failedMsg: 'Bitte gebe ein valides Datum im Format dd-mm-yyyy ein!',
        validator: async (input) => {
            if(input === '' && zinszahlungenExists) {
                const lastDate = await getLastZinszahlung(zinszahlungenPath)
                lastDate.setDate(lastDate.getDate() + 1);
                console.log(format(lastDate, "dd-MM-yyyy"))
                return lastDate;
            }
            const parsedDate = parse(input, 'dd-MM-yyyy', new Date());
            if (isValid(parsedDate)) {
                return parsedDate
            }
            return undefined;
        }
    })

    const endDatum = await validateInput({
        inputMsg: '\nEnddatum: ',
        failedMsg: 'Bitte gebe ein valides Datum im Format dd-mm-yyyy ein!',
        validator: (input) => {
            if(input === '' && zinszahlungenExists) {
                console.log(format(new Date(), "dd-MM-yyyy"))
                return new Date();
            }
            const parsedDate = parse(input, 'dd-MM-yyyy', new Date());
            if (isValid(parsedDate)) {
                return parsedDate
            }
            return undefined;
        }
    })

    await updateZinszahlungen({
            startDatum,
            endDatum,
    })
}

async function getLastZinszahlung(csvFilePath) {
    let rows = [];
    const stream = fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
            rows.push(row);
        });

    await new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('end', resolve);
    });

    const lastRow = rows[rows.length - 1];
    return parse(lastRow[Object.keys(lastRow)[0]], 'dd-MM-yyyy', new Date());
}

async function selectVerkaufskurse() {

}

async function selectNeueAnleihen() {

}

main()