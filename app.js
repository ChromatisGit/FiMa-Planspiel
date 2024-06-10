const fs = require('fs');
const csv = require('csv-parser');
const { parse, format, isValid } = require('date-fns');
const { setupFiles } = require('./setupFiles.js');
const { updateZinszahlungen } = require('./updateZinszahlungen.js');
const { updateKurseUnsereAnleihen } = require('./updateKurseUnsereAnleihen.js');
const { getAnleihen } = require('./getAnleihen.js');
const { updateAnleihenData } = require('./updateAnleihenData.js');
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
    const zinszahlungenPath = 'generated/zinszahlungen.csv';
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
    console.log(
        `Gib an, von welchen Tag die Kurse gefetcht werden sollen.
        (Falls kein Datum angegeben wird, wird heute angenommen.)`)

    const datum = await validateInput({
        inputMsg: 'Datum (dd-MM-yyyy): ',
        failedMsg: 'Bitte gebe ein valides Datum im Format dd-mm-yyyy ein!',
        validator: (input) => {
            if(input === '') {
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

    await updateKurseUnsereAnleihen(datum)
}

async function selectNeueAnleihen() {

    const min_zins = await validateInput({
        inputMsg: 'Wie hoch ist der Mindestcoupon (in %): ',
        failedMsg: 'Bitte gebe eine natürliche Zahl ein!',
        validator: (input) => {
            if (input.endsWith('%')) {
                input = input.slice(0, -1);
            }
            const num = Number(input);
            if(Number.isInteger(num) && num > 0 && input !== '') {
                return num;
            }
            return undefined;
        }
    })

    console.log('In welcher Währung soll die Anleihe emittiert sein (aktuell werden nur EUR und USD unterstützt):')

    const currency = await validateInput({
        inputMsg: '',
        failedMsg: "Nur 'USD' und 'EUR' werden unterstützt!",
        validator: (input) => {
            if(input !== 'USD' && input !== 'EUR') {
                return undefined;
            }
            return input;
        }
    })

    await getAnleihen({min_zins, currency})

    console.log('Alle ISIN der Anleihen abgerufen. Fetche detailliertere Daten...')
    await new Promise(resolve => setTimeout(resolve, 3000));

    while(true) {
        const branchenlos = await updateAnleihenData()

        if(branchenlos === 0) {
            break;
        }
        console.log(`\n${branchenlos} Anleihen ohne Branche gefunden!`)

        const command = await fehlendeBranche();
        if (command === '1') {
            continue;
        }
        if (command === '2') {
            break;
        }
        if (command === '3') {
            return;
        }
    }

    console.log('Alle detaillierten Anleihen abgerufen. Fetche Kursdaten...')
    await new Promise(resolve => setTimeout(resolve, 3000));

    await updateKurseFromAnleihen();
}

async function fehlendeBranche() {
    while (true) {
        console.log(`Füge die Branchen der branchen.csv hinzu!

            1 : Die fehlenden Branchen wurden hinzugefügt
            2 : Ignoriere alle Anleihen ohne Branche
            3 : Abbrechen`);

            const command = await userInput()
            console.clear();
            switch (command) {
                case '1':
                case '2':
                case '3':
                    return command;
                default:
                    console.log(`Unbekannter Befehl ${command}! Bitte tippe eine der folgenden Zahlen ein!\n`)
            }
    }
}

main()