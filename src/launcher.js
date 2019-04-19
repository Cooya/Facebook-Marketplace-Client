const utils = require('@coya/utils');

const config = require('../config');
const ItemsManager = require('./items_manager');
const ItemsSeller = require('./items_seller');
const logger = require('./logger');

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

		this.breakParameters = {};
		this.determineBreakParameters();
	}

	async run(action) {
		// select the action to execute
		if (!this.actions[action]) throw Error('Invalid provided action.');
		action = this.actions[action];

		// load items to process
		const items = await action.loadMethod(action.inputFile);
		if (!items.length) {
			logger.warning('No item to process.');
			return;
		}

		// process items
		while (true) {
			try {
				await this.itemsSeller.open();
				await action.processMethod(items);
				logger.info('Process done.');
			} catch (e) {
				if (e.message == 'Page crashed!') {
					logger.error('The page has crashed, restarting the process...');
					await this.itemsSeller.close();
					continue;
				} else if (e.message.indexOf('net::ERR_NAME_NOT_RESOLVED') != -1) {
					logger.error('The DNS request has failed, restarting the process...');
					await this.itemsSeller.close();
					continue;
				} else throw e;
			}
			await this.itemsSeller.close();
			break;
		}
	}

	async postItems(items) {
		let item;
		for (let i = 0; i < items.length; ++i) {
			item = items[i];
			logger.info('Putting item "%s" for sale...', item.id);

			if (this.itemsSeller.fbIds[item.title]) {
				logger.warning('Item "%s" is already for sale.', item.id);
				item.facebook_id = this.itemsSeller.fbIds[item.title];
				item.sent_at = new Date();
				await this.itemsManager.updateItem(item);
				continue;
			}

			await this.itemsSeller.sellItem(item);
			if (config.commit) {
				if (!this.itemsSeller.fbIds[item.title]) throw Error('The item "' + item.id + '" has not been found among items for sale.');
				else {
					item.facebook_id = this.itemsSeller.fbIds[item.title];
					item.sent_at = new Date();
					await this.itemsManager.updateItem(item);
					logger.info('Item "%s" is now for sale.', item.id);
				}
			}

			if (i != items.length - 1) await this.makeBreak();
		}
	}

	async editItems(items) {
		let item;
		let success;
		for (let i = 0; i < items.length; ++i) {
			item = items[i];
			logger.info('Updating item "%s"...', item.id);

			success = await utils.attempt(this.itemsSeller.manageItem.bind(this.itemsSeller, item, 'edit'), 3);
			if (success) {
				if (config.commit) {
					item.updated_at = new Date();
					await this.itemsManager.updateItem(item);
				}
				logger.info('Item "%s" has been updated successfully.', item.id);

				if (i != items.length - 1) await this.makeBreak();
			}
		}
	}

	async deleteItems(items) {
		let item;
		let success;
		for (let i = 0; i < items.length; ++i) {
			item = items[i];
			logger.info('Removing item "%s"...', item.id);

			success = await utils.attempt(this.itemsSeller.manageItem.bind(this.itemsSeller, item, 'remove'), 3);
			if (success) {
				if (config.commit) {
					item.deleted_at = new Date();
					await this.itemsManager.updateItem(item);
				}
				logger.info('Item "%s" has been removed successfully.', item.id);

				if (i != items.length - 1) await this.makeBreak();
			}
		}
	}

	determineBreakParameters() {
		if (config.actionsBetweenBreaks && config.breakTime) {
			logger.info('Determining parameters for the next break...');
			(this.breakParameters.actionsBeforeNextBreak = Array.isArray(config.actionsBetweenBreaks)
				? utils.getRandomNumber(...config.actionsBetweenBreaks)
				: config.actionsBeforeNextBreak),
			(this.breakParameters.breakTime = Array.isArray(config.breakTime) ? utils.getRandomNumber(...config.breakTime) : config.breakTime);
			logger.info('Number of actions before the next break : %d.', this.breakParameters.actionsBeforeNextBreak);
			logger.info('Duration of next break : %d seconds.', this.breakParameters.breakTime);
		}
	}

	async makeBreak() {
		if (!config.commit) await utils.randomSleep(2);
		else if (this.breakParameters.actionsBeforeNextBreak && --this.breakParameters.actionsBeforeNextBreak == 0) {
			logger.info('Time for a break, pausing the process for %d seconds...', this.breakParameters.breakTime);
			await utils.randomSleep(this.breakParameters.breakTime); // time for a break
			this.determineBreakParameters(); // reset the actions counter and the break time
		} else await utils.randomSleep(config.intervalBetweenActions[0], config.intervalBetweenActions[1]);
		logger.info(this.breakParameters.actionsBeforeNextBreak);
	}
};
