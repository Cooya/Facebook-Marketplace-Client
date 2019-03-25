const mock = require('simple-mock').mock;
const utils = require('@coya/utils');

const config = require('../../config');
const Launcher = require('../../src/launcher');
const ItemsSeller = require('../../src/items_seller');

process.env.NODE_ENV = 'test';

module.exports = async () => {
	mock(utils, 'downloadFile').callFn(() => Promise.resolve('tests/integration/pic.jpg'));
	const mysql = config.mysql;
	mysql.database = 'Tests';
	mock(config, 'mysql', mysql);
	mock(config, 'insertInputFile', 'tests/integration/insert_sample.xml');
	mock(config, 'updateInputFile', 'tests/integration/update_sample.xml');
	mock(config, 'deleteInputFile', 'tests/integration/delete_sample.xml');
	mock(config, 'commit', true);

	// mock ItemsSeller methods
	mock(ItemsSeller.prototype, 'open').callFn(() => Promise.resolve());
	mock(ItemsSeller.prototype, 'close').callFn(() => Promise.resolve());
	mock(ItemsSeller.prototype, 'sellItem').callFn(() => Promise.resolve());
	mock(ItemsSeller.prototype, 'manageItem').callFn(() => Promise.resolve(true));

	// mock randomSleep parameters to reduce the sleeping time
	utils.randomSleep2 = utils.randomSleep;
	utils.randomSleep = () => utils.randomSleep2(1);

	let launcher = new Launcher();
	await launcher.itemsManager.connect();
	await launcher.itemsManager.clearItems();
	return launcher;
};
