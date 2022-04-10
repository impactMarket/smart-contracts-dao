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
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { BigNumber } from "@ethersproject/bignumber";
import { fromEther, toEther } from "../utils/helpers";
import { parseUnits } from "@ethersproject/units/src.ts";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe.only("DonationMiner", () => {
	const START_BLOCK = 130;
	const REWARD_PERIOD_SIZE = 20;
	const CLAIM_DELAY = 5;
	const AGAINST_PERIODS = 8;
	const STAKING_DONATION_RATIO = 1000000;

	let owner: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let user4: SignerWithAddress;
	let user5: SignerWithAddress;
	let user6: SignerWithAddress;
	let user7: SignerWithAddress;
	let user8: SignerWithAddress;
	let user9: SignerWithAddress;
	let entity: SignerWithAddress;
	let ambassador: SignerWithAddress;

	let ImpactProxyAdmin: ethersTypes.Contract;
	let DonationMiner: ethersTypes.Contract;
	let DonationMinerImplementationOld: ethersTypes.Contract;
	let DonationMinerImplementationNew: ethersTypes.Contract;
	let PACT: ethersTypes.Contract;
	let SPACT: ethersTypes.Contract;
	let cUSD: ethersTypes.Contract;
	let Treasury: ethersTypes.Contract;
	let Staking: ethersTypes.Contract;

	const periodRewards: { [key: number]: BigNumber } = {
		1: toEther("4320000"),
		2: toEther("4315256.64"),
		3: toEther("4310518.48820928"),
		4: toEther("4305785.53890922621056"),
		5: toEther("4301057.7863875038801808"),
		6: toEther("4296335.22493805040092036"),
		7: toEther("4291617.84886106842158014"),
		8: toEther("4286905.65246301896845324"),
		9: toEther("4282198.63005661457362586"),
		10: toEther("4277496.775960812410824"),
		11: toEther("4272800.0845008074387969"),
		12: toEther("4268108.5500080255522291"),
		13: toEther("4263422.16682011674017274"),
		14: toEther("4258740.92928094825199202"),
		15: toEther("4254064.83174059777081132"),
		16: toEther("4249393.86855534659445896"),
		17: toEther("4244728.03408767282389824"),
		18: toEther("4240067.32270624455913758"),
		19: toEther("4235411.72878591310261164"),
		20: toEther("4230761.24670770617002496"),
		21: toEther("4226115.87085882110865026"),
		22: toEther("4221475.59563261812307296"),
		23: toEther("4216840.41542861350837382"),
		24: toEther("4212210.32465247289074162"),
		25: toEther("4207585.31771600447550758"),
		26: toEther("4202965.38903715230259346"),
		27: toEther("4198350.5330399895093652"),
		28: toEther("4193740.7441547116008839"),
		29: toEther("4189136.01681762972754612"),
		30: toEther("4184536.34547116397010526"),
		31: toEther("4179941.72456383663206608"),
		32: toEther("4175352.14855026553944406"),
		33: toEther("4170767.61189115734788174"),
		34: toEther("4166188.10905330085711376"),
		35: toEther("4161613.63450956033277264"),
		36: toEther("4157044.18273886883552724"),
		37: toEther("4152479.74822622155754582"),
		38: toEther("4147920.32546266916627562"),
		39: toEther("4143365.90894531115553104"),
		40: toEther("4138816.49317728920388226"),
		41: toEther("4134272.07266778054033638"),
		42: toEther("4129732.64193199131730308"),
		43: toEther("4125198.19549114999083668"),
		44: toEther("4120668.72787250070814674"),
		45: toEther("4116144.23360929670236918"),
		46: toEther("4111624.70724079369458996"),
		47: toEther("4107110.1433122433031133"),
		48: toEther("4102600.53637488645996648"),
		49: toEther("4098095.88098594683463342"),
		50: toEther("4093596.17170862426500898"),
	};

	function rewards(periodNumber: number): BigNumber {
		return periodRewards[periodNumber];
	}

	function rewardsSum(periodStart: number, periodEnd: number): BigNumber {
		let sum = toEther(0);

		for (let i = periodStart; i <= periodEnd; i++) {
			sum = sum.add(periodRewards[i]);
		}

		return sum;
	}

	const deploy = deployments.createFixture(async () => {
		await deployments.fixture("Test", { fallbackToGlobal: false });

		[
			owner,
			user1,
			user2,
			user3,
			user4,
			user5,
			user6,
			user7,
			user8,
			user9,
			entity,
			ambassador,
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
				await deployments.get("TokenMock")
			).address
		);

		DonationMinerImplementationOld = await ethers.getContractAt(
			"DonationMinerImplementation",
			(
				await deployments.get("DonationMinerImplementation")
			).address
		);

		DonationMinerImplementationNew = await ethers.getContractAt(
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

		SPACT = await ethers.getContractAt(
			"SPACTToken",
			(
				await deployments.get("SPACTToken")
			).address
		);

		Staking = await ethers.getContractAt(
			"StakingImplementation",
			(
				await deployments.get("StakingProxy")
			).address
		);

		Treasury = await ethers.getContractAt(
			"TreasuryImplementation",
			(
				await deployments.get("TreasuryProxy")
			).address
		);
	});

	async function showRewardPeriods(DonationMiner: any) {
		const periodsCount = await DonationMiner.rewardPeriodCount();

		console.log("rewardPeriodCount: ", periodsCount);
		for (let i = 0; i <= periodsCount; i++) {
			let rewardPeriod = await DonationMiner.rewardPeriods(i);
			console.log("rewardPeriod #", i, ": ", {
				rewardPerBlock: fromEther(rewardPeriod.rewardPerBlock),
				rewardAmount: fromEther(rewardPeriod.rewardAmount),
				startBlock: rewardPeriod.startBlock,
				endBlock: rewardPeriod.endBlock,
				donationsAmount: fromEther(rewardPeriod.donationsAmount),
				stakesAmount: fromEther(rewardPeriod.stakesAmount),
				stakingDonationRatio: rewardPeriod.stakingDonationRatio,
			});
		}
	}

	async function advanceToRewardPeriodN(rewardPeriodNumber: number) {
		const firstBlockFromPeriodNumberN =
			START_BLOCK + (rewardPeriodNumber - 1) * REWARD_PERIOD_SIZE;

		await advanceToBlockN(firstBlockFromPeriodNumberN);
	}

	async function advanceToNextRewardPeriod() {
		await advanceToRewardPeriodN(
			parseInt(await DonationMiner.rewardPeriodCount()) + 1
		);
	}
	async function rewardPeriodFixtures() {
		const user1Donation1 = toEther("100");
		const user1Donation2 = toEther("200");
		const user1Donation3 = toEther("300");
		const user2Donation = toEther("400");
		const user3Donation = toEther("500");
		const user4Donation = toEther("600");

		//first block donations
		await advanceToBlockN(START_BLOCK);
		//none

		//second block donations
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

		await cUSD
			.connect(user1)
			.approve(DonationMiner.address, user1Donation1);

		await DonationMiner.connect(user1).donate(
			cUSD.address,
			user1Donation1,
			user1.address
		);

		await cUSD.connect(user2).approve(DonationMiner.address, user2Donation);

		await DonationMiner.connect(user2).donate(
			cUSD.address,
			user2Donation,
			user2.address
		);

		await cUSD
			.connect(user1)
			.approve(DonationMiner.address, user1Donation2);

		await DonationMiner.connect(user1).donate(
			cUSD.address,
			user1Donation2,
			user1.address
		);

		//third block donations
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE - 6);

		await DonationMiner.connect(user1).claimRewards();

		await cUSD
			.connect(user1)
			.approve(DonationMiner.address, user1Donation3);

		await DonationMiner.connect(user1).donate(
			cUSD.address,
			user1Donation3,
			user1.address
		);

		await cUSD.connect(user3).approve(DonationMiner.address, user3Donation);

		await DonationMiner.connect(user3).donate(
			cUSD.address,
			user3Donation,
			user3.address
		);

		//forth block donations
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE - 5);

		await DonationMiner.connect(user3).claimRewards();
		//none

		//fifth block donations
		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE - 1);

		await cUSD.connect(user4).approve(DonationMiner.address, user4Donation);

		await DonationMiner.connect(user4).donate(
			cUSD.address,
			user4Donation,
			user4.address
		);

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
			await DonationMiner.rewardPeriodDonorAmount(2, user1.address)
		).to.equal(user1Donation1.add(user1Donation2));
		expect(
			await DonationMiner.rewardPeriodDonorAmount(2, user2.address)
		).to.equal(user2Donation);
		expect(
			await DonationMiner.rewardPeriodDonorAmount(2, user3.address)
		).to.equal(0);
		expect(
			await DonationMiner.rewardPeriodDonorAmount(3, user1.address)
		).to.equal(user1Donation3);
		expect(
			await DonationMiner.rewardPeriodDonorAmount(3, user2.address)
		).to.equal(0);
		expect(
			await DonationMiner.rewardPeriodDonorAmount(3, user3.address)
		).to.equal(user3Donation);
		expect(
			await DonationMiner.rewardPeriodDonorAmount(4, user1.address)
		).to.equal(0);
		expect(
			await DonationMiner.rewardPeriodDonorAmount(5, user3.address)
		).to.equal(0);
		expect(
			await DonationMiner.rewardPeriodDonorAmount(5, user4.address)
		).to.equal(user4Donation);

		//verify donors method
		const user1Details = await DonationMiner.donors(user1.address);
		expect(user1Details.rewardPeriodsCount).to.equal(2);
		expect(user1Details.lastClaim).to.equal(0);
		expect(user1Details.lastClaimPeriod).to.equal(2);
		const user2Details = await DonationMiner.donors(user2.address);
		expect(user2Details.rewardPeriodsCount).to.equal(1);
		expect(user2Details.lastClaim).to.equal(0);
		expect(user2Details.lastClaimPeriod).to.equal(0);
		const user3Details = await DonationMiner.donors(user3.address);
		expect(user3Details.rewardPeriodsCount).to.equal(1);
		expect(user3Details.lastClaim).to.equal(0);
		expect(user3Details.lastClaimPeriod).to.equal(3);
		const user4Details = await DonationMiner.donors(user4.address);
		expect(user4Details.rewardPeriodsCount).to.equal(1);
		expect(user4Details.lastClaim).to.equal(0);
		expect(user4Details.lastClaimPeriod).to.equal(0);

		//verify rewardPeriods method
		const rewardPeriod1 = await DonationMiner.rewardPeriods(1);
		expect(rewardPeriod1.rewardPerBlock).to.equal(toEther("216000"));
		expect(rewardPeriod1.rewardAmount).to.equal(rewards(1));
		expect(rewardPeriod1.startBlock).to.equal(START_BLOCK);
		expect(rewardPeriod1.endBlock).to.equal(149);
		expect(rewardPeriod1.donationsAmount).to.equal(0);
		expect(rewardPeriod1.stakesAmount).to.equal(0);
		const rewardPeriod2 = await DonationMiner.rewardPeriods(2);
		expect(rewardPeriod2.rewardPerBlock).to.equal(toEther("215762.832"));
		expect(rewardPeriod2.rewardAmount).to.equal(rewards(1).add(rewards(2)));
		expect(rewardPeriod2.startBlock).to.equal(150);
		expect(rewardPeriod2.endBlock).to.equal(169);
		expect(rewardPeriod2.donationsAmount).to.equal(
			user1Donation1.add(user2Donation).add(user1Donation2)
		);
		expect(rewardPeriod2.stakesAmount).to.equal(0);
		const rewardPeriod3 = await DonationMiner.rewardPeriods(3);
		expect(rewardPeriod3.rewardPerBlock).to.equal(
			toEther("215525.924410464")
		);
		expect(rewardPeriod3.rewardAmount).to.equal(
			toEther("4310518.48820928")
		);
		expect(rewardPeriod3.startBlock).to.equal(170);
		expect(rewardPeriod3.endBlock).to.equal(189);
		expect(rewardPeriod3.donationsAmount).to.equal(
			user1Donation3.add(user3Donation)
		);
		expect(rewardPeriod3.stakesAmount).to.equal(0);
		const rewardPeriod4 = await DonationMiner.rewardPeriods(4);
		expect(rewardPeriod4.rewardPerBlock).to.equal(
			toEther("215289.276945461310528")
		);
		expect(rewardPeriod4.rewardAmount).to.equal(
			toEther("4305785.53890922621056")
		);
		expect(rewardPeriod4.startBlock).to.equal(190);
		expect(rewardPeriod4.endBlock).to.equal(209);
		expect(rewardPeriod4.donationsAmount).to.equal(0);
		expect(rewardPeriod4.stakesAmount).to.equal(0);
		const rewardPeriod5 = await DonationMiner.rewardPeriods(5);
		expect(rewardPeriod5.rewardPerBlock).to.equal(
			toEther("215052.889319375194009040")
		);
		expect(rewardPeriod5.rewardAmount).to.equal(
			toEther("8606843.325296730090740800")
		);
		expect(rewardPeriod5.startBlock).to.equal(210);
		expect(rewardPeriod5.endBlock).to.equal(229);
		expect(rewardPeriod5.donationsAmount).to.equal(user4Donation);
		expect(rewardPeriod5.stakesAmount).to.equal(0);

		//verify donations method
		const donation1 = await DonationMiner.donations(1);
		expect(donation1.donor).to.equal(user1.address);
		expect(donation1.target).to.equal(Treasury.address);
		expect(donation1.rewardPeriod).to.equal(2);
		expect(donation1.blockNumber.toNumber())
			.to.be.greaterThanOrEqual(150)
			.lessThanOrEqual(169);
		expect(donation1.amount).to.equal(user1Donation1);
		expect(donation1.token).to.equal(cUSD.address);
		expect(donation1.initialAmount).to.equal(user1Donation1);
		const donation2 = await DonationMiner.donations(2);
		expect(donation2.donor).to.equal(user2.address);
		expect(donation2.target).to.equal(Treasury.address);
		expect(donation2.rewardPeriod).to.equal(2);
		expect(donation2.blockNumber.toNumber())
			.to.be.greaterThanOrEqual(150)
			.lessThanOrEqual(169);
		expect(donation2.amount).to.equal(user2Donation);
		expect(donation2.token).to.equal(cUSD.address);
		expect(donation2.initialAmount).to.equal(user2Donation);
		const donation3 = await DonationMiner.donations(3);
		expect(donation3.donor).to.equal(user1.address);
		expect(donation3.target).to.equal(Treasury.address);
		expect(donation3.rewardPeriod).to.equal(2);
		expect(donation3.blockNumber.toNumber())
			.to.be.greaterThanOrEqual(150)
			.lessThanOrEqual(169);
		expect(donation3.amount).to.equal(user1Donation2);
		expect(donation3.token).to.equal(cUSD.address);
		expect(donation3.initialAmount).to.equal(user1Donation2);
		const donation4 = await DonationMiner.donations(4);
		expect(donation4.donor).to.equal(user1.address);
		expect(donation4.target).to.equal(Treasury.address);
		expect(donation4.rewardPeriod).to.equal(3);
		expect(donation4.blockNumber.toNumber())
			.to.be.greaterThanOrEqual(170)
			.lessThanOrEqual(189);
		expect(donation4.amount).to.equal(user1Donation3);
		expect(donation4.token).to.equal(cUSD.address);
		expect(donation4.initialAmount).to.equal(user1Donation3);
		const donation5 = await DonationMiner.donations(5);
		expect(donation5.donor).to.equal(user3.address);
		expect(donation5.target).to.equal(Treasury.address);
		expect(donation5.rewardPeriod).to.equal(3);
		expect(donation5.blockNumber.toNumber())
			.to.be.greaterThanOrEqual(170)
			.lessThanOrEqual(189);
		expect(donation5.amount).to.equal(user3Donation);
		expect(donation5.token).to.equal(cUSD.address);
		expect(donation5.initialAmount).to.equal(user3Donation);
		const donation6 = await DonationMiner.donations(6);
		expect(donation6.donor).to.equal(user4.address);
		expect(donation6.target).to.equal(Treasury.address);
		expect(donation6.rewardPeriod).to.equal(5);
		expect(donation6.blockNumber.toNumber())
			.to.be.greaterThanOrEqual(210)
			.lessThanOrEqual(229);
		expect(donation6.amount).to.equal(user4Donation);
		expect(donation6.token).to.equal(cUSD.address);
		expect(donation6.initialAmount).to.equal(user4Donation);
	}

	async function chunkAdvance(chunk: number, rewardExpected: string) {
		// next 100 reward periods
		await advanceBlockNTimes(chunk - 3);
		// Approve
		await cUSD.connect(user1).approve(DonationMiner.address, 1);

		await DonationMiner.connect(user1).donate(
			cUSD.address,
			1,
			user1.address
		);

		// Claim their rewards
		await DonationMiner.connect(user1).claimRewards();

		// Check their PACT balance
		const balance = await PACT.balanceOf(user1.address);
		await expect(balance).to.equal(toEther(rewardExpected));
	}

	async function downgradeImplementation() {
		await ImpactProxyAdmin.upgrade(
			DonationMiner.address,
			DonationMinerImplementationOld.address
		);

		DonationMiner = await ethers.getContractAt(
			"DonationMinerImplementationOld",
			DonationMiner.address
		);
	}

	async function upgradeImplementation() {
		await ImpactProxyAdmin.upgrade(
			DonationMiner.address,
			DonationMinerImplementationNew.address
		);

		DonationMiner = await ethers.getContractAt(
			"DonationMinerImplementation",
			DonationMiner.address
		);
	}

	describe("Donation Miner (claimDelay = 0, againstPeriods = 0)", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(user1.address, toEther("1000000"));
			await cUSD.mint(user2.address, toEther("10000000"));
			await cUSD.mint(user3.address, toEther("100000000"));
			await cUSD.mint(user4.address, toEther("100000000"));
		});

		it("Should have correct values", async function () {
			expect(await DonationMiner.getVersion()).to.be.equal(4);
			expect(await DonationMiner.owner()).to.equal(owner.address);
			expect(await DonationMiner.cUSD()).to.equal(cUSD.address);
			expect(await DonationMiner.PACT()).to.equal(PACT.address);
			expect(await DonationMiner.treasury()).to.equal(Treasury.address);
			expect(await DonationMiner.staking()).to.equal(Staking.address);
			expect(await DonationMiner.rewardPeriodSize()).to.equal(
				REWARD_PERIOD_SIZE
			);
			expect(await DonationMiner.decayNumerator()).to.equal("998902");
			expect(await DonationMiner.decayDenominator()).to.equal("1000000");
			expect(await DonationMiner.rewardPeriodCount()).to.equal(1);
			expect(await DonationMiner.donationCount()).to.equal(0);
			expect(await DonationMiner.claimDelay()).to.equal(0);
			expect(await DonationMiner.stakingDonationRatio()).to.equal(0);
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
			const user1Donation1 = toEther("100");
			const user1ExpectedReward1 = rewards(1);
			const user1ExpectedReward2 = toEther("864000");

			//first block donations
			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation1);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation1,
				user1.address
			);

			//second block donations

			DonationMiner.updateRewardPeriodParams(
				2 * REWARD_PERIOD_SIZE,
				1,
				10
			);

			await DonationMiner.connect(user1).claimRewards();

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation1);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation1,
				user1.address
			);

			await advanceTimeAndBlockNTimes(2 * REWARD_PERIOD_SIZE);

			await DonationMiner.connect(user1).claimRewards();

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1ExpectedReward1.add(user1ExpectedReward2)
			);

			//verify rewardPeriods method
			const rewardPeriod1 = await DonationMiner.rewardPeriods(1);

			expect(rewardPeriod1.rewardPerBlock).to.equal(toEther("216000"));
			expect(rewardPeriod1.rewardAmount).to.equal(rewards(1));
			expect(rewardPeriod1.startBlock).to.equal(START_BLOCK);
			expect(rewardPeriod1.endBlock).to.equal(149);
			expect(rewardPeriod1.donationsAmount).to.equal(user1Donation1);
			expect(rewardPeriod1.stakesAmount).to.equal(0);
			const rewardPeriod2 = await DonationMiner.rewardPeriods(2);
			expect(rewardPeriod2.rewardPerBlock).to.equal(toEther("21600"));
			expect(rewardPeriod2.rewardAmount).to.equal(toEther("864000"));
			expect(rewardPeriod2.startBlock).to.equal(150);
			expect(rewardPeriod2.endBlock).to.equal(189);
			expect(rewardPeriod2.donationsAmount).to.equal(user1Donation1);
			expect(rewardPeriod2.stakesAmount).to.equal(0);
		});

		it("Should update claim delay if admin", async function () {
			expect(await DonationMiner.claimDelay()).to.be.equal(0);
			await expect(DonationMiner.updateClaimDelay(10)).to.be.fulfilled;
			expect(await DonationMiner.claimDelay()).to.be.equal(10);
		});

		it("Should not update claim delay if not admin", async function () {
			expect(await DonationMiner.claimDelay()).to.be.equal(0);
			await expect(
				DonationMiner.connect(user1).updateClaimDelay(10)
			).to.be.rejectedWith("Ownable: caller is not the owner");
			expect(await DonationMiner.claimDelay()).to.be.equal(0);
		});

		it("Should update stakingDonationRatio if admin", async function () {
			expect(await DonationMiner.stakingDonationRatio()).to.be.equal(0);
			await expect(DonationMiner.updateStakingDonationRatio(10)).to.be
				.fulfilled;
			expect(await DonationMiner.stakingDonationRatio()).to.be.equal(10);
		});

		it("Should not update stakingDonationRatio if not admin", async function () {
			expect(await DonationMiner.stakingDonationRatio()).to.be.equal(0);
			await expect(
				DonationMiner.connect(user1).updateStakingDonationRatio(10)
			).to.be.rejectedWith("Ownable: caller is not the owner");
			expect(await DonationMiner.stakingDonationRatio()).to.be.equal(0);
		});

		it("Should update treasury if admin", async function () {
			expect(await DonationMiner.treasury()).to.be.equal(
				Treasury.address
			);
			await DonationMiner.updateTreasury(owner.address);
			expect(await DonationMiner.treasury()).to.be.equal(owner.address);
		});

		it("Should not update params if not admin", async function () {
			await expect(
				DonationMiner.connect(user1).updateRewardPeriodParams(
					2 * REWARD_PERIOD_SIZE,
					1,
					10
				)
			).to.be.rejectedWith("Ownable: caller is not the owner");
			await expect(
				DonationMiner.connect(user1).updateTreasury(owner.address)
			).to.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("Should deposit funds to treasury", async function () {
			const user1Donation = toEther("100");

			//first block donations
			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
				user1Donation
			);
		});

		it("Should approve and donate 100 cUSD from user1", async function () {
			const user1Donation = toEther("200");

			await advanceToBlockN(START_BLOCK);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			const userBalance = await cUSD.balanceOf(user1.address);
			expect(userBalance).to.equal(toEther("999800"));
		});

		it("Should approve and donate, advance time and claim their reward", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward = rewards(1);

			await advanceToBlockN(START_BLOCK);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim the rewards
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
		});

		it("Should not be able to claim before the end of the reward period", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward = toEther("0");

			await advanceToBlockN(START_BLOCK);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await advanceTimeAndBlockNTimes(1);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			// Claim the rewards
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
		});

		it("Should not claim reward in the same reward period, multiple donors", async function () {
			const user1Donation = toEther("100");
			const user2Donation = toEther("100");
			const user1ExpectedReward = toEther("0");
			const user2ExpectedReward = toEther("0");

			await advanceToBlockN(START_BLOCK);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward
			);
		});

		it("Should claim reward and bonus reward, one donor", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward = toEther("8635256.64");

			await advanceToBlockN(START_BLOCK + REWARD_PERIOD_SIZE);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
		});

		it("Should claim reward after reward period, multiple donors #1", async function () {
			const user1Donation = toEther("100");
			const user2Donation = toEther("100");
			const user1ExpectedReward = toEther("2160000");
			const user2ExpectedReward = toEther("2160000");

			await advanceToBlockN(START_BLOCK);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward
			);
		});

		it("Should claim reward after reward period, multiple donors #2", async function () {
			const user1Donation1 = toEther("50");
			const user1Donation2 = toEther("50");
			const user2Donation = toEther("100");
			const user1ExpectedReward = toEther("2160000");
			const user2ExpectedReward = toEther("2160000");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation1);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation1,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation2);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation2,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward
			);
		});

		it("Should claim reward after reward period, multiple donors #2", async function () {
			const user1Donation = toEther("100");
			const user2Donation = toEther("200");
			const user1ExpectedReward = toEther("1440000");
			const user2ExpectedReward = toEther("2880000");

			await advanceToBlockN(START_BLOCK);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward
			);
		});

		it("Should claim reward after reward period, multiple donors #3", async function () {
			const user1Donation = toEther("300");
			const user2Donation = toEther("100");
			const user1ExpectedReward = toEther("3240000");
			const user2ExpectedReward = toEther("1080000");

			await advanceToBlockN(START_BLOCK);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward
			);
		});

		it("Should claim reward after reward period, multiple donors #4", async function () {
			const user1Donation = toEther("1");
			const user2Donation = toEther("1000000");
			const user1ExpectedReward = toEther("4.319995680004319995");
			const user2ExpectedReward = toEther("4319995.680004319995680004");

			await advanceToBlockN(START_BLOCK);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward
			);
		});

		it("Should not be able to donate to a wrong community", async function () {
			const user1Donation = toEther("1");

			await advanceToBlockN(START_BLOCK);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await expect(
				DonationMiner.connect(user1).donateToCommunity(
					user1.address,
					cUSD.address,
					user1Donation,
					user1.address
				)
			).to.be.revertedWith(
				"DonationMiner::donateToCommunity: This is not a valid community address"
			);
		});

		it("Should claim reward after more reward periods, one donor", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward = rewards(1);

			await advanceToBlockN(START_BLOCK);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(3 * REWARD_PERIOD_SIZE);

			// Approve
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user1Donation,
				user2.address
			);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
		});

		it("Should donate in multiple reward periods and then claim, one donor", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward = toEther("8635256.64");

			await advanceToBlockN(START_BLOCK);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
		});

		it("Should donate and claim in multiple reward periods, one donor #1", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward1 = rewards(1);
			const user1ExpectedReward2 = toEther("8635256.64");

			await advanceToRewardPeriodN(1);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceToRewardPeriodN(2);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);
		});

		it("Should calculate claimable reward", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward1 = rewards(1);
			const user1ExpectedReward2 = toEther("8635256.64");

			//first reward period
			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			//second reward period
			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			expect(
				(await DonationMiner.calculateClaimableRewards(user1.address))
					.claimAmount
			).to.be.equal(user1ExpectedReward1);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			expect(
				(await DonationMiner.calculateClaimableRewards(user1.address))
					.claimAmount
			).to.be.equal(user1ExpectedReward2);
		});

		it("Should calculate estimated reward no donation", async function () {
			const user1Donation = toEther("100");

			//first reward period
			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			expect(
				(await DonationMiner.calculateClaimableRewards(user2.address))
					.claimAmount
			).to.be.equal(0);
		});

		it("Should calculate estimated reward", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward1 = rewards(1);
			const user1ExpectedReward2 = toEther("4315256.64");
			const user2Donation = toEther("100");
			const user2ExpectedReward = toEther("2157628.32");

			//first reward period
			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			expect(
				await DonationMiner.estimateClaimableReward(user1.address)
			).to.be.equal(user1ExpectedReward1);

			//second reward period
			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			expect(
				await DonationMiner.estimateClaimableReward(user1.address)
			).to.be.equal(user1ExpectedReward2);

			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);

			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			expect(
				await DonationMiner.estimateClaimableReward(user1.address)
			).to.be.equal(user2ExpectedReward);
			expect(
				await DonationMiner.estimateClaimableReward(user2.address)
			).to.be.equal(user2ExpectedReward);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			expect(
				await DonationMiner.estimateClaimableReward(user1.address)
			).to.be.equal(0);
			expect(
				await DonationMiner.estimateClaimableReward(user2.address)
			).to.be.equal(0);
		});

		xit("Should donate and claim in 365 reward periods, one donor", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward1 = toEther(
				"409340576.103595678060756720"
			);
			const user1ExpectedReward2 = toEther(
				"776093059.949132023166703940"
			);
			const user1ExpectedReward3 = toEther(
				"1104688347.734209420766213620"
			);
			const user1ExpectedReward4 = toEther(
				"1299711602.324538381026520940"
			);

			await advanceToBlockN(START_BLOCK);

			// first 100 reward periods
			await advanceTimeAndBlockNTimes(99 * REWARD_PERIOD_SIZE);
			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);

			// next 100 reward periods
			await advanceTimeAndBlockNTimes(99 * REWARD_PERIOD_SIZE);
			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);

			// next 100 reward periods
			await advanceTimeAndBlockNTimes(99 * REWARD_PERIOD_SIZE);
			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward3
			);

			// next 65 reward periods
			await advanceTimeAndBlockNTimes(64 * REWARD_PERIOD_SIZE);
			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward4
			);
		});

		it("Should transfer founds to address", async function () {
			expect(await cUSD.balanceOf(DonationMiner.address)).to.be.equal(0);
			await cUSD.mint(DonationMiner.address, toEther("100"));
			expect(await cUSD.balanceOf(DonationMiner.address)).to.be.equal(
				toEther("100")
			);
			await DonationMiner.transfer(
				cUSD.address,
				owner.address,
				toEther("100")
			);
			expect(await cUSD.balanceOf(DonationMiner.address)).to.be.equal(0);
			expect(await cUSD.balanceOf(owner.address)).to.be.equal(
				toEther("100")
			);
		});

		it("Should donate with delegate", async function () {
			const user1Donation = toEther("100");
			const user2ExpectedReward = toEther("8635256.64");

			await advanceToRewardPeriodN(2);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user2.address
			);

			await advanceToRewardPeriodN(3);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(0);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward
			);
		});
	});

	describe("Donation Miner (claimDelay != 0, againstPeriods = 0)", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(user1.address, toEther("1000000"));
			await cUSD.mint(user2.address, toEther("10000000"));
			await cUSD.mint(user3.address, toEther("100000000"));
			await cUSD.mint(user4.address, toEther("100000000"));

			await DonationMiner.updateClaimDelay(CLAIM_DELAY);
		});

		it("Should not claim reward before claim delay, multiple donors #1", async function () {
			const user1Donation1 = toEther("50");
			const user1Donation2 = toEther("50");
			const user2Donation = toEther("100");
			const user1ExpectedReward = toEther("2160000");
			const user2ExpectedReward = toEther("2160000");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation1);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation1,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation2);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation2,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(0);
			expect(await PACT.balanceOf(user2.address)).to.equal(0);
		});

		it("Should claim reward after claim delay, multiple donors #1", async function () {
			const user1Donation1 = toEther("50");
			const user1Donation2 = toEther("50");
			const user2Donation = toEther("100");
			const user1ExpectedReward = toEther("2160000");
			const user2ExpectedReward = toEther("2160000");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation1);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);

			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation1,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation2);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation2,
				user1.address
			);

			await advanceTimeAndBlockNTimes(
				(CLAIM_DELAY + 1) * REWARD_PERIOD_SIZE
			);

			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward
			);
		});

		async function donateAndCheck(
			donation: BigNumber,
			estimatedReward: BigNumber,
			expectedClaimableReward: BigNumber
		) {
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				donation,
				user1.address
			);
			expect(
				await DonationMiner.estimateClaimableReward(user1.address)
			).to.be.equal(estimatedReward);

			//verify donors method
			expect(
				(await DonationMiner.calculateClaimableRewards(user1.address))
					.claimAmount
			).to.be.equal(expectedClaimableReward);

			await advanceToNextRewardPeriod();

			expectedClaimableReward =
				expectedClaimableReward.add(estimatedReward);
			expect(
				await DonationMiner.estimateClaimableReward(user1.address)
			).to.be.equal(0);
			expect(
				(await DonationMiner.calculateClaimableRewards(user1.address))
					.claimAmount
			).to.be.equal(expectedClaimableReward);
		}

		async function checkClaimRewards(expectedReward: BigNumber) {
			const initialBalance = await PACT.balanceOf(user1.address);
			await DonationMiner.connect(user1).claimRewards();

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				initialBalance.add(expectedReward)
			);
		}

		it("Should donate and claim in multiple reward periods, one donor #1", async function () {
			const user1Donation = toEther("100");

			await advanceToRewardPeriodN(1);

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation.mul(12));

			let previousReward = toEther("0");
			await donateAndCheck(user1Donation, rewards(1), previousReward);
			await checkClaimRewards(toEther("0"));

			previousReward = previousReward.add(rewards(1));
			await donateAndCheck(user1Donation, rewards(2), previousReward);
			await checkClaimRewards(toEther("0"));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						1
					)
				).claimAmount
			).to.be.equal(rewards(1));

			previousReward = previousReward.add(rewards(2));
			await donateAndCheck(user1Donation, rewards(3), previousReward);
			await checkClaimRewards(toEther("0"));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						1
					)
				).claimAmount
			).to.be.equal(rewards(1));

			previousReward = previousReward.add(rewards(3));
			await donateAndCheck(user1Donation, rewards(4), previousReward);
			await checkClaimRewards(toEther("0"));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						1
					)
				).claimAmount
			).to.be.equal(rewards(1));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						2
					)
				).claimAmount
			).to.be.equal(rewardsSum(1, 2));

			previousReward = previousReward.add(rewards(4));
			await donateAndCheck(user1Donation, rewards(5), previousReward);
			await checkClaimRewards(toEther("0"));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						1
					)
				).claimAmount
			).to.be.equal(rewards(1));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						2
					)
				).claimAmount
			).to.be.equal(rewardsSum(1, 2));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						3
					)
				).claimAmount
			).to.be.equal(rewardsSum(1, 3));

			previousReward = previousReward.add(rewards(5));
			await donateAndCheck(user1Donation, rewards(6), previousReward);
			await checkClaimRewards(rewards(1));

			previousReward = previousReward.add(rewards(6)).sub(rewards(1));
			await donateAndCheck(user1Donation, rewards(7), previousReward);

			previousReward = previousReward.add(rewards(7));
			await donateAndCheck(user1Donation, rewards(8), previousReward);
			await checkClaimRewards(rewards(2).add(rewards(3)));

			previousReward = previousReward
				.add(rewards(8))
				.sub(rewards(2))
				.sub(rewards(3));
			await donateAndCheck(user1Donation, rewards(9), previousReward);
			await checkClaimRewards(rewards(4));
		});

		it("Should donate and claim in multiple reward periods, one donor #2", async function () {
			await DonationMiner.updateClaimDelay(0);

			DonationMiner = await ethers.getContractAt(
				"DonationMinerImplementation",
				DonationMiner.address
			);

			const user1Donation = toEther("100");

			const user1Reward1 = toEther("4320000");
			const user1Reward2 = toEther("4315256.64");
			const user1Reward3 = toEther("4310518.48820928");
			const user1Reward4 = toEther("4305785.53890922621056");
			const user1Reward5 = toEther("4301057.7863875038801808");

			const user1Reward14 = toEther("38497625.86288946275859436");

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation.mul(12));

			await advanceToBlockN(131);

			let previousReward = toEther("0");
			await donateAndCheck(user1Donation, user1Reward1, previousReward);

			await checkClaimRewards(user1Reward1);

			previousReward = toEther("0");
			await donateAndCheck(user1Donation, user1Reward2, previousReward);
			await checkClaimRewards(user1Reward2);

			previousReward = toEther("0");
			await donateAndCheck(user1Donation, user1Reward3, previousReward);

			await DonationMiner.updateClaimDelay(CLAIM_DELAY);

			await checkClaimRewards(toEther("0"));

			previousReward = previousReward.add(user1Reward3);

			await donateAndCheck(user1Donation, user1Reward4, previousReward);
			await checkClaimRewards(toEther("0"));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						1
					)
				).claimAmount
			).to.be.equal(toEther("0"));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						2
					)
				).claimAmount
			).to.be.equal(toEther("0"));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						3
					)
				).claimAmount
			).to.be.equal(user1Reward3);
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						4
					)
				).claimAmount
			).to.be.equal(user1Reward3.add(user1Reward4));

			previousReward = previousReward.add(user1Reward4);
			await donateAndCheck(user1Donation, user1Reward5, previousReward);
			await checkClaimRewards(toEther("0"));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						1
					)
				).claimAmount
			).to.be.equal(toEther("0"));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						2
					)
				).claimAmount
			).to.be.equal(toEther("0"));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						3
					)
				).claimAmount
			).to.be.equal(user1Reward3);
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						4
					)
				).claimAmount
			).to.be.equal(user1Reward3.add(user1Reward4));
			expect(
				(
					await DonationMiner.calculateClaimableRewardsByPeriodNumber(
						user1.address,
						5
					)
				).claimAmount
			).to.be.equal(user1Reward3.add(user1Reward4).add(user1Reward5));

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 8);

			await checkClaimRewards(
				user1Reward3.add(user1Reward4).add(user1Reward5)
			);

			await donateAndCheck(user1Donation, user1Reward14, toEther("0"));
			await checkClaimRewards(toEther("0"));
		});
	});

	describe("Donation Miner (claimDelay = 0, againstPeriods != 0)", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(user1.address, toEther("1000000"));
			await cUSD.mint(user2.address, toEther("10000000"));
			await cUSD.mint(user3.address, toEther("100000000"));
			await cUSD.mint(user4.address, toEther("100000000"));

			await DonationMiner.updateAgainstPeriods(AGAINST_PERIODS);
		});

		async function donateAndCheckSamePeriod(
			donor: SignerWithAddress,
			donation: BigNumber,
			estimatedReward: BigNumber,
			expectedClaimableReward: BigNumber
		) {
			await DonationMiner.connect(donor).donate(
				cUSD.address,
				donation,
				donor.address
			);
			expect(
				await DonationMiner.estimateClaimableReward(donor.address)
			).to.be.equal(estimatedReward);

			//verify donors method
			expect(
				(await DonationMiner.calculateClaimableRewards(donor.address))
					.claimAmount
			).to.be.equal(expectedClaimableReward);
		}

		async function checkNextPeriod(
			donor: SignerWithAddress,
			donation: BigNumber,
			estimatedReward: BigNumber,
			expectedClaimableReward: BigNumber
		) {
			expectedClaimableReward =
				expectedClaimableReward.add(estimatedReward);
			expect(
				await DonationMiner.estimateClaimableReward(donor.address)
			).to.be.equal(0);
			expect(
				(await DonationMiner.calculateClaimableRewards(donor.address))
					.claimAmount
			).to.be.equal(expectedClaimableReward);
		}

		async function donateAndCheckAll(
			donor: SignerWithAddress,
			donation: BigNumber,
			estimatedReward: BigNumber,
			expectedClaimableReward: BigNumber
		) {
			await donateAndCheckSamePeriod(
				donor,
				donation,
				estimatedReward,
				expectedClaimableReward
			);

			await advanceToNextRewardPeriod();

			await checkNextPeriod(
				donor,
				donation,
				estimatedReward,
				expectedClaimableReward
			);
		}

		async function checkClaimRewards(
			donor: SignerWithAddress,
			expectedReward: BigNumber
		) {
			const initialBalance = await PACT.balanceOf(donor.address);
			await DonationMiner.connect(donor).claimRewards();

			expect(await PACT.balanceOf(donor.address)).to.be.equal(
				initialBalance.add(expectedReward)
			);
		}

		async function initialRewardPeriods() {
			const user1Donation = toEther("100");
			const user2Donation = toEther("100");

			// Approve
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation.mul(5));

			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);

			await advanceToRewardPeriodN(1);

			let previousDonor1Reward = toEther("0");
			await donateAndCheckAll(
				user1,
				user1Donation,
				rewards(1),
				toEther("0")
			);
			await checkClaimRewards(user1, rewards(1));

			await donateAndCheckAll(
				user1,
				user1Donation,
				rewards(2),
				toEther("0")
			);
			await checkClaimRewards(user1, rewards(2));

			await donateAndCheckAll(
				user1,
				user1Donation,
				rewards(3),
				toEther("0")
			);
			previousDonor1Reward = previousDonor1Reward.add(rewards(3));
			await donateAndCheckAll(
				user1,
				user1Donation,
				rewards(4),
				previousDonor1Reward
			);
			previousDonor1Reward = previousDonor1Reward.add(rewards(4));
			await donateAndCheckSamePeriod(
				user1,
				user1Donation,
				rewards(5),
				previousDonor1Reward
			);
			await checkClaimRewards(user1, previousDonor1Reward);
			await donateAndCheckAll(
				user2,
				user2Donation,
				rewards(5).div(6),
				toEther("0")
			);

			await advanceToRewardPeriodN(
				parseInt(await DonationMiner.rewardPeriodCount()) + 3
			);

			await checkClaimRewards(
				user1,
				rewards(5)
					.div(6)
					.mul(5)
					.add(rewards(6).div(6).mul(5))
					.add(rewards(7).div(6).mul(5))
					.add(toEther("0.000000000000000005")) //BigNumber vs solidity math diff
			);

			await advanceToRewardPeriodN(
				parseInt(await DonationMiner.rewardPeriodCount()) + 3
			);

			await checkClaimRewards(
				user1,
				rewards(8)
					.div(6)
					.mul(5)
					.add(rewards(9).div(6).mul(5))
					.add(rewards(10).div(5).mul(4))
					.add(toEther("0.000000000000000002")) //BigNumber vs solidity math diff
			);
		}

		it("Should claim reward based on the againstPeriods amount #1", async function () {
			await initialRewardPeriods();
			await advanceToRewardPeriodN(
				parseInt(await DonationMiner.rewardPeriodCount()) + 5
			);

			await checkClaimRewards(
				user1,
				rewards(11)
					.div(4)
					.mul(3)
					.add(rewards(12).div(3).mul(2))
					.add(rewards(13).div(2).mul(1))
					.add(toEther("0.000000000000000001")) //BigNumber vs solidity math diff
			);

			await checkClaimRewards(
				user2,
				rewards(5)
					.div(6)
					.add(rewards(6).div(6))
					.add(rewards(7).div(6))
					.add(rewards(8).div(6))
					.add(rewards(9).div(6))
					.add(rewards(10).div(5))
					.add(rewards(11).div(4))
					.add(rewards(12).div(3))
					.add(rewards(13).div(2))
			);
		});

		it("Should return the correct value for calculateClaimableRewards", async function () {
			await initialRewardPeriods();
			await advanceToRewardPeriodN(
				parseInt(await DonationMiner.rewardPeriodCount()) + 5
			);

			expect(
				(await DonationMiner.calculateClaimableRewards(user1.address))
					.claimAmount
			).to.be.equal(
				rewards(11)
					.div(4)
					.mul(3)
					.add(rewards(12).div(3).mul(2))
					.add(rewards(13).div(2).mul(1))
					.add(toEther("0.000000000000000008")) //BigNumber vs solidity math diff
			);

			expect(
				(await DonationMiner.calculateClaimableRewards(user2.address))
					.claimAmount
			).to.be.equal(
				rewards(5)
					.div(6)
					.add(rewards(6).div(6))
					.add(rewards(7).div(6))
					.add(rewards(8).div(6))
					.add(rewards(9).div(6))
					.add(rewards(10).div(5))
					.add(rewards(11).div(4))
					.add(rewards(12).div(3))
					.add(rewards(13).div(2))
					.add(toEther("0.000000000000000007")) //BigNumber vs solidity math diff
			);
		});
	});

	describe("Donation Miner (againstPeriodsDonations == 2)", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(user1.address, toEther("1000000"));
			await cUSD.mint(user2.address, toEther("10000000"));
			await cUSD.mint(user3.address, toEther("100000000"));
			await cUSD.mint(user4.address, toEther("100000000"));

			await DonationMiner.updateAgainstPeriods(2);
		});

		it("Should claim reward after claim delay, multiple donors #1", async function () {
			const user1Donation = toEther("100");
			const user2Donation = toEther("100");
			const user1ExpectedReward1 = toEther("2160000");
			const user2ExpectedReward1 = toEther("2160000");
			const user1ExpectedReward2 = toEther("4317628.32");
			const user2ExpectedReward2 = toEther("4317628.32");
			const user1ExpectedReward3 = toEther("6472887.56410464");
			const user2ExpectedReward3 = toEther("6472887.56410464");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);
			// Claim their rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward1
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);
			//Claim their rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward2
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);
			//Claim their rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward3
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward3
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 2);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward3
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward3
			);
		});

		it("Should claim reward end claim delay, multiple donors #1", async function () {
			const user1Donation = toEther("100");
			const user2Donation = toEther("100");
			const user1ExpectedReward3 = toEther("6472887.56410464");
			const user2ExpectedReward3 = toEther("6472887.56410464");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 5);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward3
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward3
			);
		});

		it("Should once donates reward end claim delay, multiple donors #1", async function () {
			const user1Donation2 = toEther("100");
			const user2Donation = toEther("100");
			const user1ExpectedReward3 = toEther("8618673.103013866210560000");
			const user2ExpectedReward3 = toEther("8632887.564104640000000000");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation2);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation2,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward3
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward3
			);
		});

		it("Should many donates reward end claim delay, multiple donors #1", async function () {
			const user1Donation1 = toEther("50");
			const user1Donation2 = toEther("50");
			const user2Donation = toEther("100");
			const user1ExpectedReward1 = toEther("1440000");
			const user2ExpectedReward1 = toEther("2880000");
			const user1ExpectedReward2 = toEther("3597628.32");
			const user2ExpectedReward2 = toEther("5037628.32");
			const user1ExpectedReward3 = toEther("5752887.56410464");
			const user2ExpectedReward3 = toEther("7192887.56410464");
			const user1ExpectedReward4 = toEther("10058673.10301386621056");
			const user2ExpectedReward4 = toEther("7192887.56410464");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation1);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation1,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward1
			);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation2);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation2,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward2
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward3
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward3
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 2);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward4
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward4
			);
		});

		it("Should many donates reward only end claim delay, multiple donors #1", async function () {
			const user1Donation1 = toEther("50");
			const user1Donation2 = toEther("50");
			const user2Donation = toEther("100");
			const user1ExpectedReward4 = toEther("10058673.10301386621056");
			const user2ExpectedReward4 = toEther("7192887.56410464");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation1);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation1,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation2);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation2,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward4
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward4
			);
		});

		it("Should delay many donates reward only end claim delay, multiple donors #1", async function () {
			DonationMiner.updateClaimDelay(3);

			const user1Donation1 = toEther("50");
			const user1Donation2 = toEther("50");
			const user2Donation = toEther("100");
			const user1ExpectedReward4 = toEther("10058673.10301386621056");
			const user2ExpectedReward4 = toEther("7192887.56410464");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation1);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation1,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation2);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation2,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 8);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward4
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward4
			);
		});
	});

	describe("Donation Miner (againstPeriodsDonations == 5)", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(user1.address, toEther("1000000"));
			await cUSD.mint(user2.address, toEther("10000000"));
			await cUSD.mint(user3.address, toEther("100000000"));
			await cUSD.mint(user4.address, toEther("100000000"));

			await DonationMiner.updateAgainstPeriods(5);
		});

		it("Should donate and claim in multiple periods, one donors #1", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward1 = toEther("21552618.453506010090740800");
			const user1ExpectedReward2 = toEther("30140571.527305128913241300");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 2);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);
		});

		it("Should donate and claim in multiple periods, multiple donors #1", async function () {
			const user1Donation = toEther("100");
			const user2Donation = toEther("100");
			const user1ExpectedReward1 = toEther("10776309.226753005045370400");
			const user2ExpectedReward1 = toEther("10776309.226753005045370400");
			const user1ExpectedReward2 = toEther("15070285.763652564456620650");
			const user2ExpectedReward2 = toEther("15070285.763652564456620650");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward1
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 5);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward2
			);
		});

		it("Should donate and claim in different periods, multiple donors #1", async function () {
			const user1Donation = toEther("100");
			const user2Donation = toEther("100");
			const user1ExpectedReward1 = toEther("12936309.226753005045370400");
			const user2ExpectedReward1 = toEther("8616309.226753005045370400");
			const user1ExpectedReward2 = toEther("15084476.839222030245830580");
			const user2ExpectedReward2 = toEther("15056094.688083098667410720");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward1
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 5);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward2
			);
		});
	});

	describe("Donation Miner (change againstPeriodsDonations)", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(user1.address, toEther("1000000"));
			await cUSD.mint(user2.address, toEther("10000000"));
			await cUSD.mint(user3.address, toEther("100000000"));
			await cUSD.mint(user4.address, toEther("100000000"));

			await DonationMiner.updateAgainstPeriods(5);
		});

		it("Should donate and claim in multiple periods while changing from 5 to 8, one donors #1", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward1 = toEther("21552618.453506010090740800");
			const user1ExpectedReward2 = toEther("30140571.527305128913241300");
			const user1ExpectedReward3 = toEther("42987172.585785574866144400");

			await advanceToBlockN(START_BLOCK);
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);
			await DonationMiner.updateAgainstPeriods(8);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 2);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward3
			);
		});

		it("Should donate and claim in multiple periods while changing from 5 to 8, one donors #1", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward1 = toEther("21552618.453506010090740800");
			const user1ExpectedReward2 = toEther("30140571.527305128913241300");
			const user1ExpectedReward3 = toEther("38709675.809824762455320400");

			await advanceToBlockN(START_BLOCK);
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);
			await DonationMiner.updateAgainstPeriods(8);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 2);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);

			// This is the different part between this test and the next one
			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 2);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward3
			);
		});

		it("Should donate and claim after changing from 5 to 8, one donors #1", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward1 = toEther("30140571.527305128913241300");
			const user1ExpectedReward2 = toEther("42987172.585785574866144400");

			await advanceToBlockN(START_BLOCK);
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 2);
			await DonationMiner.updateAgainstPeriods(8);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);
		});

		it("Should donate and claim after changing from 8 to 5, one donors #1", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward1 = toEther("30140571.527305128913241300");

			await expect(DonationMiner.updateAgainstPeriods(8)).to.be.fulfilled;

			await advanceToBlockN(START_BLOCK);
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 2);
			await expect(DonationMiner.updateAgainstPeriods(5)).to.be.fulfilled;

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);
		});

		it("Should donate and claim in multiple periods while changing from 8 to 5, one donors #1", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward1 = toEther("21552618.453506010090740800");
			const user1ExpectedReward2 = toEther("30140571.527305128913241300");

			await DonationMiner.updateAgainstPeriods(8);
			await advanceToBlockN(START_BLOCK);
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);
			await DonationMiner.updateAgainstPeriods(5);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 2);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);
		});

		it("Should donate and claim in multiple periods while changing from 5 to 8, multiple donors #1", async function () {
			const user1Donation = toEther("100");
			const user2Donation = toEther("100");
			const user1ExpectedReward1 = toEther("10776309.226753005045370400");
			const user2ExpectedReward1 = toEther("10776309.226753005045370400");
			const user1ExpectedReward2 = toEther("15070285.763652564456620650");
			const user2ExpectedReward2 = toEther("15070285.763652564456620650");
			const user1ExpectedReward3 = toEther("21493586.292892787433072200");
			const user2ExpectedReward3 = toEther("21493586.292892787433072200");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward1
			);

			await DonationMiner.updateAgainstPeriods(8);
			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 2);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward2
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 6);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward3
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward3
			);
		});

		it("Should donate and claim in different periods while changing from 5 to 8, multiple donors #1", async function () {
			const user1Donation = toEther("100");
			const user2Donation = toEther("100");
			const user1ExpectedReward1 = toEther("12936309.226753005045370400");
			const user2ExpectedReward1 = toEther("8616309.226753005045370400");
			const user1ExpectedReward2 = toEther("17230285.763652564456620650");
			const user2ExpectedReward2 = toEther("12910285.763652564456620650");
			const user1ExpectedReward3 = toEther("21514837.904912381227660200");
			const user2ExpectedReward3 = toEther("21472334.680873193638484200");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward1
			);
			await DonationMiner.updateAgainstPeriods(8);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 2);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward2
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 3);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward3
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward3
			);
		});

		it("Should donate and claim in different periods while changing from 5 to 8, multiple donors #1", async function () {
			const user1Donation = toEther("100");
			const user2Donation = toEther("50");
			const user1ExpectedReward1 = toEther("17251560.667118506210560000");
			const user1ExpectedReward2 = toEther("25844234.573909588012347532");
			const user2ExpectedReward2 = toEther("4296336.953395540900893765");
			const user1ExpectedReward3 = toEther("30128786.715169404783387082");
			const user2ExpectedReward3 = toEther("12858385.870616170082757315");
			const user1ExpectedReward4 = toEther("30128786.715169404783387082");
			const user2ExpectedReward4 = toEther("38424916.301522012431218355");

			await advanceToBlockN(START_BLOCK);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 4);
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward1
			);

			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);
			await DonationMiner.updateAgainstPeriods(8);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 2);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward2
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward2
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 3);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward3
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward3
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE * 6);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward4
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward4
			);
		});
	});

	describe("Donation Miner + Community", () => {
		const oneMinuteInBlocks = 12;
		const threeMinutesInBlocks = 36;
		const claimAmountTwo = toEther("2");
		const maxClaimTen = toEther("10");
		const oneCent = toEther("0.01");
		const mintAmount = toEther("500");
		const communityMinTranche = toEther("100");
		const communityMaxTranche = toEther("5000");

		let Community: ethersTypes.Contract;
		let CommunityAdmin: ethersTypes.Contract;

		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(user1.address, toEther("1000000"));
			await cUSD.mint(user2.address, toEther("10000000"));
			await cUSD.mint(user3.address, toEther("100000000"));
			await cUSD.mint(user4.address, toEther("100000000"));

			CommunityAdmin = await ethers.getContractAt(
				"CommunityAdminImplementation",
				(
					await deployments.get("CommunityAdminProxy")
				).address
			);

			const Ambassadors = await deployments.get("AmbassadorsProxy");

			const ambassadors = await ethers.getContractAt(
				"AmbassadorsImplementation",
				Ambassadors.address
			);

			await CommunityAdmin.updateAmbassadors(Ambassadors.address);

			await ambassadors.addEntity(entity.address);
			await ambassadors.connect(entity).addAmbassador(ambassador.address);

			await cUSD.mint(Treasury.address, mintAmount.toString());

			const tx = await CommunityAdmin.addCommunity(
				[owner.address],
				ambassador.address,
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

			Community = await ethers.getContractAt(
				"Community",
				communityAddress
			);
		});

		it("Should approve and donate to community, advance time and claim the reward", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward = toEther("4320000");

			const communityInitialBalance = await cUSD.balanceOf(
				Community.address
			);

			await advanceToBlockN(START_BLOCK);

			// Approve
			await cUSD.connect(user1).approve(Community.address, user1Donation);

			await DonationMiner.connect(user1).donateToCommunity(
				Community.address,
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE);

			// Claim the rewards
			await DonationMiner.connect(user1).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);

			expect(await cUSD.balanceOf(Community.address)).to.equal(
				communityInitialBalance.add(user1Donation)
			);

			const donation1 = await DonationMiner.donations(1);
			expect(donation1.donor).to.equal(user1.address);
			expect(donation1.target).to.equal(Community.address);
			expect(donation1.rewardPeriod).to.equal(1);
			expect(donation1.blockNumber.toNumber())
				.to.be.greaterThanOrEqual(START_BLOCK)
				.lessThanOrEqual(149);
			expect(donation1.amount).to.equal(user1Donation);
			expect(donation1.token).to.equal(cUSD.address);
			expect(donation1.initialAmount).to.equal(user1Donation);
		});

		it("Should approve and donate to community, advance time and claim the reward with delegate", async function () {
			const user1Donation = toEther("100");
			const user2ExpectedReward = toEther("4320000");

			const communityInitialBalance = await cUSD.balanceOf(
				Community.address
			);

			await advanceToRewardPeriodN(1);

			// Approve
			await cUSD.connect(user1).approve(Community.address, user1Donation);

			await DonationMiner.connect(user1).donateToCommunity(
				Community.address,
				cUSD.address,
				user1Donation,
				user2.address
			);

			await advanceToRewardPeriodN(2);

			// Claim the rewards
			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			// Check their PACT balance
			expect(await PACT.balanceOf(user1.address)).to.equal(0);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward
			);

			expect(await cUSD.balanceOf(Community.address)).to.equal(
				communityInitialBalance.add(user1Donation)
			);

			const donation1 = await DonationMiner.donations(1);
			expect(donation1.donor).to.equal(user2.address);
			expect(donation1.target).to.equal(Community.address);
			expect(donation1.rewardPeriod).to.equal(1);
			expect(donation1.blockNumber.toNumber())
				.to.be.greaterThanOrEqual(START_BLOCK)
				.lessThanOrEqual(149);
			expect(donation1.amount).to.equal(user1Donation);
			expect(donation1.token).to.equal(cUSD.address);
			expect(donation1.initialAmount).to.equal(user1Donation);
		});

		it("Should not donate to community an invalid token", async function () {
			await advanceToRewardPeriodN(1);

			await expect(
				DonationMiner.connect(user1).donateToCommunity(
					Community.address,
					PACT.address,
					100,
					user2.address
				)
			).to.be.rejectedWith(
				"DonationMiner::donateToCommunity: Invalid token"
			);
		});
	});

	describe("Donation Miner + Staking", () => {
		before(async function () {});

		const user1InitialPACTBalance = toEther("1000000");
		const user2InitialPACTBalance = toEther("2000000");
		const user3InitialPACTBalance = toEther("3000000");
		const user4InitialPACTBalance = toEther("4000000");
		const user5InitialPACTBalance = toEther("5000000");

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(user1.address, toEther("1000000"));
			await cUSD.mint(user2.address, toEther("10000000"));
			await cUSD.mint(user3.address, toEther("100000000"));
			await cUSD.mint(user4.address, toEther("100000000"));

			await DonationMiner.updateAgainstPeriods(AGAINST_PERIODS);
			await DonationMiner.updateClaimDelay(CLAIM_DELAY);
			await DonationMiner.updateStakingDonationRatio(
				STAKING_DONATION_RATIO
			);

			await PACT.transfer(user1.address, user1InitialPACTBalance);
			await PACT.transfer(user2.address, user2InitialPACTBalance);
			await PACT.transfer(user3.address, user3InitialPACTBalance);
			await PACT.transfer(user4.address, user4InitialPACTBalance);
			await PACT.transfer(user5.address, user5InitialPACTBalance);

			await advanceToBlockN(START_BLOCK);

			await SPACT.transferOwnership(Staking.address);
		});

		it("Should stake and claim, one donor #1", async function () {
			const user1Stake = toEther("100");
			const user1ExpectedReward1 = toEther("4320000");
			const user1ExpectedReward2 = toEther("4320000");

			await PACT.connect(user1).approve(Staking.address, user1Stake);
			await Staking.connect(user1).stake(user1.address, user1Stake);

			await advanceToRewardPeriodN(CLAIM_DELAY + 2);

			await DonationMiner.connect(user1).claimRewards();

			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1InitialPACTBalance
					.sub(user1Stake)
					.add(user1ExpectedReward1)
			);

			await advanceToRewardPeriodN(CLAIM_DELAY + 7);

			await DonationMiner.connect(user1).claimRewards();

			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					6,
					user1.address
				)
			).to.be.equal(user1Stake);

			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1InitialPACTBalance.add(rewardsSum(1, 6)).sub(user1Stake)
			);
		});

		it("Should set stake amounts after staking and unstaking", async function () {
			const user1Stake1 = 101;
			const user1Stake2 = 102;
			const user1Stake3 = 103;
			const user2Stake1 = 201;
			const user2Stake2 = 202;
			const user2Stake3 = 203;
			const user3Stake1 = 301;
			const user3Stake2 = 302;
			const user3Stake3 = 303;

			const user1Unstake1 = 51;
			const user1Unstake2 = 52;
			const user2Unstake1 = 61;
			const user2Unstake2 = 62;
			const user3Unstake1 = 71;
			const user3Unstake2 = 72;

			await PACT.connect(user1).approve(
				Staking.address,
				user1Stake1 + user1Stake2 + user1Stake3
			);
			await PACT.connect(user2).approve(
				Staking.address,
				user2Stake1 + user2Stake2 + user2Stake3
			);
			await PACT.connect(user3).approve(
				Staking.address,
				user3Stake1 + user3Stake2 + user3Stake3
			);

			await advanceToRewardPeriodN(2);
			await Staking.connect(user1).stake(user1.address, user1Stake1);
			await Staking.connect(user2).stake(user2.address, user2Stake1);
			await Staking.connect(user1).stake(user1.address, user1Stake2);

			await advanceToRewardPeriodN(4);
			await Staking.connect(user1).stake(user1.address, user1Stake3);

			await advanceToRewardPeriodN(5);
			await Staking.connect(user2).stake(user2.address, user2Stake2);
			await Staking.connect(user3).stake(user3.address, user3Stake1);
			await Staking.connect(user3).stake(user1.address, user3Stake2); //user3 stakes for user1

			await advanceToRewardPeriodN(6);
			await Staking.connect(user1).unstake(user1Unstake1);
			await Staking.connect(user2).unstake(user2Unstake1);

			await advanceToRewardPeriodN(7);
			await Staking.connect(user1).unstake(user1Unstake2);
			await Staking.connect(user2).stake(user2.address, user2Stake3);
			await Staking.connect(user2).unstake(user2Unstake2);

			await advanceToRewardPeriodN(9);
			await Staking.connect(user3).unstake(user3Unstake1);
			await Staking.connect(user3).unstake(user3Unstake2);

			let stakesAmount = 0;
			expect(
				(await DonationMiner.rewardPeriods(1)).stakesAmount
			).to.be.equal(stakesAmount);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					1,
					user1.address
				)
			).to.be.equal(0);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					1,
					user2.address
				)
			).to.be.equal(0);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					1,
					user3.address
				)
			).to.be.equal(0);

			stakesAmount =
				stakesAmount + user1Stake1 + user2Stake1 + user1Stake2;
			expect(
				(await DonationMiner.rewardPeriods(2)).stakesAmount
			).to.be.equal(stakesAmount);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					2,
					user1.address
				)
			).to.be.equal(user1Stake1 + user1Stake2);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					2,
					user2.address
				)
			).to.be.equal(user2Stake1);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					2,
					user3.address
				)
			).to.be.equal(0);

			expect(
				(await DonationMiner.rewardPeriods(3)).stakesAmount
			).to.be.equal(stakesAmount);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					3,
					user1.address
				)
			).to.be.equal(0);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					3,
					user2.address
				)
			).to.be.equal(0);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					3,
					user3.address
				)
			).to.be.equal(0);

			stakesAmount = stakesAmount + user1Stake3;
			expect(
				(await DonationMiner.rewardPeriods(4)).stakesAmount
			).to.be.equal(stakesAmount);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					4,
					user1.address
				)
			).to.be.equal(user1Stake1 + user1Stake2 + user1Stake3);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					4,
					user2.address
				)
			).to.be.equal(0);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					4,
					user3.address
				)
			).to.be.equal(0);

			stakesAmount =
				stakesAmount + user2Stake2 + user3Stake1 + user3Stake2;
			expect(
				(await DonationMiner.rewardPeriods(5)).stakesAmount
			).to.be.equal(stakesAmount);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					5,
					user1.address
				)
			).to.be.equal(
				user1Stake1 + user1Stake2 + user1Stake3 + user3Stake2
			);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					5,
					user2.address
				)
			).to.be.equal(user2Stake1 + user2Stake2);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					5,
					user3.address
				)
			).to.be.equal(user3Stake1);

			stakesAmount = stakesAmount - user1Unstake1 - user2Unstake1;
			expect(
				(await DonationMiner.rewardPeriods(6)).stakesAmount
			).to.be.equal(stakesAmount);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					6,
					user1.address
				)
			).to.be.equal(
				user1Stake1 +
					user1Stake2 +
					user1Stake3 +
					user3Stake2 -
					user1Unstake1
			);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					6,
					user2.address
				)
			).to.be.equal(user2Stake1 + user2Stake2 - user2Unstake1);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					6,
					user3.address
				)
			).to.be.equal(0);

			stakesAmount =
				stakesAmount - user1Unstake2 + user2Stake3 - user2Unstake2;
			expect(
				(await DonationMiner.rewardPeriods(7)).stakesAmount
			).to.be.equal(stakesAmount);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					7,
					user1.address
				)
			).to.be.equal(
				user1Stake1 +
					user1Stake2 +
					user1Stake3 +
					user3Stake2 -
					user1Unstake1 -
					user1Unstake2
			);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					7,
					user2.address
				)
			).to.be.equal(
				user2Stake1 +
					user2Stake2 -
					user2Unstake1 +
					user2Stake3 -
					user2Unstake2
			);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					7,
					user3.address
				)
			).to.be.equal(0);

			expect(
				(await DonationMiner.rewardPeriods(8)).stakesAmount
			).to.be.equal(stakesAmount);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					8,
					user1.address
				)
			).to.be.equal(0);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					8,
					user2.address
				)
			).to.be.equal(0);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					8,
					user3.address
				)
			).to.be.equal(0);

			stakesAmount = stakesAmount - user3Unstake1 - user3Unstake2;
			expect(
				(await DonationMiner.rewardPeriods(9)).stakesAmount
			).to.be.equal(stakesAmount);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					9,
					user1.address
				)
			).to.be.equal(0);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					9,
					user2.address
				)
			).to.be.equal(0);
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					9,
					user3.address
				)
			).to.be.equal(user3Stake1 - user3Unstake1 - user3Unstake2);
		});

		it("Should donate and stake reward, one donor #1", async function () {
			const user1Donation = toEther("100");

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceToRewardPeriodN(2);

			await DonationMiner.connect(user1).stakeRewards();

			expect(await Staking.stakeholdersListAt(0)).to.be.equal(
				user1.address
			);
			expect(await Staking.currentTotalAmount()).to.be.equal(rewards(1));
			expect(await Staking.stakeholderAmount(user1.address)).to.be.equal(
				rewards(1)
			);

			expect(
				(await DonationMiner.rewardPeriods(2)).stakesAmount
			).to.be.equal(rewards(1));
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					2,
					user1.address
				)
			).to.be.equal(rewards(1));
			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance
			);
			expect(await SPACT.balanceOf(user1.address)).to.be.equal(
				rewards(1)
			);
		});

		it("Should donate and stake reward, one donor #2", async function () {
			const user1Donation = toEther("100");

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceToRewardPeriodN(2);

			await DonationMiner.connect(user1).stakeRewards();

			expect(await Staking.stakeholdersListAt(0)).to.be.equal(
				user1.address
			);
			expect(await Staking.currentTotalAmount()).to.be.equal(rewards(1));
			expect(await Staking.stakeholderAmount(user1.address)).to.be.equal(
				rewards(1)
			);

			expect(
				(await DonationMiner.rewardPeriods(2)).stakesAmount
			).to.be.equal(rewards(1));
			expect(
				await DonationMiner.rewardPeriodDonorStakeAmounts(
					2,
					user1.address
				)
			).to.be.equal(rewards(1));
			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance
			);
			expect(await SPACT.balanceOf(user1.address)).to.be.equal(
				rewards(1)
			);

			await advanceToRewardPeriodN(CLAIM_DELAY + 2);
			await DonationMiner.connect(user1).claimRewards(); //user1 has already staked his reward for period #1, so he will not get anything

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance
			);
			expect(await SPACT.balanceOf(user1.address)).to.be.equal(
				rewards(1)
			);

			await advanceToRewardPeriodN(CLAIM_DELAY + 3);
			await DonationMiner.connect(user1).claimRewards();

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.add(rewards(2))
			);
			expect(await SPACT.balanceOf(user1.address)).to.be.equal(
				rewards(1)
			);
		});

		it("Should not claim reward that is staked #1", async function () {
			const user1Donation = toEther("100");

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await advanceToRewardPeriodN(2);

			await DonationMiner.connect(user1).stakeRewards();

			await advanceToRewardPeriodN(CLAIM_DELAY + 2);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance
			);

			await advanceToRewardPeriodN(CLAIM_DELAY + 3);
			await DonationMiner.connect(user1).claimRewards();
			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.add(rewards(2))
			);
		});

		it("Should stake and donate #1", async function () {
			const user1Donation = toEther("90");
			const user2Stake = toEther("1000000"); // because STAKING_DONATION_RATIO is 1000000 => this staking is counted like 1 cUSD
			const user3Donation = toEther("9");

			await cUSD
				.connect(user3)
				.approve(DonationMiner.address, user3Donation);
			await DonationMiner.connect(user3).donate(
				cUSD.address,
				user3Donation,
				user3.address
			);

			await advanceToRewardPeriodN(2);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await PACT.connect(user2).approve(Staking.address, user2Stake);
			await Staking.connect(user2).stake(user2.address, user2Stake);

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(user2Stake)
			);

			await advanceToRewardPeriodN(CLAIM_DELAY + 2);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();
			await DonationMiner.connect(user3).claimRewards();

			let user3Reward = rewards(1);

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(user2Stake)
			);
			expect(await PACT.balanceOf(user3.address)).to.be.equal(
				user3InitialPACTBalance.add(user3Reward)
			);

			await advanceToRewardPeriodN(CLAIM_DELAY + 3);

			let user1Reward = rewards(2).div(100).mul(90);
			let user2Reward = rewards(2).div(100);
			user3Reward = user3Reward.add(rewards(2).div(100).mul(9));

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();
			await DonationMiner.connect(user3).claimRewards();

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.add(user1Reward)
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(user2Stake).add(user2Reward)
			);
			expect(await PACT.balanceOf(user3.address)).to.be.equal(
				user3InitialPACTBalance.add(user3Reward)
			);

			await advanceToRewardPeriodN(CLAIM_DELAY + AGAINST_PERIODS + 2); //last period when user 3 can claim

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();
			await DonationMiner.connect(user3).claimRewards();

			user1Reward = user1Reward.add(
				rewardsSum(3, AGAINST_PERIODS + 1)
					.div(100)
					.mul(90)
			);
			user2Reward = user2Reward.add(
				rewardsSum(3, AGAINST_PERIODS + 1).div(100)
			);
			user3Reward = user3Reward.add(
				rewardsSum(3, AGAINST_PERIODS + 1)
					.div(100)
					.mul(9)
			);

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.add(user1Reward)
			);

			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(user2Stake).add(user2Reward).sub(2)
			);

			expect(await PACT.balanceOf(user3.address)).to.be.equal(
				user3InitialPACTBalance.add(user3Reward).sub(2)
			);

			await advanceToRewardPeriodN(CLAIM_DELAY + AGAINST_PERIODS + 3); //last period when user 2 can claim

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();
			await DonationMiner.connect(user3).claimRewards();

			user1Reward = user1Reward.add(
				rewards(AGAINST_PERIODS + 2)
					.div(91)
					.mul(90)
			);
			user2Reward = user2Reward.add(rewards(AGAINST_PERIODS + 2).div(91));

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.add(user1Reward)
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(user2Stake).add(user2Reward).sub(2)
			);
			expect(await PACT.balanceOf(user3.address)).to.be.equal(
				user3InitialPACTBalance.add(user3Reward).sub(2)
			);

			await advanceToRewardPeriodN(CLAIM_DELAY + AGAINST_PERIODS + 4); //last period when user 1 can claim

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();
			await DonationMiner.connect(user3).claimRewards();

			user2Reward = user2Reward.add(rewards(AGAINST_PERIODS + 3));

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.add(user1Reward)
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(user2Stake).add(user2Reward).sub(2)
			);
			expect(await PACT.balanceOf(user3.address)).to.be.equal(
				user3InitialPACTBalance.add(user3Reward).sub(2)
			);
		});

		it("Should stake and donate + change STAKING_DONATION_RATIO #1", async function () {
			const user1Donation = toEther("99");
			const user2Stake = toEther("1000000"); // because STAKING_DONATION_RATIO is 1000000 => this staking is counted like 1 cUSD

			await advanceToRewardPeriodN(2);

			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);

			await PACT.connect(user2).approve(Staking.address, user2Stake);
			await Staking.connect(user2).stake(user2.address, user2Stake);

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(user2Stake)
			);

			await advanceToRewardPeriodN(CLAIM_DELAY + 2);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(user2Stake)
			);

			await advanceToRewardPeriodN(CLAIM_DELAY + 3);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			let user1Reward = rewardsSum(1, 2).div(100).mul(99);
			let user2Reward = rewardsSum(1, 2).div(100);

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.add(user1Reward)
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(user2Stake).add(user2Reward)
			);

			const NEW_STAKING_DONATION_RATIO = STAKING_DONATION_RATIO / 10; // => next reward period 1 cUSD donated = 100.000 PACTs staked
			await DonationMiner.updateStakingDonationRatio(
				NEW_STAKING_DONATION_RATIO
			);

			//***********************************************************
			//for this test we need to have a continuous donation by user1
			await advanceToRewardPeriodN(AGAINST_PERIODS + 3);
			await cUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await DonationMiner.connect(user1).donate(
				cUSD.address,
				user1Donation,
				user1.address
			);
			//***********************************************************

			await advanceToRewardPeriodN(2 * CLAIM_DELAY + 4);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			//reward ratio for this period remains the same
			user1Reward = user1Reward.add(
				rewardsSum(3, CLAIM_DELAY + 3)
					.div(100)
					.mul(99)
			);
			user2Reward = user2Reward.add(
				rewardsSum(3, CLAIM_DELAY + 3).div(100)
			);

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.add(user1Reward).add(38)
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(user2Stake).add(user2Reward).sub(1)
			);

			await advanceToRewardPeriodN(2 * CLAIM_DELAY + 5);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			//reward ratio for this period has changed
			user1Reward = user1Reward.add(
				rewards(CLAIM_DELAY + 4)
					.div(109)
					.mul(99)
			);
			user2Reward = user2Reward.add(
				rewards(CLAIM_DELAY + 4)
					.div(109)
					.mul(10)
			);

			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.add(user1Reward).add(77)
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(user2Stake).add(user2Reward).add(2)
			);
		});
	});

	describe("Donation Miner + Treasury", () => {
		let mUSD: ethersTypes.Contract;
		let celo: ethersTypes.Contract;

		before(async function () {});

		beforeEach(async () => {
			await deploy();

			const tokenFactory = await ethers.getContractFactory("TokenMock");

			mUSD = await tokenFactory.deploy("mUSD", "mUSD");
			celo = await tokenFactory.deploy("celo", "celo");

			await cUSD.mint(user9.address, toEther(1000000));
			await mUSD.mint(user9.address, toEther(2000000));
			await celo.mint(user9.address, toEther(500000));

			let UniswapRouter = await ethers.getContractAt(
				"UniswapV2Router02",
				(
					await deployments.get("UniswapV2Router02")
				).address
			);

			await Treasury.updateUniswapRouter(UniswapRouter.address);

			await cUSD
				.connect(user9)
				.approve(UniswapRouter.address, toEther(1000000));
			await mUSD
				.connect(user9)
				.approve(UniswapRouter.address, toEther(2000000));
			await celo
				.connect(user9)
				.approve(UniswapRouter.address, toEther(500000));

			await UniswapRouter.connect(user9).addLiquidity(
				cUSD.address,
				mUSD.address,
				toEther(1000000),
				toEther(1000000),
				0,
				0,
				user9.address,
				Math.floor(new Date().getTime() / 1000) + 30 * 60
			);

			await UniswapRouter.connect(user9).addLiquidity(
				mUSD.address,
				celo.address,
				toEther(1000000),
				toEther(500000),
				0,
				0,
				user9.address,
				Math.floor(new Date().getTime() / 1000) + 30 * 60
			);

			await Treasury.setToken(mUSD.address, toEther(0.9), [
				mUSD.address,
				cUSD.address,
			]);
			await Treasury.setToken(celo.address, toEther(0.5), [
				celo.address,
				mUSD.address,
				cUSD.address,
			]);

			await advanceToRewardPeriodN(1);
		});

		it("Should not donate an invalid token", async function () {
			await expect(
				DonationMiner.connect(user1).donate(
					PACT.address,
					100,
					user1.address
				)
			).to.be.rejectedWith("DonationMiner::donate: Invalid token");
		});

		it("Should donate other token #1", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward = toEther("4320000");

			await mUSD.mint(user1.address, user1Donation);

			await mUSD
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				mUSD.address,
				user1Donation,
				user1.address
			);

			const user1ConvertedDonation = await Treasury.getConvertedAmount(
				mUSD.address,
				user1Donation
			);
			expect(user1ConvertedDonation).to.be.equal(
				toEther("89.721054810835359714")
			);

			expect(
				(await DonationMiner.rewardPeriods(1)).donationsAmount
			).to.be.equal(user1ConvertedDonation);

			const donation1 = await DonationMiner.donations(1);
			expect(donation1.donor).to.equal(user1.address);
			expect(donation1.target).to.equal(Treasury.address);
			expect(donation1.rewardPeriod).to.equal(1);
			expect(donation1.amount).to.equal(user1ConvertedDonation);
			expect(donation1.token).to.equal(mUSD.address);
			expect(donation1.initialAmount).to.equal(user1Donation);

			await advanceToRewardPeriodN(2);

			await DonationMiner.connect(user1).claimRewards();

			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
		});

		it("Should donate other token #2", async function () {
			const user1Donation = toEther("100");
			const user1ExpectedReward = toEther("4320000");

			await celo.mint(user1.address, user1Donation);

			await celo
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);

			await DonationMiner.connect(user1).donate(
				celo.address,
				user1Donation,
				user1.address
			);

			const user1ConvertedDonation = await Treasury.getConvertedAmount(
				celo.address,
				user1Donation
			);
			expect(user1ConvertedDonation).to.be.equal(
				toEther("99.361334137895888408")
			);

			expect(
				(await DonationMiner.rewardPeriods(1)).donationsAmount
			).to.be.equal(user1ConvertedDonation);

			const donation1 = await DonationMiner.donations(1);
			expect(donation1.donor).to.equal(user1.address);
			expect(donation1.target).to.equal(Treasury.address);
			expect(donation1.rewardPeriod).to.equal(1);
			expect(donation1.amount).to.equal(user1ConvertedDonation);
			expect(donation1.token).to.equal(celo.address);
			expect(donation1.initialAmount).to.equal(user1Donation);

			await advanceToRewardPeriodN(2);

			await DonationMiner.connect(user1).claimRewards();

			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
		});

		it("Should donate other token, and get correct reward", async function () {
			const user1Donation = toEther("100");
			const user2Donation = toEther("100");
			const user1ExpectedReward = toEther("2153080.311846274641735414");
			const user2ExpectedReward = toEther("2166919.688153725358264585");

			await celo.mint(user1.address, user1Donation);
			await cUSD.mint(user2.address, user1Donation);

			await celo
				.connect(user1)
				.approve(DonationMiner.address, user1Donation);
			await cUSD
				.connect(user2)
				.approve(DonationMiner.address, user2Donation);

			await DonationMiner.connect(user1).donate(
				celo.address,
				user1Donation,
				user1.address
			);
			await DonationMiner.connect(user2).donate(
				cUSD.address,
				user2Donation,
				user2.address
			);

			const user1ConvertedDonation = await Treasury.getConvertedAmount(
				celo.address,
				user1Donation
			);
			expect(user1ConvertedDonation).to.be.equal(
				toEther("99.361334137895888408")
			);

			expect(
				(await DonationMiner.rewardPeriods(1)).donationsAmount
			).to.be.equal(user1ConvertedDonation.add(user2Donation));

			const donation1 = await DonationMiner.donations(1);
			expect(donation1.donor).to.equal(user1.address);
			expect(donation1.target).to.equal(Treasury.address);
			expect(donation1.rewardPeriod).to.equal(1);
			expect(donation1.amount).to.equal(user1ConvertedDonation);
			expect(donation1.token).to.equal(celo.address);
			expect(donation1.initialAmount).to.equal(user1Donation);

			const donation2 = await DonationMiner.donations(2);
			expect(donation2.donor).to.equal(user2.address);
			expect(donation2.target).to.equal(Treasury.address);
			expect(donation2.rewardPeriod).to.equal(1);
			expect(donation2.amount).to.equal(user1Donation);
			expect(donation2.token).to.equal(cUSD.address);
			expect(donation2.initialAmount).to.equal(user1Donation);

			await advanceToRewardPeriodN(2);

			await DonationMiner.connect(user1).claimRewards();
			await DonationMiner.connect(user2).claimRewards();

			expect(await PACT.balanceOf(user1.address)).to.equal(
				user1ExpectedReward
			);
			expect(await PACT.balanceOf(user2.address)).to.equal(
				user2ExpectedReward
			);
		});
	});
});
