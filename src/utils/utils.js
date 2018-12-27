const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const request = require('request');
const sleep = require('sleep');
const util = require('util');
const xml2js = require('xml2js');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const fileStat = util.promisify(fs.stat);
const parseXML = util.promisify(xml2js.parseString);
const mkdir = util.promisify(mkdirp);
const builder = new xml2js.Builder({ rootName: 'xml' });

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

	if (!fileName)
		fileName = path.basename(url);

	const filePath = path.join(destFolder, fileName);
	if (!forceDownload && await fileExists(filePath)) // do not download if the file already exists
		return Promise.resolve(filePath);

	console.log('Downloading picture...');
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
	catch (e) {
		return false;
	}
}

async function fileSize(filePath) {
	return (await fileStat(filePath)).size;
}

function getRandomNumber(min, max) {
	return Number.parseInt(Math.random() * (max - min) + min);
}

async function randomSleep(interval = 2) {
	let seconds = Array.isArray(interval) ? getRandomNumber(interval[0], interval[1]) : interval;
	console.log('Sleeping for %s seconds...', seconds);
	await sleep.sleep(seconds);
}

async function waitForValue(variable, expectedValue, delay = 500, iterations = 10) {
	//console.debug('Waiting for value...');
	for(let i = 0; i < iterations; ++i) {
		if(variable == expectedValue)
			return true;
		await sleep.msleep(delay);
	}
	return false;
}

module.exports = {
	readXMLFile,
	writeXMLFile,
	downloadFile,
	fileExists,
	fileSize,
	deleteFile: util.promisify(fs.unlink),
	getRandomNumber,
	randomSleep,
	waitForValue
};

Array.prototype.equalsTo = function(arr) {
	if (this === arr) return true;
	if (this == null || arr == null) return false;
	if (this.length != arr.length) return false;

	for (var i = 0; i < this.length; ++i) {
		if (this[i] !== arr[i]) return false;
	}
	return true;
};