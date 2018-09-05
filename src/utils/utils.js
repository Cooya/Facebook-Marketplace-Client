const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const request = require('request');
const sleep = require('sleep');
const util = require('util');
const xml2js = require('xml2js');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const parseXML = util.promisify(xml2js.parseString);
const mkdir = util.promisify(mkdirp);
const builder = new xml2js.Builder({rootName: 'xml'});

async function readXMLFile(filePath) {
	const xml = await readFile(filePath);
	return parseXML(xml);
}

async function writeXMLFile(filePath, content) {
	const xml = builder.buildObject(content);
	await writeFile(filePath, xml);
}

async function downloadFile(url, destFolder, fileName = null, forceDownload = false) {
	await mkdir(destFolder);

	if(!fileName)
		fileName = path.basename(url);

	const filePath = path.join(destFolder, fileName);
	if(!forceDownload && await fileExists(filePath)) // do not download if the file already exists
		return Promise.resolve(filePath);

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

function getRandomNumber(min, max) {
	return Number.parseInt(Math.random() * (max - min) + min);
}

async function randomSleep(interval = 2) {
	let seconds = Array.isArray(interval) ? getRandomNumber(interval[0], interval[1]) : interval;
	console.log('Sleeping for %s seconds...', seconds);
	await sleep.sleep(seconds);
}

module.exports = {
	readXMLFile: readXMLFile,
	writeXMLFile: writeXMLFile,
	downloadFile: downloadFile,
	fileExists: fileExists,
	deleteFile: util.promisify(fs.unlink),
	getRandomNumber: getRandomNumber,
	randomSleep: randomSleep
};