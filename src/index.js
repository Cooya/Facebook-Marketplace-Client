const config = require('../config');
const Launcher = require('./launcher');
const logger = require('./logger');
const utils = require('@coya/utils');

utils.setLogger(logger);

(async function main() {
	if (!config.login || !config.password)
		throw Error('Missing credential definition in the config file.');

	const args = process.argv.slice(2);
	let action = null;
	let id = null;
	for (let i in args) {
		i = parseInt(i);
		if (args[i] == '--action' && i < args.length) {
			action = args[i + 1];
		} else if (args[i] == '--id' && i < args.length) {
			id = args[i + 1];
		} else if (args[i] == '--interval' && i < args.length) {
			config.intervalBetweenActions = [args[i + 1], args[i + 1]];
			logger.info('Interval between each action set up to % seconds.', args[i + 1]);
		}
	}

	try {
		const launcher = new Launcher();
		await launcher.itemsManager.connect();
		if (action != 'get') {
			await launcher.run(action);
		} else {
			if (!id) throw new Error('No item id provided.');
			const item = await launcher.itemsManager.getItem(id);
			if (item) logger.info(item);
			else logger.info('The item has not been found.');
		}
		await launcher.itemsManager.end();
	} catch (e) {
		logger.error(e);
		process.exit(0); // 0 allows to avoid NPM verbose output
	}
})();
