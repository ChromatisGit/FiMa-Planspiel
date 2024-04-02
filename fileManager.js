const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const { toCSVString } = require('./dataTransformer.js');

function convertJSONtoCSV(obj, keys) {
    const csvRows = obj.map((item) => {
        return keys
        .map(key => toCSVString(item[key]))
        .join(',');
    });

    const csv = [keys.join(','), ...csvRows].join('\n');
    return csv;
}

async function appendEntryToCSV(filePath, entry, keys) {
    try {
        let csvRow = keys
        .map(key => toCSVString(entry[key]))
        .join(',') + '\n';
        await fs.appendFile(filePath, csvRow, 'utf8');
    } catch (error) {
        console.error(`Error appending to CSV file: ${error}`);
        throw error;
    }
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

async function readJsonFromSheet(filePath, sheetName, startColumn, endColumn) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found.`);
    }

    const jsonData = [];

    worksheet.eachRow({ includeEmpty: false }, (row) => {
        const rowData = {};
        for (let i = startColumn; i <= endColumn; i++) {
            const cell = row.getCell(i);
            const header = worksheet.getRow(1).getCell(i).value;
            rowData[header] = cell.value.result ?? cell.value.text ?? cell.value; //If it's a formula or a hyperlink, filter the value out
        }
        jsonData.push(rowData);
    });
    jsonData.shift()

    return jsonData;
}

module.exports = { convertJSONtoCSV, appendEntryToCSV, readJsonFile, readJsonFromSheet };