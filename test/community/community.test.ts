import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { should } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, waffle, deployments } from "hardhat";
import type * as ethersTypes from "ethers";
import { parseEther } from "@ethersproject/units";
import {
	advanceBlockNTimes,
	advanceNSeconds,
	advanceTimeAndBlockNTimes,
	getBlockNumber,
	getCurrentBlockTimestamp,
} from "../utils/TimeTravel";
import { keccak256 } from "ethers/lib/utils";
import { fromEther, toEther } from "../utils/helpers";
import { JsonRpcSigner } from "@ethersproject/providers/src.ts/json-rpc-provider";
import { BigNumber } from "@ethersproject/bignumber";
import { createPool, getExchangePath } from "../utils/uniswap";
import { LpStrategy } from "../treasury/treasury.test";

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
		AddressChanged = 4,
		Copied = 5,
	}

	enum CommunityState {
		NONE = 0,
		Valid = 1,
		Removed = 2,
		Migrated = 3,
	}

	const FAKE_ADDRESS = "0x000000000000000000000000000000000000dEaD";
	const ZERO_ADDRESS = ethers.constants.AddressZero;

	//deployer
	let deployer: SignerWithAddress;
	//signer
	let authorizedWallet: SignerWithAddress;
	//admins
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

	let communityAdminImpersonator: JsonRpcSigner;

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
	let mUSD: ethersTypes.Contract;
	let cTKN: ethersTypes.Contract;
	let cEUR: ethersTypes.Contract;

	// constants
	let firstBlock: number;
	const incrementIntervalDefault = 12;
	const baseIntervalDefault = 36;
	const originalClaimAmountDefault = parseEther("2");
	const maxTotalClaimDefault = parseEther("10");
	const decreaseStepDefault = parseEther("0.01");
	const communityMinTrancheDefault = parseEther("100");
	const communityMaxTrancheDefault = parseEther("5000");
	const maxBeneficiariesDefault = 100;
	const initialAmountDefault = parseEther("0.01");
	const zeroAddress = "0x0000000000000000000000000000000000000000";
	const mintAmount = parseEther("10000");
	const managerRole = keccak256(ethers.utils.toUtf8Bytes("MANAGER_ROLE"));
	const TREASURY_SAFETY_PERCENTAGE = 9;
	const TREASURY_MIN_BALANCE = toEther(100);
	const minClaimAmountRatioDefault = 10000;
	const minClaimAmountRatioPrecision = 100;

	async function init() {
		[
			deployer,
			authorizedWallet,
			adminAccount2,
			adminAccount1,
			adminAccount2,
			adminAccount3,
			communityManagerA,
			communityManagerB,
			communityManagerC,
			beneficiaryA,
			beneficiaryB,
			beneficiaryC,
			beneficiaryD,
			ambassadorA,
			ambassadorB,
			ambassadorsEntityA,
		] = await ethers.getSigners();
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

		treasuryProxy = await ethers.getContractAt(
			"TreasuryImplementation",
			(
				await deployments.get("TreasuryProxy")
			).address
		);

		expect(
			await impactProxyAdmin.getProxyImplementation(
				(
					await deployments.get("CommunityAdminProxy")
				).address
			)
		).to.eq(
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

		await communityAdminProxy.updateAuthorizedWalletAddress(
			authorizedWallet.address
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

	async function multipleTokenSetUp() {
		const tokenFactory = await ethers.getContractFactory("TokenMock");

		const fake = await tokenFactory.deploy("fake", "fake"); // for a weird reason we need to deploy a blank contract
		mUSD = await tokenFactory.deploy("mUSD", "mUSD");
		cTKN = await tokenFactory.deploy("cTKN", "cTKN");
		cEUR = await tokenFactory.deploy("cEUR", "cEUR");

		await cUSD.mint(adminAccount1.address, toEther(100000000));
		await mUSD.mint(adminAccount1.address, toEther(100000000));
		await cTKN.mint(adminAccount1.address, toEther(100000000));
		await cEUR.mint(adminAccount1.address, toEther(100000000));

		await createPool(
			adminAccount1,
			cUSD,
			mUSD,
			toEther(1000000),
			toEther(1000000)
		);

		await createPool(
			adminAccount1,
			mUSD,
			cTKN,
			toEther(1000000),
			toEther(500000)
		);

		await createPool(
			adminAccount1,
			cUSD,
			cEUR,
			toEther(1000000),
			toEther(1000000)
		);

		await treasuryProxy.setToken(
			mUSD.address,
			toEther(0.9),
			LpStrategy.NONE,
			0,
			0,
			0,
			getExchangePath(mUSD, cUSD),
			"0x"
		);

		await treasuryProxy.setToken(
			cTKN.address,
			toEther(0.5),
			LpStrategy.NONE,
			0,
			0,
			0,
			getExchangePath(cTKN, mUSD, cUSD),
			"0x"
		);
		await treasuryProxy.setToken(
			cEUR.address,
			toEther(0.8),
			LpStrategy.NONE,
			0,
			0,
			0,
			getExchangePath(cEUR, cUSD),
			"0x"
		);
	}

	async function createCommunity(communityAdminProxy: ethersTypes.Contract) {
		const tx = await communityAdminProxy.addCommunity(
			cUSD.address,
			[communityManagerA.address],
			ambassadorA.address,
			originalClaimAmountDefault,
			maxTotalClaimDefault,
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

	async function signParams(
		signerManager: SignerWithAddress,
		empoweredAddress: string,
		communityAddress: string,
		expirationTimestamp: number
	): Promise<string> {
		const encoded = ethers.utils.defaultAbiCoder.encode(
			["address", "address", "uint256"],
			[empoweredAddress, communityAddress, expirationTimestamp]
		);
		const hash = ethers.utils.keccak256(encoded);

		return signerManager.signMessage(ethers.utils.arrayify(hash));
	}

	describe("CommunityAdmin", () => {
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(treasuryProxy.address, mintAmount);

			await addDefaultCommunity();
		});

		it("should return correct values", async () => {
			(await communityProxy.previousCommunity()).should.eq(zeroAddress);
			(await communityProxy.originalClaimAmount()).should.eq(
				originalClaimAmountDefault
			);
			(await communityProxy.claimAmount()).should.eq(
				originalClaimAmountDefault
			);
			(await communityProxy.baseInterval()).should.eq(
				baseIntervalDefault
			);
			(await communityProxy.incrementInterval()).should.eq(
				incrementIntervalDefault
			);
			(await communityProxy.maxTotalClaim()).should.eq(
				maxTotalClaimDefault
			);
			(await communityProxy.maxClaim()).should.eq(maxTotalClaimDefault);
			(await communityProxy.validBeneficiaryCount()).should.eq(0);
			(await communityProxy.treasuryFunds()).should.eq(parseEther("100"));
			(await communityProxy.privateFunds()).should.eq(0);
			(await communityProxy.communityAdmin()).should.eq(
				communityAdminProxy.address
			);
			(await communityProxy.cUSD()).should.eq(cUSD.address);
			(await communityProxy.locked()).should.eq(false);
			(await communityProxy.decreaseStep()).should.eq(
				decreaseStepDefault
			);
			(await communityProxy.minTranche()).should.eq(
				communityMinTrancheDefault
			);
			(await communityProxy.maxTranche()).should.eq(
				communityMaxTrancheDefault
			);
			(await communityProxy.lastFundRequest()).should.eq(0);
			(await communityProxy.maxBeneficiaries()).should.eq(
				maxBeneficiariesDefault
			);
			(await communityProxy.tokenList())[0].should.eq(cUSD.address);
			(await communityProxy.copyOf()).should.eq(
				ethers.constants.AddressZero
			);
			(await communityProxy.copies()).length.should.eq(0);

			(await communityProxy.getVersion()).should.eq(4);

			(await communityAdminProxy.getVersion()).should.eq(3);
			(await communityAdminProxy.minClaimAmountRatio()).should.eq(
				minClaimAmountRatioDefault
			);

			(await communityAdminProxy.treasurySafetyPercentage()).should.eq(
				TREASURY_SAFETY_PERCENTAGE
			);
			(await communityAdminProxy.treasuryMinBalance()).should.eq(
				TREASURY_MIN_BALANCE
			);
		});

		it("should not updateCommunityImplementation if not owner", async () => {
			const initialAddress =
				await communityAdminProxy.communityImplementation();
			await expect(
				communityAdminProxy
					.connect(communityManagerA)
					.updateCommunityImplementation(FAKE_ADDRESS)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(await communityAdminProxy.communityImplementation()).to.eq(
				initialAddress
			);
		});

		it("should updateCommunityImplementation if  owner", async () => {
			await expect(
				communityAdminProxy.updateCommunityImplementation(FAKE_ADDRESS)
			).to.be.fulfilled;

			expect(await communityAdminProxy.communityImplementation()).to.eq(
				FAKE_ADDRESS
			);
		});

		it("should not updateCommunityMiddleProxy if not owner", async () => {
			const initialAddress =
				await communityAdminProxy.communityMiddleProxy();
			await expect(
				communityAdminProxy
					.connect(communityManagerA)
					.updateCommunityMiddleProxy(FAKE_ADDRESS)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(await communityAdminProxy.communityMiddleProxy()).to.eq(
				initialAddress
			);
		});

		it("should updateCommunityMiddleProxy if owner", async () => {
			await expect(
				communityAdminProxy.updateCommunityMiddleProxy(FAKE_ADDRESS)
			).to.be.fulfilled;

			expect(await communityAdminProxy.communityMiddleProxy()).to.eq(
				FAKE_ADDRESS
			);
		});

		it("should add a community if admin", async () => {
			await cUSD.mint(treasuryProxy.address, mintAmount);

			const tx = await communityAdminProxy.addCommunity(
				cUSD.address,
				[communityManagerA.address],
				ambassadorA.address,
				originalClaimAmountDefault,
				maxTotalClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault,
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

			(await communityProxy.baseInterval()).should.eq(
				baseIntervalDefault
			);
			(await communityProxy.incrementInterval()).should.eq(
				incrementIntervalDefault
			);
			(await communityProxy.maxTotalClaim()).should.eq(
				maxTotalClaimDefault
			);
		});

		it("should not add a community without managers", async () => {
			await expect(
				communityAdminProxy.addCommunity(
					cUSD.address,
					[],
					ambassadorA.address,
					originalClaimAmountDefault,
					maxTotalClaimDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault,
					communityMinTrancheDefault,
					communityMaxTrancheDefault,
					maxBeneficiariesDefault
				)
			).to.be.rejectedWith(
				"CommunityAdmin::addCommunity: Community should have at least one manager"
			);
		});

		it("should remove a community if admin", async () => {
			await cUSD.mint(treasuryProxy.address, mintAmount);

			const tx = await communityAdminProxy.addCommunity(
				cUSD.address,
				[communityManagerA.address],
				ambassadorA.address,
				originalClaimAmountDefault,
				maxTotalClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault,
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
					originalClaimAmountDefault,
					maxTotalClaimDefault,
					decreaseStepDefault,
					incrementIntervalDefault,
					baseIntervalDefault,
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
					maxTotalClaimDefault, // it's supposed to be wrong!
					originalClaimAmountDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault,
					communityMinTrancheDefault,
					communityMaxTrancheDefault,
					maxBeneficiariesDefault
				)
			).to.be.rejected;
		});

		it("Should transfer founds from communityAdmin to address if admin", async function () {
			const initialBalance = await cUSD.balanceOf(adminAccount1.address);
			expect(await cUSD.balanceOf(communityAdminProxy.address)).to.eq(0);
			await cUSD.mint(communityAdminProxy.address, parseEther("100"));
			expect(await cUSD.balanceOf(communityAdminProxy.address)).to.eq(
				parseEther("100")
			);
			await communityAdminProxy.transfer(
				cUSD.address,
				adminAccount1.address,
				parseEther("100")
			);
			expect(await cUSD.balanceOf(communityAdminProxy.address)).to.eq(0);
			expect(await cUSD.balanceOf(adminAccount1.address)).to.eq(
				initialBalance.add(parseEther("100"))
			);
		});

		it("Should not transfer founds from communityAdmin to address if not admin", async function () {
			const initialBalance = await cUSD.balanceOf(adminAccount1.address);
			expect(await cUSD.balanceOf(communityAdminProxy.address)).to.eq(0);
			await cUSD.mint(communityAdminProxy.address, parseEther("100"));
			expect(await cUSD.balanceOf(communityAdminProxy.address)).to.eq(
				parseEther("100")
			);
			await expect(
				communityAdminProxy
					.connect(adminAccount2)
					.transfer(
						cUSD.address,
						adminAccount1.address,
						parseEther("100")
					)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(await cUSD.balanceOf(communityAdminProxy.address)).to.eq(
				parseEther("100")
			);
			expect(await cUSD.balanceOf(adminAccount1.address)).to.eq(
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

		it("should updateAuthorizedWalletAddress if owner or impactMarketCouncil", async () => {
			await expect(
				communityAdminProxy.updateAuthorizedWalletAddress(FAKE_ADDRESS)
			).to.be.fulfilled;

			expect(await communityAdminProxy.authorizedWalletAddress()).to.eq(
				FAKE_ADDRESS
			);
		});

		it("should updateAuthorizedWalletAddress if owner", async () => {
			await expect(
				communityAdminProxy.updateAuthorizedWalletAddress(FAKE_ADDRESS)
			).to.be.fulfilled;

			expect(await communityAdminProxy.authorizedWalletAddress()).to.eq(
				FAKE_ADDRESS
			);
		});

		it("should not updateAuthorizedWalletAddress if not owner", async () => {
			await expect(
				communityAdminProxy
					.connect(adminAccount1)
					.updateAuthorizedWalletAddress(FAKE_ADDRESS)
			).to.be.rejectedWith(
				"CommunityAdmin: Not Owner Or ImpactMarketCouncil"
			);
		});

		it("should updateMinClaimAmountRatio if owner or impactMarketCouncil", async () => {
			await expect(communityAdminProxy.updateMinClaimAmountRatio(123)).to
				.be.fulfilled;

			expect(await communityAdminProxy.minClaimAmountRatio()).to.eq(123);
		});

		it("should updateMinClaimAmountRatio if owner", async () => {
			await expect(communityAdminProxy.updateMinClaimAmountRatio(123)).to
				.be.fulfilled;

			expect(await communityAdminProxy.minClaimAmountRatio()).to.eq(123);
		});

		it("should not updateMinClaimAmountRatio if not owner", async () => {
			await expect(
				communityAdminProxy
					.connect(adminAccount1)
					.updateMinClaimAmountRatio(123)
			).to.be.rejectedWith(
				"CommunityAdmin: Not Owner Or ImpactMarketCouncil"
			);

			expect(await communityAdminProxy.minClaimAmountRatio()).to.eq(
				minClaimAmountRatioDefault
			);
		});

		it("should not updateMinClaimAmountRatio if minClaimAmountRatio too small", async () => {
			await expect(
				communityAdminProxy.updateMinClaimAmountRatio(50)
			).to.be.rejectedWith(
				"CommunityAdmin::updateMinClaimAmountRatio: Invalid minClaimAmountRatio"
			);

			expect(await communityAdminProxy.minClaimAmountRatio()).to.eq(
				minClaimAmountRatioDefault
			);
		});

		it("should updateTreasurySafetyPercentage if owner or impactMarketCouncil", async () => {
			await expect(communityAdminProxy.updateTreasurySafetyPercentage(13))
				.to.be.fulfilled;

			expect(await communityAdminProxy.treasurySafetyPercentage()).to.eq(
				13
			);

			await expect(communityAdminProxy.updateTreasurySafetyPercentage(31))
				.to.be.fulfilled;

			expect(await communityAdminProxy.treasurySafetyPercentage()).to.eq(
				31
			);
		});

		it("should not updateTreasurySafetyPercentage if not owner nor impactMarketCouncil", async () => {
			await expect(
				communityAdminProxy
					.connect(adminAccount1)
					.updateTreasurySafetyPercentage(123)
			).to.be.rejectedWith(
				"CommunityAdmin: Not Owner Or ImpactMarketCouncil"
			);

			expect(await communityAdminProxy.treasurySafetyPercentage()).to.eq(
				TREASURY_SAFETY_PERCENTAGE
			);
		});

		it("should not updateTreasurySafetyPercentage with invalid percentage", async () => {
			await expect(
				communityAdminProxy
					.connect(deployer)
					.updateTreasurySafetyPercentage(123)
			).to.be.rejectedWith(
				"CommunityAdmin::updateTreasurySafetyPercentage: Invalid treasurySafetyPercentage"
			);

			await expect(
				communityAdminProxy
					.connect(deployer)
					.updateTreasurySafetyPercentage(0)
			).to.be.rejectedWith(
				"CommunityAdmin::updateTreasurySafetyPercentage: Invalid treasurySafetyPercentage"
			);

			expect(await communityAdminProxy.treasurySafetyPercentage()).to.eq(
				TREASURY_SAFETY_PERCENTAGE
			);
		});

		it("should updateTreasuryMinBalance if owner or impactMarketCouncil", async () => {
			await expect(communityAdminProxy.updateTreasuryMinBalance(123)).to
				.be.fulfilled;

			expect(await communityAdminProxy.treasuryMinBalance()).to.eq(123);

			await expect(communityAdminProxy.updateTreasuryMinBalance(321)).to
				.be.fulfilled;

			expect(await communityAdminProxy.treasuryMinBalance()).to.eq(321);
		});

		it("should not updateTreasuryMinBalance if not owner nor impactMarketCouncil", async () => {
			await expect(
				communityAdminProxy
					.connect(adminAccount1)
					.updateTreasuryMinBalance(123)
			).to.be.rejectedWith(
				"CommunityAdmin: Not Owner Or ImpactMarketCouncil"
			);

			expect(await communityAdminProxy.treasuryMinBalance()).to.eq(
				TREASURY_MIN_BALANCE
			);
		});

		it("should not fundCommunity if not community", async () => {
			await expect(
				communityAdminProxy.connect(adminAccount1).fundCommunity()
			).to.be.rejectedWith("CommunityAdmin: NOT_COMMUNITY");
		});

		it("should not transferToBeneficiary if not community", async () => {
			await expect(
				communityAdminProxy
					.connect(adminAccount1)
					.transferToBeneficiary(
						cUSD.address,
						adminAccount1.address,
						toEther(1)
					)
			).to.be.rejectedWith("CommunityAdmin: NOT_COMMUNITY");
		});
	});

	describe("Community", () => {
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(treasuryProxy.address, mintAmount);

			await addDefaultCommunity();
		});

		it("Should transfer founds from community to address if admin", async function () {
			const initialBalance = await cUSD.balanceOf(adminAccount1.address);
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				parseEther("100")
			);
			await communityAdminProxy.transferFromCommunity(
				communityProxy.address,
				cUSD.address,
				adminAccount1.address,
				parseEther("100")
			);
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(0);
			expect(await cUSD.balanceOf(adminAccount1.address)).to.eq(
				initialBalance.add(parseEther("100"))
			);
		});

		it("Should not transfer founds from community to address if not admin #1", async function () {
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
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

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				parseEther("100")
			);
			expect(await cUSD.balanceOf(adminAccount2.address)).to.eq(
				parseEther("0")
			);
		});

		it("Should not transfer founds from community to address if not admin #2", async function () {
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
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

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				parseEther("100")
			);
			expect(await cUSD.balanceOf(adminAccount2.address)).to.eq(
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

		it("Should update maxBeneficiaries if ambassador", async function () {
			expect(await communityProxy.maxBeneficiaries()).to.eq(100);
			await expect(
				communityProxy.connect(ambassadorA).updateMaxBeneficiaries(6)
			).to.be.fulfilled;
			expect(await communityProxy.maxBeneficiaries()).to.eq(6);
		});

		it("Should not update maxBeneficiaries if not ambassador", async function () {
			expect(await communityProxy.maxBeneficiaries()).to.eq(100);
			await expect(
				communityProxy.connect(adminAccount2).updateMaxBeneficiaries(6)
			).to.be.rejectedWith(
				"Community: NOT_OWNER_OR_AMBASSADOR_OR_ENTITY"
			);
			expect(await communityProxy.maxBeneficiaries()).to.eq(100);
		});
	});

	describe("Community - Beneficiary", () => {
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(treasuryProxy.address, mintAmount);

			await addDefaultCommunity();
		});

		it("should add beneficiary to community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.addBeneficiaries([beneficiaryA.address])
			)
				.to.emit(communityProxy, "BeneficiaryAdded")
				.withArgs(communityManagerA.address, beneficiaryA.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
		});

		it("should add beneficiary to community #2", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
		});

		it("should add beneficiaries to community #1", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.NONE);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address, beneficiaryB.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Valid);

			(
				await communityProxy.beneficiaries(beneficiaryC.address)
			).state.should.eq(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([
					beneficiaryA.address,
					beneficiaryB.address,
					beneficiaryC.address,
				]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryC.address)
			).state.should.eq(BeneficiaryState.Valid);
		});

		xit("should add beneficiaries to community #2", async () => {
			const newBeneficiariesNumber = 89;
			const newBeneficiaries = [];

			for (let i = 1; i <= newBeneficiariesNumber; i++) {
				newBeneficiaries.push(ethers.Wallet.createRandom().address);
			}
			(await communityProxy.validBeneficiaryCount()).should.eq(0);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries(newBeneficiaries);
			(await communityProxy.validBeneficiaryCount()).should.eq(
				newBeneficiariesNumber
			);
		});

		it("should add beneficiary to community using a manager signature", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			(await communityProxy.validBeneficiaryCount()).should.eq(0);

			await expect(
				communityProxy
					.connect(communityManagerB)
					.addBeneficiary(beneficiaryA.address)
			).to.be.rejectedWith("Community: NOT_MANAGER");

			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.addBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			)
				.to.emit(communityProxy, "BeneficiaryAdded")
				.withArgs(authorizedWallet.address, beneficiaryA.address);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.addBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
		});

		it("should not add beneficiary to community using a manager signature if community is locked", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await expect(communityProxy.connect(ambassadorA).lock());

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.addBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith("Community: locked");
		});

		it("should add beneficiary to community using a manager signature multiple times", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.addBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.addBeneficiariesUsingSignature(
						[beneficiaryB.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			(await communityProxy.validBeneficiaryCount()).should.eq(2);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Valid);
		});

		it("should not use manager signature for wrong community", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.addBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);

			const communityProxy2 = await ethers.getContractAt(
				"CommunityImplementation",
				await createCommunity(communityAdminProxy)
			);

			await expect(
				communityProxy2
					.connect(authorizedWallet)
					.addBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith("Community: Invalid signature");
		});

		it("should not use manager signature if not authorizedWallet", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				communityManagerB.address,
				communityProxy.address,
				expirationTimestamp
			);

			await expect(
				communityProxy
					.connect(communityManagerB)
					.addBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith(
				"Community: Sender must be the backend wallet"
			);
		});

		it("should not use manager signature for other address than backend wallet", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				communityManagerB.address,
				communityProxy.address,
				expirationTimestamp
			);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.addBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith("Community: Invalid signature");
		});

		it("should not use manager signature with wrong expiration timestamp", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.addBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.addBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp + 1,
						signature
					)
			).to.be.rejectedWith("Community: Invalid signature");
		});

		it("should not use manager signature after expiration", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.addBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			await advanceNSeconds(100);

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.addBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith("Community: Signature too old");
		});

		it("should give beneficiary 5 cents when adding to community", async () => {
			(await cUSD.balanceOf(beneficiaryA.address)).should.eq("0");
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(await cUSD.balanceOf(beneficiaryA.address)).should.eq(
				initialAmountDefault
			);
		});

		it("should give beneficiary 5 cents from treasury when community doesn't have funds", async () => {
			(await cUSD.balanceOf(beneficiaryA.address)).should.eq("0");

			await communityAdminProxy.transferFromCommunity(
				communityProxy.address,
				cUSD.address,
				treasuryProxy.address,
				await cUSD.balanceOf(communityProxy.address)
			);

			const treasuryBalanceBefore = await cUSD.balanceOf(
				treasuryProxy.address
			);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			(await cUSD.balanceOf(beneficiaryA.address)).should.eq(
				initialAmountDefault
			);

			(await cUSD.balanceOf(treasuryProxy.address)).should.eq(
				treasuryBalanceBefore.sub(initialAmountDefault)
			);
		});

		it("should lock beneficiary from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.lockBeneficiary(beneficiaryA.address)
			)
				.to.emit(communityProxy, "BeneficiaryLocked")
				.withArgs(communityManagerA.address, beneficiaryA.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Locked);
		});

		it("should not lock an invalid beneficiary from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);

			await expect(
				communityProxy
					.connect(communityManagerA)
					.lockBeneficiary(beneficiaryA.address)
			).to.be.fulfilled;

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
		});

		it("should not lock an removed beneficiary from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			await communityProxy
				.connect(communityManagerA)
				.removeBeneficiary(beneficiaryA.address);

			await expect(
				communityProxy
					.connect(communityManagerA)
					.lockBeneficiary(beneficiaryA.address)
			).to.be.fulfilled;

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Removed);
		});

		it("should unlock locked beneficiary from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			await communityProxy
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Locked);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.unlockBeneficiary(beneficiaryA.address)
			)
				.to.emit(communityProxy, "BeneficiaryUnlocked")
				.withArgs(communityManagerA.address, beneficiaryA.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
		});

		it("should not unlock a not locked beneficiary from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.unlockBeneficiary(beneficiaryA.address)
			).to.be.fulfilled;
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
		});

		it("should not unlock a removed beneficiary from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			await communityProxy
				.connect(communityManagerA)
				.removeBeneficiaries([beneficiaryA.address]);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.unlockBeneficiary(beneficiaryA.address)
			).to.be.fulfilled;
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Removed);
		});

		it("should lock beneficiaries from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.lockBeneficiaries([beneficiaryA.address])
			)
				.to.emit(communityProxy, "BeneficiaryLocked")
				.withArgs(communityManagerA.address, beneficiaryA.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Locked);
		});

		it("should not lock invalid beneficiaries from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);

			await expect(
				communityProxy
					.connect(communityManagerA)
					.lockBeneficiaries([beneficiaryA.address])
			).to.be.fulfilled;

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
		});

		it("should not lock removed beneficiaries from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryA.address);
			await communityProxy
				.connect(communityManagerA)
				.removeBeneficiary(beneficiaryA.address);

			await expect(
				communityProxy
					.connect(communityManagerA)
					.lockBeneficiaries([beneficiaryA.address])
			).to.be.fulfilled;

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Removed);
		});

		it("should unlock locked beneficiaries from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address, beneficiaryB.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			await communityProxy
				.connect(communityManagerA)
				.lockBeneficiaries([
					beneficiaryA.address,
					beneficiaryB.address,
				]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Locked);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Locked);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.unlockBeneficiaries([
						beneficiaryA.address,
						beneficiaryB.address,
					])
			)
				.to.emit(communityProxy, "BeneficiaryUnlocked")
				.withArgs(communityManagerA.address, beneficiaryA.address)
				.to.emit(communityProxy, "BeneficiaryUnlocked")
				.withArgs(communityManagerA.address, beneficiaryB.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Valid);
		});

		it("should not unlock valid beneficiaries from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.unlockBeneficiaries([beneficiaryA.address])
			).to.be.fulfilled;
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
		});

		it("should not unlock removed beneficiaries from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			await communityProxy
				.connect(communityManagerA)
				.removeBeneficiaries([beneficiaryA.address]);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.unlockBeneficiaries([beneficiaryA.address])
			).to.be.fulfilled;
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Removed);
		});

		it("should lock beneficiaries using a manager signature", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.lockBeneficiaries([
						beneficiaryA.address,
						beneficiaryB.address,
					])
			).to.be.rejectedWith("Community: NOT_MANAGER");

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.lockBeneficiariesUsingSignature(
						[beneficiaryA.address, beneficiaryB.address],
						expirationTimestamp,
						signature
					)
			)
				.to.emit(communityProxy, "BeneficiaryLocked")
				.withArgs(authorizedWallet.address, beneficiaryA.address)
				.to.emit(communityProxy, "BeneficiaryLocked")
				.withArgs(authorizedWallet.address, beneficiaryB.address);

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Locked);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Locked);
		});

		it("should not lock beneficiaries using a manager signature if community is locked", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(communityProxy.connect(ambassadorA).lock());

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.lockBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith("Community: locked");
		});

		it("should lock beneficiaries using a manager signature multiple times", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.lockBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.lockBeneficiariesUsingSignature(
						[beneficiaryB.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			(await communityProxy.validBeneficiaryCount()).should.eq(0);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Locked);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Locked);
		});

		it("should not use manager signature for wrong community #lock", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);

			const communityProxy2 = await ethers.getContractAt(
				"CommunityImplementation",
				await createCommunity(communityAdminProxy)
			);

			await expect(
				communityProxy2
					.connect(authorizedWallet)
					.lockBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith("Community: Invalid signature");
		});

		it("should not use manager signature by another person #lock", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(communityManagerC)
					.lockBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith(
				"Community: Sender must be the backend wallet"
			);
		});

		it("should not use manager signature with wrong expiration timestamp #lock", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.lockBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp + 1,
						signature
					)
			).to.be.rejectedWith("Community: Invalid signature");
		});

		it("should not use manager signature after expiration #lock", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.lockBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			await advanceNSeconds(100);

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Locked);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.lockBeneficiariesUsingSignature(
						[beneficiaryB.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith("Community: Signature too old");
		});

		it("should unlock beneficiaries using a manager signature", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.lockBeneficiaries([
						beneficiaryA.address,
						beneficiaryB.address,
					])
			).to.be.rejectedWith("Community: NOT_MANAGER");

			await communityProxy
				.connect(authorizedWallet)
				.lockBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.unlockBeneficiariesUsingSignature(
						[beneficiaryA.address, beneficiaryB.address],
						expirationTimestamp,
						signature
					)
			)
				.to.emit(communityProxy, "BeneficiaryUnlocked")
				.withArgs(authorizedWallet.address, beneficiaryA.address)
				.to.emit(communityProxy, "BeneficiaryUnlocked")
				.withArgs(authorizedWallet.address, beneficiaryB.address);

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
		});

		it("should not use manager signature with wrong expiration timestamp #unlock", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);
			await communityProxy
				.connect(authorizedWallet)
				.lockBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.unlockBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp + 1,
						signature
					)
			).to.be.rejectedWith("Community: Invalid signature");
		});

		it("should not use manager signature after expiration #unlock", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await communityProxy
				.connect(authorizedWallet)
				.lockBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.unlockBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			await advanceNSeconds(100);

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.unlockBeneficiariesUsingSignature(
						[beneficiaryB.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith("Community: Signature too old");
		});

		it("should remove beneficiary from community", async () => {
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.NONE);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.removeBeneficiary(beneficiaryA.address)
			)
				.to.emit(communityProxy, "BeneficiaryRemoved")
				.withArgs(communityManagerA.address, beneficiaryA.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Removed);
		});

		it("should remove beneficiaries from community", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryB.address]);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Valid);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.removeBeneficiaries([
						beneficiaryA.address,
						beneficiaryB.address,
					])
			)
				.to.emit(communityProxy, "BeneficiaryRemoved")
				.withArgs(communityManagerA.address, beneficiaryA.address)
				.to.emit(communityProxy, "BeneficiaryRemoved")
				.withArgs(communityManagerA.address, beneficiaryB.address);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Removed);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Removed);
		});

		it("should remove beneficiaries using a manager signature", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.removeBeneficiaries([
						beneficiaryA.address,
						beneficiaryB.address,
					])
			).to.be.rejectedWith("Community: NOT_MANAGER");

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.removeBeneficiariesUsingSignature(
						[beneficiaryA.address, beneficiaryB.address],
						expirationTimestamp,
						signature
					)
			)
				.to.emit(communityProxy, "BeneficiaryRemoved")
				.withArgs(authorizedWallet.address, beneficiaryA.address)
				.to.emit(communityProxy, "BeneficiaryRemoved")
				.withArgs(authorizedWallet.address, beneficiaryB.address);

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Removed);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Removed);
		});

		it("should remove beneficiaries using a manager signature multiple times", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.removeBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.removeBeneficiariesUsingSignature(
						[beneficiaryB.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			(await communityProxy.validBeneficiaryCount()).should.eq(0);
			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Removed);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Removed);
		});

		it("should not use manager signature for wrong community #remove", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);

			const communityProxy2 = await ethers.getContractAt(
				"CommunityImplementation",
				await createCommunity(communityAdminProxy)
			);

			await expect(
				communityProxy2
					.connect(authorizedWallet)
					.removeBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith("Community: Invalid signature");
		});

		it("should not use manager signature by another person #remove", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(communityManagerC)
					.removeBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith(
				"Community: Sender must be the backend wallet"
			);
		});

		it("should not use manager signature with wrong expiration timestamp #remove", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.removeBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp + 1,
						signature
					)
			).to.be.rejectedWith("Community: Invalid signature");
		});

		it("should not use manager signature after expiration #remove", async () => {
			const expirationTimestamp =
				(await getCurrentBlockTimestamp()) + 100;
			const signature = await signParams(
				communityManagerA,
				authorizedWallet.address,
				communityProxy.address,
				expirationTimestamp
			);

			await communityProxy
				.connect(authorizedWallet)
				.addBeneficiariesUsingSignature(
					[beneficiaryA.address, beneficiaryB.address],
					expirationTimestamp,
					signature
				);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.removeBeneficiariesUsingSignature(
						[beneficiaryA.address],
						expirationTimestamp,
						signature
					)
			).to.be.fulfilled;

			await advanceNSeconds(100);

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Removed);

			await expect(
				communityProxy
					.connect(authorizedWallet)
					.removeBeneficiariesUsingSignature(
						[beneficiaryB.address],
						expirationTimestamp,
						signature
					)
			).to.be.rejectedWith("Community: Signature too old");
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
			expect(await communityProxy.validBeneficiaryCount()).to.eq(2);
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
			).state.should.eq(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryC.address)
			).state.should.eq(BeneficiaryState.NONE);
			(
				await communityProxy.beneficiaries(beneficiaryD.address)
			).state.should.eq(BeneficiaryState.NONE);
			expect(await communityProxy.validBeneficiaryCount()).to.eq(2);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.addBeneficiaries([beneficiaryC.address])
			).to.be.fulfilled;
			expect(await communityProxy.validBeneficiaryCount()).to.eq(3);
			await expect(
				communityProxy
					.connect(communityManagerA)
					.addBeneficiaries([beneficiaryD.address])
			).to.be.rejectedWith(
				"Community::_changeBeneficiaryState: This community has reached the maximum number of valid beneficiaries"
			);
			expect(await communityProxy.validBeneficiaryCount()).to.eq(3);

			(
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state.should.eq(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryC.address)
			).state.should.eq(BeneficiaryState.Valid);
			(
				await communityProxy.beneficiaries(beneficiaryD.address)
			).state.should.eq(BeneficiaryState.NONE);
		});
	});

	describe("Community - Claim", () => {
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(treasuryProxy.address, mintAmount);

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
			).to.eq(0);
			await communityProxy.connect(beneficiaryA).claim();
			expect(
				await communityProxy.lastInterval(beneficiaryA.address)
			).to.eq(baseInterval);
			await advanceTimeAndBlockNTimes(baseInterval);
			await communityProxy.connect(beneficiaryA).claim();
			expect(
				await communityProxy.lastInterval(beneficiaryA.address)
			).to.eq(baseInterval + incrementInterval);
			await advanceTimeAndBlockNTimes(incrementInterval);

			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("NOT_YET");
			expect(
				await communityProxy.lastInterval(beneficiaryA.address)
			).to.eq(baseInterval + incrementInterval);
			await advanceTimeAndBlockNTimes(baseInterval + incrementInterval);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;
			expect(
				await communityProxy.lastInterval(beneficiaryA.address)
			).to.eq(baseInterval + 2 * incrementInterval);
			await advanceTimeAndBlockNTimes(baseInterval + incrementInterval);

			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("NOT_YET");
			expect(
				await communityProxy.lastInterval(beneficiaryA.address)
			).to.eq(baseInterval + 2 * incrementInterval);
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

		it("should not claim if beneficiary has been changed", async () => {
			const baseInterval = (
				await communityProxy.baseInterval()
			).toNumber();

			await advanceTimeAndBlockNTimes(baseInterval + 1);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				);

			await communityProxy
				.connect(beneficiaryA)
				.claim()
				.should.be.rejectedWith("Community: NOT_VALID_BENEFICIARY");
		});

		it("should not claim if community is locked", async () => {
			await expect(communityProxy.connect(ambassadorA).lock())
				.to.emit(communityProxy, "CommunityLocked")
				.withArgs(ambassadorA.address);
			await expect(
				communityProxy.connect(beneficiaryA).claim()
			).to.be.rejectedWith("Community: locked");
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
			).to.eq(0);
			await communityProxy.connect(beneficiaryA).claim();
			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(originalClaimAmountDefault);

			(await cUSD.balanceOf(beneficiaryA.address)).should.eq(
				originalClaimAmountDefault.add(initialAmountDefault)
			);
		});

		it("should claim maxClaim", async () => {
			const baseInterval = (
				await communityProxy.baseInterval()
			).toNumber();
			const incrementInterval = (
				await communityProxy.incrementInterval()
			).toNumber();
			const originalClaimAmount =
				await communityProxy.originalClaimAmount();
			const maxClaim = await communityProxy.maxTotalClaim();
			let maxClaimsPerUser = maxClaim.div(originalClaimAmount).toNumber();
			if (originalClaimAmount.mul(maxClaimsPerUser) < maxClaim) {
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
			expect(beneficiaryADetails.claims).to.eq(maxClaimsPerUser);
			expect(beneficiaryADetails.claimedAmount).to.eq(maxClaim);
		});

		it("should not claim after max claim", async () => {
			const baseInterval = (
				await communityProxy.baseInterval()
			).toNumber();
			const incrementInterval = (
				await communityProxy.incrementInterval()
			).toNumber();
			const originalClaimAmount =
				await communityProxy.originalClaimAmount();
			const maxClaim = await communityProxy.maxTotalClaim();
			let maxClaimsPerUser = maxClaim.div(originalClaimAmount).toNumber();
			if (originalClaimAmount.mul(maxClaimsPerUser) < maxClaim) {
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

		it("should changeBeneficiaryAddressByManager #new beneficiary", async () => {
			await advanceTimeAndBlockNTimes(baseIntervalDefault + 1);
			await communityProxy.connect(beneficiaryA).claim();
			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				)
				.should.emit(communityProxy, "BeneficiaryAddressChanged")
				.withArgs(beneficiaryA.address, beneficiaryB.address);

			const beneficiaryADetails = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBDetails = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmounts =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmounts =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			beneficiaryBDetails.state.should.eq(BeneficiaryState.Valid);
			beneficiaryBDetails.claims.should.eq(beneficiaryADetails.claims);
			beneficiaryBDetails.claimedAmount.should.eq(
				beneficiaryADetails.claimedAmount
			);
			beneficiaryBDetails.lastClaim.should.eq(
				beneficiaryADetails.lastClaim
			);

			beneficiaryADetails.state.should.eq(
				BeneficiaryState.AddressChanged
			);

			beneficiaryBClaimedAmounts[0].should.eq(
				beneficiaryAClaimedAmounts[0]
			);
		});

		it("should changeBeneficiaryAddress #new beneficiary", async () => {
			await advanceTimeAndBlockNTimes(baseIntervalDefault + 1);
			await communityProxy.connect(beneficiaryA).claim();
			await communityProxy
				.connect(beneficiaryA)
				.changeBeneficiaryAddress(beneficiaryB.address)
				.should.emit(communityProxy, "BeneficiaryAddressChanged")
				.withArgs(beneficiaryA.address, beneficiaryB.address);

			const beneficiaryADetails = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBDetails = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmounts =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmounts =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			beneficiaryBDetails.state.should.eq(BeneficiaryState.Valid);
			beneficiaryBDetails.claims.should.eq(beneficiaryADetails.claims);
			beneficiaryBDetails.claimedAmount.should.eq(
				beneficiaryADetails.claimedAmount
			);
			beneficiaryBDetails.lastClaim.should.eq(
				beneficiaryADetails.lastClaim
			);

			beneficiaryADetails.state.should.eq(
				BeneficiaryState.AddressChanged
			);

			beneficiaryBClaimedAmounts[0].should.eq(
				beneficiaryAClaimedAmounts[0]
			);
		});

		it("should changeBeneficiaryAddressByManager #existing beneficiary #1", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryB.address]);

			await advanceTimeAndBlockNTimes(baseIntervalDefault + 1);

			await communityProxy.connect(beneficiaryA).claim();
			await communityProxy.connect(beneficiaryB).claim();

			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault + 1
			);
			await communityProxy.connect(beneficiaryA).claim();

			const beneficiaryABefore = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBBefore = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmountsBefore =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmountsBefore =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				)
				.should.emit(communityProxy, "BeneficiaryAddressChanged")
				.withArgs(beneficiaryA.address, beneficiaryB.address);

			const beneficiaryAAfter = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBAfter = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmountsAfter =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmountsAfter =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			beneficiaryBAfter.state.should.eq(beneficiaryBBefore.state);
			beneficiaryBAfter.claims.should.eq(
				beneficiaryABefore.claims.toNumber() +
					beneficiaryBBefore.claims.toNumber()
			);
			beneficiaryBAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount.add(
					beneficiaryBBefore.claimedAmount
				)
			);
			beneficiaryBAfter.lastClaim.should.eq(beneficiaryABefore.lastClaim);
			beneficiaryBClaimedAmountsAfter[0].should.eq(
				beneficiaryAClaimedAmountsBefore[0].add(
					beneficiaryBClaimedAmountsBefore[0]
				)
			);

			beneficiaryAAfter.state.should.eq(BeneficiaryState.AddressChanged);
			beneficiaryAAfter.claims.should.eq(beneficiaryABefore.claims);
			beneficiaryAAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount
			);
			beneficiaryAAfter.lastClaim.should.eq(beneficiaryABefore.lastClaim);
			beneficiaryAClaimedAmountsAfter[0].should.eq(
				beneficiaryAClaimedAmountsBefore[0]
			);
		});

		it("should changeBeneficiaryAddressByManager #existing beneficiary #2", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryB.address]);

			await advanceTimeAndBlockNTimes(baseIntervalDefault + 1);

			await communityProxy.connect(beneficiaryA).claim();
			await communityProxy.connect(beneficiaryB).claim();

			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault + 1
			);
			await communityProxy.connect(beneficiaryB).claim();

			const beneficiaryABefore = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBBefore = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmountsBefore =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmountsBefore =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				)
				.should.emit(communityProxy, "BeneficiaryAddressChanged")
				.withArgs(beneficiaryA.address, beneficiaryB.address);

			const beneficiaryAAfter = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBAfter = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmountsAfter =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmountsAfter =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			beneficiaryBAfter.state.should.eq(beneficiaryBBefore.state);
			beneficiaryBAfter.claims.should.eq(
				beneficiaryABefore.claims.toNumber() +
					beneficiaryBBefore.claims.toNumber()
			);
			beneficiaryBAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount.add(
					beneficiaryBBefore.claimedAmount
				)
			);
			beneficiaryBAfter.lastClaim.should.eq(beneficiaryBBefore.lastClaim);
			beneficiaryBClaimedAmountsAfter[0].should.eq(
				beneficiaryAClaimedAmountsBefore[0].add(
					beneficiaryBClaimedAmountsBefore[0]
				)
			);

			beneficiaryAAfter.state.should.eq(BeneficiaryState.AddressChanged);
			beneficiaryAAfter.claims.should.eq(beneficiaryABefore.claims);
			beneficiaryAAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount
			);
			beneficiaryAAfter.lastClaim.should.eq(beneficiaryABefore.lastClaim);
			beneficiaryAClaimedAmountsAfter[0].should.eq(
				beneficiaryAClaimedAmountsBefore[0]
			);
		});

		it("should not changeBeneficiaryAddress if the target user is not new", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiary(beneficiaryB.address);

			await communityProxy
				.connect(beneficiaryA)
				.changeBeneficiaryAddress(beneficiaryB.address)
				.should.be.rejectedWith(
					"Community::changeBeneficiaryAddress: Invalid beneficiary"
				);
		});

		it("should changeBeneficiaryAddress and copy status for a new user", async () => {
			await communityProxy
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);
			await communityProxy
				.connect(beneficiaryA)
				.changeBeneficiaryAddress(beneficiaryB.address);

			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Locked);

			await communityProxy
				.connect(communityManagerA)
				.unlockBeneficiary(beneficiaryB.address);
			await communityProxy
				.connect(beneficiaryB)
				.changeBeneficiaryAddress(beneficiaryC.address);
			(
				await communityProxy.beneficiaries(beneficiaryC.address)
			).state.should.eq(BeneficiaryState.Valid);

			await communityProxy
				.connect(communityManagerA)
				.removeBeneficiary(beneficiaryC.address);
			await communityProxy
				.connect(beneficiaryC)
				.changeBeneficiaryAddress(beneficiaryD.address);
			(
				await communityProxy.beneficiaries(beneficiaryD.address)
			).state.should.eq(BeneficiaryState.Removed);
		});

		it("should changeBeneficiaryAddressByManager and not copy status for an existing user", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([
					beneficiaryB.address,
					beneficiaryC.address,
					beneficiaryD.address,
				]);

			await communityProxy
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);
			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				);

			(
				await communityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Valid);

			await communityProxy
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryC.address);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryB.address,
					beneficiaryC.address
				);
			(
				await communityProxy.beneficiaries(beneficiaryC.address)
			).state.should.eq(BeneficiaryState.Locked);

			await communityProxy
				.connect(communityManagerA)
				.removeBeneficiary(beneficiaryD.address);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryC.address,
					beneficiaryD.address
				);
			(
				await communityProxy.beneficiaries(beneficiaryD.address)
			).state.should.eq(BeneficiaryState.Removed);
		});

		it("should not changeBeneficiaryAddressByManager if old beneficiary has been changed ", async () => {
			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				)
				.should.be.rejectedWith(
					"Community::changeBeneficiaryAddress: Invalid beneficiary"
				);
		});

		it("should not changeBeneficiaryAddressByManager if new beneficiary has been changed ", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryB.address]);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryB.address,
					beneficiaryC.address
				);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				)
				.should.be.rejectedWith(
					"Community::changeBeneficiaryAddress: Invalid target beneficiary"
				);
		});

		it("should not changeBeneficiaryAddress if old beneficiary has been changed ", async () => {
			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				);

			await communityProxy
				.connect(beneficiaryA)
				.changeBeneficiaryAddress(beneficiaryB.address)
				.should.be.rejectedWith(
					"Community::changeBeneficiaryAddress: Invalid beneficiary"
				);
		});

		it("should not changeBeneficiaryAddressByManager if old beneficiary is new", async () => {
			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryB.address,
					beneficiaryA.address
				)
				.should.be.rejectedWith(
					"Community::changeBeneficiaryAddress: Invalid beneficiary"
				);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryB.address,
					beneficiaryC.address
				)
				.should.be.rejectedWith(
					"Community::changeBeneficiaryAddress: Invalid beneficiary"
				);
		});
	});

	describe("Community - Governance", () => {
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			await cUSD.mint(treasuryProxy.address, mintAmount);

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
			previousCommunityOldBalance.should.eq(newCommunityNewBalance);
			previousCommunityNewBalance.should.eq(parseEther("100"));
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
			).state.should.eq(BeneficiaryState.Valid);
			(
				await newCommunityProxy.beneficiaries(beneficiaryB.address)
			).state.should.eq(BeneficiaryState.Valid);
			(
				await newCommunityProxy.beneficiaries(beneficiaryC.address)
			).state.should.eq(BeneficiaryState.NONE);
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
			(await communityProxy.incrementInterval()).should.eq(
				incrementIntervalDefault
			);

			(await communityProxy.maxBeneficiaries()).should.eq(
				maxBeneficiariesDefault
			);

			await communityAdminProxy.updateBeneficiaryParams(
				communityProxy.address,
				originalClaimAmountDefault.mul(2),
				maxTotalClaimDefault.mul(3),
				decreaseStepDefault.mul(4),
				baseIntervalDefault * 5,
				incrementIntervalDefault * 6,
				maxBeneficiariesDefault + 7
			);

			(await communityProxy.originalClaimAmount()).should.eq(
				originalClaimAmountDefault.mul(2)
			);

			(await communityProxy.originalClaimAmount()).should.eq(
				originalClaimAmountDefault.mul(2)
			);

			(await communityProxy.maxTotalClaim()).should.eq(
				maxTotalClaimDefault.mul(3)
			);

			(await communityProxy.decreaseStep()).should.eq(
				decreaseStepDefault.mul(4)
			);

			(await communityProxy.baseInterval()).should.eq(
				baseIntervalDefault * 5
			);

			(await communityProxy.incrementInterval()).should.eq(
				incrementIntervalDefault * 6
			);

			(await communityProxy.maxBeneficiaries()).should.eq(
				maxBeneficiariesDefault + 7
			);
		});

		it("should not be able edit community if not CommunityAdmin", async () => {
			await expect(
				communityProxy
					.connect(adminAccount1)
					.updateBeneficiaryParams(
						originalClaimAmountDefault,
						maxTotalClaimDefault,
						decreaseStepDefault,
						baseIntervalDefault,
						baseIntervalDefault
					)
			).to.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("should not be able edit community with invalid values", async () => {
			await expect(
				communityAdminProxy.updateBeneficiaryParams(
					communityProxy.address,
					originalClaimAmountDefault,
					maxTotalClaimDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					baseIntervalDefault + 1,
					maxBeneficiariesDefault
				)
			).to.be.rejectedWith(
				"Community::updateBeneficiaryParams: baseInterval must be greater than incrementInterval"
			);

			await expect(
				communityAdminProxy.updateBeneficiaryParams(
					communityProxy.address,
					maxTotalClaimDefault,
					originalClaimAmountDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault,
					maxBeneficiariesDefault
				)
			).to.be.rejectedWith(
				"Community::updateBeneficiaryParams: originalClaimAmount too big"
			);
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
				originalClaimAmountDefault,
				maxTotalClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault,
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
			await cUSD.mint(communityAddress, mintAmount);

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
			).state.should.eq(BeneficiaryState.Valid);
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
				.add(originalClaimAmountDefault)
				.should.eq(currentBalance);
		};

		before(async function () {
			await init();
		});
		beforeEach(async () => {
			await deploy();
		});

		it("one beneficiary to one community", async () => {
			await cUSD.mint(treasuryProxy.address, mintAmount);
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
			await cUSD.mint(treasuryProxy.address, mintAmount);
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
			const maxClaim = await communityProxyA.maxTotalClaim();
			let maxClaimsPerUser = maxClaim.div(claimAmount).toNumber();
			if (claimAmount.mul(maxClaimsPerUser) < maxClaim) {
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
				.should.eq(
					claimAmount
						.mul(6)
						.add(maxClaim)
						.add(initialAmountDefault.mul(4))
				);
		});

		it("many beneficiaries to many communities", async () => {
			await cUSD.mint(treasuryProxy.address, mintAmount);
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
			const maxClaimA = await communityProxyA.maxTotalClaim();
			let maxClaimsPerUserA = maxClaimA.div(claimAmountA).toNumber();
			if (claimAmountA.mul(maxClaimsPerUserA) < maxClaimA) {
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
			const maxClaimB = await communityProxyB.maxTotalClaim();
			let maxClaimsPerUserB = maxClaimB.div(claimAmountB).toNumber();
			if (claimAmountB.mul(maxClaimsPerUserB) < maxClaimB) {
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
				.should.eq(
					claimAmountA
						.mul(3)
						.add(maxClaimA)
						.add(initialAmountDefault.mul(2))
				);
			const currentCommunityBalanceB = await cUSD.balanceOf(
				communityProxyB.address
			);
			previousCommunityBalanceB
				.sub(currentCommunityBalanceB)
				.should.eq(
					claimAmountB
						.mul(4)
						.add(maxClaimB)
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
			await cUSD.mint(treasuryProxy.address, mintAmount);

			await addDefaultCommunity();

			firstBlock = await getBlockNumber();
		});

		it("should get funds if manager", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			const balance = await cUSD.balanceOf(communityProxy.address);

			await communityAdminProxy.transferFromCommunity(
				communityProxy.address,
				cUSD.address,
				deployer.address,
				balance
			);

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(originalClaimAmountDefault);
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await communityProxy.lastFundRequest()).to.eq(
				firstBlock + 3
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				originalClaimAmountDefault
			);
		});

		it("should not get funds if not manager", async () => {
			await expect(
				communityProxy.connect(beneficiaryA).requestFunds()
			).to.be.rejectedWith("Community: NOT_MANAGER");

			expect(await communityProxy.lastFundRequest()).to.eq(0);
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
					.connect(deployer)
					.updateCommunityParams(
						communityProxy.address,
						parseEther("50"),
						parseEther("100")
					)
			).to.be.fulfilled;

			expect(await communityProxy.minTranche()).to.eq(parseEther("50"));
			expect(await communityProxy.maxTranche()).to.eq(parseEther("100"));
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
					.connect(deployer)
					.updateCommunityParams(
						communityProxy.address,
						parseEther("100"),
						parseEther("1234")
					)
			).to.be.fulfilled;

			expect(await communityProxy.maxTranche()).to.eq(parseEther("1234"));
		});

		it("should not set communityMinTranche greater than communityMaxTranche", async () => {
			await expect(
				communityAdminProxy
					.connect(deployer)
					.updateCommunityParams(
						communityProxy.address,
						parseEther("50"),
						parseEther("100")
					)
			).to.be.fulfilled;
			await expect(
				communityAdminProxy
					.connect(deployer)
					.updateCommunityParams(
						communityProxy.address,
						parseEther("100"),
						parseEther("50")
					)
			).to.be.rejectedWith(
				"Community::updateCommunityParams: minTranche should not be greater than maxTranche"
			);

			expect(await communityProxy.minTranche()).to.eq(parseEther("50"));
			expect(await communityProxy.maxTranche()).to.eq(parseEther("100"));
		});

		it("should requestFunds if manager", async () => {
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				communityMinTrancheDefault
			);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			await transferCommunityFundsExcept();

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(originalClaimAmountDefault);

			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await communityProxy.lastFundRequest()).to.eq(
				firstBlock + 3
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				originalClaimAmountDefault
			);
		});

		it("should not requestFunds too often", async () => {
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				communityMinTrancheDefault
			);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			await transferCommunityFundsExcept();

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(originalClaimAmountDefault);
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await communityProxy.lastFundRequest()).to.eq(
				firstBlock + 3
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				originalClaimAmountDefault
			);

			await transferCommunityFundsExcept(toEther(1));

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			const beforeBalance = await cUSD.balanceOf(communityProxy.address);
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;

			(await cUSD.balanceOf(communityProxy.address)).should.eq(
				beforeBalance
			);

			expect(await communityProxy.lastFundRequest()).to.eq(
				firstBlock + 3
			);
		});

		it("should transfer funds to community again after baseInterval", async () => {
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				communityMinTrancheDefault
			);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			await transferCommunityFundsExcept(toEther(0.1));

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(originalClaimAmountDefault.sub(toEther(0.1)));

			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await communityProxy.lastFundRequest()).to.eq(
				firstBlock + 3
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				originalClaimAmountDefault
			);

			await transferCommunityFundsExcept();

			await advanceBlockNTimes(baseIntervalDefault);

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(originalClaimAmountDefault);
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await communityProxy.lastFundRequest()).to.eq(
				firstBlock + 41
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				originalClaimAmountDefault
			);
		});

		it("should not transfer funds more then safety limit", async () => {
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				communityMinTrancheDefault
			);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([
					beneficiaryA.address,
					beneficiaryB.address,
					beneficiaryC.address,
					beneficiaryD.address,
				]);

			await transferTreasuryFundsExcept(toEther(50));
			await transferCommunityFundsExcept();

			const treasurySafetyLimit = toEther(50)
				.mul(TREASURY_SAFETY_PERCENTAGE)
				.div(100);

			await communityAdminProxy.updateTreasuryMinBalance(0);

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

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				treasurySafetyLimit
			);
		});

		it("should not transfer funds more then safety limit #2", async () => {
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
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

			const beforeBalance = await cUSD.balanceOf(communityProxy.address);
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;

			(await cUSD.balanceOf(communityProxy.address)).should.eq(
				beforeBalance
			);
		});

		it("should donate directly in the community", async () => {
			const user1Donation = 1;

			await cUSD.mint(adminAccount1.address, user1Donation);
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				communityMinTrancheDefault
			);

			await cUSD
				.connect(adminAccount1)
				.approve(communityProxy.address, user1Donation);
			await communityProxy
				.connect(adminAccount1)
				.donate(adminAccount1.address, user1Donation);

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				communityMinTrancheDefault.add(user1Donation)
			);
			expect(await communityProxy.treasuryFunds()).to.eq(
				communityMinTrancheDefault
			);
			expect(await communityProxy.privateFunds()).to.eq(user1Donation);
		});

		it("should not requestFunds if you have more then communityMinTranche", async () => {
			const user1Donation = 1;

			await cUSD.mint(adminAccount1.address, parseEther("100"));
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				communityMinTrancheDefault
			);

			await cUSD
				.connect(adminAccount1)
				.approve(communityProxy.address, user1Donation);
			await communityProxy.donate(adminAccount1.address, user1Donation);

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				communityMinTrancheDefault.add(user1Donation)
			);

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);
			await expect(
				communityProxy.connect(communityManagerA).requestFunds()
			).to.be.fulfilled;
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				communityMinTrancheDefault.add(user1Donation)
			);

			expect(await communityProxy.lastFundRequest()).to.eq(0);
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
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq("0");
			expect(await cUSD.balanceOf(adminAccount1.address)).to.eq(
				userInitialBalance.add(communityInitialBalance)
			);
		});

		xit("should get more funds if have private donations", async () => {
			const user1Donation = parseEther("20000");

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			await cUSD.mint(adminAccount1.address, user1Donation);
			await cUSD
				.connect(adminAccount1)
				.approve(communityProxy.address, user1Donation);
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

			expect(await communityProxy.lastFundRequest()).to.eq(
				firstBlock + 6
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				communityMinTrancheDefault
			);
		});

		it("should recalculate claimAmount after transfer #1", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([
					beneficiaryA.address,
					beneficiaryB.address,
					beneficiaryC.address,
					beneficiaryD.address,
				]);

			(await communityProxy.validBeneficiaryCount()).should.eq(4);

			const communityInitialBalance = await cUSD.balanceOf(
				communityProxy.address
			);

			await communityAdminProxy
				.transferFromCommunity(
					communityProxy.address,
					cUSD.address,
					adminAccount1.address,
					communityInitialBalance.sub(toEther(0.01))
				)
				.should.emit(communityProxy, "ClaimAmountUpdated")
				.withArgs(
					originalClaimAmountDefault,
					originalClaimAmountDefault
						.mul(minClaimAmountRatioPrecision)
						.div(minClaimAmountRatioDefault)
				);

			(await cUSD.balanceOf(communityProxy.address)).should.eq(
				toEther(0.01)
			);

			await cUSD.mint(communityProxy.address, toEther(100));

			(await communityProxy.originalClaimAmount()).should.eq(
				originalClaimAmountDefault
			);
			(await communityProxy.claimAmount()).should.eq(
				originalClaimAmountDefault
					.mul(minClaimAmountRatioPrecision)
					.div(minClaimAmountRatioDefault)
			);

			await communityProxy.connect(beneficiaryA).claim();

			const beneficiaryAData = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			beneficiaryAData.claims.should.eq(1);
			beneficiaryAData.claimedAmount.should.eq(
				originalClaimAmountDefault
					.mul(minClaimAmountRatioPrecision)
					.div(minClaimAmountRatioDefault)
			);

			(await cUSD.balanceOf(beneficiaryA.address)).should.eq(
				initialAmountDefault.add(
					originalClaimAmountDefault
						.mul(minClaimAmountRatioPrecision)
						.div(minClaimAmountRatioDefault)
				)
			);
		});

		it("should recalculate claimAmount after transfer #2", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([
					beneficiaryA.address,
					beneficiaryB.address,
					beneficiaryC.address,
					beneficiaryD.address,
				]);

			(await communityProxy.validBeneficiaryCount()).should.eq(4);

			const communityInitialBalance = await cUSD.balanceOf(
				communityProxy.address
			);

			await communityAdminProxy
				.transferFromCommunity(
					communityProxy.address,
					cUSD.address,
					adminAccount1.address,
					communityInitialBalance.sub(toEther(2))
				)
				.should.emit(communityProxy, "ClaimAmountUpdated")
				.withArgs(originalClaimAmountDefault, toEther(2).div(4));

			(await cUSD.balanceOf(communityProxy.address)).should.eq(
				toEther(2)
			);

			(await communityProxy.originalClaimAmount()).should.eq(
				originalClaimAmountDefault
			);
			(await communityProxy.claimAmount()).should.eq(toEther(2).div(4));
			await transferTreasuryFundsExcept();

			await communityProxy.connect(beneficiaryA).claim();

			const beneficiaryAData = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			beneficiaryAData.claims.should.eq(1);
			beneficiaryAData.claimedAmount.should.eq(toEther(2).div(4));

			(await cUSD.balanceOf(beneficiaryA.address)).should.eq(
				initialAmountDefault.add(toEther(2).div(4))
			);
		});

		it("should recalculate claimAmount after transfer #3", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([
					beneficiaryA.address,
					beneficiaryB.address,
					beneficiaryC.address,
					beneficiaryD.address,
				]);

			(await communityProxy.validBeneficiaryCount()).should.eq(4);

			const communityInitialBalance = await cUSD.balanceOf(
				communityProxy.address
			);

			communityAdminProxy.transferFromCommunity(
				communityProxy.address,
				cUSD.address,
				adminAccount1.address,
				communityInitialBalance.sub(toEther(10))
			);

			(await cUSD.balanceOf(communityProxy.address)).should.eq(
				toEther(10)
			);

			(await communityProxy.originalClaimAmount()).should.eq(
				originalClaimAmountDefault
			);
			(await communityProxy.claimAmount()).should.eq(
				originalClaimAmountDefault
			);

			await communityProxy.connect(beneficiaryA).claim();

			const beneficiaryAData = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			beneficiaryAData.claims.should.eq(1);
			beneficiaryAData.claimedAmount.should.eq(
				originalClaimAmountDefault
			);

			(await cUSD.balanceOf(beneficiaryA.address)).should.eq(
				initialAmountDefault.add(originalClaimAmountDefault)
			);
		});

		it("should recalculate claimAmount after requestFunds #1", async () => {
			const newBeneficiariesNumber = 20;
			const newBeneficiaries = [];

			(await communityProxy.validBeneficiaryCount()).should.eq(0);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([
					beneficiaryA.address,
					beneficiaryB.address,
					beneficiaryC.address,
					beneficiaryD.address,
				]);

			for (let i = 1; i <= newBeneficiariesNumber - 4; i++) {
				newBeneficiaries.push(ethers.Wallet.createRandom().address);
			}
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries(newBeneficiaries);

			(await communityProxy.validBeneficiaryCount()).should.eq(20);

			const communityInitialBalance = await cUSD.balanceOf(
				communityProxy.address
			);

			await communityAdminProxy
				.transferFromCommunity(
					communityProxy.address,
					cUSD.address,
					adminAccount1.address,
					communityInitialBalance
				)
				.should.emit(communityProxy, "ClaimAmountUpdated")
				.withArgs(
					originalClaimAmountDefault,
					originalClaimAmountDefault
						.mul(minClaimAmountRatioPrecision)
						.div(minClaimAmountRatioDefault)
				);

			await treasuryProxy.transfer(
				cUSD.address,
				adminAccount1.address,
				(await cUSD.balanceOf(treasuryProxy.address)).sub(toEther(100))
			);

			const treasurySafetyLimit = toEther(100)
				.mul(TREASURY_SAFETY_PERCENTAGE)
				.div(100);
			await communityProxy
				.connect(communityManagerA)
				.requestFunds()
				.should.emit(communityProxy, "ClaimAmountUpdated")
				.withArgs(
					originalClaimAmountDefault
						.mul(minClaimAmountRatioPrecision)
						.div(minClaimAmountRatioDefault),
					treasurySafetyLimit.div(20)
				);

			(await cUSD.balanceOf(communityProxy.address)).should.eq(
				treasurySafetyLimit
			);

			(await communityProxy.originalClaimAmount()).should.eq(
				originalClaimAmountDefault
			);
			(await communityProxy.claimAmount()).should.eq(
				treasurySafetyLimit.div(20)
			);

			await communityProxy.connect(beneficiaryA).claim();

			const beneficiaryAData = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			beneficiaryAData.claims.should.eq(1);
			beneficiaryAData.claimedAmount.should.eq(
				treasurySafetyLimit.div(20)
			);

			(await cUSD.balanceOf(beneficiaryA.address)).should.eq(
				initialAmountDefault.add(treasurySafetyLimit.div(20))
			);
		});

		it("should recalculate claimAmount after requestFunds #2", async () => {
			(await communityProxy.validBeneficiaryCount()).should.eq(0);
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address, beneficiaryB.address]);

			(await communityProxy.validBeneficiaryCount()).should.eq(2);

			const communityInitialBalance = await cUSD.balanceOf(
				communityProxy.address
			);

			await communityAdminProxy.transferFromCommunity(
				communityProxy.address,
				cUSD.address,
				adminAccount1.address,
				communityInitialBalance
			);

			await treasuryProxy.transfer(
				cUSD.address,
				adminAccount1.address,
				(await cUSD.balanceOf(treasuryProxy.address)).sub(toEther(100))
			);

			await communityProxy.connect(communityManagerA).requestFunds();

			(await cUSD.balanceOf(communityProxy.address)).should.eq(
				originalClaimAmountDefault.mul(2)
			);

			(await communityProxy.originalClaimAmount()).should.eq(
				originalClaimAmountDefault
			);
			(await communityProxy.claimAmount()).should.eq(
				originalClaimAmountDefault
			);

			await communityProxy.connect(beneficiaryA).claim();

			const beneficiaryAData = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			beneficiaryAData.claims.should.eq(1);
			beneficiaryAData.claimedAmount.should.eq(
				originalClaimAmountDefault
			);

			(await cUSD.balanceOf(beneficiaryA.address)).should.eq(
				initialAmountDefault.add(originalClaimAmountDefault)
			);
		});

		it("should claim less after claimAmount has been recalculated", async () => {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([
					beneficiaryA.address,
					beneficiaryB.address,
					beneficiaryC.address,
					beneficiaryD.address,
				]);

			(await communityProxy.validBeneficiaryCount()).should.eq(4);

			await communityProxy.connect(beneficiaryA).claim();

			(await cUSD.balanceOf(beneficiaryA.address)).should.eq(
				initialAmountDefault.add(originalClaimAmountDefault)
			);

			const communityInitialBalance = await cUSD.balanceOf(
				communityProxy.address
			);

			await communityAdminProxy.transferFromCommunity(
				communityProxy.address,
				cUSD.address,
				adminAccount1.address,
				communityInitialBalance.sub(toEther(2))
			);

			await transferTreasuryFundsExcept();

			(await cUSD.balanceOf(communityProxy.address)).should.eq(
				toEther(2)
			);

			const newClaimAmount = toEther(2).div(4);
			(await communityProxy.originalClaimAmount()).should.eq(
				originalClaimAmountDefault
			);
			(await communityProxy.claimAmount()).should.eq(toEther(2).div(4));

			await communityProxy.connect(beneficiaryB).claim();

			(await cUSD.balanceOf(beneficiaryB.address)).should.eq(
				initialAmountDefault.add(newClaimAmount)
			);

			const beneficiaryBData = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			beneficiaryBData.claims.should.eq(1);
			beneficiaryBData.claimedAmount.should.eq(newClaimAmount);
		});

		it("should requestFunds when claiming", async () => {
			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				communityMinTrancheDefault
			);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([
					beneficiaryA.address,
					beneficiaryB.address,
					beneficiaryC.address,
				]);

			await transferCommunityFundsExcept();

			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(originalClaimAmountDefault.mul(3));

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;
			expect(
				await communityAdminProxy.calculateCommunityTrancheAmount(
					communityProxy.address
				)
			).to.eq(0);

			expect(await communityProxy.lastFundRequest()).to.eq(
				firstBlock + 3
			);

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				originalClaimAmountDefault.mul(2)
			);

			await expect(communityProxy.connect(beneficiaryB).claim()).to.be
				.fulfilled;

			expect(await cUSD.balanceOf(communityProxy.address)).to.eq(
				originalClaimAmountDefault
			);

			expect(await communityProxy.lastFundRequest()).to.eq(
				firstBlock + 3
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

			await cUSD.mint(treasuryProxy.address, mintAmount);

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
				originalClaimAmountDefault,
				maxTotalClaimDefault,
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
			(await oldCommunityAdminProxy.communityTemplate()).should.eq(
				oldCommunityImplementation.address
			);
			(await oldCommunityAdminProxy.getVersion()).should.eq(1);

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

			(await oldCommunityProxy1.getVersion()).should.eq(1);
			(await oldCommunityProxy2.getVersion()).should.eq(1);

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
			(await oldCommunityProxy1.getVersion()).should.eq(1);
			(await oldCommunityProxy2.getVersion()).should.eq(1);
			(await communityProxy3.getVersion()).should.eq(4);
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
			await oldCommunityProxy1.connect(beneficiaryB).claim();

			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await oldCommunityProxy1.connect(beneficiaryA).claim();

			(await oldCommunityProxy1.getVersion()).should.eq(1);

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

			(await oldCommunityProxy1.getVersion()).should.eq(1);

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

			(await oldCommunityProxy1.getVersion()).should.eq(4);

			const beneficiaryAAfter = await oldCommunityProxy1.beneficiaries(
				beneficiaryA.address
			);
			beneficiaryAAfter.state.should.eq(beneficiaryABefore.state);
			beneficiaryAAfter.claims.should.eq(beneficiaryABefore.claims);
			beneficiaryAAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount
			);
			beneficiaryAAfter.lastClaim.should.eq(beneficiaryABefore.lastClaim);

			const beneficiaryBAfter = await oldCommunityProxy1.beneficiaries(
				beneficiaryB.address
			);
			beneficiaryBAfter.state.should.eq(beneficiaryBBefore.state);
			beneficiaryBAfter.claims.should.eq(beneficiaryBBefore.claims);
			beneficiaryBAfter.claimedAmount.should.eq(
				beneficiaryBBefore.claimedAmount
			);
			beneficiaryBAfter.lastClaim.should.eq(beneficiaryBBefore.lastClaim);

			await oldCommunityProxy1.connect(beneficiaryB).claim();

			(await oldCommunityProxy1.claimAmount()).should.eq(0);

			const beneficiaryBAfter2 = await oldCommunityProxy1.beneficiaries(
				beneficiaryB.address
			);

			beneficiaryBAfter2.claimedAmount.should.eq(
				originalClaimAmountDefault.mul(2)
			);
		});
	});

	describe.skip("Community - Token", () => {
		//these tests work only on a celo mainnet fork network
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();
			await multipleTokenSetUp();

			await cUSD.mint(treasuryProxy.address, mintAmount);
			await addDefaultCommunity();
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
					"0x",
					originalClaimAmountDefault,
					maxTotalClaimDefault,
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
						"0x",
						originalClaimAmountDefault,
						maxTotalClaimDefault,
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
					"0x",
					originalClaimAmountDefault,
					maxTotalClaimDefault,
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
					"0x",
					originalClaimAmountDefault,
					maxTotalClaimDefault,
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

		it("should update token", async function () {
			expect(await communityProxy.token()).equal(cUSD.address);
			expect(await communityProxy.cUSD()).equal(cUSD.address);

			expect(await communityProxy.claimAmount()).equal(
				originalClaimAmountDefault
			);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cTKN.address,
					getExchangePath(cUSD, mUSD, cTKN),
					originalClaimAmountDefault.mul(2),
					maxTotalClaimDefault.mul(3),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 5,
					incrementIntervalDefault * 6
				)
			).to.be.fulfilled;

			expect(await communityProxy.token()).equal(cTKN.address);
			expect(await communityProxy.cUSD()).equal(cTKN.address);
			expect(await communityProxy.originalClaimAmount()).equal(
				originalClaimAmountDefault.mul(2)
			);
			expect(await communityProxy.claimAmount()).equal(
				originalClaimAmountDefault.mul(2)
			);
			expect(await communityProxy.maxTotalClaim()).equal(
				maxTotalClaimDefault.mul(3)
			);
			expect(await communityProxy.getInitialMaxTotalClaim()).equal(
				maxTotalClaimDefault.mul(3)
			);
			expect(await communityProxy.getInitialMaxClaim()).equal(
				maxTotalClaimDefault.mul(3)
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

			expect(await cTKN.balanceOf(communityProxy.address)).equal(
				toEther("48.995347426603484846")
			);

			expect(await communityProxy.tokenUpdatesLength()).equal(2);

			const token1 = await communityProxy.tokenUpdates(0);
			expect(token1.tokenAddress).to.be.eq(cUSD.address);
			expect(token1.ratio).to.be.eq(toEther(1));
			expect(token1.startBlock).to.be.eq(0);

			const token2 = await communityProxy.tokenUpdates(1);
			expect(token2.tokenAddress).to.be.eq(cTKN.address);
			expect(token2.ratio).to.be.eq(toEther(3));
			expect(token2.startBlock).to.be.eq(await getBlockNumber());
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
			expect(claimedAmounts[0]).to.be.eq(originalClaimAmountDefault);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cTKN.address,
					getExchangePath(cUSD, mUSD, cTKN),
					originalClaimAmountDefault.mul(2),
					maxTotalClaimDefault.mul(3),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 2,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(await communityProxy.token()).equal(cTKN.address);
			expect(await communityProxy.cUSD()).equal(cTKN.address);
			expect(await communityProxy.originalClaimAmount()).equal(
				originalClaimAmountDefault.mul(2)
			);
			expect(await communityProxy.claimAmount()).equal(
				originalClaimAmountDefault.mul(2)
			);
			expect(await communityProxy.maxTotalClaim()).equal(
				maxTotalClaimDefault.mul(3).sub(decreaseStepDefault.mul(4))
			);
			expect(await communityProxy.getInitialMaxTotalClaim()).equal(
				maxTotalClaimDefault.mul(3)
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

			expect(await cTKN.balanceOf(communityProxy.address)).equal(
				toEther("48.010731023622827241")
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

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault.add(initialAmountDefault)
			);
			expect(await cTKN.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault.mul(2)
			);

			let tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(2);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(cTKN.address);
			let claimedAmounts2 =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts2.length).to.be.eq(2);
			expect(claimedAmounts2[0]).to.be.eq(originalClaimAmountDefault);
			expect(claimedAmounts2[1]).to.be.eq(
				originalClaimAmountDefault.mul(2)
			);

			let beneficiary = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiary.claimedAmount).to.eq(
				originalClaimAmountDefault
					.mul(3)
					.add(originalClaimAmountDefault.mul(2))
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

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault.add(initialAmountDefault)
			);
			expect(await cTKN.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault.mul(2).mul(2)
			);

			tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(2);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(cTKN.address);
			claimedAmounts2 = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryA.address
			);
			expect(claimedAmounts2.length).to.be.eq(2);
			expect(claimedAmounts2[0]).to.be.eq(originalClaimAmountDefault);
			expect(claimedAmounts2[1]).to.be.eq(
				originalClaimAmountDefault.mul(2).mul(2)
			);

			beneficiary = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiary.claimedAmount).to.eq(
				originalClaimAmountDefault
					.mul(3)
					.add(originalClaimAmountDefault.mul(2))
					.add(originalClaimAmountDefault.mul(2))
			);
		});

		it("should beneficiary claim after multiple token updates #1", async function () {
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
			expect(claimedAmounts[0]).to.be.eq(originalClaimAmountDefault);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cTKN.address,
					getExchangePath(cUSD, mUSD, cTKN),
					originalClaimAmountDefault.mul(2),
					maxTotalClaimDefault.mul(3),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 2,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(await communityProxy.token()).equal(cTKN.address);
			expect(await communityProxy.cUSD()).equal(cTKN.address);
			expect(await communityProxy.originalClaimAmount()).equal(
				originalClaimAmountDefault.mul(2)
			);
			expect(await communityProxy.claimAmount()).equal(
				originalClaimAmountDefault.mul(2)
			);
			expect(await communityProxy.maxTotalClaim()).equal(
				maxTotalClaimDefault.mul(3).sub(decreaseStepDefault.mul(4))
			);
			expect(await communityProxy.getInitialMaxTotalClaim()).equal(
				maxTotalClaimDefault.mul(3)
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

			expect(await cTKN.balanceOf(communityProxy.address)).equal(
				toEther("48.010731023622827241")
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

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault.add(initialAmountDefault)
			);
			expect(await cTKN.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault.mul(2)
			);

			let tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(2);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(cTKN.address);
			let claimedAmounts2 =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts2.length).to.be.eq(2);
			expect(claimedAmounts2[0]).to.be.eq(originalClaimAmountDefault);
			expect(claimedAmounts2[1]).to.be.eq(
				originalClaimAmountDefault.mul(2)
			);

			let beneficiary = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiary.claimedAmount).to.eq(
				originalClaimAmountDefault
					.mul(3)
					.add(originalClaimAmountDefault.mul(2))
			);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					mUSD.address,
					getExchangePath(cTKN, mUSD),
					originalClaimAmountDefault,
					maxTotalClaimDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(await communityProxy.token()).equal(mUSD.address);
			expect(await communityProxy.cUSD()).equal(mUSD.address);
			expect(await communityProxy.originalClaimAmount()).equal(
				originalClaimAmountDefault
			);
			expect(await communityProxy.claimAmount()).equal(
				originalClaimAmountDefault
			);
			expect(await communityProxy.maxTotalClaim()).equal(
				maxTotalClaimDefault.sub(decreaseStepDefault)
			);
			expect(await communityProxy.getInitialMaxTotalClaim()).equal(
				maxTotalClaimDefault
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

			expect(await cTKN.balanceOf(communityProxy.address)).equal(
				toEther(0)
			);
			expect(await mUSD.balanceOf(communityProxy.address)).equal(
				toEther("87.150389574449433006")
			);

			//third claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault.add(initialAmountDefault)
			);
			expect(await cTKN.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault.mul(2)
			);
			expect(await mUSD.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault
			);

			tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(3);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(cTKN.address);
			expect(tokenList2[2]).to.be.eq(mUSD.address);
			claimedAmounts2 = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryA.address
			);
			expect(claimedAmounts2.length).to.be.eq(3);
			expect(claimedAmounts2[0]).to.be.eq(originalClaimAmountDefault);
			expect(claimedAmounts2[1]).to.be.eq(
				originalClaimAmountDefault.mul(2)
			);
			expect(claimedAmounts2[2]).to.be.eq(originalClaimAmountDefault);

			beneficiary = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiary.claimedAmount.div(10)).to.eq(
				//div(10) to skip the last decimal
				originalClaimAmountDefault
					.mul(3)
					.add(originalClaimAmountDefault.mul(2))
					.div(3)
					.add(originalClaimAmountDefault)
					.div(10) //div(10) to skip the last decimal
			);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cUSD.address,
					getExchangePath(mUSD, cUSD),
					originalClaimAmountDefault.div(2),
					maxTotalClaimDefault.div(2),
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(await communityProxy.token()).equal(cUSD.address);
			expect(await communityProxy.cUSD()).equal(cUSD.address);
			expect(await communityProxy.originalClaimAmount()).equal(
				originalClaimAmountDefault.div(2)
			);
			expect(await communityProxy.claimAmount()).equal(
				originalClaimAmountDefault.div(2)
			);
			expect(await communityProxy.maxTotalClaim()).equal(
				maxTotalClaimDefault.div(2).sub(decreaseStepDefault)
			);
			expect(await communityProxy.getInitialMaxTotalClaim()).equal(
				maxTotalClaimDefault.div(2)
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
				toEther("84.308134387456269831")
			);

			//forth claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault * 3
			);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault
					.add(initialAmountDefault)
					.add(originalClaimAmountDefault.div(2))
			);
			expect(await cTKN.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault.mul(2)
			);
			expect(await mUSD.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault
			);

			tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(3);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(cTKN.address);
			expect(tokenList2[2]).to.be.eq(mUSD.address);
			claimedAmounts2 = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryA.address
			);
			expect(claimedAmounts2.length).to.be.eq(3);
			expect(claimedAmounts2[0]).to.be.eq(
				originalClaimAmountDefault.add(
					originalClaimAmountDefault.div(2)
				)
			);
			expect(claimedAmounts2[1]).to.be.eq(
				originalClaimAmountDefault.mul(2)
			);
			expect(claimedAmounts2[2]).to.be.eq(originalClaimAmountDefault);

			beneficiary = await communityProxy.beneficiaries(
				beneficiaryA.address
			);

			expect(beneficiary.claimedAmount.div(10)).to.eq(
				//div(10) to skip the last decimal
				originalClaimAmountDefault
					.mul(3)
					.add(originalClaimAmountDefault.mul(2))
					.div(3)
					.add(originalClaimAmountDefault)
					.div(2)
					.add(originalClaimAmountDefault.div(2))
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
			expect(claimedAmounts[0]).to.be.eq(originalClaimAmountDefault);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cTKN.address,
					getExchangePath(cUSD, mUSD, cTKN),
					originalClaimAmountDefault.mul(2),
					maxTotalClaimDefault.mul(4),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 2,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(originalClaimAmountDefault.mul(4));

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					mUSD.address,
					getExchangePath(cTKN, mUSD),
					originalClaimAmountDefault,
					maxTotalClaimDefault,
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(originalClaimAmountDefault);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cUSD.address,
					getExchangePath(mUSD, cUSD),
					originalClaimAmountDefault.div(2),
					maxTotalClaimDefault.div(2),
					decreaseStepDefault,
					baseIntervalDefault,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(originalClaimAmountDefault.div(2));

			expect(await communityProxy.token()).equal(cUSD.address);
			expect(await communityProxy.cUSD()).equal(cUSD.address);
			expect(await communityProxy.originalClaimAmount()).equal(
				originalClaimAmountDefault.div(2)
			);
			expect(await communityProxy.claimAmount()).equal(
				originalClaimAmountDefault.div(2)
			);
			expect(await communityProxy.maxTotalClaim()).equal(
				maxTotalClaimDefault.div(2).sub(decreaseStepDefault)
			);
			expect(await communityProxy.getInitialMaxTotalClaim()).equal(
				maxTotalClaimDefault.div(2)
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
				toEther("94.129164583102415754")
			);

			//forth claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.eq(
				originalClaimAmountDefault
					.add(initialAmountDefault)
					.add(originalClaimAmountDefault.div(2))
			);
			expect(await cTKN.balanceOf(beneficiaryA.address)).to.eq(0);
			expect(await mUSD.balanceOf(beneficiaryA.address)).to.eq(0);

			let tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(3);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(cTKN.address);
			expect(tokenList2[2]).to.be.eq(mUSD.address);
			let claimedAmounts2 =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts2.length).to.be.eq(3);
			expect(claimedAmounts2[0]).to.be.eq(
				originalClaimAmountDefault.add(
					originalClaimAmountDefault.div(2)
				)
			);
			expect(claimedAmounts2[1]).to.be.eq(0);
			expect(claimedAmounts2[2]).to.be.eq(0);

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(
				originalClaimAmountDefault
					.div(2)
					.add(originalClaimAmountDefault.div(2))
			);
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
					cTKN.address,
					getExchangePath(cUSD, mUSD, cTKN),
					originalClaimAmountDefault.mul(2),
					maxTotalClaimDefault.mul(4),
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
					getExchangePath(cTKN, mUSD),
					originalClaimAmountDefault,
					maxTotalClaimDefault,
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
					getExchangePath(mUSD, cUSD),
					originalClaimAmountDefault.div(2),
					maxTotalClaimDefault.div(2),
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
				toEther("96.059977547223219131")
			);

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			await expect(communityProxy.connect(beneficiaryA).claim()).to.be
				.fulfilled;

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.eq(
				initialAmountDefault.add(originalClaimAmountDefault.div(2))
			);
			expect(await cTKN.balanceOf(beneficiaryA.address)).to.eq(0);
			expect(await mUSD.balanceOf(beneficiaryA.address)).to.eq(0);

			let tokenList2 = await communityProxy.tokenList();
			expect(tokenList2.length).to.be.eq(3);
			expect(tokenList2[0]).to.be.eq(cUSD.address);
			expect(tokenList2[1]).to.be.eq(cTKN.address);
			expect(tokenList2[2]).to.be.eq(mUSD.address);
			let claimedAmounts2 =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts2.length).to.be.eq(3);
			expect(claimedAmounts2[0]).to.be.eq(
				originalClaimAmountDefault.div(2)
			);
			expect(claimedAmounts2[1]).to.be.eq(0);
			expect(claimedAmounts2[2]).to.be.eq(0);

			expect(
				(await communityProxy.beneficiaries(beneficiaryA.address))
					.claimedAmount
			).to.eq(originalClaimAmountDefault.div(2));
		});

		it("should changeBeneficiaryAddress after multiple token updates #new target beneficiary", async function () {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			//first claim
			await expect(communityProxy.connect(beneficiaryA).claim());

			const claimedAmounts =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts[0]).to.be.eq(originalClaimAmountDefault);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cTKN.address,
					getExchangePath(cUSD, mUSD, cTKN),
					originalClaimAmountDefault.mul(2),
					maxTotalClaimDefault.mul(3),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 2,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(await communityProxy.claimAmount()).equal(
				originalClaimAmountDefault.mul(2)
			);

			//second claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault * 2 + incrementIntervalDefault * 2
			);

			await expect(communityProxy.connect(beneficiaryA).claim());

			let claimedAmounts2 =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts2[0]).to.be.eq(originalClaimAmountDefault);
			expect(claimedAmounts2[1]).to.be.eq(
				originalClaimAmountDefault.mul(2)
			);

			let beneficiaryADetails = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiaryADetails.claimedAmount).to.eq(
				originalClaimAmountDefault
					.mul(3)
					.add(originalClaimAmountDefault.mul(2))
			);

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				mUSD.address,
				getExchangePath(cTKN, mUSD),
				originalClaimAmountDefault,
				maxTotalClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			//third claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await communityProxy.connect(beneficiaryA).claim();

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				originalClaimAmountDefault.add(initialAmountDefault)
			);
			expect(await cTKN.balanceOf(beneficiaryA.address)).to.be.equal(
				originalClaimAmountDefault.mul(2)
			);
			expect(await mUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				originalClaimAmountDefault
			);

			claimedAmounts2 = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryA.address
			);
			expect(claimedAmounts2[0]).to.be.eq(originalClaimAmountDefault);
			expect(claimedAmounts2[1]).to.be.eq(
				originalClaimAmountDefault.mul(2)
			);
			expect(claimedAmounts2[2]).to.be.eq(originalClaimAmountDefault);

			beneficiaryADetails = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiaryADetails.claimedAmount.div(10)).to.eq(
				//div(10) to skip the last decimal
				originalClaimAmountDefault
					.mul(3)
					.add(originalClaimAmountDefault.mul(2))
					.div(3)
					.add(originalClaimAmountDefault)
					.div(10) //div(10) to skip the last decimal
			);

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				cUSD.address,
				getExchangePath(mUSD, cUSD),
				originalClaimAmountDefault.div(2),
				maxTotalClaimDefault.div(2),
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			//forth claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault * 3
			);

			await communityProxy.connect(beneficiaryA).claim();

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				originalClaimAmountDefault
					.add(initialAmountDefault)
					.add(originalClaimAmountDefault.div(2))
			);
			expect(await cTKN.balanceOf(beneficiaryA.address)).to.be.equal(
				originalClaimAmountDefault.mul(2)
			);
			expect(await mUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				originalClaimAmountDefault
			);

			claimedAmounts2 = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryA.address
			);

			expect(claimedAmounts2[0]).to.be.eq(
				originalClaimAmountDefault.add(
					originalClaimAmountDefault.div(2)
				)
			);
			expect(claimedAmounts2[1]).to.be.eq(
				originalClaimAmountDefault.mul(2)
			);
			expect(claimedAmounts2[2]).to.be.eq(originalClaimAmountDefault);

			beneficiaryADetails = await communityProxy.beneficiaries(
				beneficiaryA.address
			);

			expect(beneficiaryADetails.claimedAmount.div(10)).to.eq(
				//div(10) to skip the last decimal
				originalClaimAmountDefault
					.mul(3)
					.add(originalClaimAmountDefault.mul(2))
					.div(3)
					.add(originalClaimAmountDefault)
					.div(2)
					.add(originalClaimAmountDefault.div(2))
					.div(10) //div(10) to skip the last decimal
			);

			const beneficiaryABefore = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBBefore = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmountsBefore =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmountsBefore =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				)
				.should.emit(communityProxy, "BeneficiaryAddressChanged")
				.withArgs(beneficiaryA.address, beneficiaryB.address);

			const beneficiaryAAfter = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBAfter = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmountsAfter =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmountsAfter =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			beneficiaryBAfter.state.should.eq(beneficiaryABefore.state);
			beneficiaryBAfter.claims.should.eq(
				beneficiaryABefore.claims.toNumber()
			);
			beneficiaryBAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount
			);
			beneficiaryBAfter.lastClaim.should.eq(beneficiaryABefore.lastClaim);
			beneficiaryBClaimedAmountsAfter[0].should.eq(
				beneficiaryAClaimedAmountsBefore[0]
			);
			beneficiaryBClaimedAmountsAfter[1].should.eq(
				beneficiaryAClaimedAmountsBefore[1]
			);
			beneficiaryBClaimedAmountsAfter[2].should.eq(
				beneficiaryAClaimedAmountsBefore[2]
			);

			beneficiaryAAfter.state.should.eq(BeneficiaryState.AddressChanged);
			beneficiaryAAfter.claims.should.eq(beneficiaryABefore.claims);
			beneficiaryAAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount
			);
			beneficiaryAAfter.lastClaim.should.eq(beneficiaryABefore.lastClaim);
			beneficiaryAClaimedAmountsAfter[0].should.eq(
				beneficiaryAClaimedAmountsBefore[0]
			);
			beneficiaryAClaimedAmountsAfter[1].should.eq(
				beneficiaryAClaimedAmountsBefore[1]
			);
			beneficiaryAClaimedAmountsAfter[2].should.eq(
				beneficiaryAClaimedAmountsBefore[2]
			);
		});

		it("should changeBeneficiaryAddress after multiple token updates #old target beneficiary #1", async function () {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address, beneficiaryB.address]);

			//first claim
			await expect(communityProxy.connect(beneficiaryA).claim());
			await expect(communityProxy.connect(beneficiaryB).claim());

			const claimedAmounts =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts[0]).to.be.eq(originalClaimAmountDefault);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cTKN.address,
					getExchangePath(cUSD, mUSD, cTKN),
					originalClaimAmountDefault.mul(2),
					maxTotalClaimDefault.mul(3),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 2,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(await communityProxy.claimAmount()).equal(
				originalClaimAmountDefault.mul(2)
			);

			//second claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault * 2 + incrementIntervalDefault * 2
			);

			await expect(communityProxy.connect(beneficiaryA).claim());
			await expect(communityProxy.connect(beneficiaryB).claim());

			let claimedAmounts2 =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmounts2[0]).to.be.eq(originalClaimAmountDefault);
			expect(claimedAmounts2[1]).to.be.eq(
				originalClaimAmountDefault.mul(2)
			);

			let beneficiaryADetails = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiaryADetails.claimedAmount).to.eq(
				originalClaimAmountDefault
					.mul(3)
					.add(originalClaimAmountDefault.mul(2))
			);

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				mUSD.address,
				getExchangePath(cTKN, mUSD),
				originalClaimAmountDefault,
				maxTotalClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			//third claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await communityProxy.connect(beneficiaryA).claim();
			await communityProxy.connect(beneficiaryB).claim();

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				originalClaimAmountDefault.add(initialAmountDefault)
			);
			expect(await cTKN.balanceOf(beneficiaryA.address)).to.be.equal(
				originalClaimAmountDefault.mul(2)
			);
			expect(await mUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				originalClaimAmountDefault
			);

			claimedAmounts2 = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryA.address
			);
			expect(claimedAmounts2[0]).to.be.eq(originalClaimAmountDefault);
			expect(claimedAmounts2[1]).to.be.eq(
				originalClaimAmountDefault.mul(2)
			);
			expect(claimedAmounts2[2]).to.be.eq(originalClaimAmountDefault);

			beneficiaryADetails = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			expect(beneficiaryADetails.claimedAmount.div(10)).to.eq(
				//div(10) to skip the last decimal
				originalClaimAmountDefault
					.mul(3)
					.add(originalClaimAmountDefault.mul(2))
					.div(3)
					.add(originalClaimAmountDefault)
					.div(10) //div(10) to skip the last decimal
			);

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				cUSD.address,
				getExchangePath(mUSD, cUSD),
				originalClaimAmountDefault.div(2),
				maxTotalClaimDefault.div(2),
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			//forth claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault * 3
			);

			await communityProxy.connect(beneficiaryA).claim();
			await communityProxy.connect(beneficiaryB).claim();

			expect(await cUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				originalClaimAmountDefault
					.add(initialAmountDefault)
					.add(originalClaimAmountDefault.div(2))
			);
			expect(await cTKN.balanceOf(beneficiaryA.address)).to.be.equal(
				originalClaimAmountDefault.mul(2)
			);
			expect(await mUSD.balanceOf(beneficiaryA.address)).to.be.equal(
				originalClaimAmountDefault
			);

			claimedAmounts2 = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryA.address
			);

			expect(claimedAmounts2[0]).to.be.eq(
				originalClaimAmountDefault.add(
					originalClaimAmountDefault.div(2)
				)
			);
			expect(claimedAmounts2[1]).to.be.eq(
				originalClaimAmountDefault.mul(2)
			);
			expect(claimedAmounts2[2]).to.be.eq(originalClaimAmountDefault);

			beneficiaryADetails = await communityProxy.beneficiaries(
				beneficiaryA.address
			);

			expect(beneficiaryADetails.claimedAmount.div(10)).to.eq(
				//div(10) to skip the last decimal
				originalClaimAmountDefault
					.mul(3)
					.add(originalClaimAmountDefault.mul(2))
					.div(3)
					.add(originalClaimAmountDefault)
					.div(2)
					.add(originalClaimAmountDefault.div(2))
					.div(10) //div(10) to skip the last decimal
			);

			const beneficiaryABefore = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBBefore = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmountsBefore =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmountsBefore =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				)
				.should.emit(communityProxy, "BeneficiaryAddressChanged")
				.withArgs(beneficiaryA.address, beneficiaryB.address);

			const beneficiaryAAfter = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBAfter = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmountsAfter =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmountsAfter =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			beneficiaryBAfter.state.should.eq(beneficiaryBBefore.state);
			beneficiaryBAfter.claims.should.eq(
				beneficiaryABefore.claims.toNumber() +
					beneficiaryBBefore.claims.toNumber()
			);
			beneficiaryBAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount.add(
					beneficiaryBBefore.claimedAmount
				)
			);
			beneficiaryBAfter.lastClaim.should.eq(beneficiaryBBefore.lastClaim);
			beneficiaryBClaimedAmountsAfter[0].should.eq(
				beneficiaryAClaimedAmountsBefore[0].add(
					beneficiaryBClaimedAmountsBefore[0]
				)
			);
			beneficiaryBClaimedAmountsAfter[1].should.eq(
				beneficiaryAClaimedAmountsBefore[1].add(
					beneficiaryBClaimedAmountsBefore[1]
				)
			);
			beneficiaryBClaimedAmountsAfter[2].should.eq(
				beneficiaryAClaimedAmountsBefore[2].add(
					beneficiaryBClaimedAmountsBefore[2]
				)
			);

			beneficiaryAAfter.state.should.eq(BeneficiaryState.AddressChanged);
			beneficiaryAAfter.claims.should.eq(beneficiaryABefore.claims);
			beneficiaryAAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount
			);
			beneficiaryAAfter.lastClaim.should.eq(beneficiaryABefore.lastClaim);
			beneficiaryAClaimedAmountsAfter[0].should.eq(
				beneficiaryAClaimedAmountsBefore[0]
			);
			beneficiaryAClaimedAmountsAfter[1].should.eq(
				beneficiaryAClaimedAmountsBefore[1]
			);
			beneficiaryAClaimedAmountsAfter[2].should.eq(
				beneficiaryAClaimedAmountsBefore[2]
			);
		});

		it("should changeBeneficiaryAddress after multiple token updates #old target beneficiary #2", async function () {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address, beneficiaryB.address]);

			//first claim
			await expect(communityProxy.connect(beneficiaryA).claim());

			let claimedAmountsA =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmountsA[0]).to.be.eq(originalClaimAmountDefault);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cTKN.address,
					getExchangePath(cUSD, mUSD, cTKN),
					originalClaimAmountDefault.mul(2),
					maxTotalClaimDefault.mul(3),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 2,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(await communityProxy.claimAmount()).equal(
				originalClaimAmountDefault.mul(2)
			);

			//second claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault * 2 + incrementIntervalDefault * 2
			);

			await expect(communityProxy.connect(beneficiaryB).claim());

			let claimedAmountsB =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);
			expect(claimedAmountsB[0]).to.be.eq(0);
			expect(claimedAmountsB[1]).to.be.eq(
				originalClaimAmountDefault.mul(2)
			);

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				mUSD.address,
				getExchangePath(cTKN, mUSD),
				originalClaimAmountDefault,
				maxTotalClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			//third claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await communityProxy.connect(beneficiaryA).claim();

			claimedAmountsA = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryA.address
			);
			expect(claimedAmountsA[0]).to.be.eq(originalClaimAmountDefault);
			expect(claimedAmountsA[1]).to.be.eq(0);
			expect(claimedAmountsA[2]).to.be.eq(originalClaimAmountDefault);

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				cUSD.address,
				getExchangePath(mUSD, cUSD),
				originalClaimAmountDefault.div(2),
				maxTotalClaimDefault.div(2),
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			//forth claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault * 3
			);

			await communityProxy.connect(beneficiaryA).claim();

			claimedAmountsA = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryA.address
			);

			expect(claimedAmountsA[0]).to.be.eq(
				originalClaimAmountDefault.add(
					originalClaimAmountDefault.div(2)
				)
			);
			expect(claimedAmountsA[1]).to.be.eq(0);
			expect(claimedAmountsA[2]).to.be.eq(originalClaimAmountDefault);

			const beneficiaryABefore = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBBefore = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmountsBefore =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmountsBefore =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				)
				.should.emit(communityProxy, "BeneficiaryAddressChanged")
				.withArgs(beneficiaryA.address, beneficiaryB.address);

			const beneficiaryAAfter = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBAfter = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmountsAfter =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmountsAfter =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			beneficiaryBAfter.state.should.eq(beneficiaryBBefore.state);
			beneficiaryBAfter.claims.should.eq(
				beneficiaryABefore.claims.toNumber() +
					beneficiaryBBefore.claims.toNumber()
			);
			beneficiaryBAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount.add(
					beneficiaryBBefore.claimedAmount
				)
			);

			beneficiaryBAfter.lastClaim.should.eq(beneficiaryABefore.lastClaim);
			beneficiaryBClaimedAmountsAfter[0].should.eq(
				beneficiaryAClaimedAmountsBefore[0].add(
					beneficiaryBClaimedAmountsBefore[0]
				)
			);
			beneficiaryBClaimedAmountsAfter[1].should.eq(
				beneficiaryAClaimedAmountsBefore[1].add(
					beneficiaryBClaimedAmountsBefore[1]
				)
			);
			beneficiaryBClaimedAmountsAfter[2].should.eq(
				beneficiaryAClaimedAmountsBefore[2].add(
					beneficiaryBClaimedAmountsBefore[2]
				)
			);

			beneficiaryAAfter.state.should.eq(BeneficiaryState.AddressChanged);
			beneficiaryAAfter.claims.should.eq(beneficiaryABefore.claims);
			beneficiaryAAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount
			);
			beneficiaryAAfter.lastClaim.should.eq(beneficiaryABefore.lastClaim);
			beneficiaryAClaimedAmountsAfter[0].should.eq(
				beneficiaryAClaimedAmountsBefore[0]
			);
			beneficiaryAClaimedAmountsAfter[1].should.eq(
				beneficiaryAClaimedAmountsBefore[1]
			);
			beneficiaryAClaimedAmountsAfter[2].should.eq(
				beneficiaryAClaimedAmountsBefore[2]
			);
		});

		it("should changeBeneficiaryAddress after multiple token updates #old target beneficiary #3", async function () {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address, beneficiaryB.address]);

			//first claim
			await expect(communityProxy.connect(beneficiaryB).claim());

			let claimedAmountsB =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);
			expect(claimedAmountsB[0]).to.be.eq(originalClaimAmountDefault);

			await expect(
				communityAdminProxy.updateCommunityToken(
					communityProxy.address,
					cTKN.address,
					getExchangePath(cUSD, mUSD, cTKN),
					originalClaimAmountDefault.mul(2),
					maxTotalClaimDefault.mul(3),
					decreaseStepDefault.mul(4),
					baseIntervalDefault * 2,
					incrementIntervalDefault
				)
			).to.be.fulfilled;

			expect(await communityProxy.claimAmount()).equal(
				originalClaimAmountDefault.mul(2)
			);

			//second claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault * 2 + incrementIntervalDefault * 2
			);

			await expect(communityProxy.connect(beneficiaryA).claim());

			let claimedAmountsA =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			expect(claimedAmountsA[0]).to.be.eq(0);
			expect(claimedAmountsA[1]).to.be.eq(
				originalClaimAmountDefault.mul(2)
			);

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				mUSD.address,
				getExchangePath(cTKN, mUSD),
				originalClaimAmountDefault,
				maxTotalClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			//third claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await communityProxy.connect(beneficiaryB).claim();

			claimedAmountsB = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryB.address
			);
			expect(claimedAmountsB[0]).to.be.eq(originalClaimAmountDefault);
			expect(claimedAmountsB[1]).to.be.eq(0);
			expect(claimedAmountsB[2]).to.be.eq(originalClaimAmountDefault);

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				cUSD.address,
				getExchangePath(mUSD, cUSD),
				originalClaimAmountDefault.div(2),
				maxTotalClaimDefault.div(2),
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			//forth claim - after token update
			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault * 3
			);

			await communityProxy.connect(beneficiaryB).claim();

			claimedAmountsB = await communityProxy.beneficiaryClaimedAmounts(
				beneficiaryB.address
			);

			expect(claimedAmountsB[0]).to.be.eq(
				originalClaimAmountDefault.add(
					originalClaimAmountDefault.div(2)
				)
			);
			expect(claimedAmountsB[1]).to.be.eq(0);
			expect(claimedAmountsB[2]).to.be.eq(originalClaimAmountDefault);

			const beneficiaryABefore = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBBefore = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmountsBefore =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmountsBefore =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			await communityProxy
				.connect(communityManagerA)
				.changeBeneficiaryAddressByManager(
					beneficiaryA.address,
					beneficiaryB.address
				)
				.should.emit(communityProxy, "BeneficiaryAddressChanged")
				.withArgs(beneficiaryA.address, beneficiaryB.address);

			const beneficiaryAAfter = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryBAfter = await communityProxy.beneficiaries(
				beneficiaryB.address
			);
			const beneficiaryAClaimedAmountsAfter =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryBClaimedAmountsAfter =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryB.address
				);

			beneficiaryBAfter.state.should.eq(beneficiaryBBefore.state);
			beneficiaryBAfter.claims.should.eq(
				beneficiaryABefore.claims.toNumber() +
					beneficiaryBBefore.claims.toNumber()
			);
			beneficiaryBAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount.add(
					beneficiaryBBefore.claimedAmount
				)
			);

			beneficiaryBAfter.lastClaim.should.eq(beneficiaryBBefore.lastClaim);
			beneficiaryBClaimedAmountsAfter[0].should.eq(
				beneficiaryAClaimedAmountsBefore[0].add(
					beneficiaryBClaimedAmountsBefore[0]
				)
			);
			beneficiaryBClaimedAmountsAfter[1].should.eq(
				beneficiaryAClaimedAmountsBefore[1].add(
					beneficiaryBClaimedAmountsBefore[1]
				)
			);
			beneficiaryBClaimedAmountsAfter[2].should.eq(
				beneficiaryAClaimedAmountsBefore[2].add(
					beneficiaryBClaimedAmountsBefore[2]
				)
			);

			beneficiaryAAfter.state.should.eq(BeneficiaryState.AddressChanged);
			beneficiaryAAfter.claims.should.eq(beneficiaryABefore.claims);
			beneficiaryAAfter.claimedAmount.should.eq(
				beneficiaryABefore.claimedAmount
			);
			beneficiaryAAfter.lastClaim.should.eq(beneficiaryABefore.lastClaim);
			beneficiaryAClaimedAmountsAfter[0].should.eq(
				beneficiaryAClaimedAmountsBefore[0]
			);
			beneficiaryAClaimedAmountsAfter[1].should.eq(
				beneficiaryAClaimedAmountsBefore[1]
			);
			beneficiaryAClaimedAmountsAfter[2].should.eq(
				beneficiaryAClaimedAmountsBefore[2]
			);
		});
	});

	describe.skip("Community & CommunityAdmin - splitCommunity", () => {
		//these tests work only on a celo mainnet fork network
		before(async function () {
			await init();
		});

		beforeEach(async () => {
			await deploy();

			await multipleTokenSetUp();

			await cUSD.mint(treasuryProxy.address, mintAmount);

			await addDefaultCommunity();

			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([
					beneficiaryA.address,
					beneficiaryB.address,
					beneficiaryC.address,
				]);
		});

		it("should not addCopy if not owner", async function () {
			await communityProxy
				.connect(beneficiaryA)
				.addCopy(FAKE_ADDRESS)
				.should.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("should not copyCommunityDetails if not owner", async function () {
			await communityProxy
				.connect(beneficiaryA)
				.copyCommunityDetails(communityProxy.address)
				.should.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("should not splitCommunity if not owner", async function () {
			await communityAdminProxy
				.connect(beneficiaryA)
				.splitCommunity(
					communityProxy.address,
					2,
					ambassadorA.address,
					[]
				)
				.should.be.rejectedWith(
					"CommunityAdmin: Not Owner Or ImpactMarketCouncil"
				);
		});

		it("should not setBeneficiaryState if not communityCopy", async function () {
			await communityProxy
				.connect(communityManagerA)
				.setBeneficiaryState(
					beneficiaryA.address,
					BeneficiaryState.Locked
				)
				.should.be.rejectedWith("Community: Invalid community copy");
		});

		it("should splitCommunity", async function () {
			const nonce = await ethers.provider.getTransactionCount(
				communityAdminProxy.address
			);

			const anticipatedAddress = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			await communityAdminProxy
				.connect(deployer)
				.splitCommunity(
					communityProxy.address,
					1,
					ambassadorA.address,
					[communityManagerB.address]
				)
				.should.emit(communityAdminProxy, "CommunityCopied")
				.withArgs(communityProxy.address, anticipatedAddress);

			const communityCopy1 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress
			);

			(await communityCopy1.copyOf()).should.eq(communityProxy.address);
			(await communityProxy.copies())[0].should.eq(
				communityCopy1.address
			);

			(await communityProxy.copyOf()).should.eq(
				ethers.constants.AddressZero
			);
			(await communityCopy1.copies()).length.should.eq(0);

			(await communityCopy1.previousCommunity()).should.eq(
				ethers.constants.AddressZero
			);
			(await communityCopy1.originalClaimAmount()).should.eq(
				await communityProxy.originalClaimAmount()
			);
			(await communityCopy1.claimAmount()).should.eq(
				await communityProxy.claimAmount()
			);
			(await communityCopy1.baseInterval()).should.eq(
				await communityProxy.baseInterval()
			);
			(await communityCopy1.incrementInterval()).should.eq(
				await communityProxy.incrementInterval()
			);
			(await communityCopy1.minTranche()).should.eq(
				await communityProxy.minTranche()
			);
			(await communityCopy1.maxTranche()).should.eq(
				await communityProxy.maxTranche()
			);
			(await communityCopy1.maxTotalClaim()).should.not.eq(
				await communityProxy.maxTotalClaim()
			);
			(await communityCopy1.maxTotalClaim()).should.eq(
				maxTotalClaimDefault
			);
			(await communityCopy1.maxClaim()).should.eq(maxTotalClaimDefault);
			(await communityCopy1.decreaseStep()).should.eq(
				await communityProxy.decreaseStep()
			);
			(await communityCopy1.maxBeneficiaries()).should.eq(
				await communityProxy.maxBeneficiaries()
			);
			(await communityCopy1.validBeneficiaryCount()).should.eq(0);
			(await communityCopy1.treasuryFunds()).should.eq(0);
			(await communityCopy1.privateFunds()).should.eq(0);
			(await communityCopy1.communityAdmin()).should.eq(
				await communityProxy.communityAdmin()
			);
			(await communityCopy1.cUSD()).should.eq(cUSD.address);
			(await communityCopy1.token()).should.eq(
				await communityProxy.token()
			);
			(await communityCopy1.locked()).should.eq(
				await communityProxy.locked()
			);
			(await communityCopy1.lastFundRequest()).should.eq(0);
			(await communityCopy1.beneficiaryListLength()).should.eq(0);
			(await communityCopy1.tokenList())[0].should.eq(
				(await communityProxy.tokenList())[0]
			);
			(await communityCopy1.beneficiaryListLength()).should.eq(0);
			(await communityCopy1.getVersion()).should.eq(4);

			(
				await ambassadorsProxy.isAmbassadorOf(
					ambassadorA.address,
					communityProxy.address
				)
			).should.eq(true);
			(
				await ambassadorsProxy.isAmbassadorOf(
					ambassadorA.address,
					communityCopy1.address
				)
			).should.eq(true);

			(
				await communityAdminProxy.communities(communityProxy.address)
			).should.eq(CommunityState.Valid);
			(
				await communityAdminProxy.communities(communityCopy1.address)
			).should.eq(CommunityState.Valid);
		});

		it("should splitCommunity in multiples communities", async function () {
			let nonce = await ethers.provider.getTransactionCount(
				communityAdminProxy.address
			);

			const anticipatedAddress1 = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			nonce++;

			const anticipatedAddress2 = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			await communityAdminProxy
				.connect(deployer)
				.splitCommunity(
					communityProxy.address,
					2,
					ambassadorA.address,
					[communityManagerB.address]
				)
				.should.emit(communityAdminProxy, "CommunityCopied")
				.withArgs(communityProxy.address, anticipatedAddress1)
				.withArgs(communityProxy.address, anticipatedAddress2);

			const communityCopy1 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress1
			);

			(await communityCopy1.copyOf()).should.eq(communityProxy.address);
			(await communityProxy.copies())[0].should.eq(
				communityCopy1.address
			);

			(await communityProxy.copyOf()).should.eq(
				ethers.constants.AddressZero
			);
			(await communityCopy1.copies()).length.should.eq(0);

			(await communityCopy1.previousCommunity()).should.eq(
				ethers.constants.AddressZero
			);
			(await communityCopy1.originalClaimAmount()).should.eq(
				await communityProxy.originalClaimAmount()
			);
			(await communityCopy1.claimAmount()).should.eq(
				await communityProxy.claimAmount()
			);
			(await communityCopy1.baseInterval()).should.eq(
				await communityProxy.baseInterval()
			);
			(await communityCopy1.incrementInterval()).should.eq(
				await communityProxy.incrementInterval()
			);
			(await communityCopy1.minTranche()).should.eq(
				await communityProxy.minTranche()
			);
			(await communityCopy1.maxTranche()).should.eq(
				await communityProxy.maxTranche()
			);
			(await communityCopy1.maxTotalClaim()).should.not.eq(
				await communityProxy.maxTotalClaim()
			);
			(await communityCopy1.maxTotalClaim()).should.eq(
				maxTotalClaimDefault
			);
			(await communityCopy1.maxClaim()).should.eq(maxTotalClaimDefault);
			(await communityCopy1.decreaseStep()).should.eq(
				await communityProxy.decreaseStep()
			);
			(await communityCopy1.maxBeneficiaries()).should.eq(
				await communityProxy.maxBeneficiaries()
			);
			(await communityCopy1.validBeneficiaryCount()).should.eq(0);
			(await communityCopy1.treasuryFunds()).should.eq(0);
			(await communityCopy1.privateFunds()).should.eq(0);
			(await communityCopy1.communityAdmin()).should.eq(
				await communityProxy.communityAdmin()
			);
			(await communityCopy1.cUSD()).should.eq(cUSD.address);
			(await communityCopy1.token()).should.eq(
				await communityProxy.token()
			);
			(await communityCopy1.locked()).should.eq(
				await communityProxy.locked()
			);
			(await communityCopy1.lastFundRequest()).should.eq(0);
			(await communityCopy1.beneficiaryListLength()).should.eq(0);
			(await communityCopy1.beneficiaryListLength()).should.eq(0);
			(await communityCopy1.getVersion()).should.eq(4);
			(await communityCopy1.tokenList())[0].should.eq(
				(await communityProxy.tokenList())[0]
			);

			(
				await ambassadorsProxy.isAmbassadorOf(
					ambassadorA.address,
					communityProxy.address
				)
			).should.eq(true);
			(
				await ambassadorsProxy.isAmbassadorOf(
					ambassadorA.address,
					communityCopy1.address
				)
			).should.eq(true);

			(
				await communityAdminProxy.communities(communityProxy.address)
			).should.eq(CommunityState.Valid);
			(
				await communityAdminProxy.communities(communityCopy1.address)
			).should.eq(CommunityState.Valid);

			const communityCopy2 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress2
			);

			(await communityCopy2.copyOf()).should.eq(communityProxy.address);
			(await communityProxy.copies())[1].should.eq(
				communityCopy2.address
			);

			(await communityProxy.copyOf()).should.eq(
				ethers.constants.AddressZero
			);
			(await communityCopy1.copies()).length.should.eq(0);

			(await communityCopy2.previousCommunity()).should.eq(
				ethers.constants.AddressZero
			);
			(await communityCopy2.originalClaimAmount()).should.eq(
				await communityProxy.originalClaimAmount()
			);
			(await communityCopy2.claimAmount()).should.eq(
				await communityProxy.claimAmount()
			);
			(await communityCopy2.baseInterval()).should.eq(
				await communityProxy.baseInterval()
			);
			(await communityCopy2.incrementInterval()).should.eq(
				await communityProxy.incrementInterval()
			);
			(await communityCopy2.minTranche()).should.eq(
				await communityProxy.minTranche()
			);
			(await communityCopy2.maxTranche()).should.eq(
				await communityProxy.maxTranche()
			);
			(await communityCopy2.maxTotalClaim()).should.not.eq(
				await communityProxy.maxTotalClaim()
			);
			(await communityCopy2.maxTotalClaim()).should.eq(
				maxTotalClaimDefault
			);
			(await communityCopy2.maxClaim()).should.eq(maxTotalClaimDefault);
			(await communityCopy2.decreaseStep()).should.eq(
				await communityProxy.decreaseStep()
			);
			(await communityCopy2.maxBeneficiaries()).should.eq(
				await communityProxy.maxBeneficiaries()
			);
			(await communityCopy2.validBeneficiaryCount()).should.eq(0);
			(await communityCopy2.treasuryFunds()).should.eq(0);
			(await communityCopy2.privateFunds()).should.eq(0);
			(await communityCopy2.communityAdmin()).should.eq(
				await communityProxy.communityAdmin()
			);
			(await communityCopy2.cUSD()).should.eq(cUSD.address);
			(await communityCopy2.token()).should.eq(
				await communityProxy.token()
			);
			(await communityCopy2.locked()).should.eq(
				await communityProxy.locked()
			);
			(await communityCopy2.lastFundRequest()).should.eq(0);
			(await communityCopy2.beneficiaryListLength()).should.eq(0);
			(await communityCopy2.beneficiaryListLength()).should.eq(0);
			(await communityCopy2.getVersion()).should.eq(4);
			(await communityCopy2.tokenList())[0].should.eq(
				(await communityProxy.tokenList())[0]
			);

			(
				await ambassadorsProxy.isAmbassadorOf(
					ambassadorA.address,
					communityProxy.address
				)
			).should.eq(true);
			(
				await ambassadorsProxy.isAmbassadorOf(
					ambassadorA.address,
					communityCopy2.address
				)
			).should.eq(true);

			(
				await communityAdminProxy.communities(communityProxy.address)
			).should.eq(CommunityState.Valid);
			(
				await communityAdminProxy.communities(communityCopy2.address)
			).should.eq(CommunityState.Valid);
		});

		it("should splitCommunity after token update", async function () {
			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				cTKN.address,
				getExchangePath(cUSD, mUSD, cTKN),
				originalClaimAmountDefault.mul(2),
				maxTotalClaimDefault.mul(3),
				decreaseStepDefault.mul(4),
				baseIntervalDefault * 5,
				incrementIntervalDefault * 6
			).should.be.fulfilled;

			(await communityProxy.token()).should.eq(cTKN.address);
			(await communityProxy.cUSD()).should.eq(cTKN.address);
			(await communityProxy.originalClaimAmount()).should.eq(
				originalClaimAmountDefault.mul(2)
			);
			(await communityProxy.claimAmount()).should.eq(
				originalClaimAmountDefault.mul(2)
			);
			(await communityProxy.maxTotalClaim()).should.eq(
				maxTotalClaimDefault.mul(3).sub(decreaseStepDefault.mul(3 * 4))
			);
			(await communityProxy.getInitialMaxTotalClaim()).should.eq(
				maxTotalClaimDefault.mul(3)
			);
			(await communityProxy.getInitialMaxClaim()).should.eq(
				maxTotalClaimDefault.mul(3)
			);
			(await communityProxy.decreaseStep()).should.eq(
				decreaseStepDefault.mul(4)
			);
			(await communityProxy.baseInterval()).should.eq(
				baseIntervalDefault * 5
			);
			(await communityProxy.incrementInterval()).should.eq(
				incrementIntervalDefault * 6
			);
			(await communityProxy.tokenUpdatesLength()).should.eq(2);

			const token1 = await communityProxy.tokenUpdates(0);
			token1.tokenAddress.should.eq(cUSD.address);
			token1.ratio.should.eq(toEther(1));
			token1.startBlock.should.eq(0);

			const token2 = await communityProxy.tokenUpdates(1);
			token2.tokenAddress.should.eq(cTKN.address);
			token2.ratio.should.eq(toEther(3));
			token2.startBlock.should.eq(await getBlockNumber());

			//split part
			const nonce = await ethers.provider.getTransactionCount(
				communityAdminProxy.address
			);

			const anticipatedAddress = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			await communityAdminProxy
				.connect(deployer)
				.splitCommunity(
					communityProxy.address,
					1,
					ambassadorA.address,
					[communityManagerB.address]
				)
				.should.emit(communityAdminProxy, "CommunityCopied")
				.withArgs(communityProxy.address, anticipatedAddress);

			const communityCopy1 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress
			);

			(await communityCopy1.copyOf()).should.eq(communityProxy.address);
			(await communityProxy.copies())[0].should.eq(
				communityCopy1.address
			);

			(await communityProxy.copyOf()).should.eq(
				ethers.constants.AddressZero
			);
			(await communityCopy1.copies()).length.should.eq(0);

			(await communityCopy1.previousCommunity()).should.eq(
				ethers.constants.AddressZero
			);
			(await communityCopy1.originalClaimAmount()).should.eq(
				await communityProxy.originalClaimAmount()
			);
			(await communityCopy1.claimAmount()).should.eq(
				await communityProxy.claimAmount()
			);
			(await communityCopy1.baseInterval()).should.eq(
				await communityProxy.baseInterval()
			);
			(await communityCopy1.incrementInterval()).should.eq(
				await communityProxy.incrementInterval()
			);
			(await communityCopy1.minTranche()).should.eq(
				await communityProxy.minTranche()
			);
			(await communityCopy1.maxTranche()).should.eq(
				await communityProxy.maxTranche()
			);
			(await communityCopy1.maxTotalClaim()).should.not.eq(
				await communityProxy.maxTotalClaim()
			);
			(await communityCopy1.maxTotalClaim()).should.eq(
				maxTotalClaimDefault.mul(3)
			);
			(await communityCopy1.maxClaim()).should.eq(
				maxTotalClaimDefault.mul(3)
			);
			(await communityCopy1.decreaseStep()).should.eq(
				await communityProxy.decreaseStep()
			);
			(await communityCopy1.maxBeneficiaries()).should.eq(
				await communityProxy.maxBeneficiaries()
			);
			(await communityCopy1.validBeneficiaryCount()).should.eq(0);
			(await communityCopy1.treasuryFunds()).should.eq(0);
			(await communityCopy1.privateFunds()).should.eq(0);
			(await communityCopy1.communityAdmin()).should.eq(
				await communityProxy.communityAdmin()
			);
			(await communityCopy1.token()).should.eq(
				await communityProxy.token()
			);
			(await communityCopy1.locked()).should.eq(
				await communityProxy.locked()
			);
			(await communityCopy1.lastFundRequest()).should.eq(0);
			(await communityCopy1.beneficiaryListLength()).should.eq(0);
			(await communityCopy1.beneficiaryListLength()).should.eq(0);
			(await communityCopy1.getVersion()).should.eq(4);
			(await communityCopy1.tokenUpdatesLength()).should.eq(2);
			(await communityCopy1.tokenList())[0].should.eq(
				(await communityProxy.tokenList())[0]
			);
			(await communityCopy1.tokenList())[1].should.eq(
				(await communityProxy.tokenList())[1]
			);

			(
				await ambassadorsProxy.isAmbassadorOf(
					ambassadorA.address,
					communityProxy.address
				)
			).should.eq(true);
			(
				await ambassadorsProxy.isAmbassadorOf(
					ambassadorA.address,
					communityCopy1.address
				)
			).should.eq(true);
		});

		it("should copyBeneficiaries #1", async function () {
			const nonce = await ethers.provider.getTransactionCount(
				communityAdminProxy.address
			);

			const anticipatedAddress = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			await communityAdminProxy
				.connect(deployer)
				.splitCommunity(
					communityProxy.address,
					1,
					ambassadorA.address,
					[communityManagerA.address]
				);

			const communityCopy1 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress
			);

			await communityProxy.connect(beneficiaryA).claim();

			const originalState = (
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state;

			await communityCopy1
				.connect(communityManagerA)
				.copyBeneficiaries([beneficiaryA.address])
				.should.emit(communityCopy1, "BeneficiaryCopied")
				.withArgs(communityManagerA.address, beneficiaryA.address);

			const beneficiaryOriginal = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryCopy = await communityCopy1.beneficiaries(
				beneficiaryA.address
			);

			beneficiaryOriginal.state.should.eq(BeneficiaryState.Copied);
			beneficiaryCopy.state.should.eq(originalState);
			beneficiaryCopy.claims.should.eq(beneficiaryOriginal.claims);
			beneficiaryCopy.claimedAmount.should.eq(
				beneficiaryOriginal.claimedAmount
			);
			beneficiaryCopy.lastClaim.should.eq(beneficiaryOriginal.lastClaim);

			const beneficiaryClaimedAmountsOriginal =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryClaimedAmountsCopy =
				await communityCopy1.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);

			beneficiaryClaimedAmountsOriginal.length.should.eq(1);
			beneficiaryClaimedAmountsCopy.length.should.eq(1);
			beneficiaryClaimedAmountsOriginal[0].should.eq(
				beneficiaryClaimedAmountsCopy[0]
			);

			(await communityProxy.validBeneficiaryCount()).should.eq(2);
			(await communityCopy1.validBeneficiaryCount()).should.eq(1);
			(await communityCopy1.maxTotalClaim()).should.eq(
				maxTotalClaimDefault.sub(decreaseStepDefault)
			);
		});

		it("should copyBeneficiaries #2", async function () {
			const nonce = await ethers.provider.getTransactionCount(
				communityAdminProxy.address
			);

			const anticipatedAddress = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			await communityAdminProxy
				.connect(deployer)
				.splitCommunity(
					communityProxy.address,
					1,
					ambassadorA.address,
					[communityManagerA.address]
				);

			const communityCopy1 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress
			);

			await communityProxy
				.connect(communityManagerA)
				.lockBeneficiary(beneficiaryA.address);

			await communityCopy1
				.connect(communityManagerA)
				.copyBeneficiaries([beneficiaryA.address])
				.should.emit(communityCopy1, "BeneficiaryCopied")
				.withArgs(communityManagerA.address, beneficiaryA.address);

			const originalState = (
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state;
			const copiedState = (
				await communityCopy1.beneficiaries(beneficiaryA.address)
			).state;

			originalState.should.eq(BeneficiaryState.Copied);
			copiedState.should.eq(BeneficiaryState.Locked);
		});

		it("should copyBeneficiaries #2", async function () {
			const nonce = await ethers.provider.getTransactionCount(
				communityAdminProxy.address
			);

			const anticipatedAddress = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			await communityAdminProxy
				.connect(deployer)
				.splitCommunity(
					communityProxy.address,
					1,
					ambassadorA.address,
					[communityManagerA.address]
				);

			const communityCopy1 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress
			);

			await communityProxy
				.connect(communityManagerA)
				.removeBeneficiary(beneficiaryA.address);

			await communityCopy1
				.connect(communityManagerA)
				.copyBeneficiaries([beneficiaryA.address])
				.should.emit(communityCopy1, "BeneficiaryCopied")
				.withArgs(communityManagerA.address, beneficiaryA.address);

			const originalState = (
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state;
			const copiedState = (
				await communityCopy1.beneficiaries(beneficiaryA.address)
			).state;

			originalState.should.eq(BeneficiaryState.Copied);
			copiedState.should.eq(BeneficiaryState.Removed);
		});

		it("should not copyBeneficiaries multiple times", async function () {
			let nonce = await ethers.provider.getTransactionCount(
				communityAdminProxy.address
			);

			const anticipatedAddress1 = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			nonce++;

			const anticipatedAddress2 = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			await communityAdminProxy
				.connect(deployer)
				.splitCommunity(
					communityProxy.address,
					2,
					ambassadorA.address,
					[communityManagerA.address]
				);

			const communityCopy1 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress1
			);

			const communityCopy2 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress2
			);

			await communityCopy1
				.connect(communityManagerA)
				.copyBeneficiaries([beneficiaryA.address])
				.should.emit(communityCopy1, "BeneficiaryCopied")
				.withArgs(communityManagerA.address, beneficiaryA.address);

			await communityCopy2
				.connect(communityManagerA)
				.copyBeneficiaries([beneficiaryA.address])
				.should.be.rejectedWith(
					"Community::copyBeneficiary: Beneficiary already copied"
				);
		});

		it("should not claim in original community after copyBeneficiaries", async function () {
			let nonce = await ethers.provider.getTransactionCount(
				communityAdminProxy.address
			);

			const anticipatedAddress1 = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			await communityAdminProxy
				.connect(deployer)
				.splitCommunity(
					communityProxy.address,
					1,
					ambassadorA.address,
					[communityManagerA.address]
				);

			const communityCopy1 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress1
			);

			await communityCopy1
				.connect(communityManagerA)
				.copyBeneficiaries([beneficiaryA.address])
				.should.emit(communityCopy1, "BeneficiaryCopied")
				.withArgs(communityManagerA.address, beneficiaryA.address);

			await communityProxy
				.connect(beneficiaryA)
				.claim()
				.should.be.rejectedWith("ommunity: NOT_VALID_BENEFICIARY");
		});

		it("should claim in copied community after copyBeneficiaries", async function () {
			let nonce = await ethers.provider.getTransactionCount(
				communityAdminProxy.address
			);

			const anticipatedAddress1 = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			await communityAdminProxy
				.connect(deployer)
				.splitCommunity(
					communityProxy.address,
					1,
					ambassadorA.address,
					[communityManagerA.address]
				);

			const communityCopy1 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress1
			);

			await cUSD.transfer(communityCopy1.address, toEther(1000));

			await communityCopy1
				.connect(communityManagerA)
				.copyBeneficiaries([beneficiaryA.address])
				.should.emit(communityCopy1, "BeneficiaryCopied")
				.withArgs(communityManagerA.address, beneficiaryA.address);

			await communityCopy1.connect(beneficiaryA).claim().should.be
				.fulfilled;
		});

		it("should split after multiple token updates #1", async function () {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			await communityProxy.connect(beneficiaryA).claim();

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				cTKN.address,
				getExchangePath(cUSD, mUSD, cTKN),
				originalClaimAmountDefault.mul(2),
				maxTotalClaimDefault.mul(3),
				decreaseStepDefault.mul(4),
				baseIntervalDefault,
				incrementIntervalDefault
			);

			await advanceTimeAndBlockNTimes(baseIntervalDefault);

			await communityProxy.connect(beneficiaryA).claim();

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				mUSD.address,
				getExchangePath(cTKN, mUSD),
				originalClaimAmountDefault,
				maxTotalClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await communityProxy.connect(beneficiaryA).claim();

			const nonce = await ethers.provider.getTransactionCount(
				communityAdminProxy.address
			);
			const anticipatedAddress = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			await communityAdminProxy
				.connect(deployer)
				.splitCommunity(
					communityProxy.address,
					1,
					ambassadorA.address,
					[communityManagerA.address]
				);

			const communityCopy1 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress
			);

			const originalState = (
				await communityProxy.beneficiaries(beneficiaryA.address)
			).state;

			await communityCopy1
				.connect(communityManagerA)
				.copyBeneficiaries([beneficiaryA.address])
				.should.emit(communityCopy1, "BeneficiaryCopied")
				.withArgs(communityManagerA.address, beneficiaryA.address);

			const beneficiaryOriginal = await communityProxy.beneficiaries(
				beneficiaryA.address
			);
			const beneficiaryCopy = await communityCopy1.beneficiaries(
				beneficiaryA.address
			);

			beneficiaryOriginal.state.should.eq(BeneficiaryState.Copied);
			beneficiaryCopy.state.should.eq(originalState);
			beneficiaryCopy.claims.should.eq(beneficiaryOriginal.claims);
			beneficiaryCopy.claimedAmount.should.eq(
				beneficiaryOriginal.claimedAmount
			);
			beneficiaryCopy.lastClaim.should.eq(beneficiaryOriginal.lastClaim);

			const beneficiaryClaimedAmountsOriginal =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryClaimedAmountsCopy =
				await communityCopy1.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);

			beneficiaryClaimedAmountsOriginal.length.should.eq(3);
			beneficiaryClaimedAmountsCopy.length.should.eq(3);
			beneficiaryClaimedAmountsOriginal[0].should.eq(
				beneficiaryClaimedAmountsCopy[0]
			);
			beneficiaryClaimedAmountsOriginal[1].should.eq(
				beneficiaryClaimedAmountsCopy[1]
			);
			beneficiaryClaimedAmountsOriginal[2].should.eq(
				beneficiaryClaimedAmountsCopy[2]
			);
		});

		it("should split after multiple token updates #2", async function () {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			await communityProxy.connect(beneficiaryA).claim();

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				cTKN.address,
				getExchangePath(cUSD, mUSD, cTKN),
				originalClaimAmountDefault.mul(2),
				maxTotalClaimDefault.mul(3),
				decreaseStepDefault.mul(4),
				baseIntervalDefault,
				incrementIntervalDefault
			);

			await advanceTimeAndBlockNTimes(baseIntervalDefault);

			await communityProxy.connect(beneficiaryA).claim();

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				mUSD.address,
				getExchangePath(cTKN, mUSD),
				originalClaimAmountDefault,
				maxTotalClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await communityProxy.connect(beneficiaryA).claim();

			const nonce = await ethers.provider.getTransactionCount(
				communityAdminProxy.address
			);
			const anticipatedAddress = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			await communityAdminProxy
				.connect(deployer)
				.splitCommunity(
					communityProxy.address,
					1,
					ambassadorA.address,
					[communityManagerA.address]
				);

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				cEUR.address,
				getExchangePath(mUSD, cUSD, cEUR),
				originalClaimAmountDefault,
				maxTotalClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			const communityCopy1 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress
			);

			await communityCopy1
				.connect(communityManagerA)
				.copyBeneficiaries([beneficiaryA.address])
				.should.emit(communityCopy1, "BeneficiaryCopied")
				.withArgs(communityManagerA.address, beneficiaryA.address);

			const beneficiaryClaimedAmountsOriginal =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryClaimedAmountsCopy =
				await communityCopy1.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);

			beneficiaryClaimedAmountsOriginal.length.should.eq(4);
			beneficiaryClaimedAmountsCopy.length.should.eq(3);
			beneficiaryClaimedAmountsOriginal[0].should.eq(
				beneficiaryClaimedAmountsCopy[0]
			);
			beneficiaryClaimedAmountsOriginal[1].should.eq(
				beneficiaryClaimedAmountsCopy[1]
			);
			beneficiaryClaimedAmountsOriginal[2].should.eq(
				beneficiaryClaimedAmountsCopy[2]
			);
		});

		it("should split after multiple token updates #3", async function () {
			await communityProxy
				.connect(communityManagerA)
				.addBeneficiaries([beneficiaryA.address]);

			await communityProxy.connect(beneficiaryA).claim();

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				cTKN.address,
				getExchangePath(cUSD, mUSD, cTKN),
				originalClaimAmountDefault.mul(2),
				maxTotalClaimDefault.mul(3),
				decreaseStepDefault.mul(4),
				baseIntervalDefault,
				incrementIntervalDefault
			);

			await advanceTimeAndBlockNTimes(baseIntervalDefault);

			await communityProxy.connect(beneficiaryA).claim();

			await communityAdminProxy.updateCommunityToken(
				communityProxy.address,
				mUSD.address,
				getExchangePath(cTKN, mUSD),
				originalClaimAmountDefault,
				maxTotalClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			await advanceTimeAndBlockNTimes(
				baseIntervalDefault + incrementIntervalDefault
			);

			await communityProxy.connect(beneficiaryA).claim();

			const nonce = await ethers.provider.getTransactionCount(
				communityAdminProxy.address
			);
			const anticipatedAddress = ethers.utils.getContractAddress({
				from: communityAdminProxy.address,
				nonce,
			});

			await communityAdminProxy
				.connect(deployer)
				.splitCommunity(
					communityProxy.address,
					1,
					ambassadorA.address,
					[communityManagerA.address]
				);

			const communityCopy1 = await ethers.getContractAt(
				"CommunityImplementation",
				anticipatedAddress
			);

			await communityAdminProxy.updateCommunityToken(
				communityCopy1.address,
				cEUR.address,
				getExchangePath(mUSD, cUSD, cEUR),
				originalClaimAmountDefault,
				maxTotalClaimDefault,
				decreaseStepDefault,
				baseIntervalDefault,
				incrementIntervalDefault
			);

			await communityCopy1
				.connect(communityManagerA)
				.copyBeneficiaries([beneficiaryA.address])
				.should.emit(communityCopy1, "BeneficiaryCopied")
				.withArgs(communityManagerA.address, beneficiaryA.address);

			const beneficiaryClaimedAmountsOriginal =
				await communityProxy.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);
			const beneficiaryClaimedAmountsCopy =
				await communityCopy1.beneficiaryClaimedAmounts(
					beneficiaryA.address
				);

			beneficiaryClaimedAmountsOriginal.length.should.eq(3);
			beneficiaryClaimedAmountsCopy.length.should.eq(4);
			beneficiaryClaimedAmountsCopy[0].should.eq(
				beneficiaryClaimedAmountsOriginal[0]
			);
			beneficiaryClaimedAmountsCopy[1].should.eq(
				beneficiaryClaimedAmountsOriginal[1]
			);
			beneficiaryClaimedAmountsCopy[2].should.eq(
				beneficiaryClaimedAmountsOriginal[2]
			);
			beneficiaryClaimedAmountsCopy[3].should.eq(0);
		});
	});

	async function transferTreasuryFundsExcept(
		finalBalance: BigNumber = toEther(0)
	) {
		const treasuryInitialBalance = await cUSD.balanceOf(
			treasuryProxy.address
		);

		await treasuryProxy.transfer(
			cUSD.address,
			adminAccount1.address,
			treasuryInitialBalance.sub(finalBalance)
		);
	}

	async function transferCommunityFundsExcept(
		finalBalance: BigNumber = toEther(0)
	) {
		const communityInitialBalance = await cUSD.balanceOf(
			communityProxy.address
		);

		await communityAdminProxy.transferFromCommunity(
			communityProxy.address,
			cUSD.address,
			adminAccount1.address,
			communityInitialBalance.sub(finalBalance)
		);
	}
});
