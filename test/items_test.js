const assert = require('assert');
const mock = require('simple-mock').mock;

const config = require('../config');
const ItemsManager = require('../src/items_manager');
const utils = require('../src/utils/utils');
let errors;

describe('testing items loading from file and database', () => {

    before(async () => {
        mock(utils, 'downloadFile').callFn((url) => Promise.resolve(url));
        mock(config, 'dbFile', 'test/db.json');
        errors = mock(console, 'error');
        
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
        it('should be 2 present items and 4 absent items', async () => {
            const itemsManager = new ItemsManager(config);
            const items = await itemsManager.loadItemsToSell('test/sample.xml');
            assert.equal(items.length, 2);

            assert.equal(items[0].link, 'https://www.consortium-immobilier.fr/annonce-123.html');
            assert.equal(items[0].pictures.length, 1);

            assert.equal(items[1].link, 'https://www.consortium-immobilier.fr/annonce-456.html');
            assert.equal(items[1].pictures.length, 3);
        });

        it('should display 4 errors', async () => {
            let missingPicturesCounter = 0;
            let missingDescriptionCounter = 0;
            let invalidLinkCounter = 0;
            for(let call of errors.calls) {
                if(call.arg.indexOf('missing key "pictures"') != -1)
                    missingPicturesCounter++;
                if(call.arg.indexOf('missing key "description"') != -1)
                    missingDescriptionCounter++;
                if(call.arg.indexOf('link is invalid') != -1)
                    invalidLinkCounter++;
            }

            assert.equal(missingPicturesCounter, 2);
            assert.equal(missingDescriptionCounter, 1);
            assert.equal(invalidLinkCounter, 1);
        });
    })

    describe('load items from database', async () => {
        it('should be 2 present items and 4 absent items', async () => {
            const itemsManager = new ItemsManager(config);
            const items = await itemsManager.loadItemsToSell();
            assert.equal(items.length, 2);

            assert.equal(items[0].link, 'https://www.consortium-immobilier.fr/annonce-123.html');
            assert.equal(items[0].pictures.length, 1);

            assert.equal(items[1].link, 'https://www.consortium-immobilier.fr/annonce-456.html');
            assert.equal(items[1].pictures.length, 3);
        });
    })
});