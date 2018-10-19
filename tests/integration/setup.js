const mock = require('simple-mock').mock;

const config = require('../../config');
const Launcher = require('../../src/launcher');
const utils = require('../../src/utils/utils');

process.env.NODE_ENV = 'test';

module.exports = async () => {
	mock(utils, 'downloadFile').callFn((url) => Promise.resolve(url));
	const mysql = config.mysql;
	mysql.database = 'Tests';
	mock(config, 'mysql', mysql);
	mock(config, 'insertInputFile', 'tests/integration/insert_sample.xml');
	mock(config, 'updateInputFile', 'tests/integration/update_sample.xml');
	mock(config, 'commit', true);

	let launcher = new Launcher();
	await launcher.itemsManager.connect();
	await launcher.itemsManager.clearItems();
	return launcher;
};