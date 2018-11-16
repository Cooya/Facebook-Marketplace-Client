const assert = require('assert');
const mock = require('simple-mock').mock;

const config = require('../../config');
const setup = require('./setup');

describe('items insertion : testing items to insert loading from file and database', () => {
	let launcher;

	before(async() => {
		launcher = await setup();
	});

	after(async () => {
		await launcher.itemsManager.end();
	});

	describe('load items from xml file', async () => {
		let errors;

		before(async () => {
			errors = mock(console, 'error');
		});

		it('should be 2 present items and 4 absent items, that means 4 errors must have been logged', async () => {
			const items = await launcher.itemsManager.loadItemsToSell(config.insertInputFile);
			assert.equal(items.length, 2);

			assert.equal(items[0].url_site, 'https://www.consortium-immobilier.fr/annonce-123.html');
			assert.equal(items[0].url_photo.length, 1);

			assert.equal(items[1].url_site, 'https://www.consortium-immobilier.fr/annonce-456.html');
			assert.equal(items[1].url_photo.length, 3);

			let missingPicturesCounter = 0;
			let missingDescriptionCounter = 0;
			let invalidLinkCounter = 0;
			for (let call of errors.calls) {
				if (call.arg.indexOf('missing key "url_photo"') != -1)
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

	describe('load items to sell from database', async () => {
		it('should be 2 present items and 4 absent items', async () => {
			const items = await launcher.itemsManager.loadItemsToSell();
			assert.equal(items.length, 2);

			assert.equal(items[0].url_site, 'https://www.consortium-immobilier.fr/annonce-123.html');
			assert.equal(items[0].url_photo.length, 1);

			assert.equal(items[1].url_site, 'https://www.consortium-immobilier.fr/annonce-456.html');
			assert.equal(items[1].url_photo.length, 3);
		});
	});

	describe('post items', async () => {
		it('should update facebook id of every item put into the marketplace', async () => {
			const fbIds = {};
			(await launcher.itemsManager.loadItemsToSell()).map((item) => {
				fbIds[item.title] = Math.random().toString(36).substring(7);
			});
			mock(launcher.itemsSeller, 'fbIds', fbIds);

			await launcher.run('posting');

			const items = await launcher.itemsManager.getItemsForSale();
			assert.equal(items.length, 2);
			for(let item of items) {
				assert.equal(typeof item.facebook_id, 'string');
				assert.equal(item.sent_at instanceof Date, true);
			}
		});
	});
});