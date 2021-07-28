// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
import { should } from "chai";
import BigNumber from "bignumber.js";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// @ts-ignore
import { ethers, network, waffle } from "hardhat";
import type * as ethersTypes from "ethers";
import {DeployFunction} from 'hardhat-deploy/types';

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
let CommunityFactory: ethersTypes.ContractFactory;
let CommunityAdmin: ethersTypes.ContractFactory;
let Token: ethersTypes.ContractFactory;

// contract instances
let communityInstance: ethersTypes.Contract;
let communityFactoryInstance: ethersTypes.Contract;
let communityAdminInstance: ethersTypes.Contract;
let cUSDInstance: ethersTypes.Contract;

BigNumber.config({ EXPONENTIAL_AT: 25 });

const bigNum = (num: number) => num + "0".repeat(18);

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
	CommunityFactory = await ethers.getContractFactory("CommunityFactory");
	CommunityAdmin = await ethers.getContractFactory("CommunityAdmin");
	Token = await ethers.getContractFactory("TokenMock");
}

// constants
const decimals = new BigNumber(10).pow(18);
const hour = time.duration.hours(1);
const day = time.duration.days(1);
const week = time.duration.weeks(1);
// const month = time.duration.days(30);
const claimAmountTwo = new BigNumber(bigNum(2));
const maxClaimTen = new BigNumber(bigNum(10));
const fiveCents = new BigNumber("50000000000000000");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const mintAmount = new BigNumber("500000000000000000000");

describe("Community - Beneficiary", () => {
	before(async function () {
		await init();
	});

	beforeEach(async () => {
		cUSDInstance = await Token.deploy("cUSD", "cUSD");
		communityAdminInstance = await CommunityAdmin.deploy(cUSDInstance.address, adminAccount1.address);
		communityFactoryInstance = await CommunityFactory.deploy(cUSDInstance.address, communityAdminInstance.address);
		await communityAdminInstance.setCommunityFactory(communityFactoryInstance.address);


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
		await cUSDInstance.mint(communityAddress, mintAmount.toString());
	});

	it("should be able to add beneficiary to community", async () => {
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address))
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
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
		await communityInstance
			.connect(communityManagerA)
			.lockBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.Locked);
	});

	it("should not be able to lock an invalid beneficiary from community", async () => {
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await expect(
			communityInstance
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address)
		).to.be.rejectedWith("NOT_YET");
	});

	it("should be able to unlock locked beneficiary from community", async () => {
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
		await communityInstance
			.connect(communityManagerA)
			.lockBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.Locked);
		await communityInstance
			.connect(communityManagerA)
			.unlockBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
	});

	it("should not be able to unlock a not locked beneficiary from community", async () => {
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
		await expect(
			communityInstance
				.connect(communityManagerA)
				.unlockBeneficiary(beneficiaryA.address)
		).to.be.rejectedWith("NOT_YET");
	});

	it("should be able to remove beneficiary from community", async () => {
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.NONE);
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
		await communityInstance
			.connect(communityManagerA)
			.removeBeneficiary(beneficiaryA.address);
		(await communityInstance.beneficiaries(beneficiaryA.address))
			.toString()
			.should.be.equal(BeneficiaryState.Removed);
	});
});


describe("Community - Claim", () => {
	before(async function () {
		await init();
	});

	beforeEach(async () => {
		cUSDInstance = await Token.deploy("cUSD", "cUSD");
		communityAdminInstance = await CommunityAdmin.deploy(cUSDInstance.address, adminAccount1.address);
		communityFactoryInstance = await CommunityFactory.deploy(cUSDInstance.address, communityAdminInstance.address);
		await communityAdminInstance.setCommunityFactory(communityFactoryInstance.address);

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
		await cUSDInstance.mint(communityAddress, mintAmount.toString());
		await communityInstance
			.connect(communityManagerA)
			.addBeneficiary(beneficiaryA.address);
	});

	it("should return correct lastInterval values", async () => {
		const baseInterval = (await communityInstance.baseInterval()).toNumber();
		const incrementInterval = (await communityInstance.incrementInterval()).toNumber();

		expect(await communityInstance.lastInterval(beneficiaryA.address)).to.be.equal(0);
		await communityInstance.connect(beneficiaryA).claim();
		expect(await communityInstance.lastInterval(beneficiaryA.address)).to.be.equal(baseInterval);
		await network.provider.send("evm_increaseTime", [baseInterval]);
		await communityInstance.connect(beneficiaryA).claim();
		expect(await communityInstance.lastInterval(beneficiaryA.address)).to.be.equal(baseInterval + incrementInterval);
		await network.provider.send("evm_increaseTime", [incrementInterval]);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be.rejectedWith("NOT_YET");
		expect(await communityInstance.lastInterval(beneficiaryA.address)).to.be.equal(baseInterval + incrementInterval);
		await network.provider.send("evm_increaseTime", [baseInterval + incrementInterval]);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be.fulfilled;
		expect(await communityInstance.lastInterval(beneficiaryA.address)).to.be.equal(baseInterval + 2 * incrementInterval);
		await network.provider.send("evm_increaseTime", [baseInterval + incrementInterval]);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be.rejectedWith("NOT_YET");
		expect(await communityInstance.lastInterval(beneficiaryA.address)).to.be.equal(baseInterval + 2 * incrementInterval);
		await network.provider.send("evm_increaseTime", [baseInterval + 2 * incrementInterval]);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be.fulfilled;
	});

	it("should not claim without belong to community", async () => {
		await expect(
			communityInstance.connect(beneficiaryB).claim()
		).to.be.rejectedWith("NOT_BENEFICIARY");
	});

	it("should not claim after locked from community", async () => {
		await communityInstance
			.connect(communityManagerA)
			.lockBeneficiary(beneficiaryA.address);
		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("LOCKED");
	});

	it("should not claim after removed from community", async () => {
		await communityInstance
			.connect(communityManagerA)
			.removeBeneficiary(beneficiaryA.address);
		await expect(
			communityInstance.connect(beneficiaryA).claim()
		).to.be.rejectedWith("REMOVED");
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
		const baseInterval = (await communityInstance.baseInterval()).toNumber();
		const incrementInterval = (await communityInstance.incrementInterval()).toNumber();
		await communityInstance.connect(beneficiaryA).claim();
		await network.provider.send("evm_increaseTime", [baseInterval]);
		await communityInstance.connect(beneficiaryA).claim();
		await network.provider.send("evm_increaseTime", [incrementInterval]);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be.rejectedWith("NOT_YET");
		await network.provider.send("evm_increaseTime", [baseInterval + incrementInterval]);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be.fulfilled;
		await network.provider.send("evm_increaseTime", [baseInterval + incrementInterval]);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be.rejectedWith("NOT_YET");
		await network.provider.send("evm_increaseTime", [baseInterval + 2 * incrementInterval]);
		await expect(communityInstance.connect(beneficiaryA).claim()).to.be.fulfilled;
	});

	it("should claim after waiting", async () => {
		const baseInterval = (
			await communityInstance.baseInterval()
		).toNumber();
		await network.provider.send("evm_increaseTime", [baseInterval + 5]);
		await communityInstance.connect(beneficiaryA).claim();
		(await cUSDInstance.balanceOf(beneficiaryA.address))
			.toString()
			.should.be.equal(claimAmountTwo.plus(fiveCents).toString());
	});

	it("should not claim after max claim", async () => {
		const baseInterval = (
			await communityInstance.baseInterval()
		).toNumber();
		const incrementInterval = (
			await communityInstance.incrementInterval()
		).toNumber();
		const claimAmount = new BigNumber(
			(await communityInstance.claimAmount()).toString()
		)
			.div(decimals)
			.toNumber();
		const maxClaimAmount = new BigNumber(
			(await communityInstance.maxClaim()).toString()
		)
			.div(decimals)
			.toNumber();
		await communityInstance.connect(beneficiaryA).claim();
		for (let index = 0; index < maxClaimAmount / claimAmount - 1; index++) {
			await network.provider.send("evm_increaseTime", [
				baseInterval + incrementInterval * index + 5,
			]);
			await communityInstance.connect(beneficiaryA).claim();
		}
		await network.provider.send("evm_increaseTime", [
			baseInterval +
				incrementInterval * (maxClaimAmount / claimAmount) +
				5,
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
		cUSDInstance = await Token.deploy("cUSD", "cUSD");
		communityAdminInstance = await CommunityAdmin.deploy(cUSDInstance.address, adminAccount1.address);
		communityFactoryInstance = await CommunityFactory.deploy(cUSDInstance.address, communityAdminInstance.address);
		await communityAdminInstance.setCommunityFactory(communityFactoryInstance.address);

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
	});

	it("should be able to migrate funds from community if CommunityAdmin", async () => {
		const previousCommunityPreviousBalance = await cUSDInstance.balanceOf(
			communityInstance.address
		);
		const newCommunityFactoryInstance = await CommunityFactory.deploy(
			cUSDInstance.address,
			communityAdminInstance.address
		);

		const newTx = await communityAdminInstance.migrateCommunity(
			communityManagerA.address,
			communityInstance.address,
			newCommunityFactoryInstance.address
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
		previousCommunityPreviousBalance
			.toString()
			.should.be.equal(newCommunityNewBalance.toString());
		previousCommunityNewBalance.toString().should.be.equal("0");
	});

	it("should not be able to migrate from invalid community", async () => {
		const newcommunityAdminInstance = await CommunityAdmin.deploy(
			cUSDInstance.address,
			adminAccount1.address
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
			adminAccount1.address
		);
		await expect(
			communityAdminInstance.connect(adminAccount2).migrateCommunity(
				communityManagerA.address,
				cUSDInstance.address, // wrong on purpose,
				newcommunityAdminInstance.address
			)
		).to.be.rejectedWith("NOT_ADMIN");
	});

	it("should be able edit community if manager", async () => {
		(await communityInstance.incrementInterval())
			.toString()
			.should.be.equal(hour.toString());
		await communityInstance
			.connect(communityManagerA)
			.edit(
				claimAmountTwo.toString(),
				maxClaimTen.toString(),
				week.toString(),
				day.toString()
			);
		(await communityInstance.incrementInterval())
			.toString()
			.should.be.equal(day.toString());
	});

	it("should not be able edit community if not manager", async () => {
		await expect(
			communityInstance
				.connect(communityManagerB)
				.edit(
					claimAmountTwo.toString(),
					maxClaimTen.toString(),
					day.toString(),
					day.toString()
				)
		).to.be.rejectedWith("NOT_MANAGER");
	});

	it("should not be able edit community with invalid values", async () => {
		await expect(
			communityInstance
				.connect(communityManagerA)
				.edit(
					claimAmountTwo.toString(),
					maxClaimTen.toString(),
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
		cUSDInstance = await Token.deploy("cUSD", "cUSD");
		communityAdminInstance = await CommunityAdmin.deploy(cUSDInstance.address, adminAccount1.address);
		communityFactoryInstance = await CommunityFactory.deploy(cUSDInstance.address, communityAdminInstance.address);
		await communityAdminInstance.setCommunityFactory(communityFactoryInstance.address);
	});

	it("should be able to add a community if admin", async () => {
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
		(await communityInstance.maxClaim())
			.toString()
			.should.be.equal(maxClaimTen.toString());
	});

	it("should be able to remove a community if admin", async () => {
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

		(await instance.beneficiaries(beneficiaryAddress.address))
			.toString()
			.should.be.equal(BeneficiaryState.Valid);
		(await instance.cooldown(beneficiaryAddress.address))
			.toNumber()
			.should.be.equal(creationTime);
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
		const previousBalance = new BigNumber(
			await cUSDInstance.balanceOf(beneficiaryAddress.address)
		);
		const previousLastInterval = new BigNumber(
			await instance.lastInterval(beneficiaryAddress.address)
		);
		await instance.connect(beneficiaryAddress).claim();
		const currentBalance = new BigNumber(
			await cUSDInstance.balanceOf(beneficiaryAddress.address)
		);
		const currentLastInterval = new BigNumber(
			await instance.lastInterval(beneficiaryAddress.address)
		);
		previousBalance
			.plus(await instance.claimAmount())
			.toString()
			.should.be.equal(currentBalance.toString());
		// previousLastInterval
		// 	.plus(await instance.incrementInterval())
		// 	.toString()
		// 	.should.be.equal(currentLastInterval.toString());
	};

	before(async function () {
		await init();
	});
	beforeEach(async () => {
		cUSDInstance = await Token.deploy("cUSD", "cUSD");
		communityAdminInstance = await CommunityAdmin.deploy(
			cUSDInstance.address,
			adminAccount1.address
		);
		communityFactoryInstance = await CommunityFactory.deploy(
			cUSDInstance.address,
			communityAdminInstance.address
		);
		await communityAdminInstance.setCommunityFactory(
			communityFactoryInstance.address
		);
	});

	it("one beneficiary to one community", async () => {
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
		const communityInstanceA = await addCommunity(communityManagerA);
		const previousCommunityBalance = new BigNumber(
			(
				await cUSDInstance.balanceOf(communityInstanceA.address)
			).toString()
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
		const claimAmount = new BigNumber(
			(await communityInstanceA.claimAmount()).toString()
		)
			.div(decimals)
			.toNumber();
		const maxClaimAmount = new BigNumber(
			(await communityInstanceA.maxClaim()).toString()
		)
			.div(decimals)
			.toNumber();
		const maxClaimsPerUser = maxClaimAmount / claimAmount;
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
		const currentCommunityBalance = new BigNumber(
			(
				await cUSDInstance.balanceOf(communityInstanceA.address)
			).toString()
		);
		previousCommunityBalance
			.minus(currentCommunityBalance)
			.toString()
			.should.be.equal(
				new BigNumber(claimAmount * (5 + maxClaimsPerUser))
					.multipliedBy(decimals)
					.plus(4 * fiveCents.toNumber())
					.toString()
			);
	});

	it("many beneficiaries to many communities", async () => {
		// community A
		const communityInstanceA = await addCommunity(communityManagerA);
		const communityInstanceB = await addCommunity(communityManagerB);
		const previousCommunityBalanceA = new BigNumber(
			(
				await cUSDInstance.balanceOf(communityInstanceA.address)
			).toString()
		);
		const previousCommunityBalanceB = new BigNumber(
			(
				await cUSDInstance.balanceOf(communityInstanceB.address)
			).toString()
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
		const claimAmountA = new BigNumber(
			(await communityInstanceA.claimAmount()).toString()
		)
			.div(decimals)
			.toNumber();
		const maxClaimAmountA = new BigNumber(
			(await communityInstanceA.maxClaim()).toString()
		)
			.div(decimals)
			.toNumber();
		const maxClaimsPerUserA = maxClaimAmountA / claimAmountA;
		for (let index = 0; index < maxClaimsPerUserA; index++) {
			await waitClaimTime(communityInstanceA, beneficiaryB);
			await beneficiaryClaim(communityInstanceA, beneficiaryB);
		}
		// beneficiary C claims it all
		const claimAmountB = new BigNumber(
			(await communityInstanceB.claimAmount()).toString()
		)
			.div(decimals)
			.toNumber();
		const maxClaimAmountB = new BigNumber(
			(await communityInstanceB.maxClaim()).toString()
		)
			.div(decimals)
			.toNumber();
		const maxClaimsPerUserB = maxClaimAmountB / claimAmountB;
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
		const currentCommunityBalanceA = new BigNumber(
			(
				await cUSDInstance.balanceOf(communityInstanceA.address)
			).toString()
		);
		previousCommunityBalanceA
			.minus(currentCommunityBalanceA)
			.toString()
			.should.be.equal(
				new BigNumber(claimAmountA * (3 + maxClaimsPerUserA))
					.multipliedBy(decimals)
					.plus(2 * fiveCents.toNumber())
					.toString()
			);
		const currentCommunityBalanceB = new BigNumber(
			(
				await cUSDInstance.balanceOf(communityInstanceB.address)
			).toString()
		);
		previousCommunityBalanceB
			.minus(currentCommunityBalanceB)
			.toString()
			.should.be.equal(
				new BigNumber(claimAmountB * (4 + maxClaimsPerUserB))
					.multipliedBy(decimals)
					.plus(2 * fiveCents.toNumber())
					.toString()
			);
	});
});
