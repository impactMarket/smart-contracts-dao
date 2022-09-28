// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
import { should } from "chai";
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
import { parseEther } from "@ethersproject/units";
import {
	advanceBlockNTimes,
	advanceTimeAndBlockNTimes,
	getBlockNumber,
} from "../utils/TimeTravel";
import { keccak256 } from "ethers/lib/utils";
import { toEther } from "../utils/helpers";

should();

chai.use(chaiAsPromised);
const expect = chai.expect;
const provider = waffle.provider;

describe("Community", () => {
	enum BeneficiaryState {
		NONE = 0,
		Valid = 1,
		Locked = 2,
		Removed = 3,
	}

	enum CommunityState {
		NONE = 0,
		Valid = 1,
		Removed = 2,
		Migrated = 3,
	}

	const FAKE_ADDRESS = "0x000000000000000000000000000000000000dEaD";
	const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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
	// ambassadors
	let ambassadorA: SignerWithAddress;
	let ambassadorB: SignerWithAddress;
	// ambassadors entity
	let ambassadorsEntityA: SignerWithAddress;

	let communityProxy: ethersTypes.Contract;
	let ambassadorsProxy: ethersTypes.Contract;
	let communityMiddleProxy: ethersTypes.Contract;
	let communityImplementation: ethersTypes.Contract;
	let newCommunityProxy: ethersTypes.Contract;
	let communityAdminProxy: ethersTypes.Contract;
	let communityAdminImplementation: ethersTypes.Contract;
	let treasuryProxy: ethersTypes.Contract;
	let cUSD: ethersTypes.Contract;
	let impactProxyAdmin: ethersTypes.Contract;

	// constants
	let firstBlock: number;
	const incrementIntervalDefault = 12;
	const baseIntervalDefault = 36;
	const claimAmountDefault = parseEther("2");
	const maxClaimDefault = parseEther("10");
	const decreaseStepDefault = parseEther("0.01");
	const communityMinTrancheDefault = parseEther("100");
	const communityMaxTrancheDefault = parseEther("5000");
	const maxBeneficiariesDefault = 100;
	const weekInBlocks = 120960;
	const initialAmountDefault = parseEther("0.05");
	const zeroAddress = "0x0000000000000000000000000000000000000000";
	const mintAmount = parseEther("10000");
	const managerRole = keccak256(ethers.utils.toUtf8Bytes("MANAGER_ROLE"));
	const TREASURY_SAFETY_FACTOR = 10;
	const TREASURY_SAFETY_LIMIT = toEther(100);

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
		// ambassadors
		ambassadorA = accounts[10];
		ambassadorB = accounts[11];
		// ambassadors entity
		ambassadorsEntityA = accounts[12];
	}

	async function deploy() {
		await deployments.fixture("Test", { fallbackToGlobal: false });

		cUSD = await ethers.getContractAt(
			"TokenMock",
			(
				await deployments.get("TokenMock")
			).address
		);

		impactProxyAdmin = await ethers.getContractAt(
			"ImpactProxyAdmin",
			(
				await deployments.get("ImpactProxyAdmin")
			).address
		);

		communityImplementation = await ethers.getContractAt(
			"CommunityImplementation",
			(
				await deployments.get("CommunityImplementation")
			).address
		);

		const treasury = await deployments.get("TreasuryProxy");
		treasuryProxy = await ethers.getContractAt(
			"TreasuryImplementation",
			treasury.address
		);

		expect(
			await impactProxyAdmin.getProxyImplementation(
				(
					await deployments.get("CommunityAdminProxy")
				).address
			)
		).to.be.equal(
			(await deployments.get("CommunityAdminImplementation")).address
		);

		communityAdminImplementation = await ethers.getContractAt(
			"CommunityAdminImplementation",
			(
				await deployments.get("CommunityAdminImplementation")
			).address
		);

		communityAdminProxy = await ethers.getContractAt(
			"CommunityAdminImplementation",
			(
				await deployments.get("CommunityAdminProxy")
			).address
		);

		communityMiddleProxy = await ethers.getContractAt(
			"CommunityMiddleProxy",
			(
				await deployments.get("CommunityMiddleProxy")
			).address
		);

		await communityAdminProxy.updateImpactMarketCouncil(
			(
				await deployments.get("ImpactMarketCouncilProxy")
			).address
		);
		await communityAdminProxy.updateAmbassadors(
			(
				await deployments.get("AmbassadorsProxy")
			).address
		);

		ambassadorsProxy = await ethers.getContractAt(
			"AmbassadorsImplementation",
			(
				await deployments.get("AmbassadorsProxy")
			).address
		);

		await ambassadorsProxy.addEntity(ambassadorsEntityA.address);
		await ambassadorsProxy
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassadorA.address);
	}

	async function createCommunity(communityAdminProxy: ethersTypes.Contract) {
		const tx = await communityAdminProxy.addCommunity(
			cUSD.address,
			[communityManagerA.address],
			ambassadorA.address,
			claimAmountDefault,
			maxClaimDefault,
			decreaseStepDefault,
			baseIntervalDefault,
			incrementIntervalDefault,
			communityMinTrancheDefault,
			communityMaxTrancheDefault,
			maxBeneficiariesDefault
		);

		let receipt = await tx.wait();

		return receipt.events?.filter((x: any) => {
			return x.event == "CommunityAdded";
		})[0]["args"]["communityAddress"];
	}

	async function addDefaultCommunity() {
		communityProxy = await ethers.getContractAt(
			"CommunityImplementation",
			await createCommunity(communityAdminProxy)
		);
	}

	describe("CommunityAdmin", () => {
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(treasuryProxy.address, mintAmount.toString());

			await addDefaultCommunity();
		});

		it("should return correct values", async () => {
			(await communityProxy.previousCommunity()).should.be.equal(
				zeroAddress
			);
			(await communityProxy.claimAmount()).should.be.equal(
				claimAmountDefault.toString()
			);
			(await communityProxy.baseInterval()).should.be.equal(
				baseIntervalDefault.toString()
			);
			(await communityProxy.incrementInterval()).should.be.equal(
				incrementIntervalDefault.toString()
			);
			(await communityProxy.maxClaim()).should.be.equal(
				maxClaimDefault.toString()
			);
			(await communityProxy.validBeneficiaryCount()).should.be.equal(0);
			(await communityProxy.treasuryFunds()).should.be.equal(
				parseEther("100")
			);
			(await communityProxy.privateFunds()).should.be.equal(0);
			(await communityProxy.communityAdmin()).should.be.equal(
				communityAdminProxy.address
			);
			(await communityProxy.cUSD()).should.be.equal(cUSD.address);
			(await communityProxy.locked()).should.be.equal(false);
			(await communityProxy.decreaseStep()).should.be.equal(
				decreaseStepDefault
			);
			(await communityProxy.getVersion()).should.be.equal(3);
			(await communityAdminProxy.getVersion()).should.be.equal(2);
		});

		it("should not updateCommunityImplementation if not owner", async () => {
			const initialAddress =
				await communityAdminProxy.communityImplementation();
			await expect(
				communityAdminProxy
					.connect(communityManagerA)
					.updateCommunityImplementation(FAKE_ADDRESS)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(
				await communityAdminProxy.communityImplementation()
			).to.be.equal(initialAddress);
		});

		it("should updateCommunityImplementation if  owner", async () => {
			await expect(
				communityAdminProxy.updateCommunityImplementation(FAKE_ADDRESS)
			).to.be.fulfilled;

			expect(
				await communityAdminProxy.communityImplementation()
			).to.be.equal(FAKE_ADDRESS);
		});

		it("should not updateCommunityMiddleProxy if not owner", async () => {
			const initialAddress =
				await communityAdminProxy.communityMiddleProxy();
			await expect(
				communityAdminProxy
					.connect(communityManagerA)
					.updateCommunityMiddleProxy(FAKE_ADDRESS)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(
				await communityAdminProxy.communityMiddleProxy()
			).to.be.equal(initialAddress);
		});

		it("should updateCommunityMiddleProxy if owner", async () => {
			await expect(
				communityAdminProxy.updateCommunityMiddleProxy(FAKE_ADDRESS)
			).to.be.fulfilled;

			expect(
				await communityAdminProxy.communityMiddleProxy()
			).to.be.equal(FAKE_ADDRESS);
		});

		it("should add a community if admin", async () => {
			await cUSD.mint(treasuryProxy.address, mintAmount.toString());

			const tx = await communityAdminProxy.addCommunity(
				cUSD.address,
				[communityManagerA.address],
				ambassadorA.address,
				claimAmountDefault.toString(),
				maxClaimDefault.toString(),
				decreaseStepDefault.toString(),
				baseIntervalDefault.toString(),
				incrementIntervalDefault.toString(),
				communityMinTrancheDefault,
				communityMaxTrancheDefault,
				maxBeneficiariesDefault
			);

			let receipt = await tx.wait();

			const communityAddress = receipt.events?.filter((x: any) => {
				return x.event == "CommunityAdded";
			})[0]["args"]["communityAddress"];
			communityProxy = await ethers.getContractAt(
				"CommunityImplementation",
				communityAddress
			);

			(await communityProxy.baseInterval())
				.toString()
				.should.be.equal(baseIntervalDefault.toString());
			(await communityProxy.incrementInterval())
				.toString()
				.should.be.equal(incrementIntervalDefault.toString());
			(await communityProxy.maxClaim()).should.be.equal(maxClaimDefault);
		});

		it("should not add a community without managers", async () => {
			await expect(
				communityAdminProxy.addCommunity(
					cUSD.address,
					[],
					ambassadorA.address,
					claimAmountDefault.toString(),
					maxClaimDefault.toString(),
					decreaseStepDefault.toString(),
					baseIntervalDefault.toString(),
					incrementIntervalDefault.toString(),
					communityMinTrancheDefault,
					communityMaxTrancheDefault,
					maxBeneficiariesDefault
				)
			).to.be.rejectedWith(
				"CommunityAdmin::addCommunity: Community should have at least one manager"
			);
		});

		it("should remove a community if admin", async () => {
			await cUSD.mint(treasuryProxy.address, mintAmount.toString());

			const tx = await communityAdminProxy.addCommunity(
				cUSD.address,
				[communityManagerA.address],
				ambassadorA.address,
				claimAmountDefault.toString(),
				maxClaimDefault.toString(),
				decreaseStepDefault.toString(),
				baseIntervalDefault.toString(),
				incrementIntervalDefault.toString(),
				communityMinTrancheDefault,
				communityMaxTrancheDefault,
				maxBeneficiariesDefault
			);

			let receipt = await tx.wait();

			const communityAddress = receipt.events?.filter((x: any) => {
				return x.event == "CommunityAdded";
			})[0]["args"]["communityAddress"];
			communityProxy = await ethers.getContractAt(
				"CommunityImplementation",
				communityAddress
			);

			await communityAdminProxy.removeCommunity(communityProxy.address);
		});

		it("should not create a community with invalid values", async () => {
			await expect(
				communityAdminProxy.addCommunity(
					cUSD.address,
					[communityManagerA.address],
					ambassadorA.address,
					claimAmountDefault.toString(),
					maxClaimDefault.toString(),
					decreaseStepDefault.toString(),
					incrementIntervalDefault.toString(),
					baseIntervalDefault.toString(),
					communityMinTrancheDefault,
					communityMaxTrancheDefault,
					maxBeneficiariesDefault
				)
			).to.be.rejected;
			await expect(
				communityAdminProxy.addCommunity(
					cUSD.address,
					[communityManagerA.address],
					ambassadorA.address,
					maxClaimDefault.toString(), // it's supposed to be wrong!
					claimAmountDefault.toString(),
					decreaseStepDefault.toString(),
					baseIntervalDefault.toString(),
					incrementIntervalDefault.toString(),
					communityMinTrancheDefault,
					communityMaxTrancheDefault,
					maxBeneficiariesDefault
				)
			).to.be.rejected;
		});

		it("Should transfer founds from communityAdmin to address if admin", async function () {
			const initialBalance = await cUSD.balanceOf(adminAccount1.address);
			expect(
				await cUSD.balanceOf(communityAdminProxy.address)
			).to.be.equal(0);
			await cUSD.mint(communityAdminProxy.address, parseEther("100"));
			expect(
				await cUSD.balanceOf(communityAdminProxy.address)
			).to.be.equal(parseEther("100"));
			await communityAdminProxy.transfer(
				cUSD.address,
				adminAccount1.address,
				parseEther("100")
			);
			expect(
				await cUSD.balanceOf(communityAdminProxy.address)
			).to.be.equal(0);
			expect(await cUSD.balanceOf(adminAccount1.address)).to.be.equal(
				initialBalance.add(parseEther("100"))
			);
		});

		it("Should not transfer founds from communityAdmin to address if not admin", async function () {
			const initialBalance = await cUSD.balanceOf(adminAccount1.address);
			expect(
				await cUSD.balanceOf(communityAdminProxy.address)
			).to.be.equal(0);
			await cUSD.mint(communityAdminProxy.address, parseEther("100"));
			expect(
				await cUSD.balanceOf(communityAdminProxy.address)
			).to.be.equal(parseEther("100"));
			await expect(
				communityAdminProxy
					.connect(adminAccount2)
					.transfer(
						cUSD.address,
						adminAccount1.address,
						parseEther("100")
					)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(
				await cUSD.balanceOf(communityAdminProxy.address)
			).to.be.equal(parseEther("100"));
			expect(await cUSD.balanceOf(adminAccount1.address)).to.be.equal(
				initialBalance.add(parseEther("0"))
			);
		});

		it("Should not update CommunityAdmin implementation if not owner", async function () {
			await expect(
				impactProxyAdmin
					.connect(adminAccount2)
					.upgrade(communityAdminProxy.address, FAKE_ADDRESS)
			).to.be.rejectedWith("Ownable: caller is not the owner");
		});
	});

	describe("Community", () => {
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(treasuryProxy.address, mintAmount.toString());

			await addDefaultCommunity();
		});

		it("Should transfer founds from community to address if admin", async function () {
			const initialBalance = await cUSD.balanceOf(adminAccount1.address);
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				parseEther("100")
			);
			await communityAdminProxy.transferFromCommunity(
				communityProxy.address,
				cUSD.address,
				adminAccount1.address,
				parseEther("100")
			);
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(0);
			expect(await cUSD.balanceOf(adminAccount1.address)).to.be.equal(
				initialBalance.add(parseEther("100"))
			);
		});

		it("Should not transfer founds from community to address if not admin #1", async function () {
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				parseEther("100")
			);
			await expect(
				communityProxy
					.connect(adminAccount2)
					.transfer(
						cUSD.address,
						adminAccount1.address,
						parseEther("100")
					)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				parseEther("100")
			);
			expect(await cUSD.balanceOf(adminAccount2.address)).to.be.equal(
				parseEther("0")
			);
		});

		it("Should not transfer founds from community to address if not admin #2", async function () {
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				parseEther("100")
			);
			await expect(
				communityAdminProxy
					.connect(adminAccount2)
					.transferFromCommunity(
						communityProxy.address,
						cUSD.address,
						adminAccount1.address,
						parseEther("100")
					)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				parseEther("100")
			);
			expect(await cUSD.balanceOf(adminAccount2.address)).to.be.equal(
				parseEther("0")
			);
		});

		it("Should not update Community implementation if not owner #1", async function () {
			await expect(
				impactProxyAdmin
					.connect(adminAccount2)
					.upgrade(communityProxy.address, FAKE_ADDRESS)
			).to.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("Should not update Community implementation if not owner #2", async function () {
			await expect(
				communityAdminProxy
					.connect(adminAccount2)
					.updateProxyImplementation(
						communityProxy.address,
						FAKE_ADDRESS
					)
			).to.be.rejectedWith(
				"CommunityAdmin: Not Owner Or ImpactMarketCouncil"
			);
		});

		// it("Should have same storage after update community implementation #1", async function () {
		// 	const CommunityImplementationMockFactory =
		// 		await ethers.getContractFactory("CommunityImplementationMock");
		//
		// 	communityProxy = await ethers.getContractAt(
		// 		"CommunityImplementationMock",
		// 		communityProxy.address
		// 	);
		//
		// 	const newCommunityImplementation =
		// 		await CommunityImplementationMockFactory.deploy();
		//
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.addBeneficiaries([beneficiaryA.address]);
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.lockBeneficiary(beneficiaryA.address);
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.addBeneficiaries([beneficiaryB.address]);
		//
		// 	await expect(
		// 		communityAdminProxy.updateProxyImplementation(
		// 			communityProxy.address,
		// 			newCommunityImplementation.address
		// 		)
		// 	).to.be.fulfilled;
		//
		// 	// expect(await communityProxy.owner()).to.be.equal(zeroAddress);
		// 	// await communityProxy.initialize();
		//
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.addBeneficiaries([beneficiaryC.address]);
		//
		// 	expect(await communityProxy.owner()).to.be.equal(
		// 		communityAdminProxy.address
		// 	);
		// 	expect(await communityProxy.locked()).to.be.equal(false);
		// 	expect(await communityProxy.claimAmount()).to.be.equal(
		// 		claimAmountTwo
		// 	);
		// 	expect(await communityProxy.baseInterval()).to.be.equal(
		// 		threeMinutesInBlocks
		// 	);
		// 	expect(await communityProxy.incrementInterval()).to.be.equal(
		// 		oneMinuteInBlocks
		// 	);
		// 	expect(await communityProxy.maxClaim()).to.be.equal(
		// 		maxClaimTen.sub(oneCent.mul(2))
		// 	);
		// 	expect(await communityProxy.validBeneficiaryCount()).to.be.equal(2);
		// 	expect(await communityProxy.treasuryFunds()).to.be.equal(
		// 		communityMinTranche
		// 	);
		// 	expect(await communityProxy.privateFunds()).to.be.equal("0");
		// 	expect(await communityProxy.decreaseStep()).to.be.equal(oneCent);
		// 	expect(await communityProxy.minTranche()).to.be.equal(
		// 		communityMinTranche
		// 	);
		// 	expect(await communityProxy.maxTranche()).to.be.equal(
		// 		communityMaxTranche
		// 	);
		// 	expect(await communityProxy.previousCommunity()).to.be.equal(
		// 		zeroAddress
		// 	);
		// 	expect(await communityProxy.communityAdmin()).to.be.equal(
		// 		communityAdminProxy.address
		// 	);
		// 	expect(
		// 		(await communityProxy.beneficiaries(beneficiaryA.address)).state
		// 	).to.be.equal(BeneficiaryState.Locked);
		// 	expect(
		// 		(await communityProxy.beneficiaries(beneficiaryB.address)).state
		// 	).to.be.equal(BeneficiaryState.Valid);
		// 	expect(
		// 		(await communityProxy.beneficiaries(beneficiaryC.address)).state
		// 	).to.be.equal(BeneficiaryState.Valid);
		// 	expect(await communityProxy.beneficiaryListLength()).to.be.equal(3);
		// 	expect(await communityProxy.beneficiaryListAt(0)).to.be.equal(
		// 		beneficiaryA.address
		// 	);
		// 	expect(await communityProxy.beneficiaryListAt(1)).to.be.equal(
		// 		beneficiaryB.address
		// 	);
		// 	expect(await communityProxy.beneficiaryListAt(2)).to.be.equal(
		// 		beneficiaryC.address
		// 	);
		// });
		//
		// it("Should have same storage after update community implementation #2", async function () {
		// 	const CommunityImplementationMockFactory =
		// 		await ethers.getContractFactory("CommunityImplementationMock");
		//
		// 	const newCommunityImplementation =
		// 		await CommunityImplementationMockFactory.deploy();
		//
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.addBeneficiaries([beneficiaryA.address]);
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.lockBeneficiary(beneficiaryA.address);
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.addBeneficiaries([beneficiaryB.address]);
		//
		// 	await expect(
		// 		communityAdminProxy.updateCommunityImplementation(
		// 			newCommunityImplementation.address
		// 		)
		// 	).to.be.fulfilled;
		//
		// 	communityProxy = await ethers.getContractAt(
		// 		"CommunityImplementationMock",
		// 		communityProxy.address
		// 	);
		//
		// 	communityProxy
		// 		.connect(communityManagerA)
		// 		.addBeneficiaries([beneficiaryC.address]);
		//
		// 	await communityProxy.setParams();
		//
		// 	expect(await communityProxy.addressTest1()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000001"
		// 	);
		// 	expect(await communityProxy.addressTest2()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000002"
		// 	);
		// 	expect(await communityProxy.addressTest3()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000003"
		// 	);
		//
		// 	expect(await communityProxy.uint256Test1()).to.be.equal(1);
		// 	expect(await communityProxy.uint256Test2()).to.be.equal(2);
		// 	expect(await communityProxy.uint256Test3()).to.be.equal(3);
		//
		// 	expect(
		// 		await communityProxy.mapTest2(
		// 			"0x0000000000000000000000000000000000000001"
		// 		)
		// 	).to.be.equal(true);
		// 	expect(await communityProxy.mapTest3(1)).to.be.equal(
		// 		"0x0000000000000000000000000000000000000001"
		// 	);
		//
		// 	expect(await communityProxy.owner()).to.be.equal(
		// 		communityAdminProxy.address
		// 	);
		// 	expect(await communityProxy.locked()).to.be.equal(false);
		// 	expect(await communityProxy.claimAmount()).to.be.equal(
		// 		claimAmountTwo
		// 	);
		// 	expect(await communityProxy.baseInterval()).to.be.equal(
		// 		threeMinutesInBlocks
		// 	);
		// 	expect(await communityProxy.incrementInterval()).to.be.equal(
		// 		oneMinuteInBlocks
		// 	);
		// 	expect(await communityProxy.maxClaim()).to.be.equal(
		// 		maxClaimTen.sub(oneCent.mul(2))
		// 	);
		// 	expect(await communityProxy.validBeneficiaryCount()).to.be.equal(2);
		// 	expect(await communityProxy.treasuryFunds()).to.be.equal(
		// 		communityMinTranche
		// 	);
		// 	expect(await communityProxy.privateFunds()).to.be.equal("0");
		// 	expect(await communityProxy.decreaseStep()).to.be.equal(oneCent);
		// 	expect(await communityProxy.minTranche()).to.be.equal(
		// 		communityMinTranche
		// 	);
		// 	expect(await communityProxy.maxTranche()).to.be.equal(
		// 		communityMaxTranche
		// 	);
		// 	expect(await communityProxy.previousCommunity()).to.be.equal(
		// 		zeroAddress
		// 	);
		// 	expect(await communityProxy.communityAdmin()).to.be.equal(
		// 		communityAdminProxy.address
		// 	);
		// 	expect(
		// 		(await communityProxy.beneficiaries(beneficiaryA.address)).state
		// 	).to.be.equal(BeneficiaryState.Locked);
		// 	expect(
		// 		(await communityProxy.beneficiaries(beneficiaryB.address)).state
		// 	).to.be.equal(BeneficiaryState.Valid);
		// 	expect(
		// 		(await communityProxy.beneficiaries(beneficiaryC.address)).state
		// 	).to.be.equal(BeneficiaryState.Valid);
		// 	expect(await communityProxy.beneficiaryListLength()).to.be.equal(3);
		// 	expect(await communityProxy.beneficiaryListAt(0)).to.be.equal(
		// 		beneficiaryA.address
		// 	);
		// 	expect(await communityProxy.beneficiaryListAt(1)).to.be.equal(
		// 		beneficiaryB.address
		// 	);
		// 	expect(await communityProxy.beneficiaryListAt(2)).to.be.equal(
		// 		beneficiaryC.address
		// 	);
		// });

		// it("Should have update all communities by changing communityAdmin.communityTemplate #1", async function () {
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.addBeneficiaries([beneficiaryA.address]);
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.lockBeneficiary(beneficiaryA.address);
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.addBeneficiaries([beneficiaryB.address]);
		//
		// 	let communityProxy2 = await ethers.getContractAt(
		// 		"CommunityImplementation",
		// 		await createCommunity(communityAdminProxy)
		// 	);
		// 	await communityProxy2
		// 		.connect(communityManagerA)
		// 		.addBeneficiaries([beneficiaryB.address]);
		//
		// 	const newCommunityImplementation = await (
		// 		await ethers.getContractFactory("CommunityImplementationMock")
		// 	).deploy();
		//
		// 	await expect(
		// 		communityAdminProxy.updateCommunityImplementation(
		// 			newCommunityImplementation.address
		// 		)
		// 	).to.be.fulfilled;
		//
		// 	communityProxy = await ethers.getContractAt(
		// 		"CommunityImplementationMock",
		// 		communityProxy.address
		// 	);
		//
		// 	await communityProxy.setParams();
		//
		// 	expect(await communityProxy.addressTest1()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000001"
		// 	);
		// 	expect(await communityProxy.addressTest2()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000002"
		// 	);
		// 	expect(await communityProxy.addressTest3()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000003"
		// 	);
		//
		// 	expect(await communityProxy.uint256Test1()).to.be.equal(1);
		// 	expect(await communityProxy.uint256Test2()).to.be.equal(2);
		// 	expect(await communityProxy.uint256Test3()).to.be.equal(3);
		//
		// 	expect(
		// 		await communityProxy.mapTest2(
		// 			"0x0000000000000000000000000000000000000001"
		// 		)
		// 	).to.be.equal(true);
		// 	expect(await communityProxy.mapTest3(1)).to.be.equal(
		// 		"0x0000000000000000000000000000000000000001"
		// 	);
		//
		// 	//*****************************************************************
		//
		// 	communityProxy2 = await ethers.getContractAt(
		// 		"CommunityImplementationMock",
		// 		communityProxy2.address
		// 	);
		//
		// 	await communityProxy2.setParams();
		//
		// 	expect(await communityProxy2.addressTest1()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000001"
		// 	);
		// 	expect(await communityProxy2.addressTest2()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000002"
		// 	);
		// 	expect(await communityProxy2.addressTest3()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000003"
		// 	);
		//
		// 	expect(await communityProxy2.uint256Test1()).to.be.equal(1);
		// 	expect(await communityProxy2.uint256Test2()).to.be.equal(2);
		// 	expect(await communityProxy2.uint256Test3()).to.be.equal(3);
		//
		// 	expect(
		// 		await communityProxy2.mapTest2(
		// 			"0x0000000000000000000000000000000000000001"
		// 		)
		// 	).to.be.equal(true);
		// 	expect(await communityProxy2.mapTest3(1)).to.be.equal(
		// 		"0x0000000000000000000000000000000000000001"
		// 	);
		// });

		// it("Should revert implementation for only one community", async function () {
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.addBeneficiaries([beneficiaryA.address]);
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.lockBeneficiary(beneficiaryA.address);
		// 	await communityProxy
		// 		.connect(communityManagerA)
		// 		.addBeneficiaries([beneficiaryB.address]);
		//
		// 	let communityProxy2 = await ethers.getContractAt(
		// 		"CommunityImplementation",
		// 		await createCommunity(communityAdminProxy)
		// 	);
		// 	await communityProxy2
		// 		.connect(communityManagerA)
		// 		.addBeneficiaries([beneficiaryB.address]);
		//
		// 	const newCommunityImplementation = await (
		// 		await ethers.getContractFactory("CommunityImplementationMock")
		// 	).deploy();
		//
		// 	await expect(
		// 		communityAdminProxy.updateCommunityImplementation(
		// 			newCommunityImplementation.address
		// 		)
		// 	).to.be.fulfilled;
		//
		// 	communityProxy = await ethers.getContractAt(
		// 		"CommunityImplementationMock",
		// 		communityProxy.address
		// 	);
		//
		// 	await communityProxy.setParams();
		//
		// 	expect(await communityProxy.addressTest1()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000001"
		// 	);
		// 	expect(await communityProxy.addressTest2()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000002"
		// 	);
		// 	expect(await communityProxy.addressTest3()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000003"
		// 	);
		//
		// 	expect(await communityProxy.uint256Test1()).to.be.equal(1);
		// 	expect(await communityProxy.uint256Test2()).to.be.equal(2);
		// 	expect(await communityProxy.uint256Test3()).to.be.equal(3);
		//
		// 	expect(
		// 		await communityProxy.mapTest2(
		// 			"0x0000000000000000000000000000000000000001"
		// 		)
		// 	).to.be.equal(true);
		// 	expect(await communityProxy.mapTest3(1)).to.be.equal(
		// 		"0x0000000000000000000000000000000000000001"
		// 	);
		//
		// 	//*****************************************************************
		//
		// 	communityProxy2 = await ethers.getContractAt(
		// 		"CommunityImplementationMock",
		// 		communityProxy2.address
		// 	);
		//
		// 	await communityProxy2.setParams();
		//
		// 	expect(await communityProxy2.addressTest1()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000001"
		// 	);
		// 	expect(await communityProxy2.addressTest2()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000002"
		// 	);
		// 	expect(await communityProxy2.addressTest3()).to.be.equal(
		// 		"0x0000000000000000000000000000000000000003"
		// 	);
		//
		// 	expect(await communityProxy2.uint256Test1()).to.be.equal(1);
		// 	expect(await communityProxy2.uint256Test2()).to.be.equal(2);
		// 	expect(await communityProxy2.uint256Test3()).to.be.equal(3);
		//
		// 	expect(
		// 		await communityProxy2.mapTest2(
		// 			"0x0000000000000000000000000000000000000001"
		// 		)
		// 	).to.be.equal(true);
		// 	expect(await communityProxy2.mapTest3(1)).to.be.equal(
		// 		"0x0000000000000000000000000000000000000001"
		// 	);
		//
		// 	//*****************************************************************
		// 	//revert to initial implementation for community2
		//
		// 	await expect(
		// 		communityAdminProxy.updateProxyImplementation(
		// 			communityProxy2.address,
		// 			communityImplementation.address
		// 		)
		// 	).to.be.fulfilled;
		//
		// 	await expect(communityProxy.setParams()).to.be.fulfilled;
		//
		// 	// yarn coverage throws this error message
		// 	// await expect(communityProxy2.setParams()).to.be.rejectedWith(
		// 	// 	"Transaction reverted: function selector was not recognized and there's no fallback function"
		// 	// );
		//
		// 	// yarn test throws this error message
		// 	// await expect(communityProxy2.setParams()).to.be.rejectedWith(
		// 	// 	"Transaction reverted without a reason string"
		// 	// );
		//
		// 	// this error message matches both cases
		// 	await expect(communityProxy2.setParams()).to.be.rejectedWith(
		// 		"Transaction reverted"
		// 	);
		//
		// 	expect(await communityProxy2.communityAdmin()).to.be.equal(
		// 		communityAdminProxy.address
		// 	);
		// });

		it("Should update maxBeneficiaries if ambassador", async function () {
			expect(await communityProxy.maxBeneficiaries()).to.be.equal(100);
			await expect(
				communityProxy.connect(ambassadorA).updateMaxBeneficiaries(6)
			).to.be.fulfilled;
			expect(await communityProxy.maxBeneficiaries()).to.be.equal(6);
		});

		it("Should not update maxBeneficiaries if not ambassador", async function () {
			expect(await communityProxy.maxBeneficiaries()).to.be.equal(100);
			await expect(
				communityProxy.connect(adminAccount2).updateMaxBeneficiaries(6)
			).to.be.rejectedWith(
				"Community: NOT_OWNER_OR_AMBASSADOR_OR_ENTITY"
			);
			expect(await communityProxy.maxBeneficiaries()).to.be.equal(100);
		});
	});

	describe("Community - Beneficiary", () => {
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(treasuryProxy.address, mintAmount.toString());

			await addDefaultCommunity();
		});

		it("should add beneficiary to community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
		});

		it("should add beneficiary to community #2", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
		});

		it("should add beneficiaries to community #1", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.be.equal(BeneficiaryState.NONE);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address, beneficiaryB.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.be.equal(BeneficiaryState.Valid);

			(
				await communityProxy.beneficiaries(beneficiaryC.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([
					beneficiaryA.address,
					beneficiaryB.address,
					beneficiaryC.address,
				]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryC.address)
			).state.should.be.equal(BeneficiaryState.Valid);
		});

		xit("should add beneficiaries to community #2", async () => {
			const newBeneficiariesNumber = 89;
			const newBeneficiaries = [];

			for (let i = 1; i <= newBeneficiariesNumber; i++) {
				newBeneficiaries.push(ethers.Wallet.createRandom().address);
			}
			(await communityProxy.validBeneficiaryCount()).should.be.equal(0);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries(newBeneficiaries);
			(await communityProxy.validBeneficiaryCount()).should.be.equal(
				newBeneficiariesNumber
			);
		});

		it("should give beneficiary 5 cents when adding to community", async () => {
			(await cUSD.balanceOf(beneficiaryA.address))
				.toString()
				.should.be.equal("0");
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(await cUSD.balanceOf(beneficiaryA.address))
				.toString()
				.should.be.equal(initialAmountDefault.toString());
		});

		it("should lock beneficiary from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			await communityProxy
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Locked);
		});

		it("should not lock an invalid beneficiary from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.lockBeneficiary(beneficiaryA.address)
			).to.be.rejectedWith("NOT_YET");
		});

		it("should unlock locked beneficiary from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			await communityProxy
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Locked);
			await communityProxy
				.connect(communityManagerA)
				.unlockBeneficiary(beneficiaryA.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
		});

		it("should not unlock a not locked beneficiary from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.unlockBeneficiary(beneficiaryA.address)
			).to.be.rejectedWith("NOT_YET");
		});

		it("should remove beneficiary from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			await communityProxy
				.connect(communityManagerA)
				.removeBeneficiary(beneficiaryA.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Removed);
		});

		it("should not add more then maxBeneficiaries #1", async () => {
			await communityProxy.connect(ambassadorA).updateMaxBeneficiaries(3);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.addBeneficiaries([
						beneficiaryA.address,
						beneficiaryB.address,
					])
			).to.be.fulfilled;
			expect(await communityProxy.validBeneficiaryCount()).to.be.equal(2);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.addBeneficiaries([
						beneficiaryC.address,
						beneficiaryD.address,
					])
			).to.be.rejectedWith(
				"Community::_changeBeneficiaryState: This community has reached the maximum number of valid beneficiaries"
			);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryC.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			(
				await communityProxy.beneficiaries(beneficiaryD.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			expect(await communityProxy.validBeneficiaryCount()).to.be.equal(2);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.addBeneficiaries([beneficiaryC.address])
			).to.be.fulfilled;
			expect(await communityProxy.validBeneficiaryCount()).to.be.equal(3);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.addBeneficiaries([beneficiaryD.address])
			).to.be.rejectedWith(
				"Community::_changeBeneficiaryState: This community has reached the maximum number of valid beneficiaries"
			);
			expect(await communityProxy.validBeneficiaryCount()).to.be.equal(3);

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryC.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryD.address)
			).state.should.be.equal(BeneficiaryState.NONE);
		});
	});

	describe("Community - Claim", () => {
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(treasuryProxy.address, mintAmount.toString());

			await addDefaultCommunity();

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
		});

		it("should return correct lastInterval values", async () => {
			const baseInterval = (
				await communityProxy.baseInterval()
			).toNumber();
			const incrementInterval = (
				await communityProxy.incrementInterval()
			).toNumber();

			expect(
				await communityProxy.lastInterval(beneficiaryA.address)
			).to.be.equal(0);
			await communityProxy.connect(beneficiaryA).claim();
			expect(
				await communityProxy.lastInterval(beneficiaryA.address)
			).to.be.equal(baseInterval);
			await advanceTimeAndBlockNTimes(baseInterval);
			await communityProxy.connect(beneficiaryA).claim();
			expect(
				await communityProxy.lastInterval(beneficiaryA.address)
			).to.be.equal(baseInterval + incrementInterval);
			await advanceTimeAndBlockNTimes(incrementInterval);

			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("NOT_YET");
			expect(
				await communityProxy.lastInterval(beneficiaryA.address)
			).to.be.equal(baseInterval + incrementInterval);
			await advanceTimeAndBlockNTimes(baseInterval + incrementInterval);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;
			expect(
				await communityProxy.lastInterval(beneficiaryA.address)
			).to.be.equal(baseInterval + 2 * incrementInterval);
			await advanceTimeAndBlockNTimes(baseInterval + incrementInterval);

			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("NOT_YET");
			expect(
				await communityProxy.lastInterval(beneficiaryA.address)
			).to.be.equal(baseInterval + 2 * incrementInterval);
			await advanceTimeAndBlockNTimes(
				baseInterval + 2 * incrementInterval
			);
			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;
		});

		it("should not claim without belong to community", async () => {
			await expect(
				communityProxy.connect(beneficiaryB).claim()
			).to.be.rejectedWith("NOT_VALID_BENEFICIARY");
		});

		it("should not claim after locked from community", async () => {
			await communityProxy
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);
			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("Community: NOT_VALID_BENEFICIARY");
		});

		it("should not claim after removed from community", async () => {
			await communityProxy
				.connect(communityManagerA)
				.removeBeneficiary(beneficiaryA.address);
			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("Community: NOT_VALID_BENEFICIARY");
		});

		it("should not claim if community is locked", async () => {
			await expect(communityProxy.connect(ambassadorA).lock())
				.to.emit(communityProxy, "CommunityLocked")
				.withArgs(ambassadorA.address);
			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("LOCKED");
		});

		it("should not claim without waiting enough", async () => {
			const baseInterval = (
				await communityProxy.baseInterval()
			).toNumber();
			const incrementInterval = (
				await communityProxy.incrementInterval()
			).toNumber();
			await communityProxy.connect(beneficiaryA).claim();
			await advanceTimeAndBlockNTimes(baseInterval);
			await communityProxy.connect(beneficiaryA).claim();
			await advanceTimeAndBlockNTimes(incrementInterval);
			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("NOT_YET");
			await advanceTimeAndBlockNTimes(baseInterval + incrementInterval);
			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;
			await advanceTimeAndBlockNTimes(baseInterval + incrementInterval);
			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("NOT_YET");
			await advanceTimeAndBlockNTimes(
				baseInterval + 2 * incrementInterval
			);
			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;
		});

		it("should claim after waiting", async () => {
			const baseInterval = (
				await communityProxy.baseInterval()
			).toNumber();
			await advanceTimeAndBlockNTimes(baseInterval + 1);
			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.be.equal(0);
			await communityProxy.connect(beneficiaryA).claim();
			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.be.equal(claimAmountDefault);

			(await cUSD.balanceOf(beneficiaryA.address)).should.be.equal(
				claimAmountDefault.add(initialAmountDefault)
			);
		});

		it("should claim maxClaim", async () => {
			const baseInterval = (
				await communityProxy.baseInterval()
			).toNumber();
			const incrementInterval = (
				await communityProxy.incrementInterval()
			).toNumber();
			const claimAmount = await communityProxy.claimAmount();
			const maxClaimAmount = await communityProxy.maxClaim();
			let maxClaimsPerUser = maxClaimAmount.div(claimAmount).toNumber();
			if (claimAmount.mul(maxClaimsPerUser) < maxClaimAmount) {
				maxClaimsPerUser++;
			}
			for (let index = 0; index < maxClaimsPerUser; index++) {
				await advanceTimeAndBlockNTimes(
					baseInterval + incrementInterval * index + 5
				);
				await communityProxy.connect(beneficiaryA).claim();
			}

			const beneficiaryADetails = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiaryADetails.claims).to.be.equal(maxClaimsPerUser);
			expect(beneficiaryADetails.claimedAmount).to.be.equal(
				maxClaimAmount
			);
		});

		it("should not claim after max claim", async () => {
			const baseInterval = (
				await communityProxy.baseInterval()
			).toNumber();
			const incrementInterval = (
				await communityProxy.incrementInterval()
			).toNumber();
			const claimAmount = await communityProxy.claimAmount();
			const maxClaimAmount = await communityProxy.maxClaim();
			let maxClaimsPerUser = maxClaimAmount.div(claimAmount).toNumber();
			if (claimAmount.mul(maxClaimsPerUser) < maxClaimAmount) {
				maxClaimsPerUser++;
			}
			for (let index = 0; index < maxClaimsPerUser; index++) {
				await advanceTimeAndBlockNTimes(
					baseInterval + incrementInterval * index + 5
				);
				await communityProxy.connect(beneficiaryA).claim();
			}
			await advanceTimeAndBlockNTimes(
				baseInterval + incrementInterval * maxClaimsPerUser + 5
			);
			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith(
				"Community::claim: Already claimed everything"
			);
		});
	});

	describe("Community - Governance", () => {
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(treasuryProxy.address, mintAmount.toString());

			await addDefaultCommunity();
		});

		it("should migrate funds from community if CommunityAdmin", async () => {
			const previousCommunityOldBalance = await cUSD.balanceOf(
				communityProxy.address
			);

			const newTx = await communityAdminProxy.migrateCommunity(
				[communityManagerA.address],
				communityProxy.address
			);

			let receipt = await newTx.wait();

			const newCommunityAddress = receipt.events?.filter((x: any) => {
				return x.event == "CommunityMigrated";
			})[0]["args"]["communityAddress"];

			communityProxy = await ethers.getContractAt(
				"CommunityImplementation",
				newCommunityAddress
			);
			const previousCommunityNewBalance = await cUSD.balanceOf(
				communityProxy.address
			);
			const newCommunityNewBalance = await cUSD.balanceOf(
				newCommunityAddress
			);
			previousCommunityOldBalance.should.be.equal(newCommunityNewBalance);
			previousCommunityNewBalance.should.be.equal(parseEther("100"));
		});

		it("should call beneficiaryJoinFromMigrated", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryB.address]);

			const newTx = await communityAdminProxy.migrateCommunity(
				[communityManagerA.address],
				communityProxy.address
			);

			let receipt = await newTx.wait();

			const newCommunityAddress = receipt.events?.filter((x: any) => {
				return x.event == "CommunityMigrated";
			})[0]["args"]["communityAddress"];

			newCommunityProxy = await ethers.getContractAt(
				"CommunityImplementation",
				newCommunityAddress
			);
			await expect(
				newCommunityProxy
					.connect(beneficiaryA)
					.beneficiaryJoinFromMigrated(beneficiaryA.address)
			).to.be.fulfilled;
			await expect(
				newCommunityProxy
					.connect(beneficiaryB)
					.beneficiaryJoinFromMigrated(beneficiaryB.address)
			).to.be.fulfilled;
			await expect(
				newCommunityProxy
					.connect(beneficiaryC)
					.beneficiaryJoinFromMigrated(beneficiaryC.address)
			).to.be.fulfilled;

			(
				await newCommunityProxy.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			(
				await newCommunityProxy.beneficiaries(beneficiaryB.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			(
				await newCommunityProxy.beneficiaries(beneficiaryC.address)
			).state.should.be.equal(BeneficiaryState.NONE);
		});

		it("should not migrate a migrated community", async () => {
			await expect(
				communityAdminProxy.migrateCommunity(
					[communityManagerA.address],
					communityProxy.address
				)
			).to.be.fulfilled;

			await expect(
				communityAdminProxy.migrateCommunity(
					[communityManagerA.address],
					communityProxy.address
				)
			).to.be.rejectedWith(
				"CommunityAdmin::migrateCommunity: this community has been migrated"
			);
		});

		it("should not migrate community if not admin", async () => {
			await expect(
				communityAdminProxy.connect(adminAccount2).migrateCommunity(
					[communityManagerA.address],
					cUSD.address // wrong on purpose,
				)
			).to.be.rejectedWith(
				"CommunityAdmin: Not Owner Or ImpactMarketCouncil"
			);
		});

		it("should edit community if manager", async () => {
			(await communityProxy.incrementInterval()).should.be.equal(
				incrementIntervalDefault.toString()
			);

			(await communityProxy.maxBeneficiaries()).should.be.equal(
				maxBeneficiariesDefault
			);

			await communityAdminProxy.updateBeneficiaryParams(
				communityProxy.address,
				claimAmountDefault.toString(),
				maxClaimDefault.toString(),
				decreaseStepDefault.toString(),
				weekInBlocks.toString(),
				baseIntervalDefault.toString(),
				maxBeneficiariesDefault + 1
			);

			(await communityProxy.incrementInterval()).should.be.equal(
				baseIntervalDefault.toString()
			);

			(await communityProxy.maxClaim()).should.be.equal(
				maxClaimDefault.toString()
			);

			(await communityProxy.maxBeneficiaries()).should.be.equal(
				maxBeneficiariesDefault + 1
			);
		});

		it("should not be able edit community if not CommunityAdmin", async () => {
			await expect(
				communityProxy
					.connect(adminAccount1)
					.updateBeneficiaryParams(
						claimAmountDefault.toString(),
						maxClaimDefault.toString(),
						decreaseStepDefault.toString(),
						baseIntervalDefault.toString(),
						baseIntervalDefault.toString()
					)
			).to.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("should not be able edit community with invalid values", async () => {
			await expect(
				communityAdminProxy.updateBeneficiaryParams(
					communityProxy.address,
					claimAmountDefault.toString(),
					maxClaimDefault.toString(),
					decreaseStepDefault.toString(),
					baseIntervalDefault.toString(),
					weekInBlocks.toString(),
					maxBeneficiariesDefault
				)
			).to.be.rejected;

			await expect(
				communityAdminProxy.updateBeneficiaryParams(
					communityProxy.address,
					maxClaimDefault.toString(),
					claimAmountDefault.toString(),
					decreaseStepDefault.toString(),
					baseIntervalDefault.toString(),
					weekInBlocks.toString(),
					maxBeneficiariesDefault
				)
			).to.be.rejected;
		});

		it("should not add manager to community if manager", async () => {
			await expect(
				communityProxy
					.connect(communityManagerC)
					.addManager(communityManagerB.address)
			).to.be.rejectedWith("NOT_AMBASSADOR");
		});

		it("should not remove manager from community if manager", async () => {
			await communityProxy
				.connect(ambassadorA)
				.addManager(communityManagerB.address);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.removeManager(communityManagerB.address)
			).to.be.rejectedWith("NOT_AMBASSADOR");
		});

		it("should not add manager to community if not ambassador", async () => {
			await expect(
				communityProxy
					.connect(ambassadorB)
					.addManager(communityManagerB.address)
			).to.be.rejectedWith("NOT_AMBASSADOR");
		});

		it("should not remove manager from community if not ambassador", async () => {
			await communityProxy
				.connect(ambassadorA)
				.addManager(communityManagerB.address);
			await expect(
				communityProxy
					.connect(ambassadorB)
					.removeManager(communityManagerB.address)
			).to.be.rejectedWith("NOT_AMBASSADOR");
		});

		it("should add manager to community if ambassador", async () => {
			await expect(
				communityProxy
					.connect(ambassadorA)
					.addManager(communityManagerB.address)
			).to.be.fulfilled;
			await expect(
				communityProxy
					.connect(ambassadorA)
					.addManager(communityManagerC.address)
			).to.be.fulfilled;
		});

		it("should add manager to community if entity with an ambassador responsible", async () => {
			await expect(
				communityProxy
					.connect(ambassadorsEntityA)
					.addManager(communityManagerB.address)
			).to.be.fulfilled;
			await expect(
				communityProxy
					.connect(ambassadorsEntityA)
					.addManager(communityManagerC.address)
			).to.be.fulfilled;
		});

		it("should remove manager from community if ambassador", async () => {
			await expect(
				communityProxy
					.connect(ambassadorA)
					.addManager(communityManagerB.address)
			).to.be.fulfilled;
			await expect(
				communityProxy
					.connect(ambassadorA)
					.removeManager(communityManagerB.address)
			).to.be.fulfilled;
		});

		xit("should renounce from manager of community if manager", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addManager(communityManagerB.address);
			await expect(
				communityProxy
					.connect(communityManagerB)
					.renounceRole(managerRole, communityManagerB.address)
			).to.be.fulfilled;
		});

		it("should not lock community if manager", async () => {
			await expect(
				communityProxy.connect(communityManagerA).lock()
			).to.be.rejectedWith("Community: NOT_AMBASSADOR_OR_ENTITY");
		});

		it("should be able to lock community if ambassador", async () => {
			await expect(communityProxy.connect(ambassadorA).lock()).to.be
				.fulfilled;
		});

		it("should be able to lock community if entity with ambassador responsible", async () => {
			await expect(communityProxy.connect(ambassadorsEntityA).lock()).to
				.be.fulfilled;
		});
	});

	describe("Chaos test (complete flow)", async () => {
		// add community
		const addCommunity = async (
			communityManager: SignerWithAddress
		): Promise<ethersTypes.Contract> => {
			const tx = await communityAdminProxy.addCommunity(
				cUSD.address,
				[communityManager.address],
				ambassadorA.address,
				claimAmountDefault.toString(),
				maxClaimDefault.toString(),
				decreaseStepDefault.toString(),
				baseIntervalDefault.toString(),
				incrementIntervalDefault.toString(),
				communityMinTrancheDefault,
				communityMaxTrancheDefault,
				maxBeneficiariesDefault
			);

			let receipt = await tx.wait();

			const communityAddress = receipt.events?.filter((x: any) => {
				return x.event == "CommunityAdded";
			})[0]["args"]["communityAddress"];
			communityProxy = await ethers.getContractAt(
				"CommunityImplementation",
				communityAddress
			);
			await cUSD.mint(communityAddress, mintAmount.toString());

			return communityProxy;
		};
		// add beneficiary
		const addBeneficiary = async (
			community: ethersTypes.Contract,
			beneficiaryAddress: SignerWithAddress,
			communityManagerAddress: SignerWithAddress
		): Promise<void> => {
			const tx = await community
				.connect(communityManagerAddress)
				.addBeneficiaries([beneficiaryAddress.address]);
			const block = await provider.getBlock(tx.blockNumber); // block is null; the regular provider apparently doesn't know about this block yet.

			(
				await community.beneficiaries(beneficiaryAddress.address)
			).state.should.be.equal(BeneficiaryState.Valid);
		};
		// wait claim time
		const waitClaimTime = async (
			community: ethersTypes.Contract,
			beneficiaryAddress: SignerWithAddress
		): Promise<void> => {
			const waitIs = (
				await community.lastInterval(beneficiaryAddress.address)
			).toNumber();
			await advanceTimeAndBlockNTimes(waitIs + 1);
		};
		// claim
		const beneficiaryClaim = async (
			community: ethersTypes.Contract,
			beneficiaryAddress: SignerWithAddress
		): Promise<void> => {
			const previousBalance = await cUSD.balanceOf(
				beneficiaryAddress.address
			);
			await community.connect(beneficiaryAddress).claim();
			const currentBalance = await cUSD.balanceOf(
				beneficiaryAddress.address
			);
			previousBalance
				.add(await community.claimAmount())
				.should.be.equal(currentBalance);
		};

		before(async function () {
			await init();
		});
		beforeEach(async () => {
			await deploy();
		});

		it("one beneficiary to one community", async () => {
			await cUSD.mint(treasuryProxy.address, mintAmount.toString());
			const communityProxyA = await addCommunity(communityManagerA);
			await addBeneficiary(
				communityProxyA,
				beneficiaryA,
				communityManagerA
			);
			await waitClaimTime(communityProxyA, beneficiaryA);
			await beneficiaryClaim(communityProxyA, beneficiaryA);
			await expect(
				beneficiaryClaim(communityProxyA, beneficiaryA)
			).to.be.rejectedWith("NOT_YET");
			await waitClaimTime(communityProxyA, beneficiaryA);
			await beneficiaryClaim(communityProxyA, beneficiaryA);
		});

		it("many beneficiaries to one community", async () => {
			await cUSD.mint(treasuryProxy.address, mintAmount.toString());
			const communityProxyA = await addCommunity(communityManagerA);
			const previousCommunityBalance = await cUSD.balanceOf(
				communityProxyA.address
			);
			await addBeneficiary(
				communityProxyA,
				beneficiaryA,
				communityManagerA
			);
			await addBeneficiary(
				communityProxyA,
				beneficiaryB,
				communityManagerA
			);
			await addBeneficiary(
				communityProxyA,
				beneficiaryC,
				communityManagerA
			);
			await addBeneficiary(
				communityProxyA,
				beneficiaryD,
				communityManagerA
			);
			// beneficiary A claims twice
			await waitClaimTime(communityProxyA, beneficiaryA);
			await beneficiaryClaim(communityProxyA, beneficiaryA);
			await waitClaimTime(communityProxyA, beneficiaryA);
			await beneficiaryClaim(communityProxyA, beneficiaryA);
			// beneficiary B claims once
			await waitClaimTime(communityProxyA, beneficiaryB);
			await beneficiaryClaim(communityProxyA, beneficiaryB);
			// beneficiary C claims it all
			const claimAmount = await communityProxyA.claimAmount();
			const maxClaimAmount = await communityProxyA.maxClaim();
			let maxClaimsPerUser = maxClaimAmount.div(claimAmount).toNumber();
			if (claimAmount.mul(maxClaimsPerUser) < maxClaimAmount) {
				maxClaimsPerUser++;
			}
			for (let index = 1; index < maxClaimsPerUser; index++) {
				await waitClaimTime(communityProxyA, beneficiaryC);
				await beneficiaryClaim(communityProxyA, beneficiaryC);
			}
			await waitClaimTime(communityProxyA, beneficiaryC);
			await expect(communityProxyA.connect(beneficiaryC).claim()).to.be
				.fulfilled;

			// beneficiary B can still claim
			await waitClaimTime(communityProxyA, beneficiaryB);
			await beneficiaryClaim(communityProxyA, beneficiaryB);
			// beneficiary A can still claim
			await waitClaimTime(communityProxyA, beneficiaryA);
			await beneficiaryClaim(communityProxyA, beneficiaryA);
			// beneficiary A can still claim
			await waitClaimTime(communityProxyA, beneficiaryA);
			await beneficiaryClaim(communityProxyA, beneficiaryA);
			// beneficiary C can't claim anymore
			await waitClaimTime(communityProxyA, beneficiaryC);
			await expect(
				communityProxyA.connect(beneficiaryC).claim()
			).to.be.rejectedWith(
				"Community::claim: Already claimed everything"
			);
			const currentCommunityBalance = await cUSD.balanceOf(
				communityProxyA.address
			);

			previousCommunityBalance
				.sub(currentCommunityBalance)
				.should.be.equal(
					claimAmount
						.mul(6)
						.add(maxClaimAmount)
						.add(initialAmountDefault.mul(4))
				);
		});

		it("many beneficiaries to many communities", async () => {
			await cUSD.mint(treasuryProxy.address, mintAmount.toString());
			// community A
			const communityProxyA = await addCommunity(communityManagerA);
			const communityProxyB = await addCommunity(communityManagerB);
			const previousCommunityBalanceA = await cUSD.balanceOf(
				communityProxyA.address
			);
			const previousCommunityBalanceB = await cUSD.balanceOf(
				communityProxyB.address
			);
			//
			await addBeneficiary(
				communityProxyA,
				beneficiaryA,
				communityManagerA
			);
			await addBeneficiary(
				communityProxyA,
				beneficiaryB,
				communityManagerA
			);
			//
			await addBeneficiary(
				communityProxyB,
				beneficiaryC,
				communityManagerB
			);
			await addBeneficiary(
				communityProxyB,
				beneficiaryD,
				communityManagerB
			);
			// beneficiary A claims twice
			await waitClaimTime(communityProxyA, beneficiaryA);
			await beneficiaryClaim(communityProxyA, beneficiaryA);
			await waitClaimTime(communityProxyA, beneficiaryA);
			await beneficiaryClaim(communityProxyA, beneficiaryA);
			// beneficiary B claims it all
			const claimAmountA = await communityProxyA.claimAmount();
			const maxClaimAmountA = await communityProxyA.maxClaim();
			let maxClaimsPerUserA = maxClaimAmountA
				.div(claimAmountA)
				.toNumber();
			if (claimAmountA.mul(maxClaimsPerUserA) < maxClaimAmountA) {
				maxClaimsPerUserA++;
			}
			for (let index = 1; index < maxClaimsPerUserA; index++) {
				await waitClaimTime(communityProxyA, beneficiaryB);
				await beneficiaryClaim(communityProxyA, beneficiaryB);
			}
			await waitClaimTime(communityProxyA, beneficiaryB);
			await expect(communityProxyA.connect(beneficiaryB).claim()).to.be
				.fulfilled;
			// beneficiary C claims it all
			const claimAmountB = await communityProxyB.claimAmount();
			const maxClaimAmountB = await communityProxyB.maxClaim();
			let maxClaimsPerUserB = maxClaimAmountB
				.div(claimAmountB)
				.toNumber();
			if (claimAmountB.mul(maxClaimsPerUserB) < maxClaimAmountB) {
				maxClaimsPerUserB++;
			}
			for (let index = 1; index < maxClaimsPerUserB; index++) {
				await waitClaimTime(communityProxyB, beneficiaryC);
				await beneficiaryClaim(communityProxyB, beneficiaryC);
			}
			await waitClaimTime(communityProxyB, beneficiaryC);
			await expect(communityProxyB.connect(beneficiaryC).claim()).to.be
				.fulfilled;
			// beneficiary D claims three times
			await waitClaimTime(communityProxyB, beneficiaryD);
			await beneficiaryClaim(communityProxyB, beneficiaryD);
			await waitClaimTime(communityProxyB, beneficiaryD);
			await beneficiaryClaim(communityProxyB, beneficiaryD);
			await waitClaimTime(communityProxyB, beneficiaryD);
			await beneficiaryClaim(communityProxyB, beneficiaryD);
			// beneficiary A can still claim
			await waitClaimTime(communityProxyA, beneficiaryA);
			await beneficiaryClaim(communityProxyA, beneficiaryA);
			// beneficiary C can't claim anymore
			await waitClaimTime(communityProxyB, beneficiaryC);
			await expect(
				communityProxyB.connect(beneficiaryC).claim()
			).to.be.rejectedWith(
				"Community::claim: Already claimed everything"
			);
			// beneficiary B can't claim anymore
			await waitClaimTime(communityProxyB, beneficiaryC);
			await expect(
				communityProxyB.connect(beneficiaryC).claim()
			).to.be.rejectedWith(
				"Community::claim: Already claimed everything"
			);
			// beneficiary D can still claim
			await waitClaimTime(communityProxyB, beneficiaryD);
			await beneficiaryClaim(communityProxyB, beneficiaryD);
			// balances
			const currentCommunityBalanceA = await cUSD.balanceOf(
				communityProxyA.address
			);
			previousCommunityBalanceA
				.sub(currentCommunityBalanceA)
				.should.be.equal(
					claimAmountA
						.mul(3)
						.add(maxClaimAmountA)
						.add(initialAmountDefault.mul(2))
				);
			const currentCommunityBalanceB = await cUSD.balanceOf(
				communityProxyB.address
			);
			previousCommunityBalanceB
				.sub(currentCommunityBalanceB)
				.should.be.equal(
					claimAmountB
						.mul(4)
						.add(maxClaimAmountB)
						.add(initialAmountDefault.mul(2))
				);
		});
	});

	describe("Community - getFunds", () => {
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();
			await cUSD.mint(treasuryProxy.address, mintAmount.toString());

			await addDefaultCommunity();

			firstBlock = await getBlockNumber();
		});

		it("should get funds if manager", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			await communityProxy.connect(beneficiaryA).claim();

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(claimAmountDefault.add(initialAmountDefault));
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await communityProxy.lastFundRequest()).to.be.equal(
				firstBlock + 3
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);
		});

		it("should not get funds if not manager", async () => {
			await expect(
				communityProxy.connect(beneficiaryA).requestFunds()
			).to.be.rejectedWith("Community: NOT_MANAGER");

			expect(await communityProxy.lastFundRequest()).to.be.equal(0);
		});

		it("should not change community tranche limits if not admin", async () => {
			await expect(
				communityAdminProxy
					.connect(communityManagerA)
					.updateCommunityParams(
						communityProxy.address,
						parseEther("50"),
						parseEther("100")
					)
			).to.be.rejectedWith(
				"CommunityAdmin: Not Owner Or ImpactMarketCouncil"
			);
		});

		it("should change community tranche limits if admin", async () => {
			await expect(
				communityAdminProxy
					.connect(adminAccount1)
					.updateCommunityParams(
						communityProxy.address,
						parseEther("50"),
						parseEther("100")
					)
			).to.be.fulfilled;

			expect(await communityProxy.minTranche()).to.be.equal(
				parseEther("50")
			);
			expect(await communityProxy.maxTranche()).to.be.equal(
				parseEther("100")
			);
		});

		it("should not change communityMaxTranche if not admin", async () => {
			await expect(
				communityAdminProxy
					.connect(communityManagerA)
					.updateCommunityParams(
						communityProxy.address,
						parseEther("123"),
						parseEther("124")
					)
			).to.be.rejectedWith(
				"CommunityAdmin: Not Owner Or ImpactMarketCouncil"
			);
		});

		it("should change communityMaxTranche if admin", async () => {
			await expect(
				communityAdminProxy
					.connect(adminAccount1)
					.updateCommunityParams(
						communityProxy.address,
						parseEther("100"),
						parseEther("1234")
					)
			).to.be.fulfilled;

			expect(await communityProxy.maxTranche()).to.be.equal(
				parseEther("1234")
			);
		});

		it("should not set communityMinTranche greater than communityMaxTranche", async () => {
			await expect(
				communityAdminProxy
					.connect(adminAccount1)
					.updateCommunityParams(
						communityProxy.address,
						parseEther("50"),
						parseEther("100")
					)
			).to.be.fulfilled;
			await expect(
				communityAdminProxy
					.connect(adminAccount1)
					.updateCommunityParams(
						communityProxy.address,
						parseEther("100"),
						parseEther("50")
					)
			).to.be.rejectedWith(
				"Community::updateCommunityParams: minTranche should not be greater than maxTranche"
			);

			expect(await communityProxy.minTranche()).to.be.equal(
				parseEther("50")
			);
			expect(await communityProxy.maxTranche()).to.be.equal(
				parseEther("100")
			);
		});

		it("should transfer funds to community", async () => {
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			communityProxy.connect(beneficiaryA).claim();

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(claimAmountDefault.add(initialAmountDefault));
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await communityProxy.lastFundRequest()).to.be.equal(
				firstBlock + 3
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);
		});

		it("should not transfer funds to community too often", async () => {
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			communityProxy.connect(beneficiaryA).claim();

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(claimAmountDefault.add(initialAmountDefault));
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await communityProxy.lastFundRequest()).to.be.equal(
				firstBlock + 3
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);

			await expect(
				communityAdminProxy.transferFromCommunity(
					communityProxy.address,
					cUSD.address,
					adminAccount1.address,
					communityMinTrancheDefault
				)
			).to.be.fulfilled;

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.rejectedWith(
				"CommunityAdmin::fundCommunity: this community cannot request now"
			);

			expect(await communityProxy.lastFundRequest()).to.be.equal(
				firstBlock + 3
			);
		});

		it("should transfer funds to community again after baseInterval", async () => {
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			communityProxy.connect(beneficiaryA).claim();

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(claimAmountDefault.add(initialAmountDefault));
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await communityProxy.lastFundRequest()).to.be.equal(
				firstBlock + 3
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);

			await expect(
				communityAdminProxy.transferFromCommunity(
					communityProxy.address,
					cUSD.address,
					adminAccount1.address,
					communityMinTrancheDefault
				)
			).to.be.fulfilled;

			await advanceBlockNTimes(baseIntervalDefault);

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(communityMinTrancheDefault);
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await communityProxy.lastFundRequest()).to.be.equal(
				firstBlock + 41
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);
		});

		it("should not transfer funds more then safety limit", async () => {
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);

			await treasuryProxy.transfer(
				cUSD.address,
				adminAccount1.address,
				await cUSD.balanceOf(treasuryProxy.address)
			);
			await cUSD.mint(treasuryProxy.address, parseEther("100"));

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			communityProxy.connect(beneficiaryA).claim();

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryB.address]);
			communityProxy.connect(beneficiaryB).claim();

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryC.address]);
			communityProxy.connect(beneficiaryC).claim();

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryD.address]);
			communityProxy.connect(beneficiaryD).claim();

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([communityManagerA.address]);
			communityProxy.connect(communityManagerA).claim();

			const communityBalance = await cUSD.balanceOf(
				communityProxy.address
			);
			const treasurySafetyLimit = (
				await cUSD.balanceOf(treasuryProxy.address)
			).div(TREASURY_SAFETY_FACTOR);

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(treasurySafetyLimit);
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityBalance.add(treasurySafetyLimit)
			);
		});

		it("should not transfer funds more then safety limit #2", async () => {
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);

			await treasuryProxy.transfer(
				cUSD.address,
				adminAccount1.address,
				await cUSD.balanceOf(treasuryProxy.address)
			);
			await cUSD.mint(treasuryProxy.address, parseEther("10"));

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			communityProxy.connect(beneficiaryA).claim();

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.rejectedWith(
				"CommunityAdmin::fundCommunity: this community cannot request now"
			);
		});

		it("should donate directly in the community", async () => {
			const user1Donation = 1;

			await cUSD.mint(adminAccount1.address, user1Donation);
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);

			await cUSD.approve(communityProxy.address, user1Donation);
			await communityProxy.donate(adminAccount1.address, user1Donation);

			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault.add(user1Donation)
			);
			expect(await communityProxy.treasuryFunds()).to.be.equal(
				communityMinTrancheDefault
			);
			expect(await communityProxy.privateFunds()).to.be.equal(
				user1Donation
			);
		});

		it("should not requestFunds if you have more then communityMinTranche", async () => {
			const user1Donation = 1;

			await cUSD.mint(adminAccount1.address, parseEther("100"));
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);

			await cUSD.approve(communityProxy.address, user1Donation);
			await communityProxy.donate(adminAccount1.address, user1Donation);

			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault.add(user1Donation)
			);

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.rejectedWith(
				"CommunityAdmin::fundCommunity: this community cannot request now"
			);
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault.add(user1Donation)
			);

			expect(await communityProxy.lastFundRequest()).to.be.equal(0);
		});

		it("should transfer funds if admin", async () => {
			const userInitialBalance = await cUSD.balanceOf(
				adminAccount1.address
			);
			const communityInitialBalance = await cUSD.balanceOf(
				communityProxy.address
			);
			await expect(
				communityAdminProxy.transferFromCommunity(
					communityProxy.address,
					cUSD.address,
					adminAccount1.address,
					communityInitialBalance
				)
			).to.be.fulfilled;
			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				"0"
			);
			expect(await cUSD.balanceOf(adminAccount1.address)).to.be.equal(
				userInitialBalance.add(communityInitialBalance)
			);
		});

		it("should get more funds if have private donations", async () => {
			const user1Donation = parseEther("20000");

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			await cUSD.mint(adminAccount1.address, user1Donation);
			await cUSD.approve(communityProxy.address, user1Donation);
			await communityProxy.donate(adminAccount1.address, user1Donation);

			await communityAdminProxy.transferFromCommunity(
				communityProxy.address,
				cUSD.address,
				adminAccount1.address,
				user1Donation
			);

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(initialAmountDefault);
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await communityProxy.lastFundRequest()).to.be.equal(
				firstBlock + 6
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.be.equal(
				communityMinTrancheDefault
			);
		});
	});

	describe("Community Implementation - upgrade", () => {
		let oldCommunityImplementation: ethersTypes.Contract;
		let oldCommunityAdminImplementation: ethersTypes.Contract;
		let oldCommunityAdminProxy: ethersTypes.Contract;

		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(treasuryProxy.address, mintAmount.toString());

			oldCommunityAdminImplementation = await ethers.getContractAt(
				"CommunityAdminImplementationOld",
				(
					await (
						await ethers.getContractFactory(
							"CommunityAdminImplementationOld"
						)
					).deploy()
				).address
			);

			oldCommunityAdminProxy = await ethers.getContractAt(
				"CommunityAdminImplementationOld",
				(
					await (
						await ethers.getContractFactory("CommunityAdminProxy")
					).deploy(
						oldCommunityAdminImplementation.address,
						impactProxyAdmin.address
					)
				).address
			);

			oldCommunityImplementation = await ethers.getContractAt(
				"CommunityOld",
				(
					await (
						await ethers.getContractFactory("CommunityOld")
					).deploy()
				).address
			);

			await oldCommunityAdminProxy.initialize(
				oldCommunityImplementation.address,
				cUSD.address
			);

			oldCommunityAdminProxy.updateTreasury(treasuryProxy.address);

			await treasuryProxy.updateCommunityAdmin(
				oldCommunityAdminProxy.address
			);
		});

		async function createOldCommunity(
			communityAdminProxy: ethersTypes.Contract
		) {
			const tx = await communityAdminProxy.addCommunity(
				[communityManagerA.address],
				claimAmountDefault,
				maxClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault,
				communityMinTrancheDefault,
				communityMaxTrancheDefault
			);

			let receipt = await tx.wait();

			return receipt.events?.filter((x: any) => {
				return x.event == "CommunityAdded";
			})[0]["args"]["communityAddress"];
		}

		it("Should be old community", async function () {
			(await oldCommunityAdminProxy.communityTemplate()).should.be.equal(
				oldCommunityImplementation.address
			);
			(await oldCommunityAdminProxy.getVersion()).should.be.equal(1);

			oldCommunityAdminProxy = await ethers.getContractAt(
				"CommunityAdminImplementation",
				oldCommunityAdminProxy.address
			);
			await expect(
				oldCommunityAdminProxy.communityMiddleProxy()
			).to.be.rejectedWith(
				"Transaction reverted: function selector was not recognized and there's no fallback function"
			);
			await expect(
				oldCommunityAdminProxy.ambassadors()
			).to.be.rejectedWith(
				"Transaction reverted: function selector was not recognized and there's no fallback function"
			);
			await expect(
				oldCommunityAdminProxy.impactMarketCouncil()
			).to.be.rejectedWith(
				"Transaction reverted: function selector was not recognized and there's no fallback function"
			);
		});

		it("Should upgrade communityAdmin implementation", async function () {
			const oldCommunityProxy1 = await ethers.getContractAt(
				"CommunityOld",
				await createOldCommunity(oldCommunityAdminProxy)
			);

			const oldCommunityProxy2 = await ethers.getContractAt(
				"CommunityOld",
				await createOldCommunity(oldCommunityAdminProxy)
			);

			await oldCommunityProxy1
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);

			await oldCommunityProxy1
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryB.address);

			await oldCommunityProxy2
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryC.address);

			(await oldCommunityProxy1.getVersion()).should.be.equal(1);
			(await oldCommunityProxy2.getVersion()).should.be.equal(1);

			await oldCommunityAdminProxy.updateCommunityParams(
				oldCommunityProxy1.address,
				1,
				2
			);

			await expect(
				impactProxyAdmin.upgrade(
					oldCommunityAdminProxy.address,
					communityAdminImplementation.address
				)
			).to.be.fulfilled;

			oldCommunityAdminProxy = await ethers.getContractAt(
				"CommunityAdminImplementation",
				oldCommunityAdminProxy.address
			);

			await oldCommunityAdminProxy.updateCommunityMiddleProxy(
				communityMiddleProxy.address
			);

			await oldCommunityAdminProxy.updateCommunityImplementation(
				communityImplementation.address
			);

			await oldCommunityAdminProxy.updateAmbassadors(
				(
					await deployments.get("AmbassadorsProxy")
				).address
			);
			ambassadorsProxy.updateCommunityAdmin(
				oldCommunityAdminProxy.address
			);

			//communityProxy3 is still an old type community
			const communityProxy3 = await ethers.getContractAt(
				"CommunityImplementation",
				await createCommunity(oldCommunityAdminProxy)
			);

			await communityProxy3
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryD.address]);

			await oldCommunityAdminProxy.updateCommunityParams(
				communityProxy3.address,
				2,
				3
			);
			(await oldCommunityProxy1.getVersion()).should.be.equal(1);
			(await oldCommunityProxy2.getVersion()).should.be.equal(1);
			(await communityProxy3.getVersion()).should.be.equal(3);
		});

		it("Should have same storage after upgrading community implementation #1", async function () {
			const oldCommunityProxy1 = await ethers.getContractAt(
				"CommunityOld",
				await createOldCommunity(oldCommunityAdminProxy)
			);

			await oldCommunityProxy1
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			await oldCommunityProxy1
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryB.address);

			await oldCommunityProxy1.connect(beneficiaryA).claim();

			(await oldCommunityProxy1.getVersion()).should.be.equal(1);

			await expect(
				impactProxyAdmin.upgrade(
					oldCommunityAdminProxy.address,
					communityAdminImplementation.address
				)
			).to.be.fulfilled;

			oldCommunityAdminProxy = await ethers.getContractAt(
				"CommunityAdminImplementation",
				oldCommunityAdminProxy.address
			);

			await oldCommunityAdminProxy.updateCommunityMiddleProxy(
				communityMiddleProxy.address
			);

			await oldCommunityAdminProxy.updateCommunityImplementation(
				communityImplementation.address
			);

			await oldCommunityAdminProxy.updateAmbassadors(
				(
					await deployments.get("AmbassadorsProxy")
				).address
			);
			ambassadorsProxy.updateCommunityAdmin(
				oldCommunityAdminProxy.address
			);

			(await oldCommunityProxy1.getVersion()).should.be.equal(1);

			const beneficiaryABefore = await oldCommunityProxy1.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBBefore = await oldCommunityProxy1.beneficiaries(
				beneficiaryB.address
			);

			await oldCommunityAdminProxy.updateProxyImplementation(
				oldCommunityProxy1.address,
				communityMiddleProxy.address
			);

			(await oldCommunityProxy1.getVersion()).should.be.equal(3);

			const beneficiaryAAfter = await oldCommunityProxy1.beneficiaries(
				beneficiaryA.address
			);
			(await beneficiaryAAfter.state).should.eq(beneficiaryABefore.state);
			(await beneficiaryAAfter.claims).should.eq(
				beneficiaryABefore.claims
			);
			(await beneficiaryAAfter.claimedAmount).should.eq(
				beneficiaryABefore.claimedAmount
			);
			(await beneficiaryAAfter.lastClaim).should.eq(
				beneficiaryABefore.lastClaim
			);

			const beneficiaryBAfter = await oldCommunityProxy1.beneficiaries(
				beneficiaryB.address
			);
			(await beneficiaryBAfter.state).should.eq(beneficiaryBBefore.state);
			(await beneficiaryBAfter.claims).should.eq(
				beneficiaryBBefore.claims
			);
			(await beneficiaryBAfter.claimedAmount).should.eq(
				beneficiaryBBefore.claimedAmount
			);
			(await beneficiaryBAfter.lastClaim).should.eq(
				beneficiaryBBefore.lastClaim
			);
		});
	});

	describe("Community - Token", () => {
		let UniswapV2Factory: ethersTypes.Contract;
		let UniswapRouter: ethersTypes.Contract;
		let cUSD: ethersTypes.Contract;
		let mUSD: ethersTypes.Contract;
		let celo: ethersTypes.Contract;

		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			UniswapV2Factory = await ethers.getContractAt(
				"UniswapV2Factory",
				(
					await deployments.get("UniswapV2Factory")
				).address
			);

			UniswapRouter = await ethers.getContractAt(
				"UniswapV2Router02",
				(
					await deployments.get("UniswapV2Router02")
				).address
			);

			cUSD = await ethers.getContractAt(
				"TokenMock",
				(
					await deployments.get("TokenMock")
				).address
			);

			const tokenFactory = await ethers.getContractFactory("TokenMock");

			mUSD = await tokenFactory.deploy("mUSD", "mUSD");
			celo = await tokenFactory.deploy("celo", "celo");

			await cUSD.mint(treasuryProxy.address, mintAmount.toString());

			await addDefaultCommunity();

			await cUSD.mint(adminAccount1.address, toEther(100000000));
			await mUSD.mint(adminAccount1.address, toEther(100000000));
			await celo.mint(adminAccount1.address, toEther(100000000));

			await treasuryProxy.updateUniswapRouter(UniswapRouter.address);

			await cUSD
				.connect(adminAccount1)
				.approve(UniswapRouter.address, toEther(1000000));
			await mUSD
				.connect(adminAccount1)
				.approve(UniswapRouter.address, toEther(2000000));
			await celo
				.connect(adminAccount1)
				.approve(UniswapRouter.address, toEther(500000));

			await UniswapRouter.connect(adminAccount1).addLiquidity(
				cUSD.address,
				mUSD.address,
				toEther(1000000),
				toEther(1000000),
				0,
				0,
				adminAccount1.address,
				Math.floor(new Date().getTime() / 1000) + 30 * 60
			);

			await UniswapRouter.connect(adminAccount1).addLiquidity(
				mUSD.address,
				celo.address,
				toEther(1000000),
				toEther(500000),
				0,
				0,
				adminAccount1.address,
				Math.floor(new Date().getTime() / 1000) + 30 * 60
			);

			await treasuryProxy.setToken(mUSD.address, toEther(0.9), [
				mUSD.address,
				cUSD.address,
			]);
			await treasuryProxy.setToken(celo.address, toEther(0.5), [
				celo.address,
				mUSD.address,
				cUSD.address,
			]);
		});

		it("should return correct token address", async function () {
			expect(await communityProxy.cUSD()).equal(
				await communityAdminProxy.cUSD()
			);
			expect(await communityProxy.token()).equal(
				await communityAdminProxy.cUSD()
			);
		});

		it("should not update token if not communityAdmin", async function () {
			expect(await communityProxy.cUSD()).equal(
				await communityAdminProxy.cUSD()
			);
			expect(await communityProxy.token()).equal(
				await communityAdminProxy.cUSD()
			);
			await expect(
				communityProxy.updateToken(
					FAKE_ADDRESS,
					[],
					claimAmountDefault,
					maxClaimDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.rejectedWith("Ownable: caller is not the owner");
			expect(await communityProxy.token()).equal(
				await communityAdminProxy.cUSD()
			);
			expect(await communityProxy.cUSD()).equal(
				await communityAdminProxy.cUSD()
			);
		});

		it("should not update community token if not owner or council", async function () {
			expect(await communityProxy.cUSD()).equal(
				await communityAdminProxy.cUSD()
			);
			expect(await communityProxy.token()).equal(
				await communityAdminProxy.cUSD()
			);
			await expect(
				communityAdminProxy
					.connect(beneficiaryA)
					.updateCommunityToken(
						communityProxy.address,
						FAKE_ADDRESS,
						[],
						claimAmountDefault,
						maxClaimDefault,
						decreaseStepDefault,
						baseIntervalDefault,
						incrementIntervalDefault
					)
			).to.be.rejectedWith(
				"CommunityAdmin: Not Owner Or ImpactMarketCouncil"
			);
			expect(await communityProxy.token()).equal(
				await communityAdminProxy.cUSD()
			);
			expect(await communityProxy.cUSD()).equal(
				await communityAdminProxy.cUSD()
			);
		});

		it("should not update community token with an un-allowed token", async function () {
			expect(await communityProxy.cUSD()).equal(
				await communityAdminProxy.cUSD()
			);
			expect(await communityProxy.token()).equal(
				await communityAdminProxy.cUSD()
			);
			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					FAKE_ADDRESS,
					[],
					claimAmountDefault,
					maxClaimDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.rejectedWith("Community::updateToken: Invalid token");
			expect(await communityProxy.token()).equal(
				await communityAdminProxy.cUSD()
			);
			expect(await communityProxy.cUSD()).equal(
				await communityAdminProxy.cUSD()
			);
		});

		it("should not update community token with the same token", async function () {
			expect(await communityProxy.cUSD()).equal(
				await communityAdminProxy.cUSD()
			);
			expect(await communityProxy.token()).equal(
				await communityAdminProxy.cUSD()
			);
			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cUSD.address,
					[],
					claimAmountDefault,
					maxClaimDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.rejectedWith(
				"Community::updateToken: New token cannot be the same as the current token"
			);
			expect(await communityProxy.token()).equal(
				await communityAdminProxy.cUSD()
			);
			expect(await communityProxy.cUSD()).equal(
				await communityAdminProxy.cUSD()
			);
		});

		it("should not update community token with wrong path", async function () {
			await treasuryProxy.setToken(mUSD.address, toEther(0.9), [
				mUSD.address,
				cUSD.address,
			]);
			await treasuryProxy.setToken(celo.address, toEther(0.5), [
				celo.address,
				mUSD.address,
				cUSD.address,
			]);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					celo.address,
					[mUSD.address, celo.address],
					claimAmountDefault,
					maxClaimDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.rejectedWith(
				"Community::updateToken: invalid exchangePath"
			);
			expect(await communityProxy.token()).equal(
				await communityAdminProxy.cUSD()
			);
			expect(await communityProxy.cUSD()).equal(
				await communityAdminProxy.cUSD()
			);
		});

		it("should update token", async function () {
			expect(await communityProxy.token()).equal(cUSD.address);
			expect(await communityProxy.cUSD()).equal(cUSD.address);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					celo.address,
					[cUSD.address, mUSD.address, celo.address],
					claimAmountDefault.mul(2),
					maxClaimDefault.mul(3),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 5,
					incrementIntervalDefault * 6
				)
			).to.be.fulfilled;

			expect(await communityProxy.token()).equal(celo.address);
			expect(await communityProxy.cUSD()).equal(celo.address);
			expect(await communityProxy.claimAmount()).equal(
				claimAmountDefault.mul(2)
			);
			expect(await communityProxy.maxClaim()).equal(
				maxClaimDefault.mul(3)
			);
			expect(await communityProxy.getInitialMaxClaim()).equal(
				maxClaimDefault.mul(3)
			);
			expect(await communityProxy.decreaseStep()).equal(
				decreaseStepDefault.mul(4)
			);
			expect(await communityProxy.baseInterval()).equal(
				baseIntervalDefault * 5
			);
			expect(await communityProxy.incrementInterval()).equal(
				incrementIntervalDefault * 6
			);

			expect(await celo.balanceOf(communityProxy.address)).equal(
				toEther("49.690556565466314747")
			);

			expect(await communityProxy.tokensLength()).equal(2);

			const token1 = await communityProxy.tokens(0);
			expect(token1.tokenAddress).to.be.equal(cUSD.address);
			expect(token1.ratio).to.be.equal(toEther(1));
			expect(token1.startBlock).to.be.equal(0);

			const token2 = await communityProxy.tokens(1);
			expect(token2.tokenAddress).to.be.equal(celo.address);
			expect(token2.ratio).to.be.equal(toEther(3));
			expect(token2.startBlock).to.be.equal(await getBlockNumber());
		});

		it("should beneficiary claim after token update", async function () {
			expect(await communityProxy.token()).equal(cUSD.address);
			expect(await communityProxy.cUSD()).equal(cUSD.address);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			//first claim
			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			const tokenList = await communityProxy.tokenList();
			expect(tokenList.length).to.be.eq(1);
			expect(tokenList[0]).to.be.eq(cUSD.address);
			const claimedAmounts =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts.length).to.be.eq(1);
			expect(claimedAmounts[0]).to.be.eq(claimAmountDefault);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					celo.address,
					[cUSD.address, mUSD.address, celo.address],
					claimAmountDefault.mul(2),
					maxClaimDefault.mul(3),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 2,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(await communityProxy.token()).equal(celo.address);
			expect(await communityProxy.cUSD()).equal(celo.address);
			expect(await communityProxy.claimAmount()).equal(
				claimAmountDefault.mul(2)
			);
			expect(await communityProxy.maxClaim()).equal(
				maxClaimDefault.mul(3).sub(decreaseStepDefault.mul(4))
			);
			expect(await communityProxy.getInitialMaxClaim()).equal(
				maxClaimDefault.mul(3)
			);
			expect(await communityProxy.decreaseStep()).equal(
				decreaseStepDefault.mul(4)
			);
			expect(await communityProxy.baseInterval()).equal(
				baseIntervalDefault * 2
			);
			expect(await communityProxy.incrementInterval()).equal(
				incrementIntervalDefault
			);

			expect(await celo.balanceOf(communityProxy.address)).equal(
				toEther("48.672098774831796728")
			);

			//second claim - after token update
			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("NOT_YET");

			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault * 2
			);

			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("NOT_YET");

			await advanceTimeAndBlockNTimes(baseIntervalDefault);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault.add(initialAmountDefault)
			);
			expect(await celo.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault.mul(2)
			);

			let tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(2);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(celo.address);
			let claimedAmounts2 =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts2.length).to.be.eq(2);
			expect(claimedAmounts2[0]).to.be.eq(claimAmountDefault);
			expect(claimedAmounts2[1]).to.be.eq(claimAmountDefault.mul(2));

			let beneficiary = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiary.claimedAmount).to.eq(
				claimAmountDefault.mul(3).add(claimAmountDefault.mul(2))
			);

			//third claim - after token update
			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("NOT_YET");

			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("NOT_YET");

			await advanceTimeAndBlockNTimes(baseIntervalDefault);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault.add(initialAmountDefault)
			);
			expect(await celo.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault.mul(2).mul(2)
			);

			tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(2);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(celo.address);
			claimedAmounts2 = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryA.address
			);
			expect(claimedAmounts2.length).to.be.eq(2);
			expect(claimedAmounts2[0]).to.be.eq(claimAmountDefault);
			expect(claimedAmounts2[1]).to.be.eq(
				claimAmountDefault.mul(2).mul(2)
			);

			beneficiary = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiary.claimedAmount).to.eq(
				claimAmountDefault
					.mul(3)
					.add(claimAmountDefault.mul(2))
					.add(claimAmountDefault.mul(2))
			);
		});

		it("should beneficiary claim after multiple token update #1", async function () {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			//first claim
			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			const tokenList = await communityProxy.tokenList();
			expect(tokenList.length).to.be.eq(1);
			expect(tokenList[0]).to.be.eq(cUSD.address);
			const claimedAmounts =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts.length).to.be.eq(1);
			expect(claimedAmounts[0]).to.be.eq(claimAmountDefault);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					celo.address,
					[cUSD.address, mUSD.address, celo.address],
					claimAmountDefault.mul(2),
					maxClaimDefault.mul(3),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 2,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(await communityProxy.token()).equal(celo.address);
			expect(await communityProxy.cUSD()).equal(celo.address);
			expect(await communityProxy.claimAmount()).equal(
				claimAmountDefault.mul(2)
			);
			expect(await communityProxy.maxClaim()).equal(
				maxClaimDefault.mul(3).sub(decreaseStepDefault.mul(4))
			);
			expect(await communityProxy.getInitialMaxClaim()).equal(
				maxClaimDefault.mul(3)
			);
			expect(await communityProxy.decreaseStep()).equal(
				decreaseStepDefault.mul(4)
			);
			expect(await communityProxy.baseInterval()).equal(
				baseIntervalDefault * 2
			);
			expect(await communityProxy.incrementInterval()).equal(
				incrementIntervalDefault
			);

			expect(await celo.balanceOf(communityProxy.address)).equal(
				toEther("48.672098774831796728")
			);

			//second claim - after token update
			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("NOT_YET");

			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault * 2
			);

			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("NOT_YET");

			await advanceTimeAndBlockNTimes(baseIntervalDefault);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault.add(initialAmountDefault)
			);
			expect(await celo.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault.mul(2)
			);

			let tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(2);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(celo.address);
			let claimedAmounts2 =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts2.length).to.be.eq(2);
			expect(claimedAmounts2[0]).to.be.eq(claimAmountDefault);
			expect(claimedAmounts2[1]).to.be.eq(claimAmountDefault.mul(2));

			let beneficiary = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiary.claimedAmount).to.eq(
				claimAmountDefault.mul(3).add(claimAmountDefault.mul(2))
			);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					mUSD.address,
					[celo.address, mUSD.address],
					claimAmountDefault,
					maxClaimDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(await communityProxy.token()).equal(mUSD.address);
			expect(await communityProxy.cUSD()).equal(mUSD.address);
			expect(await communityProxy.claimAmount()).equal(
				claimAmountDefault
			);
			expect(await communityProxy.maxClaim()).equal(
				maxClaimDefault.sub(decreaseStepDefault)
			);
			expect(await communityProxy.getInitialMaxClaim()).equal(
				maxClaimDefault
			);
			expect(await communityProxy.decreaseStep()).equal(
				decreaseStepDefault
			);
			expect(await communityProxy.baseInterval()).equal(
				baseIntervalDefault
			);
			expect(await communityProxy.incrementInterval()).equal(
				incrementIntervalDefault
			);

			expect(await celo.balanceOf(communityProxy.address)).equal(
				toEther(0)
			);
			expect(await mUSD.balanceOf(communityProxy.address)).equal(
				toEther("89.085599505569500181")
			);

			//third claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault.add(initialAmountDefault)
			);
			expect(await celo.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault.mul(2)
			);
			expect(await mUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault
			);

			tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(3);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(celo.address);
			expect(tokenList2[2]).to.be.eq(mUSD.address);
			claimedAmounts2 = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryA.address
			);
			expect(claimedAmounts2.length).to.be.eq(3);
			expect(claimedAmounts2[0]).to.be.eq(claimAmountDefault);
			expect(claimedAmounts2[1]).to.be.eq(claimAmountDefault.mul(2));
			expect(claimedAmounts2[2]).to.be.eq(claimAmountDefault);

			beneficiary = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiary.claimedAmount.div(10)).to.eq(
				//div(10) to skip the last decimal
				claimAmountDefault
					.mul(3)
					.add(claimAmountDefault.mul(2))
					.div(3)
					.add(claimAmountDefault)
					.div(10) //div(10) to skip the last decimal
			);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cUSD.address,
					[mUSD.address, cUSD.address],
					claimAmountDefault.div(2),
					maxClaimDefault.div(2),
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(await communityProxy.token()).equal(cUSD.address);
			expect(await communityProxy.cUSD()).equal(cUSD.address);
			expect(await communityProxy.claimAmount()).equal(
				claimAmountDefault.div(2)
			);
			expect(await communityProxy.maxClaim()).equal(
				maxClaimDefault.div(2).sub(decreaseStepDefault)
			);
			expect(await communityProxy.getInitialMaxClaim()).equal(
				maxClaimDefault.div(2)
			);
			expect(await communityProxy.decreaseStep()).equal(
				decreaseStepDefault
			);
			expect(await communityProxy.baseInterval()).equal(
				baseIntervalDefault
			);
			expect(await communityProxy.incrementInterval()).equal(
				incrementIntervalDefault
			);

			expect(await cUSD.balanceOf(communityProxy.address)).equal(
				toEther("86.833786890238093963")
			);

			//forth claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault * 3
			);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault
					.add(initialAmountDefault)
					.add(claimAmountDefault.div(2))
			);
			expect(await celo.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault.mul(2)
			);
			expect(await mUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault
			);

			tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(3);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(celo.address);
			expect(tokenList2[2]).to.be.eq(mUSD.address);
			claimedAmounts2 = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryA.address
			);
			expect(claimedAmounts2.length).to.be.eq(3);
			expect(claimedAmounts2[0]).to.be.eq(
				claimAmountDefault.add(claimAmountDefault.div(2))
			);
			expect(claimedAmounts2[1]).to.be.eq(claimAmountDefault.mul(2));
			expect(claimedAmounts2[2]).to.be.eq(claimAmountDefault);

			beneficiary = await communityProxy.beneficiaries(
				beneficiaryA.address
			);

			expect(beneficiary.claimedAmount.div(10)).to.eq(
				//div(10) to skip the last decimal
				claimAmountDefault
					.mul(3)
					.add(claimAmountDefault.mul(2))
					.div(3)
					.add(claimAmountDefault)
					.div(2)
					.add(claimAmountDefault.div(2))
					.div(10) //div(10) to skip the last decimal
			);
		});

		it("should update token multiple times", async function () {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			//first claim
			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			const tokenList = await communityProxy.tokenList();
			expect(tokenList.length).to.be.eq(1);
			expect(tokenList[0]).to.be.eq(cUSD.address);

			const claimedAmounts =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts.length).to.be.eq(1);
			expect(claimedAmounts[0]).to.be.eq(claimAmountDefault);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					celo.address,
					[cUSD.address, mUSD.address, celo.address],
					claimAmountDefault.mul(2),
					maxClaimDefault.mul(4),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 2,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(claimAmountDefault.mul(4));

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					mUSD.address,
					[celo.address, mUSD.address],
					claimAmountDefault,
					maxClaimDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(claimAmountDefault);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cUSD.address,
					[mUSD.address, cUSD.address],
					claimAmountDefault.div(2),
					maxClaimDefault.div(2),
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(claimAmountDefault.div(2));

			expect(await communityProxy.token()).equal(cUSD.address);
			expect(await communityProxy.cUSD()).equal(cUSD.address);
			expect(await communityProxy.claimAmount()).equal(
				claimAmountDefault.div(2)
			);
			expect(await communityProxy.maxClaim()).equal(
				maxClaimDefault.div(2).sub(decreaseStepDefault)
			);
			expect(await communityProxy.getInitialMaxClaim()).equal(
				maxClaimDefault.div(2)
			);
			expect(await communityProxy.decreaseStep()).equal(
				decreaseStepDefault
			);
			expect(await communityProxy.baseInterval()).equal(
				baseIntervalDefault
			);
			expect(await communityProxy.incrementInterval()).equal(
				incrementIntervalDefault
			);

			expect(await cUSD.balanceOf(communityProxy.address)).equal(
				toEther("96.780048567975995775")
			);

			//forth claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				claimAmountDefault
					.add(initialAmountDefault)
					.add(claimAmountDefault.div(2))
			);
			expect(await celo.balanceOf(beneficiaryA.address)).to.be.equal(0);
			expect(await mUSD.balanceOf(beneficiaryA.address)).to.be.equal(0);

			let tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(3);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(celo.address);
			expect(tokenList2[2]).to.be.eq(mUSD.address);
			let claimedAmounts2 =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts2.length).to.be.eq(3);
			expect(claimedAmounts2[0]).to.be.eq(
				claimAmountDefault.add(claimAmountDefault.div(2))
			);
			expect(claimedAmounts2[1]).to.be.eq(0);
			expect(claimedAmounts2[2]).to.be.eq(0);

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(claimAmountDefault.div(2).add(claimAmountDefault.div(2)));
		});

		it("should update token multiple times, new beneficiary", async function () {
			const tokenList = await communityProxy.tokenList();
			expect(tokenList.length).to.be.eq(1);
			expect(tokenList[0]).to.be.eq(cUSD.address);

			const claimedAmounts =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts.length).to.be.eq(1);
			expect(claimedAmounts[0]).to.be.eq(0);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					celo.address,
					[cUSD.address, mUSD.address, celo.address],
					claimAmountDefault.mul(2),
					maxClaimDefault.mul(4),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 2,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(0);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					mUSD.address,
					[celo.address, mUSD.address],
					claimAmountDefault,
					maxClaimDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(0);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cUSD.address,
					[mUSD.address, cUSD.address],
					claimAmountDefault.div(2),
					maxClaimDefault.div(2),
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(0);

			expect(await cUSD.balanceOf(communityProxy.address)).equal(
				toEther("98.805566229659435664")
			);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				initialAmountDefault.add(claimAmountDefault.div(2))
			);
			expect(await celo.balanceOf(beneficiaryA.address)).to.be.equal(0);
			expect(await mUSD.balanceOf(beneficiaryA.address)).to.be.equal(0);

			let tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(3);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(celo.address);
			expect(tokenList2[2]).to.be.eq(mUSD.address);
			let claimedAmounts2 =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts2.length).to.be.eq(3);
			expect(claimedAmounts2[0]).to.be.eq(claimAmountDefault.div(2));
			expect(claimedAmounts2[1]).to.be.eq(0);
			expect(claimedAmounts2[2]).to.be.eq(0);

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(claimAmountDefault.div(2));
		});
	});
});
