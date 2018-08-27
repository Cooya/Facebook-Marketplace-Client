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

async function downloadFile(url, destFolder, fileName = null) {
    await mkdir(destFolder);

    if(!fileName)
        fileName = path.basename(url);

    const filePath = path.join(destFolder, fileName);
    const file = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
        request.get(url).pipe(file);

        file.on('error', reject);
        file.on('finish', resolve.bind(null, filePath));
    });
}

async function fileExists(filePath) {
    try {
        await util.promisify(fs.access)(filePath);
        return true;
    }
    catch(e) {
        return false;
    }
}

module.exports = {
    readXMLFile: readXMLFile,
    downloadFile: downloadFile,
    fileExists: fileExists
}