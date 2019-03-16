const assert = require('assert');
const mock = require('simple-mock').mock;
const restore = require('simple-mock').restore;
const utils = require('@coya/utils');

const config = require('../../config');
const Launcher = require('../../src/launcher');

describe('complete process test : insert, update and delete', () => {
	let launcher;
	let warnings;
	let errors;

	before(async () => {
		mock(config, 'insertInputFile', 'tests/e2e/insert_sample.xml');
		mock(config, 'updateInputFile', 'tests/e2e/update_sample.xml');
		mock(config, 'deleteInputFile', 'tests/e2e/delete_sample.xml');
		mock(config, 'commit', true);

		const mysql = config.mysql;
		mysql.database = 'Tests';
		mock(config, 'mysql', mysql);

		mock(utils, 'randomSleep').callFn(() => Promise.resolve());

		launcher = new Launcher();
		await launcher.itemsManager.connect();
		await launcher.itemsManager.clearItems();
	});

	beforeEach(() => {
		warnings = mock(console, 'warn');
		errors = mock(console, 'error');
	});

	after(async () => {
		await launcher.itemsManager.end();
		await launcher.itemsSeller.close();
	});

	describe('create ad on the facebook marketplace and throw a "page crashed" error', async () => {
		before(async () => {
			let errorAlreadyThrown = false;
			mock(launcher.itemsSeller, 'sellItem').callFn((item) => {
				if (!errorAlreadyThrown) {
					errorAlreadyThrown = true;
					throw Error('Page crashed!');
				} else {
					restore(launcher.itemsSeller, 'sellItem');
					return launcher.itemsSeller.sellItem(item);
				}
			});

			let error2AlreadyThrown = false;
			mock(launcher.itemsSeller, 'fillSellForm').callFn((item) => {
				if (!error2AlreadyThrown) {
					error2AlreadyThrown = true;
					throw Error('Form error !');
				} else {
					restore(launcher.itemsSeller, 'fillSellForm');
					return launcher.itemsSeller.fillSellForm(item);
				}
			});
		});

		it('should restart the posting process when the error happens', async function() {
			this.timeout(config.testsTimeout);
			await launcher.run('posting');

			const item = await launcher.itemsManager.getItem('12345');
			assert.notEqual(item.facebook_id, null);
		});
	});

	describe('try to create an ad that already exists on the facebook marketplace', async () => {
		it('should do nothing', async function() {
			this.timeout(config.testsTimeout);
			await launcher.run('posting');

			let counter = 0;
			for (let call of warnings.calls) {
				if (call.arg == 'No item to process.') counter++;
			}

			assert.equal(counter, 1);
		});
	});

	describe('update existing ad on the facebook marketplace', async () => {
		it('the item should have updates', async function() {
			this.timeout(config.testsTimeout);
			await launcher.run('edition');

			const item = await launcher.itemsManager.getItem('12345');
			assert.notEqual(item.facebook_id, null);
			assert.equal(item.price, '50 000');
			assert.equal(item.description, 'Maison de forêt sympathique avec des oies pour garder la porte d\'entrée.');
			assert.equal(item.city, 'Metz');
		});
	});

	describe('update already up-to-date ad on the facebook marketplace', async () => {
		it('should do nothing', async function() {
			this.timeout(config.testsTimeout);
			await launcher.run('edition');

			let counter = 0;
			for (let call of warnings.calls) {
				if (call.arg == 'Item "%s" is already up-to-date.') counter++;
			}

			assert.equal(counter, 1);
		});
	});

	describe('delete existing ad on the facebook marketplace', async () => {
		it('delete the ad from the marketplace', async function() {
			this.timeout(config.testsTimeout);
			await launcher.run('deletion');

			const item = await launcher.itemsManager.getItem('12345');
			assert.equal(item.deleted_at instanceof Date, true);
		});
	});

	describe('delete ad not into database', async () => {
		it('should display an error', async function() {
			this.timeout(config.testsTimeout);
			await launcher.run('deletion');

			let warnsCounter = 0;
			for (let call of warnings.calls) {
				if (call.arg == 'Item "%s" not found into database.') warnsCounter++;
			}

			assert.equal(warnsCounter, 1);
		});
	});

	describe('delete ad not on sale', async () => {
		before(async () => {
			await launcher.itemsManager.insertItem({
				id: 45678,
				title: 'test',
				url_site: 'test',
				type: 'test'
			});
		});

		it('should display a warning and update the item deletion date in the database', async function() {
			this.timeout(config.testsTimeout);
			await launcher.run('deletion');

			let warnsCounter = 0;
			for (let call of warnings.calls) {
				if (call.arg == 'Item "%s" is not for sale.') warnsCounter++;
			}

			assert.equal(warnsCounter, 1);
			const item = await launcher.itemsManager.getItem('45678');
			assert.equal(item.deleted_at instanceof Date, true);
		});
	});

	describe('delete non-existing ad into the marketplace', async () => {
		before(async () => {
			await launcher.itemsManager.updateItem({
				id: 45678,
				title: 'test',
				url_site: 'test',
				type: 'test',
				facebook_id: 123,
				sent_at: new Date(),
				updated_at: null,
				deleted_at: null
			});
		});

		it('should display an error', async function() {
			this.timeout(config.testsTimeout);
			await launcher.run('deletion');

			let errorsCounter = 0;
			for (let call of errors.calls) {
				if (call.arg == 'Cannot update or delete item "%s", not found in selling.') errorsCounter++;
			}

			assert.equal(errorsCounter, 1);
		});
	});

	describe('delete already deleted ad', async () => {
		before(async () => {
			await launcher.itemsManager.removeItem({id: '45678'});
		});

		it('it should do nothing', async function() {
			this.timeout(config.testsTimeout);
			await launcher.run('deletion');

			let warnsCounter = 0;
			for (let call of warnings.calls) {
				if (call.arg == 'Item "%s" has already been removed.') warnsCounter++;
			}

			assert.equal(warnsCounter, 1);
		});
	});
});
