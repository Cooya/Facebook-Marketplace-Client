const mysql = require('mysql');

module.exports = class DatabaseConnection {
	constructor(config) {
		this.table = 'facebook_ad';
		this.config = config;
		this.connection = mysql.createConnection(config);
	}

	async connect() {
		if (this.connection.state == 'authenticated')
			return true;

		return new Promise((resolve, reject) => {
			this.connection.connect((err) => {
				if (err) reject(err);
				else {
					console.log('Connected to the database.');
					resolve();
				}
			});
		});
	}

	async end() {
		return new Promise((resolve, reject) => {
			this.connection.end((err) => {
				if (err) reject(err);
				else {
					console.log('Connection to the database closed.');
					resolve();
				}
			});
		});
	}

	async getItem(id) {
		return convertPicturesStringToArray(await sendQuery.call(this, 'SELECT * FROM ' + this.table + ' WHERE id = ' + id))[0];
	}

	async getItems() {
		return convertPicturesStringToArray(await sendQuery.call(this, 'SELECT * FROM ' + this.table));
	}

	async getSellableItems() {
		return convertPicturesStringToArray(await sendQuery.call(this, 'SELECT * FROM ' + this.table + ' WHERE facebook_id IS NULL AND deleted_at IS NULL'));
	}

	async getItemsForSale() {
		return convertPicturesStringToArray(await sendQuery.call(this, 'SELECT * FROM ' + this.table + ' WHERE facebook_id IS NOT NULL AND deleted_at IS NULL'));
	}

	async getDeletedItems() {
		return convertPicturesStringToArray(await sendQuery.call(this, 'SELECT * FROM ' + this.table + ' WHERE deleted_at IS NOT NULL'));
	}

	async insertItem(item) {
		const query = buildQuery(item);
		//console.debug(query);

		await sendQuery.call(this, 'INSERT INTO ' + this.table + ' SET ' + query[0], query[1]);
		console.log('Item "%s" inserted into database.', item.id);
	}

	async updateItem(item) {
		const query = buildQuery(item, ['id', 'oldTitle']);
		//console.debug(query);

		await sendQuery.call(this, 'UPDATE ' + this.table + ' SET ' + query[0] + ' WHERE id = ' + item.id, query[1]);
		console.log('Item "%s" updated into database.', item.id);
	}

	async removeItem(item) {
		await sendQuery.call(this, 'DELETE FROM ' + this.table + ' WHERE id = ' + item.id);
		console.log('Item "%s" deleted from database.', item.id);
	}

	async countItems() {
		const result = await sendQuery.call(this, 'SELECT COUNT(id) AS counter FROM ' + this.table);
		console.log(result[0].counter + ' items currently into the database.');
	}

	async clearItems() {
		await sendQuery.call(this, 'TRUNCATE TABLE ' + this.table);
		console.log('All items has been removed.');
	}
};

function sendQuery(query, values) {
	return new Promise((resolve, reject) => {
		this.connection.query(query, values, (err, result) => {
			if (err) {
				if (err.code == 'PROTOCOL_CONNECTION_LOST') {
					console.debug('Reconnection to the database...');
					this.connection = new mysql.createConnection(this.config);
					this.connect().then(sendQuery.call(this, query, values).then(resolve, reject), reject);
				}
				else
					reject(err);
			}
			else resolve(result);
		});
	});
}

function buildQuery(item, ignoredKeys = []) {
	let keys = '';
	Object.keys(item).forEach((key) => {
		if (ignoredKeys.indexOf(key) != -1)
			return;
		keys += key + ' = ?, ';
	});
	keys = keys.substring(0, keys.length - 2);

	let values = [];
	Object.keys(item).forEach((key) => {
		if (ignoredKeys.indexOf(key) != -1)
			return;
		if (key == 'url_photo')
			values.push(JSON.stringify(item[key]));
		else
			values.push(item[key]);
	});

	return [keys, values];
}

function convertPicturesStringToArray(items) {
	for (let item of items)
		item.url_photo = JSON.parse(item.url_photo);
	return items;
}
