const fs = require('fs');
const login = require('facebook-chat-api');

const config = require('../config');

const REDIRECTION_ANSWER =
	'Bonjour, merci de votre message. Je vous invite à échanger sur ma page {chatbot_url}';
const CHATBOT_URL = 'https://m.me/327212517859391?ref=w4181902--{item_id}';

// to handle the parseAndCheckLogin error
process.on('unhandledRejection', error => {
	console.debug('UNHANDLED REJECTION');
	console.error(error);
});

(async () => {
	try {
		const appStateFile = fs.existsSync(config.appStateFile);
		const creds = appStateFile
			? { appState: JSON.parse(fs.readFileSync(config.appStateFile, 'utf8')) }
			: { email: config.login, password: config.password };

		login(creds, (err, api) => {
			api.setOptions({
				logLevel: 'silly'
			});

			if (err) {
				console.error('An error occurred while trying to log in.');
				throw err;
			}

			fs.writeFileSync(config.appStateFile, JSON.stringify(api.getAppState()));

			api.listen((err, message) => {
				if (err) {
					console.error('An error occurred while trying to listen messages.');
					throw err;
				}
				//console.debug(message);

				api.getThreadInfo(message.threadID, (err, info) => {
					if (err) {
						console.error('An error occurred while trying to get the thread info.');
						throw err;
					}
					//console.debug(info);

					const itemId = /\[([0-9]+)\]/.exec(info.threadName);
					if (!itemId) return;

					api.sendMessage(buildAnswer(itemId[1]), message.threadID);
				});
			});
		});
	} catch (e) {
		console.error(e);
	}
})();

function buildAnswer(itemId) {
	return REDIRECTION_ANSWER.replace('{chatbot_url}', CHATBOT_URL.replace('{item_id}', itemId));
}
