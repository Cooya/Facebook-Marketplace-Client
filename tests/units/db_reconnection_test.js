const assert = require('assert');

const config = require('../../config');
const DatabaseConnection = require('../../src/database_connection');

describe('test database reconnection', async () => {
	let connection;

	before(async () => {
		connection = new DatabaseConnection(config.mysql);
		await connection.connect();
	});

	after(async () => {
		await connection.end();
	});

	it('should reconnect when connection is lost', async () => {
		let items = await connection.getItems();
		assert(items.length, 3);

		await connection.end(); // close the first connection otherwise the script does not stop
		const error = new Error('Connection lost: The server closed the connection.');
		error.code = 'PROTOCOL_CONNECTION_LOST';
		connection.connection.emit('error', error);

		items = await connection.getItems();
		assert(items.length, 3);
	});
});