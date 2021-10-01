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
let CommunityAdminHelper: ethersTypes.ContractFactory;
let CommunityAdmin: ethersTypes.ContractFactory;

// contract instances
let communityInstance: ethersTypes.Contract;
let communityAdminHelperInstance: ethersTypes.Contract;
let communityAdminInstance: ethersTypes.Contract;
let treasuryInstance: ethersTypes.Contract;
let cUSDInstance: ethersTypes.Contract;

// constants
const hour = time.duration.hours(1);
const day = time.duration.days(1);
const week = time.duration.weeks(1);
const month = time.duration.days(30);
const claimAmountTwo = parseEther("2");
const maxClaimTen = parseEther("10");
const fiveCents = parseEther("0.05");
const oneCent = parseEther("0.01");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const mintAmount = parseEther("500");
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
	CommunityAdminHelper = await ethers.getContractFactory(
		"CommunityAdminHelper"
	);
	CommunityAdmin = await ethers.getContractFactory("CommunityAdminMock");
}

async function deploy() {
	await deployments.fixture("Test", { fallbackToGlobal: false });

	const cUSD = await deployments.get("TokenMock");
	cUSDInstance = await ethers.getContractAt("TokenMock", cUSD.address);

	const communityAdmin = await deployments.get("CommunityAdminMock");
	communityAdminInstance = await ethers.getContractAt(
		"CommunityAdminMock",
		communityAdmin.address
	);

	const treasury = await deployments.get("TreasuryMock");
	treasuryInstance = await ethers.getContractAt(
		"TreasuryMock",
		treasury.address
	);

	const communityAdminHelper = await deployments.get("CommunityAdminHelper");
	communityAdminHelperInstance = await ethers.getContractAt(
		"CommunityAdminHelper",
		communityAdminHelper.address
	);

	//for testing
	await communityAdminInstance.transferOwnership(adminAccount1.address);
	//end for testing
}

async function addDefaultCommunity() {
	const tx = await communityAdminInstance.addCommunity(
		communityManagerA.address,
		claimAmountTwo.toString(),
		maxClaimTen.toString(),
		day.toString(),
		hour.toString()
	);

	let receipt = await tx.wait();

	const communityAddress = receipt.events?.filter((x: any) => {
		return x.event == "CommunityAdded";
	})[0]["args"]["_communityAddress"];
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
			day.toString()
		);
		(await communityInstance.incrementInterval()).should.be.equal(
			hour.toString()
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
			communityAdminInstance.address
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

	it("should be able to add beneficiary to community0", async () => {
		console.log(beneficiaryA.address);
		console.log(beneficiaryB.address);
		console.log(beneficiaryC.address);
		console.log(beneficiaryD.address);

		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);

		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryB.address);

		const length = (
			await communityInstance.beneficiaryListLength()
		).toNumber();

		// console.log('length: ', length);
		//
		// for (let i = 0; i < length; i++) {
		// 	console.log(i, ': ', await communityInstance.beneficiaryList(i));
		// }
		//
		// console.log((await communityInstance.beneficiaries(beneficiaryA.address)));

		await communityInstance.connect(beneficiaryA).claim();

		console.log(await communityInstance.lastInterval(beneficiaryA.address));
		console.log(await communityInstance.lastInterval(beneficiaryC.address));
	});

	it("should be able to add beneficiary to community", async () => {
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

	it("should be able to lock beneficiary from community", async () => {
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

	it("should not be able to lock an invalid beneficiary from community", async () => {
		(await communityInstance.beneficiaries(beneficiaryA.address)).state
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await expect(
			communityInstance
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address)
		).to.be.rejectedWith("NOT_YET");
	});

	it("should be able to unlock locked beneficiary from community", async () => {
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

	it("should not be able to unlock a not locked beneficiary from community", async () => {
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

	it("should be able to remove beneficiary from community", async () => {
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
		await network.provider.send("evm_increaseTime", [baseInterval]);
		await communityInstance.connect(beneficiaryA).claim();
		expect(
			await communityInstance.lastInterval(beneficiaryA.address)
		).to.be.equal(baseInterval + incrementInterval);
		await network.provider.send("evm_increaseTime", [incrementInterval]);
		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("NOT_YET");
		expect(
			await communityInstance.lastInterval(beneficiaryA.address)
		).to.be.equal(baseInterval + incrementInterval);
		await network.provider.send("evm_increaseTime", [
			baseInterval + incrementInterval,
		]);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be
			.fulfilled;
		expect(
			await communityInstance.lastInterval(beneficiaryA.address)
		).to.be.equal(baseInterval + 2 * incrementInterval);
		await network.provider.send("evm_increaseTime", [
			baseInterval + incrementInterval,
		]);
		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("NOT_YET");
		expect(
			await communityInstance.lastInterval(beneficiaryA.address)
		).to.be.equal(baseInterval + 2 * incrementInterval);
		await network.provider.send("evm_increaseTime", [
			baseInterval + 2 * incrementInterval,
		]);
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
		await network.provider.send("evm_increaseTime", [baseInterval]);
		await communityInstance.connect(beneficiaryA).claim();
		await network.provider.send("evm_increaseTime", [incrementInterval]);
		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("NOT_YET");
		await network.provider.send("evm_increaseTime", [
			baseInterval + incrementInterval,
		]);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be
			.fulfilled;
		await network.provider.send("evm_increaseTime", [
			baseInterval + incrementInterval,
		]);
		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("NOT_YET");
		await network.provider.send("evm_increaseTime", [
			baseInterval + 2 * incrementInterval,
		]);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be
			.fulfilled;
	});

	it("should claim after waiting", async () => {
		const baseInterval = (
			await communityInstance.baseInterval()
		).toNumber();
		await network.provider.send("evm_increaseTime", [baseInterval + 5]);
		await communityInstance.connect(beneficiaryA).claim();
		(await cUSDInstance.balanceOf(beneficiaryA.address)).should.be.equal(
			claimAmountTwo.add(fiveCents).sub(oneCent)
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
			await network.provider.send("evm_increaseTime", [
				baseInterval + incrementInterval * index + 5,
			]);
			await communityInstance.connect(beneficiaryA).claim();
		}
		await network.provider.send("evm_increaseTime", [
			baseInterval + incrementInterval * maxClaimsPerUser + 5,
		]);
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

	it("should be able to migrate funds from community if CommunityAdmin", async () => {
		const previousCommunityPreviousBalance = await cUSDInstance.balanceOf(
			communityInstance.address
		);
		const newCommunityAdminHelperInstance =
			await CommunityAdminHelper.deploy(communityAdminInstance.address);

		const newTx = await communityAdminInstance.migrateCommunity(
			communityManagerA.address,
			communityInstance.address,
			newCommunityAdminHelperInstance.address
		);

		let receipt = await newTx.wait();

		const newCommunityAddress = receipt.events?.filter((x: any) => {
			return x.event == "CommunityMigrated";
		})[0]["args"]["_communityAddress"];

		communityInstance = await Community.attach(newCommunityAddress);
		const previousCommunityNewBalance = await cUSDInstance.balanceOf(
			communityInstance.address
		);
		const newCommunityNewBalance = await cUSDInstance.balanceOf(
			newCommunityAddress
		);
		previousCommunityPreviousBalance.should.be.equal(
			newCommunityNewBalance
		);
		previousCommunityNewBalance.should.be.equal(parseEther("100"));
	});

	it("should not be able to migrate from invalid community", async () => {
		const newcommunityAdminInstance = await CommunityAdmin.deploy(
			cUSDInstance.address,
			communityMinTranche,
			communityMaxTranche
		);
		await expect(
			communityAdminInstance.migrateCommunity(
				communityManagerA.address,
				zeroAddress,
				newcommunityAdminInstance.address
			)
		).to.be.rejectedWith("NOT_VALID");
	});

	it("should not be able to migrate community if not admin", async () => {
		const newcommunityAdminInstance = await CommunityAdmin.deploy(
			cUSDInstance.address,
			communityMinTranche,
			communityMaxTranche
		);
		await expect(
			communityAdminInstance.connect(adminAccount2).migrateCommunity(
				communityManagerA.address,
				cUSDInstance.address, // wrong on purpose,
				newcommunityAdminInstance.address
			)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	// it("should be able to edit community if manager", async () => {
	// 	(await communityInstance.incrementInterval()).should.be.equal(
	// 		hour.toString()
	// 	);
	// 	await communityInstance
	// 		.connect(communityManagerA)
	// 		.edit(
	// 			claimAmountTwo.toString(),
	// 			maxClaimTen.toString(),
	// 			oneCent.toString(),
	// 			week.toString(),
	// 			day.toString()
	// 		);
	// 	(await communityInstance.incrementInterval()).should.be.equal(
	// 		day.toString()
	// 	);
	// });
	//
	// it("should not be able edit community if not manager", async () => {
	// 	await expect(
	// 		communityInstance
	// 			.connect(communityManagerB)
	// 			.edit(
	// 				claimAmountTwo.toString(),
	// 				maxClaimTen.toString(),
	// 				oneCent.toString(),
	// 				day.toString(),
	// 				day.toString()
	// 			)
	// 	).to.be.rejectedWith("NOT_MANAGER");
	// });

	it("should not be able edit community with invalid values", async () => {
		await expect(
			communityInstance
				.connect(communityManagerA)
				.edit(
					claimAmountTwo.toString(),
					maxClaimTen.toString(),
					oneCent.toString(),
					day.toString(),
					week.toString()
				)
		).to.be.rejected;
		await expect(
			communityInstance.connect(communityManagerA).edit(
				maxClaimTen, // supposed to be wrong
				claimAmountTwo,
				week,
				day
			)
		).to.be.rejected;
	});

	it("should not be able to add manager to community if not manager", async () => {
		await expect(
			communityInstance
				.connect(communityManagerC)
				.addManager(communityManagerB.address)
		).to.be.rejectedWith("NOT_MANAGER");
	});

	it("should not be able to remove manager from community if not manager", async () => {
		await communityInstance
			.connect(communityManagerA)
			.addManager(communityManagerB.address);
		await expect(
			communityInstance
				.connect(communityManagerC)
				.removeManager(communityManagerB.address)
		).to.be.rejectedWith("NOT_MANAGER");
	});

	it("should be able to add manager to community if manager", async () => {
		await expect(
			communityInstance
				.connect(communityManagerA)
				.addManager(communityManagerB.address)
		).to.be.fulfilled;
	});

	it("should be able to remove manager to community if manager", async () => {
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

	it("should be able to renounce from manager of community if manager", async () => {
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

	it("should be able to lock community if manager", async () => {
		await expect(communityInstance.connect(communityManagerA).lock())
			.to.emit(communityInstance, "CommunityLocked")
			.withArgs(communityManagerA.address);
	});

	it("should be able to lock community if manager", async () => {
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

	it("should be able to add a community if admin", async () => {
		await cUSDInstance.mint(
			treasuryInstance.address,
			mintAmount.toString()
		);

		const tx = await communityAdminInstance.addCommunity(
			communityManagerA.address,
			claimAmountTwo.toString(),
			maxClaimTen.toString(),
			day.toString(),
			hour.toString()
		);

		let receipt = await tx.wait();

		const communityAddress = receipt.events?.filter((x: any) => {
			return x.event == "CommunityAdded";
		})[0]["args"]["_communityAddress"];
		communityInstance = await Community.attach(communityAddress);

		(await communityInstance.baseInterval())
			.toString()
			.should.be.equal("86400");
		(await communityInstance.incrementInterval())
			.toString()
			.should.be.equal("3600");
		(await communityInstance.maxClaim()).should.be.equal(maxClaimTen);
	});

	it("should be able to remove a community if admin", async () => {
		await cUSDInstance.mint(
			treasuryInstance.address,
			mintAmount.toString()
		);

		const tx = await communityAdminInstance.addCommunity(
			communityManagerA.address,
			claimAmountTwo.toString(),
			maxClaimTen.toString(),
			day.toString(),
			hour.toString()
		);

		let receipt = await tx.wait();

		const communityAddress = receipt.events?.filter((x: any) => {
			return x.event == "CommunityAdded";
		})[0]["args"]["_communityAddress"];
		communityInstance = await Community.attach(communityAddress);

		await communityAdminInstance.removeCommunity(communityAddress);
	});

	it("should not be able to create a community with invalid values", async () => {
		await expect(
			communityAdminInstance.addCommunity(
				communityManagerA.address,
				claimAmountTwo.toString(),
				maxClaimTen.toString(),
				hour.toString(),
				day.toString()
			)
		).to.be.rejected;
		await expect(
			communityAdminInstance.addCommunity(
				communityManagerA.address,
				maxClaimTen.toString(), // it's supposed to be wrong!
				claimAmountTwo.toString(),
				day.toString(),
				hour.toString()
			)
		).to.be.rejected;
	});
});

describe("Chaos test (complete flow)", async () => {
	// add community
	const addCommunity = async (
		communityManager: SignerWithAddress
	): Promise<ethersTypes.Contract> => {
		const tx = await communityAdminInstance.addCommunity(
			communityManager.address,
			claimAmountTwo.toString(),
			maxClaimTen.toString(),
			day.toString(),
			hour.toString()
		);

		let receipt = await tx.wait();

		const communityAddress = receipt.events?.filter((x: any) => {
			return x.event == "CommunityAdded";
		})[0]["args"]["_communityAddress"];
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
		const creationTime = block.timestamp; // Block is null, so this fails.

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
		await network.provider.send("evm_increaseTime", [waitIs + 5]);
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

	it("should be able to get funds if manager", async () => {
		await expect(
			communityInstance.connect(communityManagerA).requestFunds()
		).to.be.fulfilled;
	});

	it("should not be able to get funds if not manager", async () => {
		await expect(
			communityInstance.connect(beneficiaryA).requestFunds()
		).to.be.rejectedWith("Community: NOT_MANAGER");
	});

	it("should not be able to change communityMinTranche if not admin", async () => {
		await expect(
			communityAdminInstance
				.connect(communityManagerA)
				.setCommunityMinTranche(parseEther("123"))
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("should be able to change communityMinTranche if admin", async () => {
		await expect(
			communityAdminInstance
				.connect(adminAccount1)
				.setCommunityMinTranche(parseEther("123"))
		).to.be.fulfilled;

		expect(await communityAdminInstance.communityMinTranche()).to.be.equal(
			parseEther("123")
		);
	});

	it("should not be able to change communityMaxTranche if not admin", async () => {
		await expect(
			communityAdminInstance
				.connect(communityManagerA)
				.setCommunityMaxTranche(parseEther("123"))
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("should be able to change communityMaxTranche if admin", async () => {
		await expect(
			communityAdminInstance
				.connect(adminAccount1)
				.setCommunityMaxTranche(parseEther("1234"))
		).to.be.fulfilled;

		expect(await communityAdminInstance.communityMaxTranche()).to.be.equal(
			parseEther("1234")
		);
	});

	it("should not be able to set communityMinTranche greater than communityMaxTranche", async () => {
		await expect(
			communityAdminInstance
				.connect(adminAccount1)
				.setCommunityMinTranche(parseEther("50"))
		).to.be.fulfilled;

		await expect(
			communityAdminInstance
				.connect(adminAccount1)
				.setCommunityMaxTranche(parseEther("100"))
		).to.be.fulfilled;

		await expect(
			communityAdminInstance
				.connect(adminAccount1)
				.setCommunityMinTranche(parseEther("200"))
		).to.be.rejectedWith(
			"CommunityAdmin::setCommunityMinTranche: New communityMinTranche should be less then communityMaxTranche"
		);

		expect(await communityAdminInstance.communityMinTranche()).to.be.equal(
			parseEther("50")
		);
		expect(await communityAdminInstance.communityMaxTranche()).to.be.equal(
			parseEther("100")
		);
	});

	it("should not be able to set communityMaxTranche less than communityMinTranche", async () => {
		await expect(
			communityAdminInstance
				.connect(adminAccount1)
				.setCommunityMinTranche(parseEther("50"))
		).to.be.fulfilled;

		await expect(
			communityAdminInstance
				.connect(adminAccount1)
				.setCommunityMaxTranche(parseEther("100"))
		).to.be.fulfilled;

		await expect(
			communityAdminInstance
				.connect(adminAccount1)
				.setCommunityMaxTranche(parseEther("25"))
		).to.be.rejectedWith(
			"CommunityAdmin::setCommunityMaxTranche: New communityMaxTranche should be greater then communityMinTranche"
		);

		expect(await communityAdminInstance.communityMinTranche()).to.be.equal(
			parseEther("50")
		);
		expect(await communityAdminInstance.communityMaxTranche()).to.be.equal(
			parseEther("100")
		);
	});

	it("should not be able to deploy CommunityAdmin with communityMaxTranche less than communityMinTranche", async () => {
		await expect(
			CommunityAdmin.deploy(
				cUSDInstance.address,
				communityMaxTranche,
				communityMinTranche
			)
		).to.be.rejectedWith(
			"CommunityAdmin::constructor: communityMinTranche should be less then communityMaxTranche"
		);
	});

	it("should transfer funds to community", async () => {
		expect(
			await cUSDInstance.balanceOf(communityInstance.address)
		).to.be.equal(communityMinTranche);
		await expect(
			communityInstance.connect(communityManagerA).requestFunds()
		).to.be.fulfilled;
		expect(
			await cUSDInstance.balanceOf(communityInstance.address)
		).to.be.equal(communityMinTranche.mul(2));
	});

	it("should be able to donate directly in the community", async () => {
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

	it("should not be able to requestFunds if you have more then communityMinTranche", async () => {
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

	it("should be able to transfer funds if admin", async () => {
		const userInitialBalance = await cUSDInstance.balanceOf(
			adminAccount1.address
		);
		const communityInitialBalance = await cUSDInstance.balanceOf(
			communityInstance.address
		);
		await expect(
			communityAdminInstance.transferFromCommunity(
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

	it("should be able get more funds if have private donations", async () => {
		const user1Donation = parseEther("5000");

		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);

		await cUSDInstance.mint(adminAccount1.address, user1Donation);
		await cUSDInstance.approve(communityInstance.address, user1Donation);
		await communityInstance.donate(adminAccount1.address, user1Donation);

		await communityAdminInstance.transferFromCommunity(
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
		).to.be.equal(parseEther("356.231407035175879396"));
	});
});
