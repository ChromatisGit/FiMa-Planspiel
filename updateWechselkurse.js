const fs = require('fs').promises;
const { getDollarWechselkurse } = require('./requestManager.js');

async function updateWechselkurse(date) {
    const usd = await getDollarWechselkurse(date);

    const wechselkurse = {
        "EUR": 1,
        "USD": usd[0].kurs
    }

    fs.writeFile('data/currentWechselkurse.json', JSON.stringify(wechselkurse, null, 2))
    console.log('Exported Wechselkurse')
}

module.exports = {
    updateWechselkurse
};