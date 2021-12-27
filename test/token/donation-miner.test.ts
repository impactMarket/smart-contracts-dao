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

const STARTING_DELAY = 100;
const REWARD_PERIOD_SIZE = 20;

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
			startBlock: formatEther(rewardPeriod.startBlock),
			endBlock: formatEther(rewardPeriod.endBlock),
			donationsAmount: formatEther(rewardPeriod.donationsAmount),
		});
	}
}

describe("Donation Miner", () => {
	before(async function () {});

	beforeEach(async () => {
		await deploy();
	});

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

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation1);

		await DonationMiner.connect(donor1).donate(user1Donation1);

		await cUSD
			.connect(donor2)
			.approve(DonationMiner.address, user2Donation);

		await DonationMiner.connect(donor2).donate(user2Donation);

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation2);

		await DonationMiner.connect(donor1).donate(user1Donation2);

		//third block donations
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE - 6);

		await DonationMiner.connect(donor1).claimRewards();

		await cUSD
			.connect(donor1)
			.approve(DonationMiner.address, user1Donation3);

		await DonationMiner.connect(donor1).donate(user1Donation3);

		await cUSD
			.connect(donor3)
			.approve(DonationMiner.address, user3Donation);

		await DonationMiner.connect(donor3).donate(user3Donation);

		//forth block donations
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE - 5);

		await DonationMiner.connect(donor3).claimRewards();
		//none

		//fifth block donations
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE - 1);

		await cUSD
			.connect(donor4)
			.approve(DonationMiner.address, user4Donation);

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
		expect(donor1Details.lastClaim).to.equal(1);
		const donor2Details = await DonationMiner.donors(donor2.address);
		expect(donor2Details.rewardPeriodsCount).to.equal(1);
		expect(donor2Details.lastClaim).to.equal(0);
		const donor3Details = await DonationMiner.donors(donor3.address);
		expect(donor3Details.rewardPeriodsCount).to.equal(1);
		expect(donor3Details.lastClaim).to.equal(1);
		const donor4Details = await DonationMiner.donors(donor4.address);
		expect(donor4Details.rewardPeriodsCount).to.equal(1);
		expect(donor4Details.lastClaim).to.equal(0);

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
		expect(rewardPeriod3.rewardAmount).to.equal(
			parseEther("4310518.48820928")
		);
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

	it("Should have correct values", async function () {
		expect(await DonationMiner.getVersion()).to.be.equal(1);
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

	it("Should update first reward params if admin", async function () {
		await expect(DonationMiner.updateFirstRewardPeriodParams(100, 200)).to
			.be.fulfilled;
		const rewardPeriod1 = await DonationMiner.rewardPeriods(1);

		expect(rewardPeriod1.rewardPerBlock).to.equal(200);
		expect(rewardPeriod1.rewardAmount).to.equal(4000);
		expect(rewardPeriod1.startBlock).to.equal(100);
		expect(rewardPeriod1.endBlock).to.equal(119);
		expect(rewardPeriod1.donationsAmount).to.equal(0);
	});

	it("Should not update first reward params if not admin", async function () {
		await expect(
			DonationMiner.connect(donor1).updateFirstRewardPeriodParams(
				100,
				200
			)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("Should not update first reward params after startingBlock", async function () {
		await advanceTimeAndBlockNTimes(STARTING_DELAY);
		await expect(
			DonationMiner.updateFirstRewardPeriodParams(100, 200)
		).to.be.rejectedWith(
			"DonationMiner::updateFirstRewardPeriodParams: DonationMiner has already started"
		);
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

	xit("Should donate and claim 9 years, one donor", async function () {
		DonationMiner.updateRewardPeriodParams(1, "998902", "1000000");
		DonationMiner.updateFirstRewardPeriodParams(100, parseEther("4320000"));

		const rewardAfter9Years = "3827876834.248935270736798502";
		const donationMinerBalanceAfterYears = "172123165.751064729263201498";

		const rewardsExpected = [
			"409340576.103595678060798039", //expected reward after 100 reward periods
			"776093059.94913202316686679", //expected reward after 200 reward periods
			"1104688347.734209420766572907", //expected reward after 300 reward periods
			"1399096341.982540592262911097", //expected reward after 400 reward periods
			"1662873913.662196456097768485", //expected reward after 500 reward periods
			"1899207874.290068870157876585", //same
			"2110953477.187225761950977078", //same
			"2300668913.035562447870713304", //same
			"2470646216.491565483377240333", //same
			"2622938957.253426122132404016", //same
			"2759387050.129323467016702699", //same
			"2881638983.848098055022759696", //same
			"2991171737.168241272970393118", //same
			"3089308622.900371541408347231", //same
			"3177235275.42459022849801764", //same
			"3256013974.854864809324442669", //same
			"3326596480.906896403926653355", //same
			"3389835531.521008737569776406", //same
			"3446495145.15992050241565029", //same
			"3497259851.247939281325456866", //same
			"3542742960.268525733626106372", //same
			"3583493973.43487201937061561", //same
			"3620005221.452945965627504535", //same
			"3652717812.58278341622161101", //same
			"3682026961.859143070198300815", //same
			"3708286765.856155340619929348", //same
			"3731814480.681972715447758805", //same
			"3752894354.887734786939502388", //same
			"3771781063.597887457030261245", //same
			"3788702785.351077642798093441", //same
			"3803863958.824275942395743896", //same
			"3817447752.745309832749613474", //expected reward after 3200 reward periods
		];

		await advanceToBlockN(100);

		// 9 years = 3285 rewardPeriods
		for (let i = 0; i < 32; i++) {
			await chunkAdvance(100, rewardsExpected[i]);
		}

		await chunkAdvance(85, rewardAfter9Years);

		expect(await PACT.balanceOf(donor1.address)).to.be.equal(
			parseEther(rewardAfter9Years)
		);
		expect(await PACT.balanceOf(DonationMiner.address)).to.be.equal(
			parseEther(donationMinerBalanceAfterYears)
		);
	});

	//*******************************************************************************************

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

	it("Should update implementation if owner", async function () {
		const NewDonationMinerImplementationFactory =
			await ethers.getContractFactory("DonationMinerImplementationMock");
		const NewDonationMinerImplementation =
			await NewDonationMinerImplementationFactory.deploy();

		expect(
			await ImpactProxyAdmin.getProxyImplementation(DonationMiner.address)
		).to.be.equal(DonationMinerImplementation.address);
		await expect(
			ImpactProxyAdmin.upgrade(
				DonationMiner.address,
				NewDonationMinerImplementation.address
			)
		).to.be.fulfilled;
		expect(
			await ImpactProxyAdmin.getProxyImplementation(DonationMiner.address)
		).to.be.equal(NewDonationMinerImplementation.address);
	});

	it("Should not update implementation if not owner", async function () {
		const NewDonationMinerImplementationFactory =
			await ethers.getContractFactory("DonationMinerImplementationMock");
		const NewDonationMinerImplementation =
			await NewDonationMinerImplementationFactory.deploy();

		expect(
			await ImpactProxyAdmin.getProxyImplementation(DonationMiner.address)
		).to.be.equal(DonationMinerImplementation.address);
		await expect(
			ImpactProxyAdmin.connect(donor1).upgrade(
				DonationMiner.address,
				NewDonationMinerImplementation.address
			)
		).to.be.rejectedWith("Ownable: caller is not the owner");
		expect(
			await ImpactProxyAdmin.getProxyImplementation(DonationMiner.address)
		).to.be.equal(DonationMinerImplementation.address);
	});

	it("Should update implementation and call new methods", async function () {
		const NewDonationMinerImplementationFactory =
			await ethers.getContractFactory("DonationMinerImplementationMock");
		const NewDonationMinerImplementation =
			await NewDonationMinerImplementationFactory.deploy();

		await ImpactProxyAdmin.upgrade(
			DonationMiner.address,
			NewDonationMinerImplementation.address
		);

		DonationMiner = await ethers.getContractAt(
			"DonationMinerImplementationMock",
			DonationMiner.address
		);

		// await DonationMiner.initialize();

		expect(await DonationMiner.getVersion()).to.be.equal(2);
		expect(await DonationMiner.owner()).to.be.equal(owner.address);
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

		// expect(await DonationMiner.testParam1()).to.be.equal(0);
		await expect(DonationMiner.updateTestParam1(200)).to.be.fulfilled;
		expect(await DonationMiner.testParam1()).to.be.equal(200);
		await expect(DonationMiner.updateTestParam2(donor1.address)).to.be
			.fulfilled;
		expect(await DonationMiner.testParam2()).to.be.equal(donor1.address);
	});

	it("Should have same storage after update implementation", async function () {
		const NewDonationMinerImplementationFactory =
			await ethers.getContractFactory("DonationMinerImplementationMock");
		const NewDonationMinerImplementation =
			await NewDonationMinerImplementationFactory.deploy();

		const {
			user1Donation1,
			user1Donation2,
			user1Donation3,
			user2Donation,
			user3Donation,
			user4Donation,
		} = await rewardPeriodFixtures();

		await ImpactProxyAdmin.upgrade(
			DonationMiner.address,
			NewDonationMinerImplementation.address
		);

		DonationMiner = await ethers.getContractAt(
			"DonationMinerImplementationMock",
			DonationMiner.address
		);

		// await DonationMiner.initialize();

		await expect(DonationMiner.updateTestParam1(200)).to.be.fulfilled;
		await expect(DonationMiner.updateTestParam2(donor1.address)).to.be
			.fulfilled;
		await expect(DonationMiner.updateTestParam3(0, 100)).to.be.fulfilled;
		await expect(DonationMiner.updateTestParam3(1, 101)).to.be.fulfilled;
		await expect(DonationMiner.updateTestParam4(donor2.address, 201)).to.be
			.fulfilled;
		await expect(DonationMiner.updateTestParam4(donor2.address, 202)).to.be
			.fulfilled;

		await verifyRewardPeriodFixtures(
			user1Donation1,
			user1Donation2,
			user2Donation,
			user1Donation3,
			user3Donation,
			user4Donation
		);
	});
});

describe("Donation Miner + Community", () => {
	const oneMinuteInBlocks = 12;
	const threeMinutesInBlocks = 36;
	const claimAmountTwo = parseEther("2");
	const maxClaimTen = parseEther("10");
	const oneCent = parseEther("0.01");
	const mintAmount = parseEther("500");
	const communityMinTranche = parseEther("100");
	const communityMaxTranche = parseEther("5000");

	let Community: ethersTypes.Contract;
	let CommunityAdmin: ethersTypes.Contract;

	before(async function () {});

	beforeEach(async () => {
		deploy();

		CommunityAdmin = await ethers.getContractAt(
			"CommunityAdminImplementation",
			(
				await deployments.get("CommunityAdminProxy")
			).address
		);

		await cUSD.mint(Treasury.address, mintAmount.toString());

		const tx = await CommunityAdmin.addCommunity(
			[owner.address],
			claimAmountTwo.toString(),
			maxClaimTen.toString(),
			oneCent.toString(),
			threeMinutesInBlocks.toString(),
			oneMinuteInBlocks.toString(),
			communityMinTranche,
			communityMaxTranche
		);

		let receipt = await tx.wait();

		const communityAddress = receipt.events?.filter((x: any) => {
			return x.event == "CommunityAdded";
		})[0]["args"]["communityAddress"];

		Community = await ethers.getContractAt("Community", communityAddress);
	});

	it("Should approve and donate to community, advance time and claim the reward", async function () {
		const user1Donation = parseEther("100");
		const user1ExpectedReward = parseEther("4320000");

		const communityInitialBalance = await cUSD.balanceOf(Community.address);

		await advanceTimeAndBlockNTimes(STARTING_DELAY);

		// Approve
		await cUSD.connect(donor1).approve(Community.address, user1Donation);

		await DonationMiner.connect(donor1).donateToCommunity(
			Community.address,
			user1Donation
		);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		// Claim the rewards
		await DonationMiner.connect(donor1).claimRewards();

		// Check their PACT balance
		expect(await PACT.balanceOf(donor1.address)).to.equal(
			user1ExpectedReward
		);

		expect(await cUSD.balanceOf(Community.address)).to.equal(
			communityInitialBalance.add(user1Donation)
		);

		const donation1 = await DonationMiner.donations(1);
		expect(donation1.donor).to.equal(donor1.address);
		expect(donation1.target).to.equal(Community.address);
		expect(donation1.rewardPeriod).to.equal(1);
		expect(donation1.blockNumber.toNumber())
			.to.be.greaterThanOrEqual(130)
			.lessThanOrEqual(149);
		expect(donation1.amount).to.equal(user1Donation);
		expect(donation1.token).to.equal(cUSD.address);
		expect(donation1.tokenPrice).to.equal(parseEther("1"));
	});
});
