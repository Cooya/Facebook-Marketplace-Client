const mysql = require('mysql');

module.exports = class DatabaseConnection {
	constructor(config) {
		this.table = 'facebook_ad';
		this.connection = mysql.createConnection(config);
	}

	async connect() {
		if(this.connection.state == 'authenticated')
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
			this.connection.end(function(err) {
				if(err) reject(err);
				else {
					console.log('Connection to the database closed.');
					resolve();
				}
			});
		});
	}

	getItem(id) {
		return new Promise((resolve, reject) => {
			this.connection.query('SELECT * FROM ' + this.table + ' WHERE id = ' + id + ' AND deleted_at IS NULL', (err, result) => {
				if (err) reject(err);
				else resolve(convertPicturesStringToArray(result)[0]);
			});
		});
	}

	getItems(areForSale = false) {
		return new Promise((resolve, reject) => {
			const condition = areForSale ? 'sent_at IS NOT NULL AND deleted_at IS NULL' : 'sent_at IS NULL AND deleted_at IS NULL';
			this.connection.query('SELECT * FROM ' + this.table + ' WHERE ' + condition, (err, result) => {
				if (err) reject(err);
				else resolve(convertPicturesStringToArray(result));
			});
		});
	}

	getDeletedItems() {
		return new Promise((resolve, reject) => {
			this.connection.query('SELECT * FROM ' + this.table + ' WHERE deleted_at IS NOT NULL', (err, result) => {
				if (err) reject(err);
				else resolve(convertPicturesStringToArray(result));
			});
		});
	}

	insertItem(item) {
		return new Promise((resolve, reject) => {
			const query = buildQuery(item);
			console.debug(query);

			this.connection.query('INSERT INTO ' + this.table + ' SET ' + query[0], query[1], (err) => {
				if (err) reject(err);
				else {
					console.log('Item "%s" inserted into database.', item.id);
					resolve();
				}
			});
		});
	}

	updateItem(item) {
		return new Promise((resolve, reject) => {
			const query = buildQuery(item, ['id', 'oldTitle']);
			console.debug(query);

			this.connection.query('UPDATE ' + this.table + ' SET ' + query[0] + ' WHERE id = ' + item.id, query[1], (err) => {
				if (err) reject(err);
				else {
					console.log('Item "%s" updated into database.', item.id);
					resolve();
				}
			});
		});
	}

	removeItem(item) {
		return new Promise((resolve, reject) => {
			this.connection.query('DELETE FROM ' + this.table + ' WHERE id = ' + item.id, (err) => {
				if (err) reject(err);
				else {
					console.log('Item "%s" deleted from database.', item.id);
					resolve();
				}
			});
		});
	}

	countItems() {
		return new Promise((resolve, reject) => {
			this.connection.query('SELECT COUNT(id) AS counter FROM ' + this.table, (err, result) => {
				if (err) reject(err);
				else {
					console.log(result[0].counter + ' items currently into the database.');
					resolve();
				}
			});
		});
	}

	clearItems() {
		return new Promise((resolve, reject) => {
			this.connection.query('TRUNCATE TABLE ' + this.table, (err) => {
				if (err) reject(err);
				else {
					console.log('All items has been removed.');
					resolve();
				}
			});
		});
	}
};

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
	for(let item of items)
		item.url_photo = JSON.parse(item.url_photo);
	return items;
}
