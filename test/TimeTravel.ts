import { network } from "hardhat";

function advanceTime() {
	return new Promise((resolve, reject) => {
		try{
            const result = network.provider.send("evm_increaseTime", [new Date().getTime()]);
            return resolve(result);
        }
        catch(err){
            return reject(err);
        }	
	});
};

function advanceBlock() {
	return new Promise((resolve, reject) => {		
        try{
            const result = network.provider.send("evm_mine", []);
            return resolve(result);
        }
        catch(err){
            return reject(err);
        }
	});
};

export async function advanceTimeAndBlock() {
	await advanceTime();
	await advanceBlock();
};

export async function advanceTimeAndBlockNTimes(n:number, epochSize:number) {
	console.log(`Time travelling ${n} blocks with epoch size ${epochSize}`);
	for (let i = 0; i < n; i++) {
		const newBlock = await advanceTimeAndBlock();
	}
};