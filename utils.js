const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const request = require('request');
const util = require('util');
const xml2js = require('xml2js');

const readFile = util.promisify(fs.readFile);
const parseXML = util.promisify(xml2js.parseString);
const mkdir = util.promisify(mkdirp);

async function readXMLFile(filePath) {
    const xml = await readFile(filePath);
    return parseXML(xml);
}

async function downloadFile(url, destFolder) {
    await mkdir(destFolder);

    const filePath = path.join(destFolder, path.basename(url));
    const file = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
        request.get(url).pipe(file);

        file.on('error', reject);
        file.on('finish', resolve.bind(null, filePath));
    });
}

module.exports = {
    readXMLFile: readXMLFile,
    downloadFile: downloadFile
}