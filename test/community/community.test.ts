// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
import { should } from "chai";
import BigNumber from "bignumber.js";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// @ts-ignore
import {
	ethers,
	network,
	waffle,
	deployments,
	getNamedAccounts,
} from "hardhat";
import type * as ethersTypes from "ethers";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther, formatEther } from "@ethersproject/units";
import {
	advanceBlockNTimes,
	advanceTimeAndBlockNTimes,
} from "../utils/TimeTravel";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
	expectRevert,
	expectEvent,
	time,
	constants,
} = require("@openzeppelin/test-helpers");

should();
chai.use(chaiAsPromised);
const expect = chai.expect;
const provider = waffle.provider;

enum BeneficiaryState {
	NONE = "0",
	Valid = "1",
	Locked = "2",
	Removed = "3",
}

//users
let adminAccount1: SignerWithAddress;
let adminAccount2: SignerWithAddress;
let adminAccount3: SignerWithAddress;
// community managers
let communityManagerA: SignerWithAddress;
let communityManagerB: SignerWithAddress;
let communityManagerC: SignerWithAddress;
// beneficiaries
let beneficiaryA: SignerWithAddress;
let beneficiaryB: SignerWithAddress;
let beneficiaryC: SignerWithAddress;
let beneficiaryD: SignerWithAddress;

let Community: ethersTypes.ContractFactory;

let communityInstance: ethersTypes.Contract;
let communityAdminProxy: ethersTypes.Contract;
let treasuryInstance: ethersTypes.Contract;
let cUSDInstance: ethersTypes.Contract;

// constants
const oneMinuteInBlocks = 12;
const threeMinutesInBlocks = 36;
const hourInBlocks = 720;
const dayInBlocks = 17280;
const weekInBlocks = 120960;
const claimAmountTwo = parseEther("2");
const maxClaimTen = parseEther("10");
const fiveCents = parseEther("0.05");
const oneCent = parseEther("0.01");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const mintAmount = parseEther("10000");
const communityMinTranche = parseEther("100");
const communityMaxTranche = parseEther("5000");

async function init() {
	const accounts: SignerWithAddress[] = await ethers.getSigners();

	adminAccount1 = accounts[0];
	adminAccount2 = accounts[1];
	adminAccount3 = accounts[2];
	// community managers
	communityManagerA = accounts[3];
	communityManagerB = accounts[4];
	communityManagerC = accounts[5];
	// beneficiaries
	beneficiaryA = accounts[6];
	beneficiaryB = accounts[7];
	beneficiaryC = accounts[8];
	beneficiaryD = accounts[9];

	Community = await ethers.getContractFactory("Community");
}

async function deploy() {
	await deployments.fixture("Test", { fallbackToGlobal: false });

	const cUSD = await deployments.get("TokenMock");
	cUSDInstance = await ethers.getContractAt("TokenMock", cUSD.address);

	const communityAdmin = await deployments.get("CommunityAdminProxy");
	communityAdminProxy = await ethers.getContractAt(
		"CommunityAdminImplementation",
		communityAdmin.address
	);

	const treasury = await deployments.get("TreasuryProxy");
	treasuryInstance = await ethers.getContractAt(
		"TreasuryImplementation",
		treasury.address
	);
}

async function addDefaultCommunity() {
	const tx = await communityAdminProxy.addCommunity(
		[communityManagerA.address],
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
	communityInstance = await Community.attach(communityAddress);
}

describe("Community - Setup", () => {
	before(async function () {
		await init();
	});

	beforeEach(async () => {
		await deploy();

		await cUSDInstance.mint(
			treasuryInstance.address,
			mintAmount.toString()
		);

		await addDefaultCommunity();
	});

	it("should return correct values", async () => {
		(await communityInstance.previousCommunity()).should.be.equal(
			zeroAddress
		);
		(await communityInstance.claimAmount()).should.be.equal(
			claimAmountTwo.toString()
		);
		(await communityInstance.baseInterval()).should.be.equal(
			threeMinutesInBlocks.toString()
		);
		(await communityInstance.incrementInterval()).should.be.equal(
			oneMinuteInBlocks.toString()
		);
		(await communityInstance.maxClaim()).should.be.equal(
			maxClaimTen.toString()
		);
		(await communityInstance.validBeneficiaryCount()).should.be.equal(0);
		(await communityInstance.treasuryFunds()).should.be.equal(
			parseEther("100")
		);
		(await communityInstance.privateFunds()).should.be.equal(0);
		(await communityInstance.communityAdmin()).should.be.equal(
			communityAdminProxy.address
		);
		(await communityInstance.cUSD()).should.be.equal(cUSDInstance.address);
		(await communityInstance.locked()).should.be.equal(false);
		(await communityInstance.decreaseStep()).should.be.equal(oneCent);
	});
});

describe("Community - Beneficiary", () => {
	before(async function () {
		await init();
	});

	beforeEach(async () => {
		await deploy();

		await cUSDInstance.mint(
			treasuryInstance.address,
			mintAmount.toString()
		);

		await addDefaultCommunity();
	});

	it("should add beneficiary to community", async () => {
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
	});

	it("should give beneficiary 5 cents when adding to community", async () => {
		(await cUSDInstance.balanceOf(beneficiaryA.address))
			.toString()
			.should.be.equal("0");
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
		(await cUSDInstance.balanceOf(beneficiaryA.address))
			.toString()
			.should.be.equal(fiveCents.toString());
	});

	it("should lock beneficiary from community", async () => {
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
		await communityInstance
			.connect(communityManagerA)
			.lockBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.Locked);
	});

	it("should not lock an invalid beneficiary from community", async () => {
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await expect(
			communityInstance
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address)
		).to.be.rejectedWith("NOT_YET");
	});

	it("should unlock locked beneficiary from community", async () => {
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
		await communityInstance
			.connect(communityManagerA)
			.lockBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.Locked);
		await communityInstance
			.connect(communityManagerA)
			.unlockBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
	});

	it("should not unlock a not locked beneficiary from community", async () => {
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
		await expect(
			communityInstance
				.connect(communityManagerA)
				.unlockBeneficiary(beneficiaryA.address)
		).to.be.rejectedWith("NOT_YET");
	});

	it("should remove beneficiary from community", async () => {
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
		await communityInstance
			.connect(communityManagerA)
			.removeBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.Removed);
	});
});

describe("Community - Claim", () => {
	before(async function () {
		await init();
	});

	beforeEach(async () => {
		await deploy();

		await cUSDInstance.mint(
			treasuryInstance.address,
			mintAmount.toString()
		);

		await addDefaultCommunity();

		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
	});

	it("should return correct lastInterval values", async () => {
		const baseInterval = (
			await communityInstance.baseInterval()
		).toNumber();
		const incrementInterval = (
			await communityInstance.incrementInterval()
		).toNumber();

		expect(
			await communityInstance.lastInterval(beneficiaryA.address)
		).to.be.equal(0);
		await communityInstance.connect(beneficiaryA).claim();
		expect(
			await communityInstance.lastInterval(beneficiaryA.address)
		).to.be.equal(baseInterval);
		await advanceTimeAndBlockNTimes(baseInterval);
		await communityInstance.connect(beneficiaryA).claim();
		expect(
			await communityInstance.lastInterval(beneficiaryA.address)
		).to.be.equal(baseInterval + incrementInterval);
		await advanceTimeAndBlockNTimes(incrementInterval);

		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("NOT_YET");
		expect(
			await communityInstance.lastInterval(beneficiaryA.address)
		).to.be.equal(baseInterval + incrementInterval);
		await advanceTimeAndBlockNTimes(baseInterval + incrementInterval);

		await expect(communityInstance.connect(beneficiaryA).claim()).to.be
			.fulfilled;
		expect(
			await communityInstance.lastInterval(beneficiaryA.address)
		).to.be.equal(baseInterval + 2 * incrementInterval);
		await advanceTimeAndBlockNTimes(baseInterval + incrementInterval);

		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("NOT_YET");
		expect(
			await communityInstance.lastInterval(beneficiaryA.address)
		).to.be.equal(baseInterval + 2 * incrementInterval);
		await advanceTimeAndBlockNTimes(baseInterval + 2 * incrementInterval);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be
			.fulfilled;
	});

	it("should not claim without belong to community", async () => {
		await expect(
			communityInstance.connect(beneficiaryB).claim()
		).to.be.rejectedWith("NOT_VALID_BENEFICIARY");
	});

	it("should not claim after locked from community", async () => {
		await communityInstance
			.connect(communityManagerA)
			.lockBeneficiary(beneficiaryA.address);
		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("Community: NOT_VALID_BENEFICIARY");
	});

	it("should not claim after removed from community", async () => {
		await communityInstance
			.connect(communityManagerA)
			.removeBeneficiary(beneficiaryA.address);
		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("Community: NOT_VALID_BENEFICIARY");
	});

	it("should not claim if community is locked", async () => {
		await expect(communityInstance.connect(communityManagerA).lock())
			.to.emit(communityInstance, "CommunityLocked")
			.withArgs(communityManagerA.address);
		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("LOCKED");
	});

	it("should not claim without waiting enough", async () => {
		const baseInterval = (
			await communityInstance.baseInterval()
		).toNumber();
		const incrementInterval = (
			await communityInstance.incrementInterval()
		).toNumber();
		await communityInstance.connect(beneficiaryA).claim();
		await advanceTimeAndBlockNTimes(baseInterval);
		await communityInstance.connect(beneficiaryA).claim();
		await advanceTimeAndBlockNTimes(incrementInterval);
		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("NOT_YET");
		await advanceTimeAndBlockNTimes(baseInterval + incrementInterval);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be
			.fulfilled;
		await advanceTimeAndBlockNTimes(baseInterval + incrementInterval);
		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("NOT_YET");
		await advanceTimeAndBlockNTimes(baseInterval + 2 * incrementInterval);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be
			.fulfilled;
	});

	it("should claim after waiting", async () => {
		const baseInterval = (
			await communityInstance.baseInterval()
		).toNumber();
		await advanceTimeAndBlockNTimes(baseInterval + 1);
		await communityInstance.connect(beneficiaryA).claim();
		(await cUSDInstance.balanceOf(beneficiaryA.address)).should.be.equal(
			claimAmountTwo.add(fiveCents)
		);
	});

	it("should not claim after max claim", async () => {
		const baseInterval = (
			await communityInstance.baseInterval()
		).toNumber();
		const incrementInterval = (
			await communityInstance.incrementInterval()
		).toNumber();
		const claimAmount = await communityInstance.claimAmount();
		const maxClaimAmount = await communityInstance.maxClaim();
		await communityInstance.connect(beneficiaryA).claim();
		const maxClaimsPerUser = maxClaimAmount.div(claimAmount).toNumber();
		for (let index = 0; index < maxClaimsPerUser - 1; index++) {
			await advanceTimeAndBlockNTimes(
				baseInterval + incrementInterval * index + 5
			);
			await communityInstance.connect(beneficiaryA).claim();
		}
		await advanceTimeAndBlockNTimes(
			baseInterval + incrementInterval * maxClaimsPerUser + 5
		);
		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("MAX_CLAIM");
	});
});

describe("Community - Governance (2)", () => {
	before(async function () {
		await init();
	});

	beforeEach(async () => {
		await deploy();

		await cUSDInstance.mint(
			treasuryInstance.address,
			mintAmount.toString()
		);

		await addDefaultCommunity();
	});

	it("should migrate funds from community if CommunityAdmin", async () => {
		const previousCommunityOldBalance = await cUSDInstance.balanceOf(
			communityInstance.address
		);

		const newTx = await communityAdminProxy.migrateCommunity(
			[communityManagerA.address],
			communityInstance.address
		);

		let receipt = await newTx.wait();

		const newCommunityAddress = receipt.events?.filter((x: any) => {
			return x.event == "CommunityMigrated";
		})[0]["args"]["communityAddress"];

		communityInstance = await Community.attach(newCommunityAddress);
		const previousCommunityNewBalance = await cUSDInstance.balanceOf(
			communityInstance.address
		);
		const newCommunityNewBalance = await cUSDInstance.balanceOf(
			newCommunityAddress
		);
		previousCommunityOldBalance.should.be.equal(newCommunityNewBalance);
		previousCommunityNewBalance.should.be.equal(parseEther("100"));
	});

	it("should call beneficiaryJoinFromMigrated", async () => {
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);

		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryB.address);

		const newTx = await communityAdminProxy.migrateCommunity(
			[communityManagerA.address],
			communityInstance.address
		);

		let receipt = await newTx.wait();

		const newCommunityAddress = receipt.events?.filter((x: any) => {
			return x.event == "CommunityMigrated";
		})[0]["args"]["communityAddress"];

		const newCommunityInstance = await Community.attach(
			newCommunityAddress
		);
		await expect(
			newCommunityInstance
				.connect(beneficiaryA)
				.beneficiaryJoinFromMigrated()
		).to.be.fulfilled;
		await expect(
			newCommunityInstance
				.connect(beneficiaryB)
				.beneficiaryJoinFromMigrated()
		).to.be.fulfilled;
		await expect(
			newCommunityInstance
				.connect(beneficiaryC)
				.beneficiaryJoinFromMigrated()
		).to.be.fulfilled;

		(await newCommunityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
		(await newCommunityInstance.beneficiaries(beneficiaryB.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
		(await newCommunityInstance.beneficiaries(beneficiaryC.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
	});

	it("should not migrate an migrated community", async () => {
		await expect(
			communityAdminProxy.migrateCommunity(
				[communityManagerA.address],
				communityInstance.address
			)
		).to.be.fulfilled;

		await expect(
			communityAdminProxy.migrateCommunity(
				[communityManagerA.address],
				communityInstance.address
			)
		).to.be.rejectedWith(
			"CommunityAdmin::migrateCommunity: this community has been migrated"
		);
	});

	it("should not migrate community if not admin", async () => {
		await expect(
			communityAdminProxy.connect(adminAccount2).migrateCommunity(
				[communityManagerA.address],
				cUSDInstance.address // wrong on purpose,
			)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("should edit community if manager", async () => {
		(await communityInstance.incrementInterval()).should.be.equal(
			oneMinuteInBlocks.toString()
		);
		await communityAdminProxy.updateBeneficiaryParams(
			communityInstance.address,
			claimAmountTwo.toString(),
			maxClaimTen.toString(),
			oneCent.toString(),
			weekInBlocks.toString(),
			threeMinutesInBlocks.toString()
		);

		(await communityInstance.incrementInterval()).should.be.equal(
			threeMinutesInBlocks.toString()
		);
	});

	it("should not be able edit community if not CommunityAdmin", async () => {
		await expect(
			communityInstance
				.connect(adminAccount1)
				.updateBeneficiaryParams(
					claimAmountTwo.toString(),
					maxClaimTen.toString(),
					oneCent.toString(),
					threeMinutesInBlocks.toString(),
					threeMinutesInBlocks.toString()
				)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("should not be able edit community with invalid values", async () => {
		await expect(
			communityAdminProxy.updateBeneficiaryParams(
				communityInstance.address,
				claimAmountTwo.toString(),
				maxClaimTen.toString(),
				oneCent.toString(),
				threeMinutesInBlocks.toString(),
				weekInBlocks.toString()
			)
		).to.be.rejected;

		await expect(
			communityAdminProxy.updateBeneficiaryParams(
				communityInstance.address,
				maxClaimTen.toString(),
				claimAmountTwo.toString(),
				oneCent.toString(),
				threeMinutesInBlocks.toString(),
				weekInBlocks.toString()
			)
		).to.be.rejected;
	});

	it("should not add manager to community if not manager", async () => {
		await expect(
			communityInstance
				.connect(communityManagerC)
				.addManager(communityManagerB.address)
		).to.be.rejectedWith("NOT_MANAGER");
	});

	it("should not remove manager from community if not manager", async () => {
		await communityInstance
			.connect(communityManagerA)
			.addManager(communityManagerB.address);
		await expect(
			communityInstance
				.connect(communityManagerC)
				.removeManager(communityManagerB.address)
		).to.be.rejectedWith("NOT_MANAGER");
	});

	it("should add manager to community if manager", async () => {
		await expect(
			communityInstance
				.connect(communityManagerA)
				.addManager(communityManagerB.address)
		).to.be.fulfilled;
		await expect(
			communityInstance
				.connect(communityManagerB)
				.addManager(communityManagerC.address)
		).to.be.fulfilled;
	});

	it("should remove manager to community if manager", async () => {
		await expect(
			communityInstance
				.connect(communityManagerA)
				.addManager(communityManagerB.address)
		).to.be.fulfilled;
		await expect(
			communityInstance
				.connect(communityManagerA)
				.removeManager(communityManagerB.address)
		).to.be.fulfilled;
	});

	it("should renounce from manager of community if manager", async () => {
		await communityInstance
			.connect(communityManagerA)
			.addManager(communityManagerB.address);
		await expect(
			communityInstance
				.connect(communityManagerB)
				.renounceRole(
					await communityInstance.MANAGER_ROLE(),
					communityManagerB.address
				)
		).to.be.fulfilled;
	});

	it("should lock community if manager", async () => {
		await expect(communityInstance.connect(communityManagerA).lock())
			.to.emit(communityInstance, "CommunityLocked")
			.withArgs(communityManagerA.address);
	});

	it("should lock community if manager", async () => {
		await expect(communityInstance.connect(communityManagerA).lock())
			.to.emit(communityInstance, "CommunityLocked")
			.withArgs(communityManagerA.address);

		await expect(communityInstance.connect(communityManagerA).unlock())
			.to.emit(communityInstance, "CommunityUnlocked")
			.withArgs(communityManagerA.address);
	});
});

describe("CommunityAdmin", () => {
	before(async function () {
		await init();
	});
	beforeEach(async () => {
		await deploy();
	});

	it("should add a community if admin", async () => {
		await cUSDInstance.mint(
			treasuryInstance.address,
			mintAmount.toString()
		);

		const tx = await communityAdminProxy.addCommunity(
			[communityManagerA.address],
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
		communityInstance = await Community.attach(communityAddress);

		(await communityInstance.baseInterval())
			.toString()
			.should.be.equal(threeMinutesInBlocks.toString());
		(await communityInstance.incrementInterval())
			.toString()
			.should.be.equal(oneMinuteInBlocks.toString());
		(await communityInstance.maxClaim()).should.be.equal(maxClaimTen);
	});

	it("should remove a community if admin", async () => {
		await cUSDInstance.mint(
			treasuryInstance.address,
			mintAmount.toString()
		);

		const tx = await communityAdminProxy.addCommunity(
			[communityManagerA.address],
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
		communityInstance = await Community.attach(communityAddress);

		await communityAdminProxy.removeCommunity(communityAddress);
	});

	it("should not create a community with invalid values", async () => {
		await expect(
			communityAdminProxy.addCommunity(
				[communityManagerA.address],
				claimAmountTwo.toString(),
				maxClaimTen.toString(),
				oneCent.toString(),
				oneMinuteInBlocks.toString(),
				threeMinutesInBlocks.toString(),
				communityMinTranche,
				communityMaxTranche
			)
		).to.be.rejected;
		await expect(
			communityAdminProxy.addCommunity(
				[communityManagerA.address],
				maxClaimTen.toString(), // it's supposed to be wrong!
				claimAmountTwo.toString(),
				oneCent.toString(),
				threeMinutesInBlocks.toString(),
				oneMinuteInBlocks.toString(),
				communityMinTranche,
				communityMaxTranche
			)
		).to.be.rejected;
	});
});

describe("Chaos test (complete flow)", async () => {
	// add community
	const addCommunity = async (
		communityManager: SignerWithAddress
	): Promise<ethersTypes.Contract> => {
		const tx = await communityAdminProxy.addCommunity(
			[communityManager.address],
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
		communityInstance = await Community.attach(communityAddress);
		await cUSDInstance.mint(communityAddress, mintAmount.toString());

		return communityInstance;
	};
	// add beneficiary
	const addBeneficiary = async (
		instance: ethersTypes.Contract,
		beneficiaryAddress: SignerWithAddress,
		communityManagerAddress: SignerWithAddress
	): Promise<void> => {
		const tx = await instance
			.connect(communityManagerAddress)
			.addBeneficiary(beneficiaryAddress.address);
		const block = await provider.getBlock(tx.blockNumber); // block is null; the regular provider apparently doesn't know about this block yet.

		(await instance.beneficiaries(beneficiaryAddress.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
	};
	// wait claim time
	const waitClaimTime = async (
		instance: ethersTypes.Contract,
		beneficiaryAddress: SignerWithAddress
	): Promise<void> => {
		const waitIs = (
			await instance.lastInterval(beneficiaryAddress.address)
		).toNumber();
		await advanceTimeAndBlockNTimes(waitIs + 1);
	};
	// claim
	const beneficiaryClaim = async (
		instance: ethersTypes.Contract,
		beneficiaryAddress: SignerWithAddress
	): Promise<void> => {
		const previousBalance = await cUSDInstance.balanceOf(
			beneficiaryAddress.address
		);
		await instance.connect(beneficiaryAddress).claim();
		const currentBalance = await cUSDInstance.balanceOf(
			beneficiaryAddress.address
		);
		previousBalance
			.add(await instance.claimAmount())
			.should.be.equal(currentBalance);
	};

	before(async function () {
		await init();
	});
	beforeEach(async () => {
		await deploy();
	});

	it("one beneficiary to one community", async () => {
		await cUSDInstance.mint(
			treasuryInstance.address,
			mintAmount.toString()
		);
		const communityInstanceA = await addCommunity(communityManagerA);
		await addBeneficiary(
			communityInstanceA,
			beneficiaryA,
			communityManagerA
		);
		await waitClaimTime(communityInstanceA, beneficiaryA);
		await beneficiaryClaim(communityInstanceA, beneficiaryA);
		await expect(
			beneficiaryClaim(communityInstanceA, beneficiaryA)
		).to.be.rejectedWith("NOT_YET");
		await waitClaimTime(communityInstanceA, beneficiaryA);
		await beneficiaryClaim(communityInstanceA, beneficiaryA);
	});

	it("many beneficiaries to one community", async () => {
		await cUSDInstance.mint(
			treasuryInstance.address,
			mintAmount.toString()
		);
		const communityInstanceA = await addCommunity(communityManagerA);
		const previousCommunityBalance = await cUSDInstance.balanceOf(
			communityInstanceA.address
		);
		await addBeneficiary(
			communityInstanceA,
			beneficiaryA,
			communityManagerA
		);
		await addBeneficiary(
			communityInstanceA,
			beneficiaryB,
			communityManagerA
		);
		await addBeneficiary(
			communityInstanceA,
			beneficiaryC,
			communityManagerA
		);
		await addBeneficiary(
			communityInstanceA,
			beneficiaryD,
			communityManagerA
		);
		// beneficiary A claims twice
		await waitClaimTime(communityInstanceA, beneficiaryA);
		await beneficiaryClaim(communityInstanceA, beneficiaryA);
		await waitClaimTime(communityInstanceA, beneficiaryA);
		await beneficiaryClaim(communityInstanceA, beneficiaryA);
		// beneficiary B claims once
		await waitClaimTime(communityInstanceA, beneficiaryB);
		await beneficiaryClaim(communityInstanceA, beneficiaryB);
		// beneficiary C claims it all
		const claimAmount = await communityInstanceA.claimAmount();
		const maxClaimAmount = await communityInstanceA.maxClaim();
		const maxClaimsPerUser = maxClaimAmount.div(claimAmount).toNumber();
		for (let index = 0; index < maxClaimsPerUser; index++) {
			await waitClaimTime(communityInstanceA, beneficiaryC);
			await beneficiaryClaim(communityInstanceA, beneficiaryC);
		}
		// beneficiary B can still claim
		await waitClaimTime(communityInstanceA, beneficiaryB);
		await beneficiaryClaim(communityInstanceA, beneficiaryB);
		// beneficiary A can still claim
		await waitClaimTime(communityInstanceA, beneficiaryA);
		await beneficiaryClaim(communityInstanceA, beneficiaryA);
		// beneficiary C can't claim anymore
		await waitClaimTime(communityInstanceA, beneficiaryC);
		await expect(
			beneficiaryClaim(communityInstanceA, beneficiaryC)
		).to.be.rejectedWith("MAX_CLAIM");
		const currentCommunityBalance = await cUSDInstance.balanceOf(
			communityInstanceA.address
		);

		previousCommunityBalance
			.sub(currentCommunityBalance)
			.should.be.equal(
				claimAmount.mul(5 + maxClaimsPerUser).add(fiveCents.mul(4))
			);
	});

	it("many beneficiaries to many communities", async () => {
		await cUSDInstance.mint(
			treasuryInstance.address,
			mintAmount.toString()
		);
		// community A
		const communityInstanceA = await addCommunity(communityManagerA);
		const communityInstanceB = await addCommunity(communityManagerB);
		const previousCommunityBalanceA = await cUSDInstance.balanceOf(
			communityInstanceA.address
		);
		const previousCommunityBalanceB = await cUSDInstance.balanceOf(
			communityInstanceB.address
		);
		//
		await addBeneficiary(
			communityInstanceA,
			beneficiaryA,
			communityManagerA
		);
		await addBeneficiary(
			communityInstanceA,
			beneficiaryB,
			communityManagerA
		);
		//
		await addBeneficiary(
			communityInstanceB,
			beneficiaryC,
			communityManagerB
		);
		await addBeneficiary(
			communityInstanceB,
			beneficiaryD,
			communityManagerB
		);
		// beneficiary A claims twice
		await waitClaimTime(communityInstanceA, beneficiaryA);
		await beneficiaryClaim(communityInstanceA, beneficiaryA);
		await waitClaimTime(communityInstanceA, beneficiaryA);
		await beneficiaryClaim(communityInstanceA, beneficiaryA);
		// beneficiary B claims it all
		const claimAmountA = await communityInstanceA.claimAmount();
		const maxClaimAmountA = await communityInstanceA.maxClaim();
		const maxClaimsPerUserA = maxClaimAmountA.div(claimAmountA).toNumber();
		for (let index = 0; index < maxClaimsPerUserA; index++) {
			await waitClaimTime(communityInstanceA, beneficiaryB);
			await beneficiaryClaim(communityInstanceA, beneficiaryB);
		}
		// beneficiary C claims it all
		const claimAmountB = await communityInstanceB.claimAmount();
		const maxClaimAmountB = await communityInstanceB.maxClaim();
		const maxClaimsPerUserB = maxClaimAmountB.div(claimAmountB).toNumber();
		for (let index = 0; index < maxClaimsPerUserB; index++) {
			await waitClaimTime(communityInstanceB, beneficiaryC);
			await beneficiaryClaim(communityInstanceB, beneficiaryC);
		}
		// beneficiary D claims three times
		await waitClaimTime(communityInstanceB, beneficiaryD);
		await beneficiaryClaim(communityInstanceB, beneficiaryD);
		await waitClaimTime(communityInstanceB, beneficiaryD);
		await beneficiaryClaim(communityInstanceB, beneficiaryD);
		await waitClaimTime(communityInstanceB, beneficiaryD);
		await beneficiaryClaim(communityInstanceB, beneficiaryD);
		// beneficiary A can still claim
		await waitClaimTime(communityInstanceA, beneficiaryA);
		await beneficiaryClaim(communityInstanceA, beneficiaryA);
		// beneficiary C can't claim anymore
		await waitClaimTime(communityInstanceB, beneficiaryC);
		await expect(
			beneficiaryClaim(communityInstanceB, beneficiaryC)
		).to.be.rejectedWith("MAX_CLAIM");
		// beneficiary B can't claim anymore
		await waitClaimTime(communityInstanceB, beneficiaryC);
		await expect(
			beneficiaryClaim(communityInstanceB, beneficiaryC)
		).to.be.rejectedWith("MAX_CLAIM");
		// beneficiary D can still claim
		await waitClaimTime(communityInstanceB, beneficiaryD);
		await beneficiaryClaim(communityInstanceB, beneficiaryD);
		// balances
		const currentCommunityBalanceA = await cUSDInstance.balanceOf(
			communityInstanceA.address
		);
		previousCommunityBalanceA
			.sub(currentCommunityBalanceA)
			.should.be.equal(
				claimAmountA.mul(3 + maxClaimsPerUserA).add(fiveCents.mul(2))
			);
		const currentCommunityBalanceB = await cUSDInstance.balanceOf(
			communityInstanceB.address
		);
		previousCommunityBalanceB
			.sub(currentCommunityBalanceB)
			.should.be.equal(
				claimAmountB.mul(4 + maxClaimsPerUserB).add(fiveCents.mul(2))
			);
	});
});

describe("Community - getFunds", () => {
	before(async function () {
		await init();
	});

	beforeEach(async () => {
		await deploy();
		await cUSDInstance.mint(
			treasuryInstance.address,
			mintAmount.toString()
		);

		await addDefaultCommunity();
	});

	it("should get funds if manager", async () => {
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);

		communityInstance.connect(beneficiaryA).claim();

		await expect(
			communityInstance.connect(communityManagerA).requestFunds()
		).to.be.fulfilled;

		expect(
			await cUSDInstance.balanceOf(communityInstance.address)
		).to.be.equal(communityMinTranche);
	});

	it("should not get funds if not manager", async () => {
		await expect(
			communityInstance.connect(beneficiaryA).requestFunds()
		).to.be.rejectedWith("Community: NOT_MANAGER");
	});

	it("should not change community tranche limits if not admin", async () => {
		await expect(
			communityAdminProxy
				.connect(communityManagerA)
				.updateCommunityParams(
					communityInstance.address,
					parseEther("50"),
					parseEther("100")
				)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("should change community tranche limits if admin", async () => {
		await expect(
			communityAdminProxy
				.connect(adminAccount1)
				.updateCommunityParams(
					communityInstance.address,
					parseEther("50"),
					parseEther("100")
				)
		).to.be.fulfilled;

		expect(await communityInstance.minTranche()).to.be.equal(
			parseEther("50")
		);
		expect(await communityInstance.maxTranche()).to.be.equal(
			parseEther("100")
		);
	});

	it("should not change communityMaxTranche if not admin", async () => {
		await expect(
			communityAdminProxy
				.connect(communityManagerA)
				.updateCommunityParams(
					communityInstance.address,
					parseEther("123"),
					parseEther("124")
				)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("should change communityMaxTranche if admin", async () => {
		await expect(
			communityAdminProxy
				.connect(adminAccount1)
				.updateCommunityParams(
					communityInstance.address,
					parseEther("100"),
					parseEther("1234")
				)
		).to.be.fulfilled;

		expect(await communityInstance.maxTranche()).to.be.equal(
			parseEther("1234")
		);
	});

	it("should not set communityMinTranche greater than communityMaxTranche", async () => {
		await expect(
			communityAdminProxy
				.connect(adminAccount1)
				.updateCommunityParams(
					communityInstance.address,
					parseEther("50"),
					parseEther("100")
				)
		).to.be.fulfilled;
		await expect(
			communityAdminProxy
				.connect(adminAccount1)
				.updateCommunityParams(
					communityInstance.address,
					parseEther("100"),
					parseEther("50")
				)
		).to.be.rejectedWith(
			"Community::updateCommunityParams: minTranche should not be greater than maxTranche"
		);

		expect(await communityInstance.minTranche()).to.be.equal(
			parseEther("50")
		);
		expect(await communityInstance.maxTranche()).to.be.equal(
			parseEther("100")
		);
	});

	it("should transfer funds to community", async () => {
		expect(
			await cUSDInstance.balanceOf(communityInstance.address)
		).to.be.equal(communityMinTranche);

		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);

		communityInstance.connect(beneficiaryA).claim();

		await expect(
			communityInstance.connect(communityManagerA).requestFunds()
		).to.be.fulfilled;
		expect(
			await cUSDInstance.balanceOf(communityInstance.address)
		).to.be.equal(communityMinTranche);
	});

	it("should donate directly in the community", async () => {
		const user1Donation = 1;

		await cUSDInstance.mint(adminAccount1.address, user1Donation);
		expect(
			await cUSDInstance.balanceOf(communityInstance.address)
		).to.be.equal(communityMinTranche);

		await cUSDInstance.approve(communityInstance.address, user1Donation);
		await communityInstance.donate(adminAccount1.address, user1Donation);

		expect(
			await cUSDInstance.balanceOf(communityInstance.address)
		).to.be.equal(communityMinTranche.add(user1Donation));
		expect(await communityInstance.treasuryFunds()).to.be.equal(
			communityMinTranche
		);
		expect(await communityInstance.privateFunds()).to.be.equal(
			user1Donation
		);
	});

	it("should not requestFunds if you have more then communityMinTranche", async () => {
		const user1Donation = 1;

		await cUSDInstance.mint(adminAccount1.address, parseEther("100"));
		expect(
			await cUSDInstance.balanceOf(communityInstance.address)
		).to.be.equal(communityMinTranche);

		await cUSDInstance.approve(communityInstance.address, user1Donation);
		await communityInstance.donate(adminAccount1.address, user1Donation);

		expect(
			await cUSDInstance.balanceOf(communityInstance.address)
		).to.be.equal(communityMinTranche.add(user1Donation));

		await expect(
			communityInstance.connect(communityManagerA).requestFunds()
		).to.be.rejectedWith(
			"CommunityAdmin::fundCommunity: this community has enough funds"
		);
		expect(
			await cUSDInstance.balanceOf(communityInstance.address)
		).to.be.equal(communityMinTranche.add(user1Donation));
	});

	it("should transfer funds if admin", async () => {
		const userInitialBalance = await cUSDInstance.balanceOf(
			adminAccount1.address
		);
		const communityInitialBalance = await cUSDInstance.balanceOf(
			communityInstance.address
		);
		await expect(
			communityAdminProxy.transferFromCommunity(
				communityInstance.address,
				cUSDInstance.address,
				adminAccount1.address,
				communityInitialBalance
			)
		).to.be.fulfilled;
		expect(
			await cUSDInstance.balanceOf(communityInstance.address)
		).to.be.equal("0");
		expect(await cUSDInstance.balanceOf(adminAccount1.address)).to.be.equal(
			userInitialBalance.add(communityInitialBalance)
		);
	});

	it.only("should get more funds if have private donations", async () => {
		const user1Donation = parseEther("20000");

		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);

		await cUSDInstance.mint(adminAccount1.address, user1Donation);
		await cUSDInstance.approve(communityInstance.address, user1Donation);
		await communityInstance.donate(adminAccount1.address, user1Donation);

		await communityAdminProxy.transferFromCommunity(
			communityInstance.address,
			cUSDInstance.address,
			adminAccount1.address,
			user1Donation
		);

		await expect(
			communityInstance.connect(communityManagerA).requestFunds()
		).to.be.fulfilled;

		expect(
			await cUSDInstance.balanceOf(communityInstance.address)
		).to.be.equal(parseEther("402"));
	});
});
