// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { advanceBlockNTimes, advanceToBlockN } from "../utils/TimeTravel";
import { parseEther, formatEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

chai.use(chaiAsPromised);
const expect = chai.expect;

const REWARD_PERIOD_SIZE = 20;
const INITIAL_REWARD = parseEther("100000001");

let owner: SignerWithAddress;
let donor1: SignerWithAddress;

let ImpactProxyAdmin: ethersTypes.Contract;
let DonationMiner: ethersTypes.Contract;
let PACT: ethersTypes.Contract;
let ImpactLabsVesting: ethersTypes.Contract;
let cUSD: ethersTypes.Contract;

const deploy = deployments.createFixture(async () => {
	await deployments.fixture("Test", { fallbackToGlobal: false });

	[owner, donor1] = await ethers.getSigners();

	ImpactProxyAdmin = await ethers.getContractAt(
		"ImpactProxyAdmin",
		(
			await deployments.get("ImpactProxyAdmin")
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

	ImpactLabsVesting = await ethers.getContractAt(
		"ImpactLabsVestingImplementation",
		(
			await deployments.get("ImpactLabsVestingProxy")
		).address
	);

	cUSD = await ethers.getContractAt(
		"TokenMock",
		(
			await await deployments.get("TokenMock")
		).address
	);

	await cUSD.mint(donor1.address, parseEther("1000000"));
	await PACT.transfer(DonationMiner.address, parseEther("2000000000"));
});

describe("Impact Labs Vesting", () => {
	before(async function () {});

	beforeEach(async () => {
		await deploy();
	});

	it("Should transfer PACTs on initialization", async function () {
		await advanceToBlockN(131);

		expect(await PACT.balanceOf(owner.address)).to.be.equal(INITIAL_REWARD);
		expect(await ImpactLabsVesting.advancePayment()).to.be.equal(
			INITIAL_REWARD
		);

		await advanceBlockNTimes(REWARD_PERIOD_SIZE);

		await ImpactLabsVesting.claim();

		expect(await PACT.balanceOf(owner.address)).to.be.equal(INITIAL_REWARD);
		expect(await ImpactLabsVesting.advancePayment()).to.be.equal(
			parseEther("96760001")
		);
	});

	it("Should get more PACTs after delay", async function () {
		await advanceToBlockN(131);

		expect(await PACT.balanceOf(owner.address)).to.be.equal(INITIAL_REWARD);
		expect(await ImpactLabsVesting.advancePayment()).to.be.equal(
			INITIAL_REWARD
		);

		await advanceBlockNTimes(10 * REWARD_PERIOD_SIZE);
		await cUSD.connect(donor1).approve(DonationMiner.address, 1);
		await DonationMiner.connect(donor1).donate(1);
		await ImpactLabsVesting.claim();
		expect(await PACT.balanceOf(owner.address)).to.be.equal(INITIAL_REWARD);
		expect(await ImpactLabsVesting.advancePayment()).to.be.equal(
			parseEther("67759621.560660818850391700")
		);

		await advanceBlockNTimes(10 * REWARD_PERIOD_SIZE);
		await cUSD.connect(donor1).approve(DonationMiner.address, 1);
		await DonationMiner.connect(donor1).donate(1);
		await ImpactLabsVesting.claim();
		expect(await PACT.balanceOf(owner.address)).to.be.equal(INITIAL_REWARD);
		expect(await ImpactLabsVesting.advancePayment()).to.be.equal(
			parseEther("35871497.488265784597291605")
		);

		await advanceBlockNTimes(11 * REWARD_PERIOD_SIZE);
		await cUSD.connect(donor1).approve(DonationMiner.address, 1);
		await DonationMiner.connect(donor1).donate(1);
		await ImpactLabsVesting.claim();
		expect(await PACT.balanceOf(owner.address)).to.be.equal(INITIAL_REWARD);
		expect(await ImpactLabsVesting.advancePayment()).to.be.equal(
			parseEther("1196823.780236024210611910")
		);

		await advanceBlockNTimes(REWARD_PERIOD_SIZE);
		await cUSD.connect(donor1).approve(DonationMiner.address, 1);
		await DonationMiner.connect(donor1).donate(1);
		await ImpactLabsVesting.claim();
		expect(await PACT.balanceOf(owner.address)).to.be.equal(
			parseEther("101934691.331176674943971135")
		);
		expect(await ImpactLabsVesting.advancePayment()).to.be.equal(
			parseEther("0")
		);

		await advanceBlockNTimes(8 * REWARD_PERIOD_SIZE);
		await cUSD.connect(donor1).approve(DonationMiner.address, 1);
		await DonationMiner.connect(donor1).donate(1);
		await ImpactLabsVesting.claim();
		expect(await PACT.balanceOf(owner.address)).to.be.equal(
			parseEther("126863338.341679958786368725")
		);
		expect(await ImpactLabsVesting.advancePayment()).to.be.equal(
			parseEther("0")
		);
	});

	async function chunkAdvance(chunk: number, rewardExpected: string) {
		// next 100 reward periods
		await advanceBlockNTimes(chunk - 3);

		await cUSD.connect(donor1).approve(DonationMiner.address, 1);

		await DonationMiner.connect(donor1).donate(1);

		// Claim their rewards
		await ImpactLabsVesting.claim();

		// Check their PACT balance
		const balance = await PACT.balanceOf(owner.address);
		expect(balance).to.equal(parseEther(rewardExpected));
	}

	xit("Should donate and claim 9 years, one donor", async function () {
		DonationMiner.updateRewardPeriodParams(1, "998902", "1000000");
		DonationMiner.updateFirstRewardPeriodParams(100, parseEther("4320000"));

		const rewardAfter9Years = "2870907625.686701453052597639";
		const donationMinerBalanceAfterYears = "129092374.313298546947402361";

		const rewardsExpected = [
			"307005432.07769675854559849", //expected reward after 100 reward periods
			"582069794.961849017375150011", //expected reward after 200 reward periods
			"828516260.800657065574929566", //expected reward after 300 reward periods
			"1049322256.486905444197183171", //expected reward after 400 reward periods
			"1247155435.246647342073326174", //expected reward after 500 reward periods
			"1424405905.717551652618407216", //same
			"1583215107.89041932146323255", //same
			"1725501684.776671835903034679", //same
			"1852984662.368674112532929914", //same
			"1967204217.940069591599302636", //same
			"2069540287.59699260026252661", //same
			"2161229237.886073541267069318", //same
			"2243378802.876180954727794346", //same
			"2316981467.175278656056259895", //same
			"2382926456.568442671373512669", //same
			"2442010481.141148606993331405", //same
			"2494947360.680172302944989381", //same
			"2542376648.640756553177331632", //same
			"2584871358.869940376811737003", //same
			"2622944888.435954460994091897", //same
			"2657057220.201394300219578994", //same
			"2687620480.076154014527960886", //same
			"2715003916.08970947422062754", //same
			"2739538359.437087562166207361", //same
			"2761520221.394357302648724674", //same
			"2781215074.392116505464946039", //same
			"2798860860.511479536585818093", //same
			"2814670766.16580109020462574", //same
			"2828835797.698415592772694847", //same
			"2841527089.013308232098568958", //same
			"2852897969.118206956796806758", //same
			"2863085814.558982374562208901", //expected reward after 3200 reward periods
		];

		await advanceToBlockN(100);

		// 9 years = 3285 rewardPeriods
		for (let i = 0; i < 32; i++) {
			await chunkAdvance(100, rewardsExpected[i]);
		}

		await chunkAdvance(85, rewardAfter9Years);

		expect(await PACT.balanceOf(owner.address)).to.be.equal(
			parseEther(rewardAfter9Years)
		);
		expect(await PACT.balanceOf(ImpactLabsVesting.address)).to.be.equal(
			parseEther(donationMinerBalanceAfterYears)
		);
	});
});
