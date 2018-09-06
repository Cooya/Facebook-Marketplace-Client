const assert = require('assert');
const mock = require('simple-mock').mock;

const config = require('../../config');
const ItemsManager = require('../../src/items_manager');
const ItemsSeller = require('../../src/items_seller');
const Launcher = require('../../src/launcher');
const utils = require('../../src/utils/utils');

describe('items update : testing items to edit loading from file and database', () => {
	let itemsManager;

	before(async () => {
		mock(utils, 'downloadFile').callFn((url) => Promise.resolve(url));
		mock(config, 'dbFile', 'tests/integration/db.json');
		mock(config, 'insertInputFile', 'tests/integration/insert_sample.xml');
		mock(config, 'updateInputFile', 'tests/integration/update_sample.xml');
		mock(config, 'commit', true);

		itemsManager = new ItemsManager(config);
	});

	after(async () => {
		try {
			await utils.deleteFile(config.dbFile);
		}
		catch (e) { }
	});

	describe('load items from xml file with empty database', async () => {
		let warnings;
		let errors;

		before(async () => {
			warnings = mock(console, 'warn');
			errors = mock(console, 'error');
		});

		it('should be 0 present item, 1 invalid and 3 not found into database', async () => {
			const items = await itemsManager.loadItemsToEdit(config.updateInputFile);
			assert.equal(items.length, 0);

			let missingPicturesCounter = 0;
			let missingDescriptionCounter = 0;
			let missingLocationCounter = 0;
			let invalidLinkCounter = 0;
			for (let call of errors.calls) {
				if (call.arg.indexOf('missing key "pictures"') != -1)
					missingPicturesCounter++;
				if (call.arg.indexOf('missing key "description"') != -1)
					missingDescriptionCounter++;
				if (call.arg.indexOf('missing key "location"') != -1)
					missingLocationCounter++;
				if (call.arg.indexOf('link is invalid') != -1)
					invalidLinkCounter++;
			}

			assert.equal(missingPicturesCounter, 0);
			assert.equal(missingDescriptionCounter, 0);
			assert.equal(missingLocationCounter, 1);
			assert.equal(invalidLinkCounter, 0);

			let itemNotFoundCounter = 0;
			for (let call of warnings.calls) {
				if(call.arg == 'Item "%s" not found into database.')
					itemNotFoundCounter++;
			}

			assert.equal(itemNotFoundCounter, 3);
		});
	});

	describe('update items from xml file with loaded database', async () => {
		let launcher;

		before(async () => {
			try {
				await utils.deleteFile(config.dbFile);
			}
			catch (e) { }

			launcher = new Launcher();
			itemsManager = launcher.itemsManager;

			// load items to sell into database and put them a random facebook id
			const items = await itemsManager.loadItemsToSell(config.insertInputFile);
			for(let item of items) {
				item.fbId = Math.random().toString(36).substring(7);
				await itemsManager.updateItem(item);
			}

			// mock ItemsSeller methods
			mock(ItemsSeller.prototype, 'open').callFn(() => Promise.resolve());
			mock(ItemsSeller.prototype, 'close').callFn(() => Promise.resolve());
			mock(ItemsSeller.prototype, 'manageItem').callFn(() => Promise.resolve(true));
			mock(utils, 'randomSleep').callFn(() => Promise.resolve());
		});

		it('one item should be updated', async () => {
			let item = await itemsManager.getItem('123');
			assert.equal(item.price, '300 000');
			assert.equal(item.description, 'Jolie maison avec vue sur un parc où l\'on peut aperçevoir des écureuils roux.');

			await launcher.run('edition');

			item = await itemsManager.getItem('123');
			assert.equal(item.price, '200 000');
			assert.equal(item.description, 'Jolie maison avec vue sur un parc où l\'on peut aperçevoir des écureuils roux et gris.');
		});
	});
});