const config = require('../config');
const Launcher = require('./launcher');

(async function main() {
	if (!config.login || !config.password)
		throw Error('Missing credential definition in the config file.');

	const args = process.argv.slice(2);
	let action = null;
	for (let i in args) {
		if (args[i] == '--action')
			action = i < args.length && args[Number.parseInt(i) + 1];
	}

	const launcher = new Launcher();
	await launcher.run(action);
})();