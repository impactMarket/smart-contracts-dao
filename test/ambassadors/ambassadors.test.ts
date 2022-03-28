// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import { ethers, deployments } from "hardhat";
import type * as ethersTypes from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";
import { advanceBlockNTimes } from "../utils/TimeTravel";

chai.use(chaiAsPromised);

const expect = chai.expect;

let user1: SignerWithAddress;
// ambassadors entity
let communityManager1: SignerWithAddress;
let ambassadorsEntityA: SignerWithAddress;
let ambassadorsEntityB: SignerWithAddress;
// ambassadors
let ambassador1: SignerWithAddress;
let ambassador2: SignerWithAddress;
let ambassador3: SignerWithAddress;

let Community: ethersTypes.ContractFactory;
let OldCommunity: ethersTypes.ContractFactory;

let communityInstance: ethersTypes.Contract;
let newCommunityInstance: ethersTypes.Contract;
let oldCommunityInstance: ethersTypes.Contract;
let communityAdminProxy: ethersTypes.Contract;
let treasuryInstance: ethersTypes.Contract;
let cUSDInstance: ethersTypes.Contract;
let impactProxyAdmin: ethersTypes.Contract;
let ambassadors: ethersTypes.Contract;

async function init() {
	const accounts: SignerWithAddress[] = await ethers.getSigners();

	communityManager1 = accounts[0];
	user1 = accounts[1];
	ambassadorsEntityA = accounts[2];
	ambassadorsEntityB = accounts[3];
	ambassador1 = accounts[4];
	ambassador2 = accounts[5];
	ambassador3 = accounts[6];

	Community = await ethers.getContractFactory("Community");
}

async function deploy() {
	await deployments.fixture("Test", { fallbackToGlobal: false });

	const cUSD = await deployments.get("TokenMock");
	cUSDInstance = await ethers.getContractAt("TokenMock", cUSD.address);

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");
	impactProxyAdmin = await ethers.getContractAt(
		"ImpactProxyAdmin",
		ImpactProxyAdmin.address
	);

	const communityAdmin = await deployments.get("CommunityAdminProxy");
	communityAdminProxy = await ethers.getContractAt(
		"CommunityAdminImplementationOld",
		communityAdmin.address
	);

	const treasury = await deployments.get("TreasuryProxy");
	treasuryInstance = await ethers.getContractAt(
		"TreasuryImplementation",
		treasury.address
	);

	const CommunityAdminImplementationOld = await deployments.get(
		"CommunityAdminImplementationOld"
	);
	const CommunityAdminImplementation = await deployments.get(
		"CommunityAdminImplementation"
	);
	expect(
		await impactProxyAdmin.getProxyImplementation(
			communityAdminProxy.address
		)
	).to.be.equal(CommunityAdminImplementationOld.address);
	await expect(
		impactProxyAdmin.upgrade(
			communityAdminProxy.address,
			CommunityAdminImplementation.address
		)
	).to.be.fulfilled;
	expect(
		await impactProxyAdmin.getProxyImplementation(
			communityAdminProxy.address
		)
	).to.be.equal(CommunityAdminImplementation.address);

	communityAdminProxy = await ethers.getContractAt(
		"CommunityAdminImplementation",
		communityAdminProxy.address
	);

	const UBICommitteeProxy = await deployments.get("UBICommitteeProxy");
	const AmbassadorsProxy = await deployments.get("AmbassadorsProxy");

	await communityAdminProxy.updateUbiCommittee(UBICommitteeProxy.address);
	await communityAdminProxy.updateAmbassadors(AmbassadorsProxy.address);

	ambassadors = await ethers.getContractAt(
		"AmbassadorsImplementation",
		AmbassadorsProxy.address
	);

	const mintAmount = parseEther("10000");
	await cUSDInstance.mint(treasuryInstance.address, mintAmount.toString());
}

async function addDefaultCommunity() {
	const oneMinuteInBlocks = 12;
	const threeMinutesInBlocks = 36;
	const claimAmountTwo = parseEther("2");
	const maxClaimTen = parseEther("10");
	const oneCent = parseEther("0.01");
	const communityMinTranche = parseEther("100");
	const communityMaxTranche = parseEther("5000");
	const tx = await communityAdminProxy.addCommunity(
		[communityManager1.address],
		ambassador1.address,
		claimAmountTwo,
		maxClaimTen,
		oneCent,
		threeMinutesInBlocks,
		oneMinuteInBlocks,
		communityMinTranche,
		communityMaxTranche
	);

	let receipt = await tx.wait();

	const communityAddress = receipt.events?.filter((x: any) => {
		return x.event == "CommunityAdded";
	})[0]["args"]["communityAddress"];
	communityInstance = await Community.attach(communityAddress);
}

describe("Ambassadors", function () {
	before(async function () {
		await init();
	});

	beforeEach(async () => {
		await deploy();
		// await addDefaultCommunity();
	});

	it("should be able to add an entity if admin", async () => {
		await expect(ambassadors.addEntity(ambassadorsEntityA.address)).to.be
			.fulfilled;
	});

	it("should be able to remove an entity if admin", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await expect(ambassadors.removeEntity(ambassadorsEntityA.address)).to.be
			.fulfilled;
	});

	it("should not be able to add an entity if not admin", async () => {
		await expect(
			ambassadors.connect(user1).addEntity(ambassadorsEntityA.address)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("should not be able to remove an entity if not admin", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await expect(
			ambassadors.connect(user1).removeEntity(ambassadorsEntityA.address)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("should not be able to add existing account as entity", async () => {
		await expect(ambassadors.addEntity(ambassadorsEntityA.address)).to.be
			.fulfilled;
		await expect(
			ambassadors.addEntity(ambassadorsEntityA.address)
		).to.be.rejectedWith("Ambassador:: ALREADY_ENTITY");
	});

	it("should not be able to remove non existing entity", async () => {
		await expect(
			ambassadors.removeEntity(ambassadorsEntityA.address)
		).to.be.rejectedWith("Ambassador:: NOT_ENTITY");
	});

	it("should not be able to remove entity with ambassadors", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.addAmbassador(ambassador1.address)
		).to.be.fulfilled;
		await expect(
			ambassadors.removeEntity(ambassadorsEntityA.address)
		).to.be.rejectedWith("Ambassador:: HAS_AMBASSADORS");
	});

	it("should be able to replace entity account if entity", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		const entityIndex = await ambassadors.entityByAddress(
			ambassadorsEntityA.address
		);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.replaceEntityAccount(
					ambassadorsEntityA.address,
					ambassadorsEntityB.address
				)
		).to.be.fulfilled;
		const newEntityAddress = await ambassadors.entityByIndex(entityIndex);
		expect(newEntityAddress).to.be.equal(ambassadorsEntityB.address);
	});

	it("should be able to replace entity account if admin", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		const entityIndex = await ambassadors.entityByAddress(
			ambassadorsEntityA.address
		);
		await expect(
			ambassadors.replaceEntityAccount(
				ambassadorsEntityA.address,
				ambassadorsEntityB.address
			)
		).to.be.fulfilled;
		const newEntityAddress = await ambassadors.entityByIndex(entityIndex);
		expect(newEntityAddress).to.be.equal(ambassadorsEntityB.address);
	});

	it("should be able to replace entity account if not allowed", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await expect(
			ambassadors
				.connect(ambassadorsEntityB)
				.replaceEntityAccount(
					ambassadorsEntityA.address,
					ambassadorsEntityB.address
				)
		).to.be.rejectedWith("Ambassador:: NOT_ALLOWED");
	});

	it("should be able to replace entity account if not entity", async () => {
		await expect(
			ambassadors.replaceEntityAccount(
				ambassadorsEntityA.address,
				ambassadorsEntityB.address
			)
		).to.be.rejectedWith("Ambassador:: NOT_ENTITY");
	});

	it("should be able to add ambassador if entity", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.addAmbassador(ambassador1.address)
		).to.be.fulfilled;
	});

	it("should be able to remove ambassador from entity", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.removeAmbassador(ambassador1.address)
		).to.be.fulfilled;
	});

	it("should not be able to add ambassador twice", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.addAmbassador(ambassador1.address)
		).to.be.rejectedWith("Ambassador:: ALREADY_AMBASSADOR");
	});

	it("should not be able to add ambassador if not entity", async () => {
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.addAmbassador(ambassador1.address)
		).to.be.rejectedWith("Ambassador:: ONLY_ENTITY");
	});

	it("should not be able to remove ambassador if not ambassador", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.removeAmbassador(ambassador1.address)
		).to.be.rejectedWith("Ambassador:: NOT_AMBASSADOR");
	});

	it("should not be able to remove ambassador if not entity", async () => {
		await ambassadors.addEntity(ambassadorsEntityB.address);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.removeAmbassador(ambassador1.address)
		).to.be.rejectedWith("Ambassador:: ONLY_ENTITY");
	});

	it("should not be able to remove ambassador on other entities", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors.addEntity(ambassadorsEntityB.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await expect(
			ambassadors
				.connect(ambassadorsEntityB)
				.removeAmbassador(ambassador1.address)
		).to.be.rejectedWith("Ambassador:: NOT_AMBASSADOR");
	});

	xit("should not be able to remove ambassador with communities", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await addDefaultCommunity();
		await communityAdminProxy.setCommunityToAmbassador(
			ambassador1.address,
			communityInstance.address
		);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.removeAmbassador(ambassador1.address)
		).to.be.rejectedWith("Ambassador:: HAS_COMMUNITIES");
	});
});
