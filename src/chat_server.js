const fs = require('fs');
const login = require('facebook-chat-api');
const sleep = require('sleep');

const config = require('../config');

const REDIRECTION_ANSWER =
	'Bonjour, merci de votre message. Je vous invite à échanger sur ma page {chatbot_url}';
const CHATBOT_URL = 'https://m.me/327212517859391?ref=w4181902--{item_id}';

process.on('unhandledRejection', error => {
	console.debug('UNHANDLED REJECTION');
	console.error(error);
});

let loginAttempts = 0;

(() => {
	try {
		const appStateFileExists = fs.existsSync(config.appStateFile);

		const loginCallback = (err, api) => {
			if (err) {
				console.error('An error occurred while trying to log in.');
				if(/Error retrieving userID/.test(err.error) && ++loginAttempts == 0) {
					login(getCreds(false), loginCallback);
					return;
				}
				else
					throw err.error;
			}
		
			api.setOptions({
				logLevel: 'silly',
				selfListen: true
			});
		
			fs.writeFileSync(config.appStateFile, JSON.stringify(api.getAppState()));
		
			let listenCounter = 0;
			const listen = () => {
				listenCounter++;
				api.listen((err, message) => {
					if (err) {
						console.error('An error occurred while trying to listen messages.');
						if (
							err.message ==
								'parseAndCheckLogin got status code: 200. Bailing out of trying to parse response.' &&
							listenCounter <= 5
						) {
							console.log('Tryin again in 10 seconds...');
							sleep.sleep(10);
							listen();
							return;
						} else throw err.error;
					}
					//console.debug(message);
		
					api.getThreadInfo(message.threadID, (err, info) => {
						if (err) {
							console.error('An error occurred while trying to get the thread info.');
							throw err.error;
						}
						//console.debug(info);
		
						const itemId = /\[([0-9]+)\]/.exec(info.threadName);
						if (!itemId) return;
		
						api.sendMessage(buildAnswer(itemId[1]), message.threadID);
					});
				});
			};
			listen();
		};
		login(getCreds(appStateFileExists), loginCallback);
	} catch (e) {
		console.error('An error has been caught.');
		console.error(e);
	}
})();

function getCreds(useAppStateFile) {
	return useAppStateFile
		? { appState: JSON.parse(fs.readFileSync(config.appStateFile, 'utf8')) }
		: { email: config.login, password: config.password };
}

function buildAnswer(itemId) {
	return REDIRECTION_ANSWER.replace('{chatbot_url}', CHATBOT_URL.replace('{item_id}', itemId));
}