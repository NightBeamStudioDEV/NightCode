import {parentPort,workerData} from 'node:worker_threads';
import {queryDatabase} from './database';
void queryDatabase(workerData).then(result=>parentPort?.postMessage(result)).catch(error=>parentPort?.postMessage({error:error.message}));
