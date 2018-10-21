const config = require('../config');
const Launcher = require('./launcher');

(async function main() {
	if (!config.login || !config.password)
		throw Error('Missing credential definition in the config file.');

	const args = process.argv.slice(2);
	let action = null;
	for (let i in args) {
		i = parseInt(i);
		if (args[i] == '--action' && i < args.length)
			action = args[i + 1];
		if (args[i] == '--interval' && i < args.length) {
			config.intervalBetweenActions = [args[i + 1], args[i + 1]];
			console.log('Interval between each action set up to % seconds.', args[i + 1]);
		}
	}

	const launcher = new Launcher();
	await launcher.itemsManager.connect();
	await launcher.run(action);
	await launcher.itemsManager.end();
})();