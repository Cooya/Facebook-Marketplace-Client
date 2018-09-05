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
		if(!items.length)
			throw Error('No item to process.');
		
		await this.itemsSeller.open();
		await action.processMethod(items);
		await this.itemsSeller.close();
	}

	async postItems(items) {
		for(let item of items) {
			console.log('Selling item "' + item.title + '"...');
			await this.itemsSeller.sellItem(item);
			if(config.commit)
				await this.itemsManager.updateItemsWithBindings(this.itemsSeller.bindings);
			await utils.randomSleep(config.commit && config.intervalBetweenSellings);
			console.log('Item "%s" is now selling.', item.id);
		}
	}
	
	async editItems(items) {
		let processedItem;
		for(let item of items) {
			processedItem = await this.itemsManager.getProcessedItem(item.id);
			if(!processedItem)
				continue;
	
			console.log('Updating item "%s"...', item.id);
			const success = await this.itemsSeller.manageItem(item, 'edit');
			if(success) {
				if(config.commit)
					await this.itemsManager.updateItem(processedItem, item);
				await utils.randomSleep(config.commit && config.intervalBetweenSellings);
				console.log('Item "%s" has been updated successfully.', item.id);
			}
		}
	}
	
	async deleteItems(items) {
		let processedItem;
		for(let id of items) {
			processedItem = await this.itemsManager.getProcessedItem(id);
			if(!processedItem)
				continue;
	
			console.log('Removing item "%s"...', id);
			await this.itemsSeller.manageItem(processedItem, 'remove');
			if(config.commit)
				await this.itemsManager.removeItem(processedItem);
			await utils.randomSleep(config.commit && config.intervalBetweenSellings);
			console.log('Item "%s" has been removed successfully.', id);
		}
	}
};