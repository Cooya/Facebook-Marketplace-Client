const assert = require('assert');
const mock = require('simple-mock').mock;

const config = require('../../config');
const setup = require('./setup');

describe('items deletion', () => {
	let launcher;

	before(async () => {
		launcher = await setup();
	});

	after(async () => {
		await launcher.itemsManager.end();
	});

	describe('load items from xml file with empty database', async () => {
		let warnings;
		let errors;

		before(async () => {
			warnings = mock(console, 'warn');
			errors = mock(console, 'error');

			// load items to sell into database and mark the first one as for sale
			const items = await launcher.itemsManager.loadItemsToSell(config.insertInputFile);
			items[0].facebook_id = Math.random().toString(36).substring(7);
			items[0].sent_at = new Date();
			await launcher.itemsManager.updateItem(items[0]);
		});

		it('should find 1 present item into database, 1 item absent from database and 1 invalid link', async () => {
			const items = await launcher.itemsManager.loadItemsToRemove(config.deleteInputFile);
			assert.equal(items.length, 1);
			assert.equal(items[0].id, '123');

			let invalidLinkFound = false;
			let notForSaleFound = false;
			for (let call of errors.calls) {
				if (call.arg == 'Link "%s" is invalid.')
					invalidLinkFound = true;
			}
			for (let call of warnings.calls) {
				if (call.arg == 'Item "%s" is not for sale.')
					notForSaleFound = true;
			}

			assert.equal(invalidLinkFound, true);
			assert.equal(notForSaleFound, true);
		});
	});

	describe('run the deletion', async () => {
		it('should be no item for sale left into database', async () => {
			await launcher.run('deletion');

			const itemsForSale = await launcher.itemsManager.getItems(true);
			assert.equal(itemsForSale.length, 0);

			const deletedItems = await launcher.itemsManager.getDeletedItems();
			assert.equal(deletedItems.length, 1);
			assert.equal(deletedItems[0].id, '123');
			assert.equal(deletedItems[0].deleted_at instanceof Date, true);
		});
	});

	describe('insert item which has been deleted', async () => {
		let warnings;

		before(async () => {
			warnings = mock(console, 'warn');
		});

		it('should reinsert the item', async () => {
			const fbIds = {};
			(await launcher.itemsManager.loadItemsToSell()).map((item) => {
				fbIds[item.title] = Math.random().toString(36).substring(7);
			});
			mock(launcher.itemsSeller, 'fbIds', fbIds);

			await launcher.run('posting');

			const itemsForSale = await launcher.itemsManager.getItems(true);
			assert.equal(itemsForSale.length, 2);
			assert.equal(itemsForSale[0].id, '123');
			assert.equal(itemsForSale[0].deleted_at, null);
			assert.equal(itemsForSale[0].facebook_id, null);

			const deletedItems = await launcher.itemsManager.getDeletedItems();
			assert.equal(deletedItems.length, 0);

			let removedItemFound;
			for (let call of warnings.calls) {
				if (call.arg == 'Item "123" removed from the marketplace.')
					removedItemFound = true;
			}
			assert.equal(removedItemFound, true);
		});
	});
});