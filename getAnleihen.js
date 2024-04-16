const fs = require('fs').promises;
const { getNeueAnleihen } = require('./requestManager.js');

async function getAnleihen() {
    const anleihen = await getNeueAnleihen({min_zins: 10, currency: 'USD'})

    fs.writeFile('data/fetchedAnleihen.json', JSON.stringify(anleihen, null, 2))
    console.log('Exported Anleihen')
}

getAnleihen()