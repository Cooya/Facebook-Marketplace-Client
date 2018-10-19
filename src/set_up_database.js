const fs = require('fs');
const mysql = require('mysql');
const util = require('util');

const config = require('../config');
const readFile = util.promisify(fs.readFile);

(async () => {
	const credentials = {
		host: config.mysql.host,
		user: config.mysql.user,
		password: config.mysql.password,
		schemaFile: config.mysql.schemaFile,
		multipleStatements: true
	};
	await setUpDatabase(credentials, config.mysql.database);
	console.log();
	await setUpDatabase(credentials, 'Tests');
})();

async function setUpDatabase(credentials, databaseName) {
	const connection = mysql.createConnection(credentials);

	await connect(connection);
	const created = await createDatabase(connection, databaseName);
	if(created) {
		const schema = (await readFile(credentials.schemaFile)).toString();
		await importSchema(connection, schema);
	}
	connection.end();
	console.log('Connection to the database closed.');
}

function connect(connection) {
	return new Promise((resolve, reject) => {
		connection.connect((err) => {
			if (err) reject(err);
			else {
				console.log('Connected to the database.');
				resolve();
			}
		});
	});
}

function createDatabase(connection, name) {
	return new Promise((resolve, reject) => {
		connection.query('CREATE DATABASE `' + name + '`', (err) => {
			if (err) {
				if(err.message.indexOf('ER_DB_CREATE_EXISTS') != -1) {
					console.warn('Database "' + name + '" already exists.');
					resolve(false);
				}
				else reject(err);
			}
			else {
				console.log('Database created.');
				connection.query('USE `' + name + '`', (err) => {
					if(err) reject(err);
					else  {
						console.log('Database selected.');
						resolve(true);
					}
				});
			}
		});
	});
}

function importSchema(connection, schema) {
	return new Promise((resolve, reject) => {
		connection.query(schema, function (err) {
			if (err) reject(err);
			else {
				console.log('Schema imported succesfully.');
				resolve();
			}
		});
	});
}