const assert = require('assert');
const mock = require('simple-mock').mock;

const config = require('../../config');
const Launcher = require('../../src/launcher');
const utils = require('../../src/utils/utils');

describe('complete process test : insert, update and delete', () => {
	let launcher;

	before(async () => {
		mock(config, 'dbFile', 'tests/e2e/db.json');
		mock(config, 'insertInputFile', 'tests/e2e/insert_sample.xml');
		mock(config, 'updateInputFile', 'tests/e2e/update_sample.xml');
		mock(config, 'deleteInputFile', 'tests/e2e/delete_sample.xml');
		mock(config, 'commit', true);
		mock(config, 'headless', false);

		mock(utils, 'randomSleep').callFn(() => Promise.resolve());

		launcher = new Launcher();

		try {
			await utils.deleteFile(config.cookiesFile);
			await utils.deleteFile(config.dbFile);
		}
		catch (e) { }
	});

	after(async () => {
		try {
			await utils.deleteFile(config.dbFile);
		}
		catch (e) { }
		launcher.itemsSeller.close();
	});
	
	describe('create ad on the facebook marketplace', async () => {
		it('the item should have a real facebook id', async function() {
			this.timeout(60000);
			await launcher.run('posting');

			const item = await launcher.itemsManager.getItem('12345');
			assert.notEqual(item.fbId, null);
		});
	});

	describe('update existing ad on the facebook marketplace', async () => {
		it('the item should have updates', async function() {
			this.timeout(60000);
			await launcher.run('edition');

			const item = await launcher.itemsManager.getItem('12345');
			assert.notEqual(item.fbId, null);
			assert.equal(item.price, '50 000');
			assert.equal(item.description, 'Maison de forêt sympathique avec des oies pour garder la porte d\'entrée.');
			assert.equal(item.location, 'Metz');
		});
	});

	describe('delete existing ad on the facebook marketplace', async () => {
		it('the item should not be present into database', async function() {
			this.timeout(60000);
			await launcher.run('deletion');

			const item = await launcher.itemsManager.getItem('12345');
			assert.equal(item, null);
		});
	});
});