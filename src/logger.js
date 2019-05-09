const path = require('path');
const util = require('util');
const { createLogger, config, format, transports } = require('winston');

const logsFolder = require('../config').logsFolder;

module.exports = (() => {
	let transport;
	let exitOnError;
	const formats = [
		format.timestamp({ format: 'DD/MM HH:mm:ss' }),
		format.label({ label: path.basename(process.mainModule.filename) }),
		format.errors({ stack: true }),
		format.splat(),
		format.printf(info => {
			info.message = typeof info.message === 'object' ? util.inspect(info.message) : info.message;
			return `${info.timestamp} ${info.level} [${info.label}] ${info.message} ${info.stack || ''}`;
		})
	];

	if (process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'prod') {
		transport = new transports.File({
			filename: (logsFolder || '') + new Date().toISOString() + '.log',
			level: 'debug'
		});
		exitOnError = false;
	} else {
		formats.unshift(format.colorize());
		transport = new transports.Console({
			level: process.env.NODE_ENV == 'debug' ? 'debug' : 'info',
			handleExceptions: true
		});
		exitOnError = true;
	}

	return createLogger({
		levels: config.syslog.levels,
		level: 'debug',
		exitOnError,
		transports: [transport],
		format: format.combine(...formats)
	});
})();
