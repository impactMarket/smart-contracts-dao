import fs from 'fs'
import { parseBalanceMap } from './utils/parse-balance-map'
const csv = require('csv-parser')

const results: {address: string, earnings: string, reasons: string}[] = [];

fs.createReadStream('airdrop_scripts/results/reward_distributions_base_18.csv')
    .pipe(csv({ headers: ["address", "earnings"]}))
    .on('data', (data: any) => {
        data.reasons = ''
        results.push(data);
    }).on('end', () => {

    fs.writeFile('airdrop_scripts/tree_scripts/merkleTree.json', JSON.stringify(parseBalanceMap(results)),function(err: any) {
            if (err) throw 'error writing file: ' + err;
        });
    });
