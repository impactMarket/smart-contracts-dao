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
		"CommunityAdminImplementation",
		communityAdmin.address
	);

	const treasury = await deployments.get("TreasuryProxy");
	treasuryInstance = await ethers.getContractAt(
		"TreasuryImplementation",
		treasury.address
	);

	// const CommunityAdminImplementationOld = await deployments.get(
	// 	"CommunityAdminImplementationOld"
	// );
	// const CommunityAdminImplementation = await deployments.get(
	// 	"CommunityAdminImplementation"
	// );
	// expect(
	// 	await impactProxyAdmin.getProxyImplementation(
	// 		communityAdminProxy.address
	// 	)
	// ).to.be.equal(CommunityAdminImplementationOld.address);
	// await expect(
	// 	impactProxyAdmin.upgrade(
	// 		communityAdminProxy.address,
	// 		CommunityAdminImplementation.address
	// 	)
	// ).to.be.fulfilled;
	// expect(
	// 	await impactProxyAdmin.getProxyImplementation(
	// 		communityAdminProxy.address
	// 	)
	// ).to.be.equal(CommunityAdminImplementation.address);

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

async function addDefaultCommunity(
	ambassadorAddress: string = ambassador1.address
) {
	const oneMinuteInBlocks = 12;
	const threeMinutesInBlocks = 36;
	const claimAmountTwo = parseEther("2");
	const maxClaimTen = parseEther("10");
	const oneCent = parseEther("0.01");
	const communityMinTranche = parseEther("100");
	const communityMaxTranche = parseEther("5000");
	const tx = await communityAdminProxy.addCommunity(
		[communityManager1.address],
		ambassadorAddress,
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

	// removeAmbassador

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

	it("should not be able to remove ambassador with communities", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await addDefaultCommunity();
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.removeAmbassador(ambassador1.address)
		).to.be.rejectedWith("Ambassador:: HAS_COMMUNITIES");
	});

	// replaceAmbassadorAccount

	it("should be able to replace ambassador account if ambassador", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await addDefaultCommunity();
		const previousAmbassadorAddress = await ambassadors.ambassadorByAddress(
			ambassador1.address
		);
		await expect(
			ambassadors
				.connect(ambassador1)
				.replaceAmbassadorAccount(
					ambassador1.address,
					ambassador2.address
				)
		).to.be.fulfilled;
		const newAmbassadorAddress = await ambassadors.ambassadorByAddress(
			ambassador2.address
		);
		expect(previousAmbassadorAddress).to.be.equal(newAmbassadorAddress);
	});

	it("should be able to replace ambassador account if owner", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await addDefaultCommunity();
		const previousAmbassadorAddress = await ambassadors.ambassadorByAddress(
			ambassador1.address
		);
		await expect(
			ambassadors.replaceAmbassadorAccount(
				ambassador1.address,
				ambassador2.address
			)
		).to.be.fulfilled;
		const newAmbassadorAddress = await ambassadors.ambassadorByAddress(
			ambassador2.address
		);
		expect(previousAmbassadorAddress).to.be.equal(newAmbassadorAddress);
	});

	it("should not be able to replace ambassador account if new account is ambassador", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador2.address);
		await addDefaultCommunity();
		await expect(
			ambassadors.replaceAmbassadorAccount(
				ambassador1.address,
				ambassador2.address
			)
		).to.be.rejectedWith("Ambassador:: ALREADY_AMBASSADOR");
	});

	// replaceAmbassador

	it("should be able to replace ambassador if entity", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await addDefaultCommunity();
		const previousAmbassadorAddress = await ambassadors.ambassadorByAddress(
			ambassador1.address
		);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.replaceAmbassador(ambassador1.address, ambassador2.address)
		).to.be.fulfilled;
		const newAmbassadorAddress = await ambassadors.ambassadorByAddress(
			ambassador2.address
		);
		expect(previousAmbassadorAddress).to.be.equal(newAmbassadorAddress);
	});

	it("should be able to replace ambassador if owner", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await addDefaultCommunity();
		const previousAmbassadorAddress = await ambassadors.ambassadorByAddress(
			ambassador1.address
		);
		await expect(
			ambassadors.replaceAmbassador(
				ambassador1.address,
				ambassador2.address
			)
		).to.be.fulfilled;
		const newAmbassadorAddress = await ambassadors.ambassadorByAddress(
			ambassador2.address
		);
		expect(previousAmbassadorAddress).to.be.equal(newAmbassadorAddress);
	});

	it("should not be able to replace ambassador if new is ambassador", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador2.address);
		await addDefaultCommunity();
		await expect(
			ambassadors.replaceAmbassador(
				ambassador1.address,
				ambassador2.address
			)
		).to.be.rejectedWith("Ambassador:: ALREADY_AMBASSADOR");
	});

	// transferAmbassador

	it("should be able to transfer ambassador if entity", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors.addEntity(ambassadorsEntityB.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		const previousAmbassadorEntity = await ambassadors.ambassadorToEntity(
			ambassador1.address
		);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.transferAmbassador(
					ambassador1.address,
					ambassadorsEntityB.address,
					true
				)
		).to.be.fulfilled;
		const newAmbassadorEntity = await ambassadors.ambassadorToEntity(
			ambassador2.address
		);
		expect(previousAmbassadorEntity).to.be.equal(newAmbassadorEntity);
	});

	it("should be able to transfer ambassador with communities", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors.addEntity(ambassadorsEntityB.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await addDefaultCommunity();
		const previousAmbassadorEntity = await ambassadors.ambassadorToEntity(
			ambassador1.address
		);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.transferAmbassador(
					ambassador1.address,
					ambassadorsEntityB.address,
					true
				)
		).to.be.fulfilled;
		const newAmbassadorEntity = await ambassadors.ambassadorToEntity(
			ambassador2.address
		);
		expect(previousAmbassadorEntity).to.be.equal(newAmbassadorEntity);
	});

	it("should not be able to transfer ambassador with communities if not intended", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors.addEntity(ambassadorsEntityB.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await addDefaultCommunity();
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.transferAmbassador(
					ambassador1.address,
					ambassadorsEntityB.address,
					false
				)
		).to.be.rejectedWith("Ambassador:: HAS_COMMUNITIES");
	});

	it("should not be able to transfer invalid ambassador", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors.addEntity(ambassadorsEntityB.address);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.transferAmbassador(
					ambassador1.address,
					ambassadorsEntityB.address,
					true
				)
		).to.be.rejectedWith("Ambassador:: NOT_AMBASSADOR");
	});

	// transferCommunityToAmbassador

	it("should be able to transfer communities to another ambassador", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador2.address);
		await addDefaultCommunity(ambassador1.address);
		const previousCommunityToAmbassador =
			await ambassadors.communityToAmbassador(ambassador1.address);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.transferCommunityToAmbassador(
					ambassador2.address,
					communityInstance.address
				)
		).to.be.fulfilled;
		const newCommunityToAmbassador =
			await ambassadors.communityToAmbassador(ambassador2.address);
		expect(previousCommunityToAmbassador).to.be.equal(
			newCommunityToAmbassador
		);
	});

	it("should be able to transfer communities to another ambassador if owner", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador2.address);
		await addDefaultCommunity();
		const previousCommunityToAmbassador =
			await ambassadors.communityToAmbassador(ambassador1.address);
		await expect(
			ambassadors.transferCommunityToAmbassador(
				ambassador2.address,
				communityInstance.address
			)
		).to.be.fulfilled;
		const newCommunityToAmbassador =
			await ambassadors.communityToAmbassador(ambassador2.address);
		expect(previousCommunityToAmbassador).to.be.equal(
			newCommunityToAmbassador
		);
	});

	it("should not be able to transfer communities to invalid ambassador", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await addDefaultCommunity();
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.transferCommunityToAmbassador(
					ambassador2.address,
					communityInstance.address
				)
		).to.be.rejectedWith("Ambassador:: NOT_AMBASSADOR");
	});

	it("should not be able to transfer communities to already ambassador", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await addDefaultCommunity();
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.transferCommunityToAmbassador(
					ambassador1.address,
					communityInstance.address
				)
		).to.be.rejectedWith("Ambassador:: ALREADY_AMBASSADOR");
	});

	it("should not be able to transfer communities to another ambassador", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador2.address);
		await addDefaultCommunity();
		await addDefaultCommunity(ambassador2.address);
		await expect(
			ambassadors
				.connect(ambassadorsEntityA)
				.transferCommunityToAmbassador(
					ambassador2.address,
					communityInstance.address
				)
		).to.be.rejectedWith("Ambassador:: ALREADY_AMBASSADOR");
	});

	// setCommunityToAmbassador
	// (tested with the deploy)

	// removeCommunity

	it("should be able to remove community", async () => {
		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassador1.address);
		await addDefaultCommunity();
		const previousCommunityToAmbassador =
			await ambassadors.communityToAmbassador(communityInstance.address);
		const previousAmbassadorIndex = await ambassadors.ambassadorByAddress(
			ambassador1.address
		);
		expect(previousCommunityToAmbassador).to.be.equal(
			previousAmbassadorIndex
		);
		await expect(
			communityAdminProxy.removeCommunity(communityInstance.address)
		).to.be.fulfilled;
		const newCommunityToAmbassador =
			await ambassadors.communityToAmbassador(communityInstance.address);
		expect(newCommunityToAmbassador).to.be.equal(0);
	});
});
