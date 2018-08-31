const assert = require('assert');
const mock = require('simple-mock').mock;

const config = require('../config');
const utils = require('../utils');

mock(utils, 'downloadFile').callFn((url) => Promise.resolve(url));
mock(config, 'dbFile', 'test/db.json');

const manager = require('../items_manager');

describe('testing items loading from file and database', () => {

    before(async () => {
        try {
            await utils.deleteFile('test/db.json');
        }
        catch (e) { }
    });

    after(async () => {
        try {
            await utils.deleteFile('test/db.json');
        }
        catch (e) { }
    });

    describe('load items from xml file', async () => {
        it('should be 2 present items and 3 absent items', async () => {
            const items = await manager.loadItems('test/sample.xml');
            assert.equal(items.length, 2);

            assert.equal(items[0].link, 'https://site.com/9163625.html');
            assert.equal(items[0].pictures.length, 1);

            assert.equal(items[1].link, 'https://site.com/9163623.html');
            assert.equal(items[1].pictures.length, 3);
        });
    })

    describe('load items from database', async () => {
        it('should be 2 present items and 3 absent items', async () => {
            const items = await manager.loadItems();
            assert.equal(items.length, 2);

            assert.equal(items[0].link, 'https://site.com/9163625.html');
            assert.equal(items[0].pictures.length, 1);

            assert.equal(items[1].link, 'https://site.com/9163623.html');
            assert.equal(items[1].pictures.length, 3);
        });
    })
});