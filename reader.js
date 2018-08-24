const fs = require('fs');
const xml2js = require('xml2js');
const util = require('util');

const readFile = util.promisify(fs.readFile);
const parseXML = util.promisify(xml2js.parseString);

async function readXMLFile(filePath) {
    const xml = await readFile(filePath);
    return parseXML(xml);
}

module.exports = {
    readXMLFile: readXMLFile
}