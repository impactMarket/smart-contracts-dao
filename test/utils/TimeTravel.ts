import { network } from "hardhat";

function advanceTime() {
	return new Promise((resolve, reject) => {
		try {
			const result = network.provider.send("evm_increaseTime", [
				new Date().getTime(),
			]);
			return resolve(result);
		} catch (err) {
			return reject(err);
		}
	});
}

function advanceBlock() {
	return new Promise((resolve, reject) => {
		try {
			const result = network.provider.send("evm_mine", []);
			return resolve(result);
		} catch (err) {
			return reject(err);
		}
	});
}

export async function advanceTimeAndBlock() {
	await advanceTime();
	await advanceBlock();
}

export async function advanceTimeAndBlockNTimes(
	n: number,
	rewardPeriodSize: number
) {
	for (let i = 0; i < n; i++) {
		const newBlock = await advanceTimeAndBlock();
	}
}

export async function advanceBlockNTimes(n: number) {
	for (let i = 0; i < n; i++) {
		const newBlock = await advanceBlock();
	}
}

export async function advanceNSeconds(n: number) {
	return new Promise((resolve, reject) => {
		try {
			const result = network.provider.send("evm_increaseTime", [n]);

			return resolve(result);
		} catch (err) {
			return reject(err);
		}
	});
}
