// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import { deployments, ethers, getNamedAccounts } from "hardhat";
import {
	advanceBlockNTimes,
	advanceTimeAndBlockNTimes,
} from "../utils/TimeTravel";
import { parseEther, formatEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

chai.use(chaiAsPromised);
const expect = chai.expect;

const STARTING_DELAY = 10;
const REWARD_PERIOD_SIZE = 20;

let owner: SignerWithAddress;

let ImpactProxyAdmin: ethersTypes.Contract;
let DonationMiner: ethersTypes.Contract;
let IPCT: ethersTypes.Contract;
let ImpactLabsVesting: ethersTypes.Contract;
let ImpactLabsVestingImplementation: ethersTypes.Contract;

const deploy = deployments.createFixture(async () => {
	await deployments.fixture("Test", { fallbackToGlobal: false });

	[owner] = await ethers.getSigners();

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

	IPCT = await ethers.getContractAt(
		"IPCTToken",
		(
			await deployments.get("IPCTToken")
		).address
	);

	ImpactLabsVesting = await ethers.getContractAt(
		"ImpactLabsVestingImplementation",
		(
			await deployments.get("ImpactLabsVestingProxy")
		).address
	);
});

describe("Impact Labs Vesting", () => {
	before(async function () {});

	beforeEach(async () => {
		await deploy();
	});

	it("Should transfer IPCTs on initialization", async function () {
		expect(await IPCT.balanceOf(owner.address)).to.be.equal(
			parseEther("100000001")
		);
		expect(await ImpactLabsVesting.advancePayment()).to.be.equal(
			parseEther("100000001")
		);

		await advanceBlockNTimes(REWARD_PERIOD_SIZE);

		await ImpactLabsVesting.claim();

		expect(await IPCT.balanceOf(owner.address)).to.be.equal(
			parseEther("100000001")
		);
		expect(await ImpactLabsVesting.advancePayment()).to.be.equal(
			parseEther("96760001")
		);
	});
});
