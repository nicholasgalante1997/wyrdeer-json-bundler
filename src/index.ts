import { Collection, Db, Document, MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const MONGO_DB_USERNAME = process.env.MONGO_DB_USERNAME;
const MONGO_DB_PASSWORD = process.env.MONGO_DB_PASSWORD;

let MONGO_DB_URI = process.env.MONGO_DB_URI;

if (!MONGO_DB_PASSWORD || !MONGO_DB_USERNAME || !MONGO_DB_URI) {
  console.error('Could not read environment variables.');
  process.exit(1);
}

MONGO_DB_URI = MONGO_DB_URI?.replace(/<username>/, MONGO_DB_USERNAME);
MONGO_DB_URI = MONGO_DB_URI?.replace(/<password>/, MONGO_DB_PASSWORD);

Object.freeze(MONGO_DB_URI);

const mongodbClient = new MongoClient(MONGO_DB_URI, {
  serverApi: ServerApiVersion.v1,
});

async function createPokedexCollection(db: Db) {
  await db.createCollection('cards_mlist', { capped: false });
}

async function writeJsonFilesToMongoDb(collection: Collection<Document>) {
  const jsonDirPath = path.resolve(process.cwd(), 'src', 'json-data');
  const fileList = fs.readdirSync(jsonDirPath, { encoding: 'utf-8' });
  for (const file of fileList) {
    console.log('****************************************');
    console.log(`beginning ${file} upload op`);
    console.log('****************************************');
    let didError = false;
    const fileString = fs.readFileSync(path.join(jsonDirPath, file), { encoding: 'utf-8' });
    const fileData = JSON.parse(fileString);
    const { cards = [], set } = fileData;

    const query = { "set.id": set.setId };

    /** Check to see if the set exists already inside mongo db */
    try {
      if ((await collection.countDocuments(query)) === 0) {
        /** if weve hit this block, the set does not have any cards in our db */
        const bulkWriteDocuments = cards.map((card: any) => ({ insertOne: { document: { ...card, _id: card.id } } }));
        const resultOp = await collection.bulkWrite(bulkWriteDocuments);
        console.log('****************************************');
        console.log(`Wrote ${resultOp.insertedIds} to MongoDB#PokedexV0#cards_mlist`);
        console.log('****************************************');
      }
    } catch (e) {
      console.log('****************************************');
      console.log(`${file} op failed unsuccessfully.`);
      console.error((e as Error).message);
      console.log('****************************************');
      didError = true;
    } finally {
      if (didError) {
        console.log('****************************************');
        console.error('Batch Exec Upload failed for file: ' + file);
        console.log('****************************************');
      } else {
        console.log(`Uploaded cards from ${file} successfully.`);
      }
    }
  }
}

async function run() {
  try {
    await mongodbClient.connect();
    const db = mongodbClient.db(process.env.MONGO_DB_CLUSTER_NAME);
    let collections = await db.collections();
    if (collections.length === 0) {
      await createPokedexCollection(db);
    }
    let collection = db.collection('cards_mlist');
    await writeJsonFilesToMongoDb(collection);
    process.exit(0);
  } catch (e: any) {
    mongodbClient.close();
    console.error(e);
    process.exit(1);
  }
}

run();
