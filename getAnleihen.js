const fs = require('fs').promises;
const { getNeueAnleihen } = require('./requestManager.js');

async function getAnleihen({min_zins, currency}) {
    const anleihen = await getNeueAnleihen({min_zins, currency})

    fs.writeFile('data/fetchedAnleihen.json', JSON.stringify(anleihen, null, 2))
    console.log('Exported Anleihen')
}

module.exports = {
    getAnleihen
};