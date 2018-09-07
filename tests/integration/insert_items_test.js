const assert = require('assert');
const mock = require('simple-mock').mock;

const config = require('../../config');
const ItemsManager = require('../../src/items_manager');
const ItemsSeller = require('../../src/items_seller');
const Launcher = require('../../src/launcher');
const utils = require('../../src/utils/utils');

describe('items insertion : testing items to insert loading from file and database', () => {
	let itemsManager;

	before(async () => {
		mock(utils, 'downloadFile').callFn((url) => Promise.resolve(url));
		mock(config, 'dbFile', 'tests/integration/db.json');
		mock(config, 'insertInputFile', 'tests/integration/insert_sample.xml');
		mock(config, 'commit', true);

		itemsManager = new ItemsManager(config);

		try {
			await utils.deleteFile(config.dbFile);
		}
		catch (e) { }
	});

	after(async () => {
		try {
			await utils.deleteFile(config.dbFile);
		}
		catch (e) { }
	});

	describe('load items from xml file', async () => {
		let errors;

		before(async () => {
			errors = mock(console, 'error');
		});

		it('should be 2 present items and 4 absent items', async () => {
			const items = await itemsManager.loadItemsToSell(config.insertInputFile);
			assert.equal(items.length, 2);

			assert.equal(items[0].link, 'https://www.consortium-immobilier.fr/annonce-123.html');
			assert.equal(items[0].pictures.length, 1);

			assert.equal(items[1].link, 'https://www.consortium-immobilier.fr/annonce-456.html');
			assert.equal(items[1].pictures.length, 3);
		});

		it('should display 4 errors', async () => {
			let missingPicturesCounter = 0;
			let missingDescriptionCounter = 0;
			let invalidLinkCounter = 0;
			for (let call of errors.calls) {
				if (call.arg.indexOf('missing key "pictures"') != -1)
					missingPicturesCounter++;
				if (call.arg.indexOf('missing key "description"') != -1)
					missingDescriptionCounter++;
				if (call.arg.indexOf('link is invalid') != -1)
					invalidLinkCounter++;
			}

			assert.equal(missingPicturesCounter, 1);
			assert.equal(missingDescriptionCounter, 2);
			assert.equal(invalidLinkCounter, 1);
		});
	});

	describe('load items from database and sell them', async () => {
		it('should be 2 present items and 4 absent items', async () => {
			const items = await itemsManager.loadItemsToSell();
			assert.equal(items.length, 2);

			assert.equal(items[0].link, 'https://www.consortium-immobilier.fr/annonce-123.html');
			assert.equal(items[0].pictures.length, 1);

			assert.equal(items[1].link, 'https://www.consortium-immobilier.fr/annonce-456.html');
			assert.equal(items[1].pictures.length, 3);
		});
	});

	describe('post items', async () => {
		let launcher;

		before(async () => {
			mock(ItemsSeller.prototype, 'open').callFn(() => Promise.resolve());
			mock(ItemsSeller.prototype, 'close').callFn(() => Promise.resolve());
			mock(ItemsSeller.prototype, 'sellItem').callFn(() => Promise.resolve());
			mock(utils, 'randomSleep').callFn(() => Promise.resolve());

			launcher = new Launcher();
		});

		it('should update facebook id of every item put into the marketplace', async () => {
			const fbIds = {};
			(await launcher.itemsManager.loadItemsToSell()).map((item) => {
				fbIds[item.title] = Math.random().toString(36).substring(7);
			});
			mock(launcher.itemsSeller, 'fbIds', fbIds);

			await launcher.run('posting');

			const items = launcher.itemsManager.getItemsForSale();
			assert.equal(items.length, 2);
			for(let item of items)
				assert.equal(typeof item.fbId, 'string');
		});
	});
});