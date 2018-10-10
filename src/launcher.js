const config = require('../config');
const ItemsManager = require('./items_manager');
const ItemsSeller = require('./items_seller');
const utils = require('./utils/utils');

module.exports = class Launcher {
	constructor() {
		this.itemsManager = new ItemsManager(config);
		this.itemsSeller = new ItemsSeller(config);

		this.actions = {
			posting: {
				inputFile: config.insertInputFile,
				loadMethod: this.itemsManager.loadItemsToSell.bind(this.itemsManager),
				processMethod: this.postItems.bind(this)
			},
			edition: {
				inputFile: config.updateInputFile,
				loadMethod: this.itemsManager.loadItemsToEdit.bind(this.itemsManager),
				processMethod: this.editItems.bind(this)
			},
			deletion: {
				inputFile: config.deleteInputFile,
				loadMethod: this.itemsManager.loadItemsToRemove.bind(this.itemsManager),
				processMethod: this.deleteItems.bind(this)
			}
		};
	}

	async run(action) {
		if(!this.actions[action])
			throw Error('Invalid provided action.');

		action = this.actions[action];

		const items = await action.loadMethod(action.inputFile);
		if(!items.length) {
			console.warn('No item to process.');
			return;
		}
		
		while(true) {
			try {
				await this.itemsSeller.open();
				await action.processMethod(items);
			}
			catch(e) {
				if(e.message == 'Page crashed!') {
					console.log('The page has crashed, restarting the process...');
					await this.itemsSeller.close();
					continue;
				}
				else
					throw e;
			}
			await this.itemsSeller.close();
			break;
		}
	}

	async postItems(items) {
		for(let item of items) {
			console.log('Putting item "%s" for sale...', item.id);

			if(this.itemsSeller.fbIds[item.title]) {
				console.warn('Item "%s" is already for sale.', item.id);
				item.fbId = this.itemsSeller.fbIds[item.title];
				await this.itemsManager.updateItem(item);
				continue;
			}

			await this.itemsSeller.sellItem(item);
			if(config.commit) {
				if(!this.itemsSeller.fbIds[item.title])
					console.error('The item "%s" has not been found among items for sale.', item.id);
				else {
					item.fbId = this.itemsSeller.fbIds[item.title];
					await this.itemsManager.updateItem(item);
					console.log('Item "%s" is now for sale.', item.id);
				}
			}
			await utils.randomSleep(config.commit ? config.intervalBetweenActions : 2);
		}
	}
	
	async editItems(items) {
		for(let item of items) {
			console.log('Updating item "%s"...', item.id);
			if(await this.itemsSeller.manageItem(item, 'edit')) {
				if(config.commit)
					await this.itemsManager.updateItem(item);
				console.log('Item "%s" has been updated successfully.', item.id);
				await utils.randomSleep(config.commit ? config.intervalBetweenActions : 2);
			}
		}
	}
	
	async deleteItems(items) {
		for(let item of items) {
			console.log('Removing item "%s"...', item.id);
			if(await this.itemsSeller.manageItem(item, 'remove')) {
				if(config.commit)
					await this.itemsManager.removeItem(item);
				console.log('Item "%s" has been removed successfully.', item.id);
				await utils.randomSleep(config.commit ? config.intervalBetweenActions : 2);
			}
		}
	}
};