// // @ts-ignore
// import { deployments, ethers, getNamedAccounts } from "hardhat";
// import { expect } from "../utils/chai-setup";
// import { advanceTimeAndBlockNTimes } from "../utils/TimeTravel";
//
// const REWARD_PERIOD_SIZE = 10;
// const STARTING_REWARD_PER_BLOCK = 100;
//
// const initialize = deployments.createFixture(
// 	async ({ deployments, getNamedAccounts, ethers }, options) => {
// 		await deployments.fixture();
// 		const { deployer, user1, user2, user3 } = await getNamedAccounts();
//
// 		const cUSD = await deployments.get("TokenMock");
// 		const cUSDContract = await ethers.getContractAt(
// 			"TokenMock",
// 			cUSD.address
// 		);
// 		const DonationMiner = await deployments.get("DonationMiner");
// 		const DonationMinerContract = await ethers.getContractAt(
// 			"DonationMiner",
// 			DonationMiner.address
// 		);
// 		const IPCT = await deployments.get("IPCTToken");
// 		const IPCTContract = await ethers.getContractAt(
// 			"IPCTToken",
// 			IPCT.address
// 		);
//
// 		// Mint each of the test some cUSD
// 		await cUSDContract.mint(user1, 1000);
// 		await cUSDContract.mint(user2, 2000);
// 		await cUSDContract.mint(user3, 3000);
//
// 		// Mint the DonationMiner some IPCT
// 		await IPCTContract.transfer(DonationMiner.address, 100000);
//
// 		// Get signers for write tests
// 		const [ownerSigner, user1Signer, user2Signer, user3Signer] =
// 			await ethers.getSigners();
//
// 		console.log(`Owner is ${JSON.stringify(ownerSigner)}`);
// 		console.log(`User 1 is ${JSON.stringify(user1Signer)}`);
// 		console.log(`User 2 is ${JSON.stringify(user2Signer)}`);
// 		console.log(`User 3 is ${JSON.stringify(user3Signer)}`);
//
// 		return {
// 			cUSD: {
// 				owner: deployer,
// 				deployed: cUSD,
// 				contract: cUSDContract,
// 			},
// 			IPCT: {
// 				owner: deployer,
// 				deployed: IPCT,
// 				contract: IPCTContract,
// 			},
// 			DonationMiner: {
// 				owner: deployer,
// 				deployed: DonationMiner,
// 				contract: DonationMinerContract,
// 			},
// 			signers: [ownerSigner, user1Signer, user2Signer, user3Signer],
// 		};
// 	}
// );
//
// describe("Donation Miner", () => {
// 	it("Should approve and donate 100 cUSD from user1", async function () {
// 		const { cUSD, IPCT, DonationMiner, signers } = await initialize();
//
// 		const user1Donation = 200;
//
// 		// Approve from user1
// 		await cUSD.contract
// 			.connect(signers[1])
// 			.approve(DonationMiner.deployed.address, user1Donation);
//
// 		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
//
// 		const userBalance = await cUSD.contract.balanceOf(
// 			signers[1].getAddress()
// 		);
// 		expect(userBalance).to.equal("800");
// 	});
//
// 	it("Should approve and donate 100 cUSD from user1, advance time and claim their reward", async function () {
// 		const { cUSD, IPCT, DonationMiner, signers } = await initialize();
//
// 		const user1Donation = 100;
// 		const user1ExpectedReward = 1000;
//
// 		// Approve from user1
// 		await cUSD.contract
// 			.connect(signers[1])
// 			.approve(DonationMiner.deployed.address, user1Donation);
//
// 		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
//
// 		// Advance 3 blocks
// 		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE, REWARD_PERIOD_SIZE);
//
// 		// Claim the rewards
// 		await DonationMiner.contract.connect(signers[1]).claimRewards();
//
// 		// Check their IPCT balance
// 		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
// 			user1ExpectedReward
// 		);
//
// 		console.log(
// 			`User1 donated ${user1Donation} cUSD and claimed: ${user1ExpectedReward} IPCT`
// 		);
// 	});
//
// 	it("Should not be able to claim before the end of the reward period", async function () {
// 		const { cUSD, IPCT, DonationMiner, signers } = await initialize();
//
// 		const user1Donation = 100;
// 		const user1ExpectedReward = 0;
//
// 		// Approve from user1
// 		await cUSD.contract
// 			.connect(signers[1])
// 			.approve(DonationMiner.deployed.address, user1Donation);
//
// 		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
//
// 		// Claim the rewards
// 		await DonationMiner.contract.connect(signers[1]).claimRewards();
//
// 		// Check their IPCT balance
// 		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
// 			user1ExpectedReward
// 		);
//
// 		console.log(
// 			`User1 donated ${user1Donation} cUSD and claimed: ${user1ExpectedReward} IPCT`
// 		);
// 	});
//
// 	it("Should not claim reward in the same reward period, multiple donors", async function () {
// 		const { cUSD, IPCT, DonationMiner, signers } = await initialize();
//
// 		const user1Donation = 100;
// 		const user2Donation = 100;
// 		const user1ExpectedReward = 0;
// 		const user2ExpectedReward = 0;
//
// 		// Approve from user1
// 		await cUSD.contract
// 			.connect(signers[1])
// 			.approve(DonationMiner.deployed.address, user1Donation);
// 		await cUSD.contract
// 			.connect(signers[2])
// 			.approve(DonationMiner.deployed.address, user2Donation);
//
// 		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
// 		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);
//
// 		// Advance 3 blocks
// 		await advanceTimeAndBlockNTimes(3, REWARD_PERIOD_SIZE);
//
// 		// Claim their rewards
// 		await DonationMiner.contract.connect(signers[1]).claimRewards();
// 		await DonationMiner.contract.connect(signers[2]).claimRewards();
//
// 		// Check their IPCT balance
// 		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
// 			user1ExpectedReward
// 		);
// 		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
// 			user2ExpectedReward
// 		);
//
// 		console.log(
// 			`User1 donated ${user1Donation} cUSD and claimed: ${user1ExpectedReward} IPCT`
// 		);
// 		console.log(
// 			`User1 donated ${user2Donation} cUSD and claimed: ${user2ExpectedReward} IPCT`
// 		);
// 	});
//
// 	it("Should claim reward after reward period, multiple donors #1", async function () {
// 		const { cUSD, IPCT, DonationMiner, signers } = await initialize();
//
// 		const user1Donation = 100;
// 		const user2Donation = 100;
// 		const user1ExpectedReward = 500;
// 		const user2ExpectedReward = 500;
//
// 		// Approve from user1
// 		await cUSD.contract
// 			.connect(signers[1])
// 			.approve(DonationMiner.deployed.address, user1Donation);
// 		await cUSD.contract
// 			.connect(signers[2])
// 			.approve(DonationMiner.deployed.address, user2Donation);
//
// 		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
// 		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);
//
// 		// Advance 3 blocks
// 		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE, REWARD_PERIOD_SIZE);
//
// 		// Claim their rewards
// 		await DonationMiner.contract.connect(signers[1]).claimRewards();
// 		await DonationMiner.contract.connect(signers[2]).claimRewards();
//
// 		// Check their IPCT balance
// 		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
// 			user1ExpectedReward
// 		);
// 		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
// 			user2ExpectedReward
// 		);
//
// 		console.log(
// 			`User1 donated ${user1Donation} cUSD and claimed: ${user1ExpectedReward} IPCT`
// 		);
// 		console.log(
// 			`User1 donated ${user2Donation} cUSD and claimed: ${user2ExpectedReward} IPCT`
// 		);
// 	});
//
// 	it("Should claim reward after reward period, multiple donors #2", async function () {
// 		const { cUSD, IPCT, DonationMiner, signers } = await initialize();
//
// 		const user1Donation = 100;
// 		const user2Donation = 200;
// 		const user1ExpectedReward = 333;
// 		const user2ExpectedReward = 667;
//
// 		// Approve from user1
// 		await cUSD.contract
// 			.connect(signers[1])
// 			.approve(DonationMiner.deployed.address, user1Donation);
// 		await cUSD.contract
// 			.connect(signers[2])
// 			.approve(DonationMiner.deployed.address, user2Donation);
//
// 		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
// 		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);
//
// 		// Advance 3 blocks
// 		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE, REWARD_PERIOD_SIZE);
//
// 		// Claim their rewards
// 		await DonationMiner.contract.connect(signers[1]).claimRewards();
// 		await DonationMiner.contract.connect(signers[2]).claimRewards();
//
// 		// Check their IPCT balance
// 		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
// 			user1ExpectedReward
// 		);
// 		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
// 			user2ExpectedReward
// 		);
//
// 		console.log(
// 			`User1 donated ${user1Donation} cUSD and claimed: ${user1ExpectedReward} IPCT`
// 		);
// 		console.log(
// 			`User1 donated ${user2Donation} cUSD and claimed: ${user2ExpectedReward} IPCT`
// 		);
// 	});
//
// 	it("Should claim reward after reward period, multiple donors #3", async function () {
// 		const { cUSD, IPCT, DonationMiner, signers } = await initialize();
//
// 		const user1Donation = 300;
// 		const user2Donation = 100;
// 		const user1ExpectedReward = 750;
// 		const user2ExpectedReward = 250;
//
// 		// Approve from user1
// 		await cUSD.contract
// 			.connect(signers[1])
// 			.approve(DonationMiner.deployed.address, user1Donation);
// 		await cUSD.contract
// 			.connect(signers[2])
// 			.approve(DonationMiner.deployed.address, user2Donation);
//
// 		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
// 		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);
//
// 		// Advance 3 blocks
// 		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE, REWARD_PERIOD_SIZE);
//
// 		// Claim their rewards
// 		await DonationMiner.contract.connect(signers[1]).claimRewards();
// 		await DonationMiner.contract.connect(signers[2]).claimRewards();
//
// 		// Check their IPCT balance
// 		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
// 			user1ExpectedReward
// 		);
// 		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
// 			user2ExpectedReward
// 		);
//
// 		console.log(
// 			`User1 donated ${user1Donation} cUSD and claimed: ${user1ExpectedReward} IPCT`
// 		);
// 		console.log(
// 			`User1 donated ${user2Donation} cUSD and claimed: ${user2ExpectedReward} IPCT`
// 		);
// 	});
// });
