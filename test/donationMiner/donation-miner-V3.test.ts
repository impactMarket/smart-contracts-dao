// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import {
	advanceBlockNTimes,
	advanceTimeAndBlockNTimes,
	advanceToBlockN,
	getBlockNumber,
} from "../utils/TimeTravel";
import { parseEther, formatEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

chai.use(chaiAsPromised);
const expect = chai.expect;

let STARTING_DELAY = 100;
const REWARD_PERIOD_SIZE = 20;
const CLAIM_DELAY = 8;
const AGAINST_PERIODS = 4;

let owner: SignerWithAddress;
let donor1: SignerWithAddress;
let donor2: SignerWithAddress;
let donor3: SignerWithAddress;
let donor4: SignerWithAddress;
let donor5: SignerWithAddress;
let donor6: SignerWithAddress;
let donor7: SignerWithAddress;
let donor8: SignerWithAddress;
let donor9: SignerWithAddress;

let ImpactProxyAdmin: ethersTypes.Contract;
let DonationMiner: ethersTypes.Contract;
let DonationMinerImplementation: ethersTypes.Contract;
let DonationMinerImplementationV3: ethersTypes.Contract;
let PACT: ethersTypes.Contract;
let cUSD: ethersTypes.Contract;
let Treasury: ethersTypes.Contract;

const deploy = deployments.createFixture(async () => {
	await deployments.fixture("Test", { fallbackToGlobal: false });

	[
		owner,
		donor1,
		donor2,
		donor3,
		donor4,
		donor5,
		donor6,
		donor7,
		donor8,
		donor9,
	] = await ethers.getSigners();

	ImpactProxyAdmin = await ethers.getContractAt(
		"ImpactProxyAdmin",
		(
			await deployments.get("ImpactProxyAdmin")
		).address
	);

	cUSD = await ethers.getContractAt(
		"TokenMock",
		(
			await await deployments.get("TokenMock")
		).address
	);

	DonationMinerImplementation = await ethers.getContractAt(
		"DonationMinerImplementation",
		(
			await deployments.get("DonationMinerImplementation")
		).address
	);

	DonationMinerImplementationV3 = await ethers.getContractAt(
		"DonationMinerImplementationV3",
		(
			await deployments.get("DonationMinerImplementationV3")
		).address
	);

	DonationMiner = await ethers.getContractAt(
		"DonationMinerImplementation",
		(
			await deployments.get("DonationMinerProxy")
		).address
	);

	PACT = await ethers.getContractAt(
		"PACTToken",
		(
			await deployments.get("PACTToken")
		).address
	);

	Treasury = await ethers.getContractAt(
		"TreasuryImplementation",
		(
			await deployments.get("TreasuryProxy")
		).address
	);

	// Mint each of the test some cUSD
	await cUSD.mint(donor1.address, parseEther("1000000"));
	await cUSD.mint(donor2.address, parseEther("10000000"));
	await cUSD.mint(donor3.address, parseEther("100000000"));
	await cUSD.mint(donor4.address, parseEther("100000000"));
});

async function showRewardPeriods(DonationMiner: any) {
	const periodsCount = await DonationMiner.rewardPeriodCount();

	console.log("rewardPeriodCount: ", periodsCount);
	for (let i = 0; i <= periodsCount; i++) {
		let rewardPeriod = await DonationMiner.rewardPeriods(i);
		console.log("rewardPeriod #", i, ": ", {
			rewardPerBlock: formatEther(rewardPeriod.rewardPerBlock),
			rewardAmount: formatEther(rewardPeriod.rewardAmount),
			startBlock: rewardPeriod.startBlock,
			endBlock: rewardPeriod.endBlock,
			donationsAmount: formatEther(rewardPeriod.donationsAmount),
		});
	}
}

async function rewardPeriodFixtures() {
	const user1Donation1 = parseEther("100");
	const user1Donation2 = parseEther("200");
	const user1Donation3 = parseEther("300");
	const user2Donation = parseEther("400");
	const user3Donation = parseEther("500");
	const user4Donation = parseEther("600");

	//first block donations
	await advanceTimeAndBlockNTimes(STARTING_DELAY);
	//none

	//second block donations
	await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

	await cUSD.connect(donor1).approve(DonationMiner.address, user1Donation1);

	await DonationMiner.connect(donor1).donate(user1Donation1);

	await cUSD.connect(donor2).approve(DonationMiner.address, user2Donation);

	await DonationMiner.connect(donor2).donate(user2Donation);

	await cUSD.connect(donor1).approve(DonationMiner.address, user1Donation2);

	await DonationMiner.connect(donor1).donate(user1Donation2);

	//third block donations
	await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE - 6);

	await DonationMiner.connect(donor1).claimRewards();

	await cUSD.connect(donor1).approve(DonationMiner.address, user1Donation3);

	await DonationMiner.connect(donor1).donate(user1Donation3);

	await cUSD.connect(donor3).approve(DonationMiner.address, user3Donation);

	await DonationMiner.connect(donor3).donate(user3Donation);

	//forth block donations
	await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE - 5);

	await DonationMiner.connect(donor3).claimRewards();
	//none

	//fifth block donations
	await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE - 1);

	await cUSD.connect(donor4).approve(DonationMiner.address, user4Donation);

	await DonationMiner.connect(donor4).donate(user4Donation);

	return {
		user1Donation1,
		user1Donation2,
		user1Donation3,
		user2Donation,
		user3Donation,
		user4Donation,
	};
}

async function verifyRewardPeriodFixtures(
	user1Donation1: BigNumber,
	user1Donation2: BigNumber,
	user2Donation: BigNumber,
	user1Donation3: BigNumber,
	user3Donation: BigNumber,
	user4Donation: BigNumber
) {
	expect(await DonationMiner.rewardPeriodCount()).to.equal(5);
	expect(await DonationMiner.donationCount()).to.equal(6);

	//verify rewardPeriodDonorAmount method
	expect(
		await DonationMiner.rewardPeriodDonorAmount(2, donor1.address)
	).to.equal(user1Donation1.add(user1Donation2));
	expect(
		await DonationMiner.rewardPeriodDonorAmount(2, donor2.address)
	).to.equal(user2Donation);
	expect(
		await DonationMiner.rewardPeriodDonorAmount(2, donor3.address)
	).to.equal(0);
	expect(
		await DonationMiner.rewardPeriodDonorAmount(3, donor1.address)
	).to.equal(user1Donation3);
	expect(
		await DonationMiner.rewardPeriodDonorAmount(3, donor2.address)
	).to.equal(0);
	expect(
		await DonationMiner.rewardPeriodDonorAmount(3, donor3.address)
	).to.equal(user3Donation);
	expect(
		await DonationMiner.rewardPeriodDonorAmount(4, donor1.address)
	).to.equal(0);
	expect(
		await DonationMiner.rewardPeriodDonorAmount(5, donor3.address)
	).to.equal(0);
	expect(
		await DonationMiner.rewardPeriodDonorAmount(5, donor4.address)
	).to.equal(user4Donation);

	//verify donors method
	const donor1Details = await DonationMiner.donors(donor1.address);
	expect(donor1Details.rewardPeriodsCount).to.equal(2);
	expect(donor1Details.lastClaim).to.equal(0);
	expect(donor1Details.lastClaimPeriod).to.equal(2);
	const donor2Details = await DonationMiner.donors(donor2.address);
	expect(donor2Details.rewardPeriodsCount).to.equal(1);
	expect(donor2Details.lastClaim).to.equal(0);
	expect(donor2Details.lastClaimPeriod).to.equal(0);
	const donor3Details = await DonationMiner.donors(donor3.address);
	expect(donor3Details.rewardPeriodsCount).to.equal(1);
	expect(donor3Details.lastClaim).to.equal(0);
	expect(donor3Details.lastClaimPeriod).to.equal(3);
	const donor4Details = await DonationMiner.donors(donor4.address);
	expect(donor4Details.rewardPeriodsCount).to.equal(1);
	expect(donor4Details.lastClaim).to.equal(0);
	expect(donor4Details.lastClaimPeriod).to.equal(0);

	//verify rewardPeriods method
	const rewardPeriod1 = await DonationMiner.rewardPeriods(1);
	expect(rewardPeriod1.rewardPerBlock).to.equal(parseEther("216000"));
	expect(rewardPeriod1.rewardAmount).to.equal(parseEther("4320000"));
	expect(rewardPeriod1.startBlock).to.equal(130);
	expect(rewardPeriod1.endBlock).to.equal(149);
	expect(rewardPeriod1.donationsAmount).to.equal(0);
	const rewardPeriod2 = await DonationMiner.rewardPeriods(2);
	expect(rewardPeriod2.rewardPerBlock).to.equal(parseEther("215762.832"));
	expect(rewardPeriod2.rewardAmount).to.equal(parseEther("8635256.64"));
	expect(rewardPeriod2.startBlock).to.equal(150);
	expect(rewardPeriod2.endBlock).to.equal(169);
	expect(rewardPeriod2.donationsAmount).to.equal(
		user1Donation1.add(user2Donation).add(user1Donation2)
	);
	const rewardPeriod3 = await DonationMiner.rewardPeriods(3);
	expect(rewardPeriod3.rewardPerBlock).to.equal(
		parseEther("215525.924410464")
	);
	expect(rewardPeriod3.rewardAmount).to.equal(parseEther("4310518.48820928"));
	expect(rewardPeriod3.startBlock).to.equal(170);
	expect(rewardPeriod3.endBlock).to.equal(189);
	expect(rewardPeriod3.donationsAmount).to.equal(
		user1Donation3.add(user3Donation)
	);
	const rewardPeriod4 = await DonationMiner.rewardPeriods(4);
	expect(rewardPeriod4.rewardPerBlock).to.equal(
		parseEther("215289.276945461310528")
	);
	expect(rewardPeriod4.rewardAmount).to.equal(
		parseEther("4305785.53890922621056")
	);
	expect(rewardPeriod4.startBlock).to.equal(190);
	expect(rewardPeriod4.endBlock).to.equal(209);
	expect(rewardPeriod4.donationsAmount).to.equal(0);
	const rewardPeriod5 = await DonationMiner.rewardPeriods(5);
	expect(rewardPeriod5.rewardPerBlock).to.equal(
		parseEther("215052.889319375194009040")
	);
	expect(rewardPeriod5.rewardAmount).to.equal(
		parseEther("8606843.325296730090740800")
	);
	expect(rewardPeriod5.startBlock).to.equal(210);
	expect(rewardPeriod5.endBlock).to.equal(229);
	expect(rewardPeriod5.donationsAmount).to.equal(user4Donation);

	//verify donations method
	const donation1 = await DonationMiner.donations(1);
	expect(donation1.donor).to.equal(donor1.address);
	expect(donation1.target).to.equal(Treasury.address);
	expect(donation1.rewardPeriod).to.equal(2);
	expect(donation1.blockNumber.toNumber())
		.to.be.greaterThanOrEqual(150)
		.lessThanOrEqual(169);
	expect(donation1.amount).to.equal(user1Donation1);
	expect(donation1.token).to.equal(cUSD.address);
	expect(donation1.tokenPrice).to.equal(parseEther("1"));
	const donation2 = await DonationMiner.donations(2);
	expect(donation2.donor).to.equal(donor2.address);
	expect(donation2.target).to.equal(Treasury.address);
	expect(donation2.rewardPeriod).to.equal(2);
	expect(donation2.blockNumber.toNumber())
		.to.be.greaterThanOrEqual(150)
		.lessThanOrEqual(169);
	expect(donation2.amount).to.equal(user2Donation);
	expect(donation2.token).to.equal(cUSD.address);
	expect(donation2.tokenPrice).to.equal(parseEther("1"));
	const donation3 = await DonationMiner.donations(3);
	expect(donation3.donor).to.equal(donor1.address);
	expect(donation3.target).to.equal(Treasury.address);
	expect(donation3.rewardPeriod).to.equal(2);
	expect(donation3.blockNumber.toNumber())
		.to.be.greaterThanOrEqual(150)
		.lessThanOrEqual(169);
	expect(donation3.amount).to.equal(user1Donation2);
	expect(donation3.token).to.equal(cUSD.address);
	expect(donation3.tokenPrice).to.equal(parseEther("1"));
	const donation4 = await DonationMiner.donations(4);
	expect(donation4.donor).to.equal(donor1.address);
	expect(donation4.target).to.equal(Treasury.address);
	expect(donation4.rewardPeriod).to.equal(3);
	expect(donation4.blockNumber.toNumber())
		.to.be.greaterThanOrEqual(170)
		.lessThanOrEqual(189);
	expect(donation4.amount).to.equal(user1Donation3);
	expect(donation4.token).to.equal(cUSD.address);
	expect(donation4.tokenPrice).to.equal(parseEther("1"));
	const donation5 = await DonationMiner.donations(5);
	expect(donation5.donor).to.equal(donor3.address);
	expect(donation5.target).to.equal(Treasury.address);
	expect(donation5.rewardPeriod).to.equal(3);
	expect(donation5.blockNumber.toNumber())
		.to.be.greaterThanOrEqual(170)
		.lessThanOrEqual(189);
	expect(donation5.amount).to.equal(user3Donation);
	expect(donation5.token).to.equal(cUSD.address);
	expect(donation5.tokenPrice).to.equal(parseEther("1"));
	const donation6 = await DonationMiner.donations(6);
	expect(donation6.donor).to.equal(donor4.address);
	expect(donation6.target).to.equal(Treasury.address);
	expect(donation6.rewardPeriod).to.equal(5);
	expect(donation6.blockNumber.toNumber())
		.to.be.greaterThanOrEqual(210)
		.lessThanOrEqual(229);
	expect(donation6.amount).to.equal(user4Donation);
	expect(donation6.token).to.equal(cUSD.address);
	expect(donation6.tokenPrice).to.equal(parseEther("1"));
}

async function chunkAdvance(chunk: number, rewardExpected: string) {
	// next 100 reward periods
	await advanceBlockNTimes(chunk - 3);
	// Approve
	await cUSD.connect(donor1).approve(DonationMiner.address, 1);

	await DonationMiner.connect(donor1).donate(1);

	// Claim their rewards
	await DonationMiner.connect(donor1).claimRewards();

	// Check their PACT balance
	const balance = await PACT.balanceOf(donor1.address);
	expect(balance).to.equal(parseEther(rewardExpected));
}

describe("Donation Miner V3 (claimDelay = 0, againstPeriods = 0)", () => {
	before(async function () {});

	beforeEach(async () => {
		await deploy();

		expect(
			await ImpactProxyAdmin.getProxyImplementation(DonationMiner.address)
		).to.be.equal(DonationMinerImplementation.address);
		await expect(
			ImpactProxyAdmin.upgrade(
				DonationMiner.address,
				DonationMinerImplementationV3.address
			)
		).to.be.fulfilled;
		expect(
			await ImpactProxyAdmin.getProxyImplementation(DonationMiner.address)
		).to.be.equal(DonationMinerImplementationV3.address);

		DonationMiner = await ethers.getContractAt(
			"DonationMinerImplementationV3",
			DonationMiner.address
		);

		STARTING_DELAY = 90;
	});

	it("Should have correct values", async function () {
		expect(await DonationMiner.getVersion()).to.be.equal(3);
		expect(await DonationMiner.owner()).to.equal(owner.address);
		expect(await DonationMiner.cUSD()).to.equal(cUSD.address);
		expect(await DonationMiner.PACT()).to.equal(PACT.address);
		expect(await DonationMiner.treasury()).to.equal(Treasury.address);
		expect(await DonationMiner.rewardPeriodSize()).to.equal(
			REWARD_PERIOD_SIZE
		);
		expect(await DonationMiner.decayNumerator()).to.equal("998902");
		expect(await DonationMiner.decayDenominator()).to.equal("1000000");
		expect(await DonationMiner.rewardPeriodCount()).to.equal(1);
		expect(await DonationMiner.donationCount()).to.equal(0);
		expect(await DonationMiner.claimDelay()).to.equal(0);
	});

	it("Should have correct values #2", async function () {
		const {
			user1Donation1,
			user1Donation2,
			user1Donation3,
			user2Donation,
			user3Donation,
			user4Donation,
		} = await rewardPeriodFixtures();

		await verifyRewardPeriodFixtures(
			user1Donation1,
			user1Donation2,
			user2Donation,
			user1Donation3,
			user3Donation,
			user4Donation
		);
	});

	it("Should update reward params if admin", async function () {
		const user1Donation1 = parseEther("100");
		const user1ExpectedReward1 = parseEther("4320000");
		const user1ExpectedReward2 = parseEther("864000");

		//first block donations
		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation1);

		await DonationMiner.connect(donor1).donate(user1Donation1);

		//second block donations

		DonationMiner.updateRewardPeriodParams(2 * REWARD_PERIOD_SIZE, 1, 10);

		await DonationMiner.connect(donor1).claimRewards();

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation1);

		await DonationMiner.connect(donor1).donate(user1Donation1);

		await advanceTimeAndBlockNTimes(2 * REWARD_PERIOD_SIZE);

		await DonationMiner.connect(donor1).claimRewards();

		expect(await PACT.balanceOf(donor1.address)).to.be.equal(
			user1ExpectedReward1.add(user1ExpectedReward2)
		);

		//verify rewardPeriods method
		const rewardPeriod1 = await DonationMiner.rewardPeriods(1);

		expect(rewardPeriod1.rewardPerBlock).to.equal(parseEther("216000"));
		expect(rewardPeriod1.rewardAmount).to.equal(parseEther("4320000"));
		expect(rewardPeriod1.startBlock).to.equal(130);
		expect(rewardPeriod1.endBlock).to.equal(149);
		expect(rewardPeriod1.donationsAmount).to.equal(user1Donation1);
		const rewardPeriod2 = await DonationMiner.rewardPeriods(2);
		expect(rewardPeriod2.rewardPerBlock).to.equal(parseEther("21600"));
		expect(rewardPeriod2.rewardAmount).to.equal(parseEther("864000"));
		expect(rewardPeriod2.startBlock).to.equal(150);
		expect(rewardPeriod2.endBlock).to.equal(189);
		expect(rewardPeriod2.donationsAmount).to.equal(user1Donation1);
	});

	it("Should update claim delay if admin", async function () {
		expect(await DonationMiner.claimDelay()).to.be.equal(0);
		await expect(DonationMiner.updateClaimDelay(10)).to.be.fulfilled;
		expect(await DonationMiner.claimDelay()).to.be.equal(10);
	});

	it("Should not update claim delay if not admin", async function () {
		expect(await DonationMiner.claimDelay()).to.be.equal(0);
		await expect(
			DonationMiner.connect(donor1).updateClaimDelay(10)
		).to.be.rejectedWith("Ownable: caller is not the owner");
		expect(await DonationMiner.claimDelay()).to.be.equal(0);
	});

	it("Should update treasury if admin", async function () {
		expect(await DonationMiner.treasury()).to.be.equal(Treasury.address);
		DonationMiner.updateTreasury(owner.address);
		expect(await DonationMiner.treasury()).to.be.equal(owner.address);
	});

	it("Should not update params if not admin", async function () {
		await expect(
			DonationMiner.connect(donor1).updateRewardPeriodParams(
				2 * REWARD_PERIOD_SIZE,
				1,
				10
			)
		).to.be.rejectedWith("Ownable: caller is not the owner");
		await expect(
			DonationMiner.connect(donor1).updateTreasury(owner.address)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("Should deposit funds to treasury", async function () {
		const user1Donation = parseEther("100");

		//first block donations
		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
			user1Donation
		);
	});

	it("Should approve and donate 100 cUSD from user1", async function () {
		const user1Donation = parseEther("200");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		const userBalance = await cUSD.balanceOf(donor1.address);
		expect(userBalance).to.equal(parseEther("999800"));
	});

	it("Should approve and donate, advance time and claim their reward", async function () {
		const user1Donation = parseEther("100");
		const user1ExpectedReward = parseEther("4320000");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim the rewards
		await DonationMiner.connect(donor1).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);
	});

	it("Should not be able to claim before the end of the reward period", async function () {
		const user1Donation = parseEther("100");
		const user1ExpectedReward = parseEther("0");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await advanceTimeAndBlockNTimes(1);
		await DonationMiner.connect(donor1).donate(user1Donation);

		// Claim the rewards
		await DonationMiner.connect(donor1).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);
	});

	it("Should not claim reward in the same reward period, multiple donors", async function () {
		const user1Donation = parseEther("100");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("0");
		const user2ExpectedReward = parseEther("0");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);
		await cUSD
			.connect(donor2)
			.approve(DonationMiner.address, user2Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);
		await DonationMiner.connect(donor2).donate(user2Donation);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();
		await DonationMiner.connect(donor2).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);
		expect(await PACT.balanceOf(donor2.address)).to.equal(
			user2ExpectedReward
		);
	});

	it("Should claim reward and bonus reward, one donor", async function () {
		const user1Donation = parseEther("100");
		const user1ExpectedReward = parseEther("8635256.64");

		await advanceTimeAndBlockNTimes(STARTING_DELAY + REWARD_PERIOD_SIZE);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);
	});

	it("Should claim reward after reward period, multiple donors #1", async function () {
		const user1Donation = parseEther("100");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("2160000");
		const user2ExpectedReward = parseEther("2160000");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);
		await cUSD
			.connect(donor2)
			.approve(DonationMiner.address, user2Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);
		await DonationMiner.connect(donor2).donate(user2Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();
		await DonationMiner.connect(donor2).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);
		expect(await PACT.balanceOf(donor2.address)).to.equal(
			user2ExpectedReward
		);
	});

	it("Should claim reward after reward period, multiple donors #2", async function () {
		const user1Donation1 = parseEther("50");
		const user1Donation2 = parseEther("50");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("2160000");
		const user2ExpectedReward = parseEther("2160000");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation1);
		await cUSD
			.connect(donor2)
			.approve(DonationMiner.address, user2Donation);

		await DonationMiner.connect(donor1).donate(user1Donation1);
		await DonationMiner.connect(donor2).donate(user2Donation);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation2);
		await DonationMiner.connect(donor1).donate(user1Donation2);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();
		await DonationMiner.connect(donor2).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);
		expect(await PACT.balanceOf(donor2.address)).to.equal(
			user2ExpectedReward
		);
	});

	it("Should claim reward after reward period, multiple donors #2", async function () {
		const user1Donation = parseEther("100");
		const user2Donation = parseEther("200");
		const user1ExpectedReward = parseEther("1440000");
		const user2ExpectedReward = parseEther("2880000");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);
		await cUSD
			.connect(donor2)
			.approve(DonationMiner.address, user2Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);
		await DonationMiner.connect(donor2).donate(user2Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();
		await DonationMiner.connect(donor2).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);
		expect(await PACT.balanceOf(donor2.address)).to.equal(
			user2ExpectedReward
		);
	});

	it("Should claim reward after reward period, multiple donors #3", async function () {
		const user1Donation = parseEther("300");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("3240000");
		const user2ExpectedReward = parseEther("1080000");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);
		await cUSD
			.connect(donor2)
			.approve(DonationMiner.address, user2Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);
		await DonationMiner.connect(donor2).donate(user2Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();
		await DonationMiner.connect(donor2).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);
		expect(await PACT.balanceOf(donor2.address)).to.equal(
			user2ExpectedReward
		);
	});

	it("Should claim reward after reward period, multiple donors #4", async function () {
		const user1Donation = parseEther("1");
		const user2Donation = parseEther("1000000");
		const user1ExpectedReward = parseEther("4.319995680004319995");
		const user2ExpectedReward = parseEther("4319995.680004319995680004");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);
		await cUSD
			.connect(donor2)
			.approve(DonationMiner.address, user2Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);
		await DonationMiner.connect(donor2).donate(user2Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();
		await DonationMiner.connect(donor2).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);
		expect(await PACT.balanceOf(donor2.address)).to.equal(
			user2ExpectedReward
		);
	});

	it("Should not be able to donate to a wrong community", async function () {
		const user1Donation = parseEther("1");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await expect(
			DonationMiner.connect(donor1).donateToCommunity(
				donor1.address,
				user1Donation
			)
		).to.be.revertedWith(
			"DonationMiner::donateToCommunity: This is not a valid community address"
		);
	});

	it("Should claim reward after more reward periods, one donor", async function () {
		const user1Donation = parseEther("100");
		const user1ExpectedReward = parseEther("4320000");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		await advanceTimeAndBlockNTimes(3 * REWARD_PERIOD_SIZE);

		// Approve
		await cUSD
			.connect(donor2)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor2).donate(user1Donation);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);
	});

	it("Should donate in multiple reward periods and then claim, one donor", async function () {
		const user1Donation = parseEther("100");
		const user1ExpectedReward = parseEther("8635256.64");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);
	});

	it("Should donate and claim in multiple reward periods, one donor #1", async function () {
		const user1Donation = parseEther("100");
		const user1ExpectedReward1 = parseEther("4320000");
		const user1ExpectedReward2 = parseEther("8635256.64");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward1
		);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward2
		);
	});

	it("Should calculate claimable reward", async function () {
		const user1Donation = parseEther("100");
		const user1ExpectedReward1 = parseEther("4320000");
		const user1ExpectedReward2 = parseEther("8635256.64");

		//first reward period
		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		//second reward period
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		expect(
			await DonationMiner.calculateClaimableRewards(donor1.address)
		).to.be.equal(user1ExpectedReward1);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		expect(
			await DonationMiner.calculateClaimableRewards(donor1.address)
		).to.be.equal(user1ExpectedReward2);
	});

	it("Should calculate estimated reward no donation", async function () {
		const user1Donation = parseEther("100");

		//first reward period
		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		expect(
			await DonationMiner.calculateClaimableRewards(donor2.address)
		).to.be.equal(0);
	});

	it("Should calculate estimated reward", async function () {
		const user1Donation = parseEther("100");
		const user1ExpectedReward1 = parseEther("4320000");
		const user1ExpectedReward2 = parseEther("4315256.64");
		const user2Donation = parseEther("100");
		const user2ExpectedReward = parseEther("2157628.32");

		//first reward period
		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		expect(
			await DonationMiner.estimateClaimableReward(donor1.address)
		).to.be.equal(user1ExpectedReward1);

		//second reward period
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		expect(
			await DonationMiner.estimateClaimableReward(donor1.address)
		).to.be.equal(user1ExpectedReward2);

		await cUSD
			.connect(donor2)
			.approve(DonationMiner.address, user2Donation);

		await DonationMiner.connect(donor2).donate(user2Donation);

		expect(
			await DonationMiner.estimateClaimableReward(donor1.address)
		).to.be.equal(user2ExpectedReward);
		expect(
			await DonationMiner.estimateClaimableReward(donor2.address)
		).to.be.equal(user2ExpectedReward);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		expect(
			await DonationMiner.estimateClaimableReward(donor1.address)
		).to.be.equal(0);
		expect(
			await DonationMiner.estimateClaimableReward(donor2.address)
		).to.be.equal(0);
	});

	xit("Should donate and claim in 365 reward periods, one donor", async function () {
		const user1Donation = parseEther("100");
		const user1ExpectedReward1 = parseEther("409340576.103595678060756720");
		const user1ExpectedReward2 = parseEther("776093059.949132023166703940");
		const user1ExpectedReward3 = parseEther(
			"1104688347.734209420766213620"
		);
		const user1ExpectedReward4 = parseEther(
			"1299711602.324538381026520940"
		);

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// first 100 reward periods
		await advanceTimeAndBlockNTimes(99 * REWARD_PERIOD_SIZE);
		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward1
		);

		// next 100 reward periods
		await advanceTimeAndBlockNTimes(99 * REWARD_PERIOD_SIZE);
		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward2
		);

		// next 100 reward periods
		await advanceTimeAndBlockNTimes(99 * REWARD_PERIOD_SIZE);
		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward3
		);

		// next 65 reward periods
		await advanceTimeAndBlockNTimes(64 * REWARD_PERIOD_SIZE);
		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation);

		await DonationMiner.connect(donor1).donate(user1Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward4
		);
	});

	it("Should transfer founds to address", async function () {
		expect(await cUSD.balanceOf(DonationMiner.address)).to.be.equal(0);
		await cUSD.mint(DonationMiner.address, parseEther("100"));
		expect(await cUSD.balanceOf(DonationMiner.address)).to.be.equal(
			parseEther("100")
		);
		await DonationMiner.transfer(
			cUSD.address,
			owner.address,
			parseEther("100")
		);
		expect(await cUSD.balanceOf(DonationMiner.address)).to.be.equal(0);
		expect(await cUSD.balanceOf(owner.address)).to.be.equal(
			parseEther("100")
		);
	});
});

describe("Donation Miner V3 (claimDelay != 0, againstPeriods = 0)", () => {
	before(async function () {});

	beforeEach(async () => {
		await deploy();

		STARTING_DELAY = 93;
	});

	async function updateImplementation() {
		ImpactProxyAdmin.upgrade(
			DonationMiner.address,
			DonationMinerImplementationV3.address
		);

		DonationMiner = await ethers.getContractAt(
			"DonationMinerImplementationV3",
			DonationMiner.address
		);

		DonationMiner.updateClaimDelay(CLAIM_DELAY);

		STARTING_DELAY = 90;
	}

	it("Should not claim reward before claim delay, multiple donors #1", async function () {
		await updateImplementation();

		const user1Donation1 = parseEther("50");
		const user1Donation2 = parseEther("50");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("2160000");
		const user2ExpectedReward = parseEther("2160000");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation1);
		await cUSD
			.connect(donor2)
			.approve(DonationMiner.address, user2Donation);

		await DonationMiner.connect(donor1).donate(user1Donation1);
		await DonationMiner.connect(donor2).donate(user2Donation);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation2);
		await DonationMiner.connect(donor1).donate(user1Donation2);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();
		await DonationMiner.connect(donor2).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(0);
		expect(await PACT.balanceOf(donor2.address)).to.equal(0);
	});

	it("Should claim reward after claim delay, multiple donors #1", async function () {
		await updateImplementation();

		const user1Donation1 = parseEther("50");
		const user1Donation2 = parseEther("50");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("2160000");
		const user2ExpectedReward = parseEther("2160000");

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation1);
		await cUSD
			.connect(donor2)
			.approve(DonationMiner.address, user2Donation);

		await DonationMiner.connect(donor1).donate(user1Donation1);
		await DonationMiner.connect(donor2).donate(user2Donation);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation2);
		await DonationMiner.connect(donor1).donate(user1Donation2);

		await advanceTimeAndBlockNTimes((CLAIM_DELAY + 1) * REWARD_PERIOD_SIZE);

		// Claim their rewards
		await DonationMiner.connect(donor1).claimRewards();
		await DonationMiner.connect(donor2).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);
		expect(await PACT.balanceOf(donor2.address)).to.equal(
			user2ExpectedReward
		);
	});

	async function donateAndCheck(
		donation: BigNumber,
		estimatedReward: BigNumber,
		expectedClaimableReward: BigNumber
	) {
		await DonationMiner.connect(donor1).donate(donation);
		expect(
			await DonationMiner.estimateClaimableReward(donor1.address)
		).to.be.equal(estimatedReward);

		//verify donors method
		expect(
			await DonationMiner.calculateClaimableRewards(donor1.address)
		).to.be.equal(expectedClaimableReward);
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE - 2);
		expectedClaimableReward = expectedClaimableReward.add(estimatedReward);
		expect(
			await DonationMiner.estimateClaimableReward(donor1.address)
		).to.be.equal(0);
		expect(
			await DonationMiner.calculateClaimableRewards(donor1.address)
		).to.be.equal(expectedClaimableReward);
	}

	async function checkClaimRewards(expectedReward: BigNumber) {
		const initialBalance = await PACT.balanceOf(donor1.address);
		await DonationMiner.connect(donor1).claimRewards();

		expect(await PACT.balanceOf(donor1.address)).to.be.equal(
			initialBalance.add(expectedReward)
		);
	}

	it("Should donate and claim in multiple reward periods, one donor #1", async function () {
		await updateImplementation();

		const user1Donation = parseEther("100");

		const user1Reward1 = parseEther("4320000");
		const user1Reward2 = parseEther("4315256.64");
		const user1Reward3 = parseEther("4310518.48820928");
		const user1Reward4 = parseEther("4305785.53890922621056");
		const user1Reward5 = parseEther("4301057.7863875038801808");
		const user1Reward6 = parseEther("4296335.22493805040092036");
		const user1Reward7 = parseEther("4291617.84886106842158014");
		const user1Reward8 = parseEther("4286905.65246301896845324");
		const user1Reward9 = parseEther("4282198.63005661457362586");
		const user1Reward10 = parseEther("4277496.775960812410824");
		const user1Reward11 = parseEther("4272800.0845008074387969");
		const user1Reward12 = parseEther("4268108.5500080255522291");

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation.mul(12));

		await advanceTimeAndBlockNTimes(STARTING_DELAY + 10);

		let previousReward = parseEther("0");
		await donateAndCheck(user1Donation, user1Reward1, previousReward);
		await checkClaimRewards(parseEther("0"));

		previousReward = previousReward.add(user1Reward1);
		await donateAndCheck(user1Donation, user1Reward2, previousReward);
		await checkClaimRewards(parseEther("0"));
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				1
			)
		).to.be.equal(user1Reward1);

		previousReward = previousReward.add(user1Reward2);
		await donateAndCheck(user1Donation, user1Reward3, previousReward);
		await checkClaimRewards(parseEther("0"));
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				1
			)
		).to.be.equal(user1Reward1);

		previousReward = previousReward.add(user1Reward3);
		await donateAndCheck(user1Donation, user1Reward4, previousReward);
		await checkClaimRewards(parseEther("0"));
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				1
			)
		).to.be.equal(user1Reward1);
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				2
			)
		).to.be.equal(user1Reward1.add(user1Reward2));

		previousReward = previousReward.add(user1Reward4);
		await donateAndCheck(user1Donation, user1Reward5, previousReward);
		await checkClaimRewards(parseEther("0"));
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				1
			)
		).to.be.equal(user1Reward1);
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				2
			)
		).to.be.equal(user1Reward1.add(user1Reward2));
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				3
			)
		).to.be.equal(user1Reward1.add(user1Reward2).add(user1Reward3));

		previousReward = previousReward.add(user1Reward5);
		await donateAndCheck(user1Donation, user1Reward6, previousReward);
		await checkClaimRewards(parseEther("0"));

		previousReward = previousReward.add(user1Reward6);
		await donateAndCheck(user1Donation, user1Reward7, previousReward);
		await checkClaimRewards(parseEther("0"));

		previousReward = previousReward.add(user1Reward7);
		await donateAndCheck(user1Donation, user1Reward8, previousReward);
		await checkClaimRewards(parseEther("0"));

		previousReward = previousReward.add(user1Reward8);
		await donateAndCheck(user1Donation, user1Reward9, previousReward);
		await checkClaimRewards(user1Reward1);

		previousReward = previousReward.add(user1Reward9).sub(user1Reward1);
		await donateAndCheck(user1Donation, user1Reward10, previousReward);

		previousReward = previousReward.add(user1Reward10);
		await donateAndCheck(user1Donation, user1Reward11, previousReward);
		await checkClaimRewards(user1Reward2.add(user1Reward3));

		previousReward = previousReward
			.add(user1Reward11)
			.sub(user1Reward2)
			.sub(user1Reward3);
		await donateAndCheck(user1Donation, user1Reward12, previousReward);
		await checkClaimRewards(user1Reward4);
	});

	it("Should donate and claim in multiple reward periods, one donor #2", async function () {
		DonationMiner = await ethers.getContractAt(
			"DonationMinerImplementation",
			DonationMiner.address
		);

		const user1Donation = parseEther("100");

		const user1Reward1 = parseEther("4320000");
		const user1Reward2 = parseEther("4315256.64");
		const user1Reward3 = parseEther("4310518.48820928");
		const user1Reward4 = parseEther("4305785.53890922621056");
		const user1Reward5 = parseEther("4301057.7863875038801808");

		const user1Reward14 = parseEther("38497625.86288946275859436");

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation.mul(12));

		await advanceTimeAndBlockNTimes(STARTING_DELAY + 10);

		let previousReward = parseEther("0");
		await donateAndCheck(user1Donation, user1Reward1, previousReward);

		await checkClaimRewards(user1Reward1);

		previousReward = parseEther("0");
		await donateAndCheck(user1Donation, user1Reward2, previousReward);
		await checkClaimRewards(user1Reward2);

		previousReward = parseEther("0");
		await donateAndCheck(user1Donation, user1Reward3, previousReward);

		await updateImplementation();

		await checkClaimRewards(parseEther("0"));

		previousReward = previousReward.add(user1Reward3);

		await donateAndCheck(user1Donation, user1Reward4, previousReward);
		await checkClaimRewards(parseEther("0"));
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				1
			)
		).to.be.equal(parseEther("0"));
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				2
			)
		).to.be.equal(parseEther("0"));
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				3
			)
		).to.be.equal(user1Reward3);
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				4
			)
		).to.be.equal(user1Reward3.add(user1Reward4));

		previousReward = previousReward.add(user1Reward4);
		await donateAndCheck(user1Donation, user1Reward5, previousReward);
		await checkClaimRewards(parseEther("0"));
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				1
			)
		).to.be.equal(parseEther("0"));
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				2
			)
		).to.be.equal(parseEther("0"));
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				3
			)
		).to.be.equal(user1Reward3);
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				4
			)
		).to.be.equal(user1Reward3.add(user1Reward4));
		expect(
			await DonationMiner.calculateClaimableRewardsByPeriodNumber(
				donor1.address,
				5
			)
		).to.be.equal(user1Reward3.add(user1Reward4).add(user1Reward5));

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 8);

		await checkClaimRewards(
			user1Reward3.add(user1Reward4).add(user1Reward5)
		);

		await donateAndCheck(user1Donation, user1Reward14, parseEther("0"));
		await checkClaimRewards(parseEther("0"));
	});
});


describe.only("Donation Miner V3 (claimDelay = 0, againstPeriods != 0)", () => {
	before(async function () {});

	beforeEach(async () => {
		await deploy();

		STARTING_DELAY = 93;
	});

	async function updateImplementation() {
		ImpactProxyAdmin.upgrade(
			DonationMiner.address,
			DonationMinerImplementationV3.address
		);

		DonationMiner = await ethers.getContractAt(
			"DonationMinerImplementationV3",
			DonationMiner.address
		);

		DonationMiner.updateAgainstPeriods(AGAINST_PERIODS);

	}

	async function donateAndCheckSamePeriod(
		donor: SignerWithAddress,
		donation: BigNumber,
		estimatedReward: BigNumber,
		expectedClaimableReward: BigNumber
	) {
		await DonationMiner.connect(donor).donate(donation);
		expect(
			await DonationMiner.estimateClaimableReward(donor.address)
		).to.be.equal(estimatedReward);

		//verify donors method
		expect(
			await DonationMiner.calculateClaimableRewards(donor.address)
		).to.be.equal(expectedClaimableReward);
	}

	async function checkNextPeriod(
		donor: SignerWithAddress,
		donation: BigNumber,
		estimatedReward: BigNumber,
		expectedClaimableReward: BigNumber
	) {
		expectedClaimableReward = expectedClaimableReward.add(estimatedReward);
		expect(
			await DonationMiner.estimateClaimableReward(donor.address)
		).to.be.equal(0);
		expect(
			await DonationMiner.calculateClaimableRewards(donor.address)
		).to.be.equal(expectedClaimableReward);
	}

	async function donateAndCheckAll(
		donor: SignerWithAddress,
		donation: BigNumber,
		estimatedReward: BigNumber,
		expectedClaimableReward: BigNumber
	) {
		await donateAndCheckSamePeriod(donor, donation, estimatedReward, expectedClaimableReward);
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE - 1);
		await checkNextPeriod(donor, donation, estimatedReward, expectedClaimableReward);
	}

	async function checkClaimRewards(donor: SignerWithAddress, expectedReward: BigNumber) {
		const initialBalance = await PACT.balanceOf(donor.address);
		await DonationMiner.connect(donor).claimRewards();

		expect(await PACT.balanceOf(donor.address)).to.be.equal(
			initialBalance.add(expectedReward)
		);
	}

	it("Should claim reward based on the againstPeriods amount #1", async function () {
		updateImplementation();

		const user1Donation = parseEther("100");
		const user2Donation = parseEther("100");

		const periodReward1 = parseEther("4320000");
		const periodReward2 = parseEther("4315256.64");
		const periodReward3 = parseEther("4310518.48820928");
		const periodReward4 = parseEther("4305785.53890922621056");
		const periodReward5 = parseEther("4301057.7863875038801808"); //0.7
		const periodReward6 = parseEther("4296335.22493805040092036");// 0.8   1.5
		const periodReward7 = parseEther("4291617.84886106842158014");// 1.05  2.55
		const periodReward8 = parseEther("4286905.65246301896845324");// 1.4   3.95
		const periodReward9 = parseEther("4282198.63005661457362586");// 2.1   6.2
		const periodReward10 = parseEther("4277496.775960812410824");
		const periodReward11 = parseEther("4272800.0845008074387969");
		const periodReward12 = parseEther("4268108.5500080255522291");

		// Approve
		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation.mul(5));

		await cUSD
			.connect(donor2)
			.approve(DonationMiner.address, user2Donation);

		await advanceTimeAndBlockNTimes(STARTING_DELAY + 5);

		let previousDonor1Reward = parseEther("0");
		await donateAndCheckAll(donor1, user1Donation, periodReward1,  parseEther("0"));
		await checkClaimRewards(donor1, periodReward1);

		await donateAndCheckAll(donor1, user1Donation, periodReward2,  parseEther("0"));
		await checkClaimRewards(donor1, periodReward2);

		await donateAndCheckAll(donor1, user1Donation, periodReward3,  parseEther("0"));
		previousDonor1Reward = previousDonor1Reward.add(periodReward3);
		await donateAndCheckAll(donor1, user1Donation, periodReward4, previousDonor1Reward);
		previousDonor1Reward = previousDonor1Reward.add(periodReward4);
		await donateAndCheckSamePeriod(donor1, user1Donation, periodReward5, previousDonor1Reward);
		await checkClaimRewards(donor1, previousDonor1Reward)
		await donateAndCheckAll(donor2, user2Donation, periodReward5.div(6),  parseEther("0"));

		await advanceTimeAndBlockNTimes(2 * REWARD_PERIOD_SIZE);

		await checkClaimRewards(
			donor1,
			(periodReward5.div(6).mul(5))
				.add(periodReward6.div(5).mul(4))
				.add(periodReward7.div(4).mul(3))
				.add(parseEther("0.000000000000000003"))  //BigNumber vs solidity math diff
		);

		await advanceTimeAndBlockNTimes(7 * REWARD_PERIOD_SIZE);


		await checkClaimRewards(
			donor1,
			(periodReward8.div(3).mul(2))
				.add(periodReward9.div(2))
				.add(parseEther("0.000000000000000001"))  //BigNumber vs solidity math diff
		);

		await checkClaimRewards(
			donor2,
			(periodReward5.div(6))
				.add(periodReward6.div(5))
				.add(periodReward7.div(4))
				.add(periodReward8.div(3))
				.add(periodReward9.div(2))
		);
	});
});