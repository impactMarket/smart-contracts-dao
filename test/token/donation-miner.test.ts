// @ts-ignore
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { expect } from "../utils/chai-setup";
import { advanceTimeAndBlockNTimes } from "../utils/TimeTravel";
import { parseEther, formatEther } from "@ethersproject/units";

const STARTING_DELAY = 10;
const REWARD_PERIOD_SIZE = 20;

const initialize = deployments.createFixture(
	async ({ deployments, getNamedAccounts, ethers }, options) => {
		await deployments.fixture("Test", { fallbackToGlobal: false });
		const { deployer, user1, user2, user3 } = await getNamedAccounts();

		const cUSD = await deployments.get("TokenMock");
		const cUSDContract = await ethers.getContractAt(
			"TokenMock",
			cUSD.address
		);
		const DonationMiner = await deployments.get("DonationMinerProxy");
		const DonationMinerContract = await ethers.getContractAt(
			"DonationMinerImplementation",
			DonationMiner.address
		);
		const IPCT = await deployments.get("IPCTToken");
		const IPCTContract = await ethers.getContractAt(
			"IPCTToken",
			IPCT.address
		);

		// Mint each of the test some cUSD
		await cUSDContract.mint(user1, parseEther("1000000"));
		await cUSDContract.mint(user2, parseEther("10000000"));
		await cUSDContract.mint(user3, parseEther("100000000"));

		// transfer to the DonationMiner some IPCT
		await IPCTContract.transfer(
			DonationMiner.address,
			parseEther("4000000000")
		);

		// Get signers for write tests
		const [ownerSigner, user1Signer, user2Signer, user3Signer] =
			await ethers.getSigners();

		console.log(`Owner is ${JSON.stringify(ownerSigner)}`);
		console.log(`User 1 is ${JSON.stringify(user1Signer)}`);
		console.log(`User 2 is ${JSON.stringify(user2Signer)}`);
		console.log(`User 3 is ${JSON.stringify(user3Signer)}`);

		return {
			cUSD: {
				owner: deployer,
				deployed: cUSD,
				contract: cUSDContract,
			},
			IPCT: {
				owner: deployer,
				deployed: IPCT,
				contract: IPCTContract,
			},
			DonationMiner: {
				owner: deployer,
				deployed: DonationMiner,
				contract: DonationMinerContract,
			},
			signers: [ownerSigner, user1Signer, user2Signer, user3Signer],
		};
	}
);

async function showRewardPeriods(DonationMiner: any) {
	const periodsCount = await DonationMiner.contract.rewardPeriodCount();

	console.log("rewardPeriodCount: ", periodsCount);
	for (let i = 0; i <= periodsCount; i++) {
		console.log(
			"rewardPeriod #",
			i,
			": ",
			await DonationMiner.contract.rewardPeriods(i)
		);
	}
}

describe("Donation Miner", () => {
	it("Should approve and donate 100 cUSD from user1", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("200");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);

		const userBalance = await cUSD.contract.balanceOf(
			signers[1].getAddress()
		);
		expect(userBalance).to.equal(parseEther("999800"));
	});

	it("Should approve and donate 100 cUSD from user1, advance time and claim their reward", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user1ExpectedReward = parseEther("4320000");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim the rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);

		console.log(
			`User1 donated ${formatEther(
				user1Donation
			)} cUSD and claimed: ${formatEther(user1ExpectedReward)} IPCT`
		);
	});

	it("Should not be able to claim before the end of the reward period", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user1ExpectedReward = parseEther("0");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);

		await advanceTimeAndBlockNTimes(1);
		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);

		// Claim the rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);

		console.log(
			`User1 donated ${formatEther(
				user1Donation
			)} cUSD and claimed: ${formatEther(user1ExpectedReward)} IPCT`
		);
	});

	it("Should not claim reward in the same reward period, multiple donors", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("0");
		const user2ExpectedReward = parseEther("0");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);
		await cUSD.contract
			.connect(signers[2])
			.approve(DonationMiner.deployed.address, user2Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);

		// Claim their rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();
		await DonationMiner.contract.connect(signers[2]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);
		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
			user2ExpectedReward
		);

		console.log(
			`User1 donated ${formatEther(
				user1Donation
			)} cUSD and claimed: ${formatEther(user1ExpectedReward)} IPCT`
		);
		console.log(
			`User1 donated ${formatEther(
				user2Donation
			)} cUSD and claimed: ${formatEther(user2ExpectedReward)} IPCT`
		);
	});

	it("Should claim reward and bonus reward, one donor", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user1ExpectedReward = parseEther("8635256.64");

		await advanceTimeAndBlockNTimes(STARTING_DELAY + REWARD_PERIOD_SIZE);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);

		console.log(
			`User1 donated ${formatEther(
				user1Donation
			)} cUSD and claimed: ${formatEther(user1ExpectedReward)} IPCT`
		);
	});

	it("Should claim reward after reward period, multiple donors #1", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("2160000");
		const user2ExpectedReward = parseEther("2160000");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);
		await cUSD.contract
			.connect(signers[2])
			.approve(DonationMiner.deployed.address, user2Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);

		// Advance 3 blocks
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();
		await DonationMiner.contract.connect(signers[2]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);
		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
			user2ExpectedReward
		);

		console.log(
			`User1 donated ${formatEther(
				user1Donation
			)} cUSD and claimed: ${formatEther(user1ExpectedReward)} IPCT`
		);
		console.log(
			`User1 donated ${formatEther(
				user2Donation
			)} cUSD and claimed: ${formatEther(user2ExpectedReward)} IPCT`
		);
	});

	it("Should claim reward after reward period, multiple donors #2", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user2Donation = parseEther("200");
		const user1ExpectedReward = parseEther("1440000");
		const user2ExpectedReward = parseEther("2880000");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);
		await cUSD.contract
			.connect(signers[2])
			.approve(DonationMiner.deployed.address, user2Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);

		// Advance 3 blocks
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();
		await DonationMiner.contract.connect(signers[2]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);
		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
			user2ExpectedReward
		);

		console.log(
			`User1 donated ${formatEther(
				user1Donation
			)} cUSD and claimed: ${formatEther(user1ExpectedReward)} IPCT`
		);
		console.log(
			`User1 donated ${formatEther(
				user2Donation
			)} cUSD and claimed: ${formatEther(user2ExpectedReward)} IPCT`
		);
	});

	it("Should claim reward after reward period, multiple donors #3", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("300");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("3240000");
		const user2ExpectedReward = parseEther("1080000");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);
		await cUSD.contract
			.connect(signers[2])
			.approve(DonationMiner.deployed.address, user2Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);

		// Advance 3 blocks
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();
		await DonationMiner.contract.connect(signers[2]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);
		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
			user2ExpectedReward
		);

		console.log(
			`User1 donated ${formatEther(
				user1Donation
			)} cUSD and claimed: ${formatEther(user1ExpectedReward)} IPCT`
		);
		console.log(
			`User1 donated ${formatEther(
				user2Donation
			)} cUSD and claimed: ${formatEther(user2ExpectedReward)} IPCT`
		);
	});

	it("Should claim reward after reward period, multiple donors #4", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("1");
		const user2Donation = parseEther("1000000");
		const user1ExpectedReward = parseEther("4.319995680004319995");
		const user2ExpectedReward = parseEther("4319995.680004319995680004");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);
		await cUSD.contract
			.connect(signers[2])
			.approve(DonationMiner.deployed.address, user2Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);

		// Advance 3 blocks
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();
		await DonationMiner.contract.connect(signers[2]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);
		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
			user2ExpectedReward
		);

		console.log(
			`User1 donated ${formatEther(
				user1Donation
			)} cUSD and claimed: ${formatEther(user1ExpectedReward)} IPCT`
		);
		console.log(
			`User1 donated ${formatEther(
				user2Donation
			)} cUSD and claimed: ${formatEther(user2ExpectedReward)} IPCT`
		);
	});

	it("Should not be able to donate to a wrong community", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("1");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);

		await expect(
			DonationMiner.contract
				.connect(signers[1])
				.donateToCommunity(signers[1].address, user1Donation)
		).to.be.revertedWith(
			"DonationMiner::donateToCommunity: This is not a valid community address"
		);
	});
});
