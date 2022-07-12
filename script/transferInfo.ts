import { fromEther, toEther } from "../test/utils/helpers";

const { ethers } = require("hardhat");

const PACTAddress = "0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58";
const LPAddress = "0x39AC98447f28612D3583e46E57cb106337FCAe3F";
const SPACTAddress = "0xFC39D3f2cBE4D5efc21CE48047bB2511ACa5cAF3";


const transferAbi = ["event Transfer(address indexed from, address indexed to, uint256 amount)"];
const transferInterface = new ethers.utils.Interface(transferAbi);


let holderAmountsPACT: any[] = [];
let holderAmountsLP: any[] = [];
let holderAmountsSPACT: any[] = [];

async function tokenEvents(holderAmounts: any[], tokenAddress: string, startBlock: number, endBlock: number): Promise<any[]> {
    const filter = {
        address: tokenAddress,
        fromBlock: startBlock,
        toBlock: endBlock,
        topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
    };

    let logs = await ethers.provider.getLogs(filter);

    let event;
    logs.map((log: any) => {
        event = transferInterface.parseLog(log);

        let amount = toEther(fromEther(event.args.amount));

        if (!holderAmounts[event.args.to]) {
            holderAmounts[event.args.to] = toEther(0);
        }

        if (!holderAmounts[event.args.from]) {
            holderAmounts[event.args.from] = toEther(0);
        }

        if (holderAmounts[event.args.to].eq(toEther(0))) {
            holderAmounts[event.args.to] = amount;
        } else {
            holderAmounts[event.args.to] = holderAmounts[event.args.to].add(amount);
        }

        if (holderAmounts[event.args.from].gte(amount)) {
            holderAmounts[event.args.from] = holderAmounts[event.args.from].sub(amount);
        } else if (event.args.from != "0x0000000000000000000000000000000000000000") {
            console.log("error: " + event.args.from + " : " + holderAmounts[event.args.from] + " - " + amount);
            holderAmounts[event.args.from] = toEther(0);
        }
    });

    return holderAmounts
};

async function checkEpoch(startBlock: number, endBlock: number) {
    holderAmountsPACT = await tokenEvents(holderAmountsPACT, PACTAddress, startBlock, endBlock);
    holderAmountsLP = await tokenEvents(holderAmountsLP, LPAddress, startBlock, endBlock);
    holderAmountsSPACT = await tokenEvents(holderAmountsSPACT, SPACTAddress, startBlock, endBlock);

    // console.log(holderAmountsPACT);
    // console.log(holderAmountsLP);
    // console.log(holderAmountsSPACT);

    let count = 0;
    for (let holder in holderAmountsPACT) {
        if ((holderAmountsPACT[holder]).gt(toEther(0))) {
            count++;
        }
    }

    for (let holder in holderAmountsLP) {
        if ((holderAmountsLP[holder]).gt(toEther(0)) && (!holderAmountsPACT[holder] || (holderAmountsPACT[holder]).eq(toEther(0)))) {
            count++;
        }
    }

    for (let holder in holderAmountsSPACT) {
        if ((holderAmountsSPACT[holder]).gt(toEther(0)) && (!holderAmountsPACT[holder] || (holderAmountsPACT[holder]).eq(toEther(0)))) {
            count++;
        }
    }

    console.log(count);
}


async function main() {
    const epochSize = 17280;
    let startBlock = 10490040;
    let endBlock = startBlock + epochSize - 1;

    let lastEpoch = 190 + 7; //the token had been released 7 days before the donation miner started
    // lastEpoch = 2;

    for (let epoch = 1; epoch <= lastEpoch; epoch++) {
        // console.log("Epoch: " + epoch + " : " + startBlock + ", " + endBlock);
        await checkEpoch(startBlock, endBlock);
        startBlock += epochSize;
        endBlock += epochSize;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
