const fs = require('fs').promises;
const { getDollarWechselkurs } = require('./requestManager.js');

async function updateWechselkurse(date) {
    const usd = await getDollarWechselkurs(date);

    const wechselkurse = {
        "EUR": 1,
        "USD": usd
    }

    fs.writeFile('data/currentWechselkurse.json', JSON.stringify(wechselkurse, null, 2))
    console.log('Exported Wechselkurse')
}

module.exports = {
    updateWechselkurse
};