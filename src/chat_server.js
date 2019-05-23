const facebookChatApi = require('facebook-chat-api');
const fs = require('fs');

const config = require('../config');
const logger = require('./logger');

const REDIRECTION_ANSWER = 'Bonjour, merci de votre message. Je vous invite à échanger sur ma page {chatbot_url}';
const CHATBOT_URL = 'https://m.me/327212517859391?ref=w4181902--{item_id}';

process.on('unhandledRejection', error => {
	logger.error('UNHANDLED REJECTION');
	logger.error(error);
});

(async () => {
	const appStateFileExists = fs.existsSync(config.appStateFile);
	let loginAttempts = 0;
	let api;
	
	// log in to the API
	try {
		api = await login(appStateFileExists, loginAttempts);
	} catch(e) {
		logger.error(e);
		process.exit(1);
	}

	// update the app state file
	fs.writeFileSync(config.appStateFile, JSON.stringify(api.getAppState()));

	// configure the API
	api.setOptions({
		logLevel: 'info',
		selfListen: false // set it to true may be dangerous
	});
		
	api.listen(async (err, message) => {
		if (err) {
			logger.error('An error has occurred while listening for messages.');
			logger.error(err);
		}
		else {
			logger.info('Message received !');
			try {
				const itemId = await getItemId(api, message);
				if(!itemId) logger.warning('No response sent because the item id has not been found in this message.');
				else {
					await sendMessage(api, itemId, message.threadID);
					logger.info('Message sent successfully.');
				}
			} catch(e) {
				console.error(e);
			}
		}
	});
})();

function getCreds(useAppStateFile) {
	return useAppStateFile
		? { appState: JSON.parse(fs.readFileSync(config.appStateFile, 'utf8')) }
		: { email: config.login, password: config.password };
}

function login(appStateFileExists, loginAttempts) {
	return new Promise((resolve, reject) => {
		const creds = getCreds(appStateFileExists);
		facebookChatApi(creds, (err, api) => {
			if (err) {
				logger.error('An error has occurred while trying to log in.');
				if(/Error retrieving userID/.test(err.error) && ++loginAttempts == 0)
					login(appStateFileExists, loginAttempts).then(resolve, reject);
				else
					reject(err);
			} else resolve(api);
		});
	});
}

function getItemId(api, message) {
	return new Promise((resolve, reject) => {
		api.getThreadInfo(message.threadID, (err, info) => {
			if (err) {
				logger.error('An error has occurred while trying to get the thread info.');
				reject(err);
			} else {
				const itemId = /\[([0-9]+)\]/.exec(info.threadName);
				resolve(itemId ? itemId[1] : null);
			}
		});
	});
}

function sendMessage(api, itemId, threadId) {
	return new Promise((resolve, reject) => {
		api.sendMessage(buildAnswer(itemId), threadId, (err) => {
			if(err) reject(err);
			else resolve();
		});
	});
}

function buildAnswer(itemId) {
	return REDIRECTION_ANSWER.replace('{chatbot_url}', CHATBOT_URL.replace('{item_id}', itemId));
}