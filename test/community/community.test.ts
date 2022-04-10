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
import { parseEther, formatEther } from "@ethersproject/units";
import {
	advanceBlockNTimes,
	advanceTimeAndBlockNTimes,
	getBlockNumber,
} from "../utils/TimeTravel";
import { Bytes, keccak256 } from "ethers/lib/utils";

should();

chai.use(chaiAsPromised);
const expect = chai.expect;
const provider = waffle.provider;

describe.only("Community", () => {
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

	let CommunityImplementationFactory: ethersTypes.ContractFactory;

	let communityInstance: ethersTypes.Contract;
	let communityImplementation: ethersTypes.Contract;
	let newCommunityInstance: ethersTypes.Contract;
	let communityAdminProxy: ethersTypes.Contract;
	let treasuryInstance: ethersTypes.Contract;
	let cUSDInstance: ethersTypes.Contract;
	let impactProxyAdmin: ethersTypes.Contract;

	// constants
	let firstBlock: number;
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
	const managerRole = keccak256(ethers.utils.toUtf8Bytes("MANAGER_ROLE"));

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

		communityImplementation = await ethers.getContractAt(
			"CommunityImplementation",
			(
				await deployments.get("CommunityImplementation")
			).address
		);

		const treasury = await deployments.get("TreasuryProxy");
		treasuryInstance = await ethers.getContractAt(
			"TreasuryImplementation",
			treasury.address
		);

		const CommunityAdminImplementation = await deployments.get(
			"CommunityAdminImplementation"
		);
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

		const ambassadors = await ethers.getContractAt(
			"AmbassadorsImplementation",
			AmbassadorsProxy.address
		);

		await ambassadors.addEntity(ambassadorsEntityA.address);
		await ambassadors
			.connect(ambassadorsEntityA)
			.addAmbassador(ambassadorA.address);
	}

	async function createCommunity() {
		const tx = await communityAdminProxy.addCommunity(
			[communityManagerA.address],
			ambassadorA.address,
			claimAmountTwo,
			maxClaimTen,
			oneCent,
			threeMinutesInBlocks,
			oneMinuteInBlocks,
			communityMinTranche,
			communityMaxTranche
		);

		let receipt = await tx.wait();

		return receipt.events?.filter((x: any) => {
			return x.event == "CommunityAdded";
		})[0]["args"]["communityAddress"];
	}

	async function addDefaultCommunity() {
		communityInstance = await ethers.getContractAt(
			"CommunityImplementation",
			await createCommunity()
		);
	}

	describe("CommunityAdmin", () => {
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
			(await communityInstance.validBeneficiaryCount()).should.be.equal(
				0
			);
			(await communityInstance.treasuryFunds()).should.be.equal(
				parseEther("100")
			);
			(await communityInstance.privateFunds()).should.be.equal(0);
			(await communityInstance.communityAdmin()).should.be.equal(
				communityAdminProxy.address
			);
			(await communityInstance.cUSD()).should.be.equal(
				cUSDInstance.address
			);
			(await communityInstance.locked()).should.be.equal(false);
			(await communityInstance.decreaseStep()).should.be.equal(oneCent);
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

		it("should updateCommunityMiddleProxy if  owner", async () => {
			await expect(
				communityAdminProxy.updateCommunityMiddleProxy(FAKE_ADDRESS)
			).to.be.fulfilled;

			expect(
				await communityAdminProxy.communityMiddleProxy()
			).to.be.equal(FAKE_ADDRESS);
		});

		it("should add a community if admin", async () => {
			await cUSDInstance.mint(
				treasuryInstance.address,
				mintAmount.toString()
			);

			const tx = await communityAdminProxy.addCommunity(
				[communityManagerA.address],
				ambassadorA.address,
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
			communityInstance = await ethers.getContractAt(
				"CommunityImplementation",
				communityAddress
			);

			(await communityInstance.baseInterval())
				.toString()
				.should.be.equal(threeMinutesInBlocks.toString());
			(await communityInstance.incrementInterval())
				.toString()
				.should.be.equal(oneMinuteInBlocks.toString());
			(await communityInstance.maxClaim()).should.be.equal(maxClaimTen);
		});

		it("should not add a community without managers", async () => {
			await expect(
				communityAdminProxy.addCommunity(
					[],
					ambassadorA.address,
					claimAmountTwo.toString(),
					maxClaimTen.toString(),
					oneCent.toString(),
					threeMinutesInBlocks.toString(),
					oneMinuteInBlocks.toString(),
					communityMinTranche,
					communityMaxTranche
				)
			).to.be.rejectedWith(
				"CommunityAdmin::addCommunity: Community should have at least one manager"
			);
		});

		it("should remove a community if admin", async () => {
			await cUSDInstance.mint(
				treasuryInstance.address,
				mintAmount.toString()
			);

			const tx = await communityAdminProxy.addCommunity(
				[communityManagerA.address],
				ambassadorA.address,
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
			communityInstance = await ethers.getContractAt(
				"CommunityImplementation",
				communityAddress
			);

			await communityAdminProxy.removeCommunity(
				communityInstance.address
			);
		});

		it("should not create a community with invalid values", async () => {
			await expect(
				communityAdminProxy.addCommunity(
					[communityManagerA.address],
					ambassadorA.address,
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
					ambassadorA.address,
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

		it("Should transfer founds from communityAdmin to address if admin", async function () {
			expect(
				await cUSDInstance.balanceOf(communityAdminProxy.address)
			).to.be.equal(0);
			await cUSDInstance.mint(
				communityAdminProxy.address,
				parseEther("100")
			);
			expect(
				await cUSDInstance.balanceOf(communityAdminProxy.address)
			).to.be.equal(parseEther("100"));
			await communityAdminProxy.transfer(
				cUSDInstance.address,
				adminAccount1.address,
				parseEther("100")
			);
			expect(
				await cUSDInstance.balanceOf(communityAdminProxy.address)
			).to.be.equal(0);
			expect(
				await cUSDInstance.balanceOf(adminAccount1.address)
			).to.be.equal(parseEther("100"));
		});

		it("Should not transfer founds from communityAdmin to address if not admin", async function () {
			expect(
				await cUSDInstance.balanceOf(communityAdminProxy.address)
			).to.be.equal(0);
			await cUSDInstance.mint(
				communityAdminProxy.address,
				parseEther("100")
			);
			expect(
				await cUSDInstance.balanceOf(communityAdminProxy.address)
			).to.be.equal(parseEther("100"));
			await expect(
				communityAdminProxy
					.connect(adminAccount2)
					.transfer(
						cUSDInstance.address,
						adminAccount1.address,
						parseEther("100")
					)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(
				await cUSDInstance.balanceOf(communityAdminProxy.address)
			).to.be.equal(parseEther("100"));
			expect(
				await cUSDInstance.balanceOf(adminAccount2.address)
			).to.be.equal(parseEther("0"));
		});

		it("Should not update CommunityAdmin implementation if not owner", async function () {
			const CommunityAdminMockFactory = await ethers.getContractFactory(
				"CommunityAdminImplementationMock"
			);

			const newCommunityAdminImplementation =
				await CommunityAdminMockFactory.deploy();

			await expect(
				impactProxyAdmin
					.connect(adminAccount2)
					.upgrade(
						communityAdminProxy.address,
						newCommunityAdminImplementation.address
					)
			).to.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("Should have same storage after update communityAdmin implementation", async function () {
			const CommunityAdminMockFactory = await ethers.getContractFactory(
				"CommunityAdminImplementationMock"
			);

			const newCommunityAdminImplementation =
				await CommunityAdminMockFactory.deploy();

			await expect(
				impactProxyAdmin.upgrade(
					communityAdminProxy.address,
					newCommunityAdminImplementation.address
				)
			).to.be.fulfilled;

			const oldCommunityImplementation =
				await communityAdminProxy.communityImplementation();
			expect(await communityAdminProxy.owner()).to.be.equal(
				adminAccount1.address
			);
			expect(await communityAdminProxy.cUSD()).to.be.equal(
				cUSDInstance.address
			);
			expect(await communityAdminProxy.treasury()).to.be.equal(
				treasuryInstance.address
			);
			expect(
				await communityAdminProxy.communityImplementation()
			).to.be.equal(oldCommunityImplementation);
			expect(
				await communityAdminProxy.communities(communityInstance.address)
			).to.be.equal(CommunityState.Valid);
			expect(await communityAdminProxy.communityListLength()).to.be.equal(
				1
			);
			expect(await communityAdminProxy.communityListAt(0)).to.be.equal(
				communityInstance.address
			);
		});
	});

	describe("Community", () => {
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

		it("Should transfer founds from community to address if admin", async function () {
			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(parseEther("100"));
			await communityAdminProxy.transferFromCommunity(
				communityInstance.address,
				cUSDInstance.address,
				adminAccount1.address,
				parseEther("100")
			);
			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(0);
			expect(
				await cUSDInstance.balanceOf(adminAccount1.address)
			).to.be.equal(parseEther("100"));
		});

		it("Should not transfer founds from community to address if not admin #1", async function () {
			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(parseEther("100"));
			await expect(
				communityInstance
					.connect(adminAccount2)
					.transfer(
						cUSDInstance.address,
						adminAccount1.address,
						parseEther("100")
					)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(parseEther("100"));
			expect(
				await cUSDInstance.balanceOf(adminAccount2.address)
			).to.be.equal(parseEther("0"));
		});

		it("Should not transfer founds from community to address if not admin #2", async function () {
			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(parseEther("100"));
			await expect(
				communityAdminProxy
					.connect(adminAccount2)
					.transferFromCommunity(
						communityInstance.address,
						cUSDInstance.address,
						adminAccount1.address,
						parseEther("100")
					)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(parseEther("100"));
			expect(
				await cUSDInstance.balanceOf(adminAccount2.address)
			).to.be.equal(parseEther("0"));
		});

		it("Should not update Community implementation if not owner #1", async function () {
			await expect(
				impactProxyAdmin
					.connect(adminAccount2)
					.upgrade(communityInstance.address, FAKE_ADDRESS)
			).to.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("Should not update Community implementation if not owner #2", async function () {
			await expect(
				communityAdminProxy
					.connect(adminAccount2)
					.updateProxyImplementation(
						communityInstance.address,
						FAKE_ADDRESS
					)
			).to.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("Should have same storage after update community implementation #1", async function () {
			const CommunityImplementationMockFactory = await ethers.getContractFactory(
				"CommunityImplementationMock"
			);

			communityInstance = await ethers.getContractAt(
				"CommunityImplementationMock",
				communityInstance.address
			);

			const newCommunityImplementation =
				await CommunityImplementationMockFactory.deploy();

			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			await communityInstance
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);
			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryB.address);

			await expect(
				communityAdminProxy.updateProxyImplementation(
					communityInstance.address,
					newCommunityImplementation.address
				)
			).to.be.fulfilled;

			// expect(await communityInstance.owner()).to.be.equal(zeroAddress);
			// await communityInstance.initialize();

			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryC.address);

			expect(await communityInstance.owner()).to.be.equal(
				communityAdminProxy.address
			);
			expect(await communityInstance.locked()).to.be.equal(false);
			expect(await communityInstance.claimAmount()).to.be.equal(
				claimAmountTwo
			);
			expect(await communityInstance.baseInterval()).to.be.equal(
				threeMinutesInBlocks
			);
			expect(await communityInstance.incrementInterval()).to.be.equal(
				oneMinuteInBlocks
			);
			expect(await communityInstance.maxClaim()).to.be.equal(
				maxClaimTen.sub(oneCent.mul(2))
			);
			expect(await communityInstance.validBeneficiaryCount()).to.be.equal(
				2
			);
			expect(await communityInstance.treasuryFunds()).to.be.equal(
				communityMinTranche
			);
			expect(await communityInstance.privateFunds()).to.be.equal("0");
			expect(await communityInstance.decreaseStep()).to.be.equal(oneCent);
			expect(await communityInstance.minTranche()).to.be.equal(
				communityMinTranche
			);
			expect(await communityInstance.maxTranche()).to.be.equal(
				communityMaxTranche
			);
			expect(await communityInstance.previousCommunity()).to.be.equal(
				zeroAddress
			);
			expect(await communityInstance.communityAdmin()).to.be.equal(
				communityAdminProxy.address
			);
			expect(
				(await communityInstance.beneficiaries(beneficiaryA.address))
					.state
			).to.be.equal(BeneficiaryState.Locked);
			expect(
				(await communityInstance.beneficiaries(beneficiaryB.address))
					.state
			).to.be.equal(BeneficiaryState.Valid);
			expect(
				(await communityInstance.beneficiaries(beneficiaryC.address))
					.state
			).to.be.equal(BeneficiaryState.Valid);
			expect(await communityInstance.beneficiaryListLength()).to.be.equal(
				3
			);
			expect(await communityInstance.beneficiaryListAt(0)).to.be.equal(
				beneficiaryA.address
			);
			expect(await communityInstance.beneficiaryListAt(1)).to.be.equal(
				beneficiaryB.address
			);
			expect(await communityInstance.beneficiaryListAt(2)).to.be.equal(
				beneficiaryC.address
			);
		});

		it("Should have same storage after update community implementation #2", async function () {
			const CommunityImplementationMockFactory = await ethers.getContractFactory(
				"CommunityImplementationMock"
			);

			const newCommunityImplementation =
				await CommunityImplementationMockFactory.deploy();

			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			await communityInstance
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);
			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryB.address);

			await expect(
				communityAdminProxy.updateCommunityImplementation(
					newCommunityImplementation.address
				)
			).to.be.fulfilled;

			communityInstance = await ethers.getContractAt(
				"CommunityImplementationMock",
				communityInstance.address
			);

			communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryC.address);

			await communityInstance.setParams();

			expect(await communityInstance.addressTest1()).to.be.equal(
				"0x0000000000000000000000000000000000000001"
			);
			expect(await communityInstance.addressTest2()).to.be.equal(
				"0x0000000000000000000000000000000000000002"
			);
			expect(await communityInstance.addressTest3()).to.be.equal(
				"0x0000000000000000000000000000000000000003"
			);

			expect(await communityInstance.uint256Test1()).to.be.equal(1);
			expect(await communityInstance.uint256Test2()).to.be.equal(2);
			expect(await communityInstance.uint256Test3()).to.be.equal(3);

			expect(
				await communityInstance.mapTest2(
					"0x0000000000000000000000000000000000000001"
				)
			).to.be.equal(true);
			expect(await communityInstance.mapTest3(1)).to.be.equal(
				"0x0000000000000000000000000000000000000001"
			);

			expect(await communityInstance.owner()).to.be.equal(
				communityAdminProxy.address
			);
			expect(await communityInstance.locked()).to.be.equal(false);
			expect(await communityInstance.claimAmount()).to.be.equal(
				claimAmountTwo
			);
			expect(await communityInstance.baseInterval()).to.be.equal(
				threeMinutesInBlocks
			);
			expect(await communityInstance.incrementInterval()).to.be.equal(
				oneMinuteInBlocks
			);
			expect(await communityInstance.maxClaim()).to.be.equal(
				maxClaimTen.sub(oneCent.mul(2))
			);
			expect(await communityInstance.validBeneficiaryCount()).to.be.equal(
				2
			);
			expect(await communityInstance.treasuryFunds()).to.be.equal(
				communityMinTranche
			);
			expect(await communityInstance.privateFunds()).to.be.equal("0");
			expect(await communityInstance.decreaseStep()).to.be.equal(oneCent);
			expect(await communityInstance.minTranche()).to.be.equal(
				communityMinTranche
			);
			expect(await communityInstance.maxTranche()).to.be.equal(
				communityMaxTranche
			);
			expect(await communityInstance.previousCommunity()).to.be.equal(
				zeroAddress
			);
			expect(await communityInstance.communityAdmin()).to.be.equal(
				communityAdminProxy.address
			);
			expect(
				(await communityInstance.beneficiaries(beneficiaryA.address))
					.state
			).to.be.equal(BeneficiaryState.Locked);
			expect(
				(await communityInstance.beneficiaries(beneficiaryB.address))
					.state
			).to.be.equal(BeneficiaryState.Valid);
			expect(
				(await communityInstance.beneficiaries(beneficiaryC.address))
					.state
			).to.be.equal(BeneficiaryState.Valid);
			expect(await communityInstance.beneficiaryListLength()).to.be.equal(
				3
			);
			expect(await communityInstance.beneficiaryListAt(0)).to.be.equal(
				beneficiaryA.address
			);
			expect(await communityInstance.beneficiaryListAt(1)).to.be.equal(
				beneficiaryB.address
			);
			expect(await communityInstance.beneficiaryListAt(2)).to.be.equal(
				beneficiaryC.address
			);
		});

		it("Should have update all communities by changing communityAdmin.communityTemplate #1", async function () {
			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			await communityInstance
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);
			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryB.address);

			let communityInstance2 = await ethers.getContractAt(
				"CommunityImplementation",
				await createCommunity()
			);
			await communityInstance2
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryB.address);

			const newCommunityImplementation = await (
				await ethers.getContractFactory("CommunityImplementationMock")
			).deploy();

			await expect(
				communityAdminProxy.updateCommunityImplementation(
					newCommunityImplementation.address
				)
			).to.be.fulfilled;

			communityInstance = await ethers.getContractAt(
				"CommunityImplementationMock",
				communityInstance.address
			);

			await communityInstance.setParams();

			expect(await communityInstance.addressTest1()).to.be.equal(
				"0x0000000000000000000000000000000000000001"
			);
			expect(await communityInstance.addressTest2()).to.be.equal(
				"0x0000000000000000000000000000000000000002"
			);
			expect(await communityInstance.addressTest3()).to.be.equal(
				"0x0000000000000000000000000000000000000003"
			);

			expect(await communityInstance.uint256Test1()).to.be.equal(1);
			expect(await communityInstance.uint256Test2()).to.be.equal(2);
			expect(await communityInstance.uint256Test3()).to.be.equal(3);

			expect(
				await communityInstance.mapTest2(
					"0x0000000000000000000000000000000000000001"
				)
			).to.be.equal(true);
			expect(await communityInstance.mapTest3(1)).to.be.equal(
				"0x0000000000000000000000000000000000000001"
			);

			//*****************************************************************

			communityInstance2 = await ethers.getContractAt(
				"CommunityImplementationMock",
				communityInstance2.address
			);

			await communityInstance2.setParams();

			expect(await communityInstance2.addressTest1()).to.be.equal(
				"0x0000000000000000000000000000000000000001"
			);
			expect(await communityInstance2.addressTest2()).to.be.equal(
				"0x0000000000000000000000000000000000000002"
			);
			expect(await communityInstance2.addressTest3()).to.be.equal(
				"0x0000000000000000000000000000000000000003"
			);

			expect(await communityInstance2.uint256Test1()).to.be.equal(1);
			expect(await communityInstance2.uint256Test2()).to.be.equal(2);
			expect(await communityInstance2.uint256Test3()).to.be.equal(3);

			expect(
				await communityInstance2.mapTest2(
					"0x0000000000000000000000000000000000000001"
				)
			).to.be.equal(true);
			expect(await communityInstance2.mapTest3(1)).to.be.equal(
				"0x0000000000000000000000000000000000000001"
			);
		});

		it("Should revert implementation for only one community", async function () {
			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			await communityInstance
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);
			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryB.address);

			let communityInstance2 = await ethers.getContractAt(
				"CommunityImplementation",
				await createCommunity()
			);
			await communityInstance2
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryB.address);

			const newCommunityImplementation = await (
				await ethers.getContractFactory("CommunityImplementationMock")
			).deploy();

			await expect(
				communityAdminProxy.updateCommunityImplementation(
					newCommunityImplementation.address
				)
			).to.be.fulfilled;

			communityInstance = await ethers.getContractAt(
				"CommunityImplementationMock",
				communityInstance.address
			);

			await communityInstance.setParams();

			expect(await communityInstance.addressTest1()).to.be.equal(
				"0x0000000000000000000000000000000000000001"
			);
			expect(await communityInstance.addressTest2()).to.be.equal(
				"0x0000000000000000000000000000000000000002"
			);
			expect(await communityInstance.addressTest3()).to.be.equal(
				"0x0000000000000000000000000000000000000003"
			);

			expect(await communityInstance.uint256Test1()).to.be.equal(1);
			expect(await communityInstance.uint256Test2()).to.be.equal(2);
			expect(await communityInstance.uint256Test3()).to.be.equal(3);

			expect(
				await communityInstance.mapTest2(
					"0x0000000000000000000000000000000000000001"
				)
			).to.be.equal(true);
			expect(await communityInstance.mapTest3(1)).to.be.equal(
				"0x0000000000000000000000000000000000000001"
			);

			//*****************************************************************

			communityInstance2 = await ethers.getContractAt(
				"CommunityImplementationMock",
				communityInstance2.address
			);

			await communityInstance2.setParams();

			expect(await communityInstance2.addressTest1()).to.be.equal(
				"0x0000000000000000000000000000000000000001"
			);
			expect(await communityInstance2.addressTest2()).to.be.equal(
				"0x0000000000000000000000000000000000000002"
			);
			expect(await communityInstance2.addressTest3()).to.be.equal(
				"0x0000000000000000000000000000000000000003"
			);

			expect(await communityInstance2.uint256Test1()).to.be.equal(1);
			expect(await communityInstance2.uint256Test2()).to.be.equal(2);
			expect(await communityInstance2.uint256Test3()).to.be.equal(3);

			expect(
				await communityInstance2.mapTest2(
					"0x0000000000000000000000000000000000000001"
				)
			).to.be.equal(true);
			expect(await communityInstance2.mapTest3(1)).to.be.equal(
				"0x0000000000000000000000000000000000000001"
			);


			//*****************************************************************
			//revert to initial implementation for community2

			await expect(
				communityAdminProxy.updateProxyImplementation(
					communityInstance2.address,
					communityImplementation.address
				)
			).to.be.fulfilled;

			await expect(communityInstance.setParams()).to.be.fulfilled;
			await expect(communityInstance2.setParams()).to.be.rejectedWith('Transaction reverted without a reason string');
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
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
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
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			await communityInstance
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Locked);
		});

		it("should not lock an invalid beneficiary from community", async () => {
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await expect(
				communityInstance
					.connect(communityManagerA)
					.lockBeneficiary(beneficiaryA.address)
			).to.be.rejectedWith("NOT_YET");
		});

		it("should unlock locked beneficiary from community", async () => {
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			await communityInstance
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Locked);
			await communityInstance
				.connect(communityManagerA)
				.unlockBeneficiary(beneficiaryA.address);
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
		});

		it("should not unlock a not locked beneficiary from community", async () => {
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			await expect(
				communityInstance
					.connect(communityManagerA)
					.unlockBeneficiary(beneficiaryA.address)
			).to.be.rejectedWith("NOT_YET");
		});

		it("should remove beneficiary from community", async () => {
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.NONE);
			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			await communityInstance
				.connect(communityManagerA)
				.removeBeneficiary(beneficiaryA.address);
			(
				await communityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Removed);
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
			await advanceTimeAndBlockNTimes(
				baseInterval + 2 * incrementInterval
			);
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
			await expect(communityInstance.connect(ambassadorA).lock())
				.to.emit(communityInstance, "CommunityLocked")
				.withArgs(ambassadorA.address);
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
			await advanceTimeAndBlockNTimes(
				baseInterval + 2 * incrementInterval
			);
			await expect(communityInstance.connect(beneficiaryA).claim()).to.be
				.fulfilled;
		});

		it("should claim after waiting", async () => {
			const baseInterval = (
				await communityInstance.baseInterval()
			).toNumber();
			await advanceTimeAndBlockNTimes(baseInterval + 1);
			expect(
				(await communityInstance.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.be.equal(0);
			await communityInstance.connect(beneficiaryA).claim();
			expect(
				(await communityInstance.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.be.equal(claimAmountTwo);

			(
				await cUSDInstance.balanceOf(beneficiaryA.address)
			).should.be.equal(claimAmountTwo.add(fiveCents));
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

			communityInstance = await ethers.getContractAt(
				"CommunityImplementation",
				newCommunityAddress
			);
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

			newCommunityInstance = await ethers.getContractAt(
				"CommunityImplementation",
				newCommunityAddress
			);
			await expect(
				newCommunityInstance
					.connect(beneficiaryA)
					.beneficiaryJoinFromMigrated(beneficiaryA.address)
			).to.be.fulfilled;
			await expect(
				newCommunityInstance
					.connect(beneficiaryB)
					.beneficiaryJoinFromMigrated(beneficiaryB.address)
			).to.be.fulfilled;
			await expect(
				newCommunityInstance
					.connect(beneficiaryC)
					.beneficiaryJoinFromMigrated(beneficiaryC.address)
			).to.be.fulfilled;

			(
				await newCommunityInstance.beneficiaries(beneficiaryA.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			(
				await newCommunityInstance.beneficiaries(beneficiaryB.address)
			).state.should.be.equal(BeneficiaryState.Valid);
			(
				await newCommunityInstance.beneficiaries(beneficiaryC.address)
			).state.should.be.equal(BeneficiaryState.NONE);
		});

		it("should not migrate a migrated community", async () => {
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
			).to.be.rejectedWith("CommunityAdmin: Not Owner Or UBICommittee");
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

		it("should not add manager to community if manager", async () => {
			await expect(
				communityInstance
					.connect(communityManagerC)
					.addManager(communityManagerB.address)
			).to.be.rejectedWith("NOT_AMBASSADOR");
		});

		it("should not remove manager from community if manager", async () => {
			await communityInstance
				.connect(ambassadorA)
				.addManager(communityManagerB.address);
			await expect(
				communityInstance
					.connect(communityManagerA)
					.removeManager(communityManagerB.address)
			).to.be.rejectedWith("NOT_AMBASSADOR");
		});

		it("should not add manager to community if not ambassador", async () => {
			await expect(
				communityInstance
					.connect(ambassadorB)
					.addManager(communityManagerB.address)
			).to.be.rejectedWith("NOT_AMBASSADOR");
		});

		it("should not remove manager from community if not ambassador", async () => {
			await communityInstance
				.connect(ambassadorA)
				.addManager(communityManagerB.address);
			await expect(
				communityInstance
					.connect(ambassadorB)
					.removeManager(communityManagerB.address)
			).to.be.rejectedWith("NOT_AMBASSADOR");
		});

		it("should add manager to community if ambassador", async () => {
			await expect(
				communityInstance
					.connect(ambassadorA)
					.addManager(communityManagerB.address)
			).to.be.fulfilled;
			await expect(
				communityInstance
					.connect(ambassadorA)
					.addManager(communityManagerC.address)
			).to.be.fulfilled;
		});

		it("should remove manager from community if ambassador", async () => {
			await expect(
				communityInstance
					.connect(ambassadorA)
					.addManager(communityManagerB.address)
			).to.be.fulfilled;
			await expect(
				communityInstance
					.connect(ambassadorA)
					.removeManager(communityManagerB.address)
			).to.be.fulfilled;
		});

		xit("should renounce from manager of community if manager", async () => {
			await communityInstance
				.connect(communityManagerA)
				.addManager(communityManagerB.address);
			await expect(
				communityInstance
					.connect(communityManagerB)
					.renounceRole(managerRole, communityManagerB.address)
			).to.be.fulfilled;
		});

		it("should notlock community if manager", async () => {
			await expect(
				communityInstance.connect(communityManagerA).lock()
			).to.be.rejectedWith("Community: NOT_AMBASSADOR");
		});
	});

	describe("Chaos test (complete flow)", async () => {
		// add community
		const addCommunity = async (
			communityManager: SignerWithAddress
		): Promise<ethersTypes.Contract> => {
			const tx = await communityAdminProxy.addCommunity(
				[communityManager.address],
				ambassadorA.address,
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
			communityInstance = await ethers.getContractAt(
				"CommunityImplementation",
				communityAddress
			);
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

			(
				await instance.beneficiaries(beneficiaryAddress.address)
			).state.should.be.equal(BeneficiaryState.Valid);
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
			const maxClaimsPerUserA = maxClaimAmountA
				.div(claimAmountA)
				.toNumber();
			for (let index = 0; index < maxClaimsPerUserA; index++) {
				await waitClaimTime(communityInstanceA, beneficiaryB);
				await beneficiaryClaim(communityInstanceA, beneficiaryB);
			}
			// beneficiary C claims it all
			const claimAmountB = await communityInstanceB.claimAmount();
			const maxClaimAmountB = await communityInstanceB.maxClaim();
			const maxClaimsPerUserB = maxClaimAmountB
				.div(claimAmountB)
				.toNumber();
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
					claimAmountA
						.mul(3 + maxClaimsPerUserA)
						.add(fiveCents.mul(2))
				);
			const currentCommunityBalanceB = await cUSDInstance.balanceOf(
				communityInstanceB.address
			);
			previousCommunityBalanceB
				.sub(currentCommunityBalanceB)
				.should.be.equal(
					claimAmountB
						.mul(4 + maxClaimsPerUserB)
						.add(fiveCents.mul(2))
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

			firstBlock = await getBlockNumber();
		});

		it("should get funds if manager", async () => {
			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);

			await communityInstance.connect(beneficiaryA).claim();

			await expect(
				communityInstance.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;

			expect(await communityInstance.lastFundRequest()).to.be.equal(
				firstBlock + 3
			);

			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(communityMinTranche);
		});

		it("should not get funds if not manager", async () => {
			await expect(
				communityInstance.connect(beneficiaryA).requestFunds()
			).to.be.rejectedWith("Community: NOT_MANAGER");

			expect(await communityInstance.lastFundRequest()).to.be.equal(0);
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
			).to.be.rejectedWith("CommunityAdmin: Not Owner Or UBICommittee");
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
			).to.be.rejectedWith("CommunityAdmin: Not Owner Or UBICommittee");
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

			expect(await communityInstance.lastFundRequest()).to.be.equal(
				firstBlock + 3
			);

			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(communityMinTranche);
		});

		it("should not transfer funds to community too often", async () => {
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

			expect(await communityInstance.lastFundRequest()).to.be.equal(
				firstBlock + 3
			);

			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(communityMinTranche);

			await expect(
				communityAdminProxy.transferFromCommunity(
					communityInstance.address,
					cUSDInstance.address,
					adminAccount1.address,
					communityMinTranche
				)
			).to.be.fulfilled;

			await expect(
				communityInstance.connect(communityManagerA).requestFunds()
			).to.be.rejectedWith(
				"CommunityAdmin::fundCommunity: this community is not allowed to request yet"
			);

			expect(await communityInstance.lastFundRequest()).to.be.equal(
				firstBlock + 3
			);
		});

		it("should transfer funds to community again after baseInterval", async () => {
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

			expect(await communityInstance.lastFundRequest()).to.be.equal(
				firstBlock + 3
			);

			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(communityMinTranche);

			await expect(
				communityAdminProxy.transferFromCommunity(
					communityInstance.address,
					cUSDInstance.address,
					adminAccount1.address,
					communityMinTranche
				)
			).to.be.fulfilled;

			await advanceBlockNTimes(threeMinutesInBlocks);

			await expect(
				communityInstance.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;

			expect(await communityInstance.lastFundRequest()).to.be.equal(
				firstBlock + 41
			);

			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(communityMinTranche);
		});

		it("should not transfer funds more then safety limit", async () => {
			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(communityMinTranche);

			await treasuryInstance.transfer(
				cUSDInstance.address,
				adminAccount1.address,
				await cUSDInstance.balanceOf(treasuryInstance.address)
			);
			await cUSDInstance.mint(treasuryInstance.address, parseEther("10"));

			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);

			communityInstance.connect(beneficiaryA).claim();

			await expect(
				communityInstance.connect(communityManagerA).requestFunds()
			).to.be.rejectedWith(
				"CommunityAdmin::fundCommunity: Not enough funds"
			);

			expect(await communityInstance.lastFundRequest()).to.be.equal(0);
		});

		it("should donate directly in the community", async () => {
			const user1Donation = 1;

			await cUSDInstance.mint(adminAccount1.address, user1Donation);
			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(communityMinTranche);

			await cUSDInstance.approve(
				communityInstance.address,
				user1Donation
			);
			await communityInstance.donate(
				adminAccount1.address,
				user1Donation
			);

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

			await cUSDInstance.approve(
				communityInstance.address,
				user1Donation
			);
			await communityInstance.donate(
				adminAccount1.address,
				user1Donation
			);

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

			expect(await communityInstance.lastFundRequest()).to.be.equal(0);
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
			expect(
				await cUSDInstance.balanceOf(adminAccount1.address)
			).to.be.equal(userInitialBalance.add(communityInitialBalance));
		});

		it("should get more funds if have private donations", async () => {
			const user1Donation = parseEther("20000");

			await communityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);

			await cUSDInstance.mint(adminAccount1.address, user1Donation);
			await cUSDInstance.approve(
				communityInstance.address,
				user1Donation
			);
			await communityInstance.donate(
				adminAccount1.address,
				user1Donation
			);

			await communityAdminProxy.transferFromCommunity(
				communityInstance.address,
				cUSDInstance.address,
				adminAccount1.address,
				user1Donation
			);

			await expect(
				communityInstance.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;

			expect(await communityInstance.lastFundRequest()).to.be.equal(
				firstBlock + 6
			);

			expect(
				await cUSDInstance.balanceOf(communityInstance.address)
			).to.be.equal(parseEther("402"));
		});
	});

	describe("Old Community", () => {
		let legacyCommunity: ethersTypes.ContractFactory;
		let legacyCommunityInstance: ethersTypes.Contract;

		before(async function () {
			await init();

			legacyCommunity = await ethers.getContractFactory(
				"CommunityLegacy"
			);
		});

		beforeEach(async () => {
			await deploy();

			await cUSDInstance.mint(
				treasuryInstance.address,
				mintAmount.toString()
			);

			await addDefaultCommunity();

			legacyCommunityInstance = await legacyCommunity.deploy(
				communityManagerA.address,
				claimAmountTwo,
				maxClaimTen,
				threeMinutesInBlocks,
				oneMinuteInBlocks,
				zeroAddress,
				cUSDInstance.address,
				adminAccount1.address
			);

			await cUSDInstance.mint(
				legacyCommunityInstance.address,
				mintAmount.toString()
			);

			legacyCommunityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			legacyCommunityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryB.address);
			legacyCommunityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryC.address);

			legacyCommunityInstance
				.connect(communityManagerA)
				.addManager(communityManagerB.address);
			legacyCommunityInstance
				.connect(communityManagerB)
				.addManager(communityManagerC.address);
			legacyCommunityInstance
				.connect(communityManagerC)
				.removeManager(communityManagerB.address);
		});

		async function migrateCommunity() {
			const newTx = await communityAdminProxy.migrateCommunity(
				[communityManagerA.address],
				legacyCommunityInstance.address
			);

			let receipt = await newTx.wait();

			const newCommunityAddress = receipt.events?.filter((x: any) => {
				return x.event == "CommunityMigrated";
			})[0]["args"]["communityAddress"];

			newCommunityInstance = await ethers.getContractAt(
				"CommunityImplementation",
				newCommunityAddress
			);

			await cUSDInstance.mint(
				newCommunityInstance.address,
				mintAmount.toString()
			);
		}

		it("should migrate an old community is owner", async () => {
			await expect(
				communityAdminProxy.migrateCommunity(
					[communityManagerA.address],
					legacyCommunityInstance.address
				)
			).to.be.fulfilled;
		});

		it("should migrate an old community if not owner", async () => {
			await expect(
				communityAdminProxy
					.connect(adminAccount2)
					.migrateCommunity(
						[communityManagerA.address],
						legacyCommunityInstance.address
					)
			).to.be.rejectedWith("CommunityAdmin: Not Owner Or UBICommittee");
		});

		it("should migrate an old community twice", async () => {
			await expect(
				communityAdminProxy.migrateCommunity(
					[communityManagerA.address],
					legacyCommunityInstance.address
				)
			).to.be.fulfilled;
			await expect(
				communityAdminProxy.migrateCommunity(
					[communityManagerA.address],
					legacyCommunityInstance.address
				)
			).to.be.rejectedWith(
				"CommunityAdmin::migrateCommunity: this community has been migrated"
			);
		});

		it("should join from migrated if valid beneficiary", async () => {
			await migrateCommunity();
			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryA.address))
					.state
			).to.be.equal(BeneficiaryState.NONE);
			await expect(
				newCommunityInstance
					.connect(beneficiaryA)
					.beneficiaryJoinFromMigrated(beneficiaryA.address)
			).to.be.fulfilled;
			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryA.address))
					.state
			).to.be.equal(BeneficiaryState.Valid);
		});

		it("should join from migrated if valid beneficiary, added by anyone", async () => {
			await migrateCommunity();
			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryA.address))
					.state
			).to.be.equal(BeneficiaryState.NONE);
			await expect(
				newCommunityInstance
					.connect(beneficiaryD)
					.beneficiaryJoinFromMigrated(beneficiaryA.address)
			).to.be.fulfilled;
			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryA.address))
					.state
			).to.be.equal(BeneficiaryState.Valid);
		});

		it("should not join from migrated twice if beneficiary", async () => {
			await migrateCommunity();
			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryA.address))
					.state
			).to.be.equal(BeneficiaryState.NONE);
			await expect(
				newCommunityInstance
					.connect(beneficiaryA)
					.beneficiaryJoinFromMigrated(beneficiaryA.address)
			).to.be.fulfilled;
			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryA.address))
					.state
			).to.be.equal(BeneficiaryState.Valid);

			await expect(
				newCommunityInstance
					.connect(beneficiaryA)
					.beneficiaryJoinFromMigrated(beneficiaryA.address)
			).to.be.rejectedWith(
				"Community::beneficiaryJoinFromMigrated: Beneficiary exists"
			);
		});

		it("should join from migrated if locked beneficiary", async () => {
			await migrateCommunity();
			await legacyCommunityInstance
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);

			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryA.address))
					.state
			).to.be.equal(BeneficiaryState.NONE);
			await expect(
				newCommunityInstance
					.connect(beneficiaryA)
					.beneficiaryJoinFromMigrated(beneficiaryA.address)
			).to.be.fulfilled;
			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryA.address))
					.state
			).to.be.equal(BeneficiaryState.Locked);
		});

		it("should join from migrated if removed beneficiary", async () => {
			await migrateCommunity();
			await legacyCommunityInstance
				.connect(communityManagerA)
				.removeBeneficiary(beneficiaryA.address);

			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryA.address))
					.state
			).to.be.equal(BeneficiaryState.NONE);
			await expect(
				newCommunityInstance
					.connect(beneficiaryA)
					.beneficiaryJoinFromMigrated(beneficiaryA.address)
			).to.be.fulfilled;
			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryA.address))
					.state
			).to.be.equal(BeneficiaryState.Removed);
		});

		it("should join from migrated if not beneficiary", async () => {
			await migrateCommunity();

			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryD.address))
					.state
			).to.be.equal(BeneficiaryState.NONE);
			await expect(
				newCommunityInstance
					.connect(beneficiaryD)
					.beneficiaryJoinFromMigrated(beneficiaryD.address)
			).to.be.fulfilled;
			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryD.address))
					.state
			).to.be.equal(BeneficiaryState.NONE);
		});

		it("should join from migrated if not beneficiary, added by anyone", async () => {
			await migrateCommunity();

			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryD.address))
					.state
			).to.be.equal(BeneficiaryState.NONE);
			await expect(
				newCommunityInstance
					.connect(beneficiaryA)
					.beneficiaryJoinFromMigrated(beneficiaryD.address)
			).to.be.fulfilled;
			expect(
				(await newCommunityInstance.beneficiaries(beneficiaryD.address))
					.state
			).to.be.equal(BeneficiaryState.NONE);
		});

		it("should copy beneficiary details from old community", async () => {
			await migrateCommunity();
			await newCommunityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryB.address);
			await legacyCommunityInstance.connect(beneficiaryA).claim();

			await expect(
				newCommunityInstance
					.connect(beneficiaryA)
					.beneficiaryJoinFromMigrated(beneficiaryA.address)
			).to.be.fulfilled;

			const beneficiaryADetails =
				await newCommunityInstance.beneficiaries(beneficiaryA.address);
			expect(beneficiaryADetails.claims).to.be.equal(1);
			expect(beneficiaryADetails.claimedAmount).to.be.equal(
				claimAmountTwo
			);
			// expect(beneficiaryADetails.lastClaim).to.be.equal(9);

			await newCommunityInstance
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryC.address);

			expect(await newCommunityInstance.beneficiaryListAt(0)).to.be.equal(
				beneficiaryB.address
			);
			expect(await newCommunityInstance.beneficiaryListAt(1)).to.be.equal(
				beneficiaryA.address
			);
			expect(await newCommunityInstance.beneficiaryListAt(2)).to.be.equal(
				beneficiaryC.address
			);
		});
	});
});
