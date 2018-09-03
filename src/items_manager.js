const loki = require('lokijs');
const util = require('util');

const utils = require('./utils/utils');

const loadDatabase = util.promisify(new loki().loadDatabase);
const saveDatabase = util.promisify(new loki().saveDatabase);

module.exports = class ItemsManager {
    
    constructor(config) {
        this.db = new loki(config.dbFile);
        this.inputFile = config.inputFile;
        this.itemCategory = config.itemCategory;
        this.picturesFolder = config.picturesFolder;
        this.requiredKeys = ['link', 'title', 'price', 'location', 'description', 'pictures'];
        this.linkRegex = /https:\/\/www\.consortium-immobilier\.fr\/annonce-([0-9]+)\.html/;
        this.itemsCollection = null;
    }

    async getProcessedItems() {
        await loadDatabase.call(this.db, {});
        this.itemsCollection = this.db.getCollection('items');
        if(!this.itemsCollection)
            return [];
        return this.itemsCollection.find({processed: true});
    }

    async loadItems() {
        await loadDatabase.call(this.db, {});
    
        // load or create the items collection
        this.itemsCollection = this.db.getCollection('items');
        if(!this.itemsCollection)
            this.itemsCollection = this.db.addCollection('items', {unique: 'id'});
    
        // if input file exists
        if(this.inputFile && await utils.fileExists(this.inputFile)) {
            console.log('Loading items from file "' + this.inputFile + '"...');
    
            // read xml file
            const xml = await utils.readXMLFile(this.inputFile);
    
            // process items
            const processedItems = await processItems.call(this, xml.xml.annonce, this.requiredKeys);
    
            // save processed items into database
            await saveItemsIntoDatabase.call(this, processedItems);
        }
    
        // return the unprocessed items from the database
        return this.itemsCollection.find({processed: false});
    }

    async markItemAsProcessed(id) {
        const item = this.itemsCollection.findOne({id: id});
        if(!item) {
            console.error('The item "' + id + '" has not been found into database.');
            return;
        }
        item.processed = true;
        this.itemsCollection.update(item);
        await saveDatabase.call(this.db);
        console.log('Item marked as processed.');
    }
    
    async updateItemsWithBindings(bindings) {
        let item;
        for(let binding of bindings) {
            item = this.itemsCollection.findOne({title: binding.title});
            if(!item) {
                console.error('Unknown item with title = "' + binding.title + '".');
                continue;
            }
            if(item.fbId)
                continue;
    
            item.fbId = binding.fbId;
            this.itemsCollection.update(item);
            console.log('Facebook ID added to item.');
        }
    
        await saveDatabase.call(this.db);
    }
};

async function processItems(items) {
    console.log(items.length + ' items to process.');
    let invalidCounter = 0;

    const processedItems =  await Promise.all(items.map(async (item) => {
        const processedItem = {};
        processedItem.link = item.lien[0];
        processedItem.title = item.type[0];
        processedItem.price = item.prix[0].replace(',00 EUR', '');
        processedItem.location = item.ville && item.ville[0];
        processedItem.description = item.descriptif && item.descriptif[0];
        processedItem.category = this.itemCategory;
            
        if(item.photos) {
            processedItem.pictures = [];
            for(let photo of item.photos[0].photo) {
                let picturePath = await utils.downloadFile(photo, this.picturesFolder);
                if(picturePath)
                    processedItem.pictures.push(picturePath);
            }
            if(!processedItem.pictures.length) {
                console.error('Unexpected issue when reading pictures from item "' + processedItem.link + '".');
                //console.error(processedItem);
                invalidCounter++;
                return null;
            }
        }

        for(let key of this.requiredKeys) {
            if(!processedItem[key]) {
                console.error('Processed item is invalid : "' + processedItem.link + '", missing key "' + key + '".');
                //console.error(processedItem);
                invalidCounter++;
                return null;
            }
        }

        const matchResult = processedItem['link'].match(this.linkRegex);
        if(!matchResult) {
            console.error('Processed item is invalid : "' + processedItem.link + '", link is invalid.');
            //console.error(processedItem);
            invalidCounter++;
            return null;
        }
        processedItem['id'] = matchResult[1];

        return processedItem;
    }));

    console.log(invalidCounter + ' invalid items.');
    return processedItems;
}

async function saveItemsIntoDatabase(items) {
    let counter = 0;
    for(let item of items) {
        if(!item)
            continue;
        if(this.itemsCollection.findOne({id: item.id}))
            ;//console.warn('Item "' + item.id + '" already exists in database.');
        else {
            item.processed = false;
            this.itemsCollection.insert(item);
            //console.log('Item "' + item.id + '" inserted into database.');
            counter++;
        }
    }
    
    if(counter) {
        await saveDatabase.call(this.db);
        console.log(counter + ' new items loaded into database.');
    }
    console.log(this.itemsCollection.data.length + ' items currently in database.')
}