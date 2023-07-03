import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { deployments, ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import {
	createDefaultCommunity,
	createDefaultCommunityAdmin,
} from "../community/helpers";
import { toEther } from "../utils/helpers";
import { BigNumber } from "@ethersproject/bignumber";

chai.use(chaiAsPromised);
should();

describe("LearnAndEarn", () => {
	const FAKE_ADDRESS = "0x000000000000000000000000000000000000dEaD";

	let owner: SignerWithAddress;
	let signerWallet: SignerWithAddress;
	let impactMarketCouncil: SignerWithAddress;
	let ambassadorsEntity1: SignerWithAddress;
	let ambassador1: SignerWithAddress;
	let manager1: SignerWithAddress;
	let beneficiary1: SignerWithAddress;
	let beneficiary2: SignerWithAddress;
	let beneficiary3: SignerWithAddress;
	let beneficiary4: SignerWithAddress;
	let beneficiary5: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;

	let ImpactProxyAdmin: ethersTypes.Contract;
	let LearnAndEarn: ethersTypes.Contract;
	let cUSD: ethersTypes.Contract;
	let PACT: ethersTypes.Contract;
	let CommunityAdmin: ethersTypes.Contract;
	let CommunityA: ethersTypes.Contract;
	let CommunityB: ethersTypes.Contract;

	enum LevelState {
		Invalid = 0,
		Valid = 1,
		Paused = 2,
		Canceled = 3,
	}

	const deploy = deployments.createFixture(async () => {
		await deployments.fixture("Test", { fallbackToGlobal: false });

		[
			owner,
			signerWallet,
			impactMarketCouncil,
			ambassadorsEntity1,
			ambassador1,
			manager1,
			beneficiary1,
			beneficiary2,
			beneficiary3,
			beneficiary4,
			beneficiary5,
			user1,
			user2,
		] = await ethers.getSigners();

		ImpactProxyAdmin = await ethers.getContractAt(
			"ImpactProxyAdmin",
			(
				await deployments.get("ImpactProxyAdmin")
			).address
		);
		LearnAndEarn = await ethers.getContractAt(
			"LearnAndEarnImplementation",
			(
				await deployments.get("LearnAndEarnProxy")
			).address
		);

		cUSD = await ethers.getContractAt(
			"TokenMock",
			(
				await deployments.get("TokenMock")
			).address
		);

		PACT = await ethers.getContractAt(
			"PACTToken",
			(
				await deployments.get("PACTToken")
			).address
		);

		CommunityAdmin = await createDefaultCommunityAdmin(
			ambassadorsEntity1,
			ambassador1
		);
		CommunityA = await createDefaultCommunity(
			CommunityAdmin,
			manager1,
			ambassador1
		);
		CommunityB = await createDefaultCommunity(
			CommunityAdmin,
			manager1,
			ambassador1
		);

		await CommunityAdmin.updateImpactMarketCouncil(
			impactMarketCouncil.address
		);

		await CommunityA.connect(manager1).addBeneficiary(beneficiary1.address);
		await CommunityA.connect(manager1).addBeneficiary(beneficiary2.address);
		await CommunityA.connect(manager1).addBeneficiary(beneficiary3.address);
		await CommunityB.connect(manager1).addBeneficiary(beneficiary3.address);
		await CommunityB.connect(manager1).addBeneficiary(beneficiary4.address);
		await CommunityB.connect(manager1).addBeneficiary(beneficiary5.address);

		await cUSD.mint(user1.address, toEther(1000000));
		await cUSD.mint(user2.address, toEther(1000000));
		await PACT.connect(owner).transfer(user1.address, toEther(1000000));
	});

	async function signParams(
		signer: SignerWithAddress,
		beneficiary: SignerWithAddress,
		levelId: number,
		rewardAmount: BigNumber
	): Promise<string> {
		const encoded = ethers.utils.defaultAbiCoder.encode(
			["address", "uint256", "uint256"],
			[beneficiary.address, levelId, rewardAmount]
		);
		const hash = ethers.utils.keccak256(encoded);

		return signer.signMessage(ethers.utils.arrayify(hash));
	}

	describe("LearnAndEarn - Basic", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();
		});

		it("Should have correct values", async function () {
			(await LearnAndEarn.signerWalletAddress()).should.eq(
				signerWallet.address
			);
			(await LearnAndEarn.communityAdmin()).should.eq(
				CommunityAdmin.address
			);
			(await LearnAndEarn.paused()).should.be.equal(false);
		});

		it("Should update communityAdmin if owner", async function () {
			await LearnAndEarn.updateCommunityAdmin(FAKE_ADDRESS).should.be
				.fulfilled;
			(await LearnAndEarn.communityAdmin()).should.be.equal(FAKE_ADDRESS);
		});

		it("Should not update communityAdmin if not owner", async function () {
			await LearnAndEarn.connect(signerWallet)
				.updateCommunityAdmin(FAKE_ADDRESS)
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await LearnAndEarn.communityAdmin()).should.be.equal(
				CommunityAdmin.address
			);
		});

		it("Should update signerWallet if owner", async function () {
			await LearnAndEarn.updateSignerWalletAddress(FAKE_ADDRESS).should.be
				.fulfilled;
			(await LearnAndEarn.signerWalletAddress()).should.be.equal(
				FAKE_ADDRESS
			);
		});

		it("Should update signerWallet if ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(
				impactMarketCouncil
			).updateSignerWalletAddress(FAKE_ADDRESS).should.be.fulfilled;
			(await LearnAndEarn.signerWalletAddress()).should.be.equal(
				FAKE_ADDRESS
			);
		});

		it("Should not update signerWallet if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(signerWallet)
				.updateSignerWalletAddress(FAKE_ADDRESS)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);
			(await LearnAndEarn.signerWalletAddress()).should.be.equal(
				signerWallet.address
			);
		});

		it("Should pause if owner", async function () {
			await LearnAndEarn.pause().should.be.fulfilled;
			(await LearnAndEarn.paused()).should.be.equal(true);
		});

		it("Should pause if ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(impactMarketCouncil).pause().should.be
				.fulfilled;
			(await LearnAndEarn.paused()).should.be.equal(true);
		});

		it("Should not pause if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(signerWallet)
				.pause()
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);
			(await LearnAndEarn.paused()).should.be.equal(false);
		});

		it("Should unpause if owner", async function () {
			await LearnAndEarn.pause();
			await LearnAndEarn.unpause().should.be.fulfilled;
			(await LearnAndEarn.paused()).should.be.equal(false);
		});

		it("Should unpause if ImpactMarketCouncil", async function () {
			await LearnAndEarn.pause();
			await LearnAndEarn.connect(impactMarketCouncil).unpause().should.be
				.fulfilled;
			(await LearnAndEarn.paused()).should.be.equal(false);
		});

		it("Should not unpause if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.pause();
			await LearnAndEarn.connect(signerWallet)
				.unpause()
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);
			(await LearnAndEarn.paused()).should.be.equal(true);
		});
	});

	describe("LearnAndEarn - Level basic", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();
		});

		it("Should add level if owner", async function () {
			await LearnAndEarn.connect(owner)
				.addLevel(123, cUSD.address)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(123, LevelState.Valid);

			(await LearnAndEarn.levelListLength()).should.eq(1);
			(await LearnAndEarn.levelListAt(0)).should.eq(123);

			const level = await LearnAndEarn.levels(123);
			level.token.should.be.equal(cUSD.address);
			level.balance.should.be.equal(0);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should add level if ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(impactMarketCouncil)
				.addLevel(123, cUSD.address)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(123, LevelState.Valid);

			(await LearnAndEarn.levelListLength()).should.eq(1);
			(await LearnAndEarn.levelListAt(0)).should.eq(123);

			const level = await LearnAndEarn.levels(123);
			level.token.should.be.equal(cUSD.address);
			level.balance.should.be.equal(0);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should not add level if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(signerWallet)
				.addLevel(1, cUSD.address)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);
		});

		it("Should add multiple levels", async function () {
			await LearnAndEarn.connect(owner)
				.addLevel(1, cUSD.address)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, LevelState.Valid);
			await LearnAndEarn.connect(owner)
				.addLevel(2, cUSD.address)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(2, LevelState.Valid);
			await LearnAndEarn.connect(owner)
				.addLevel(3, cUSD.address)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(3, LevelState.Valid);

			(await LearnAndEarn.levelListLength()).should.eq(3);
			(await LearnAndEarn.levelListAt(0)).should.eq(1);
			(await LearnAndEarn.levelListAt(1)).should.eq(2);
			(await LearnAndEarn.levelListAt(2)).should.eq(3);

			const level1 = await LearnAndEarn.levels(1);
			level1.token.should.be.equal(cUSD.address);
			level1.balance.should.be.equal(0);
			level1.state.should.be.equal(LevelState.Valid);

			const level2 = await LearnAndEarn.levels(2);
			level2.token.should.be.equal(cUSD.address);
			level2.balance.should.be.equal(0);
			level2.state.should.be.equal(LevelState.Valid);

			const level3 = await LearnAndEarn.levels(3);
			level3.token.should.be.equal(cUSD.address);
			level3.balance.should.be.equal(0);
			level3.state.should.be.equal(LevelState.Valid);
		});
	});

	describe("LearnAndEarn - manage level", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await LearnAndEarn.connect(owner).addLevel(1, cUSD.address);
			await LearnAndEarn.connect(owner).addLevel(2, cUSD.address);
			await LearnAndEarn.connect(owner).addLevel(3, cUSD.address);
		});

		it("Should pause level if owner", async function () {
			await LearnAndEarn.pauseLevel(1)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, LevelState.Paused);

			const level = await LearnAndEarn.levels(1);
			level.state.should.be.equal(LevelState.Paused);
		});

		it("Should pause level if ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(impactMarketCouncil)
				.pauseLevel(1)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, LevelState.Paused);

			const level = await LearnAndEarn.levels(1);
			level.state.should.be.equal(LevelState.Paused);
		});

		it("Should not pause level if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(signerWallet)
				.pauseLevel(1)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);

			const level = await LearnAndEarn.levels(1);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should not pause level if level is not valid", async function () {
			await LearnAndEarn.pauseLevel(4).should.be.rejectedWith(
				"LearnAndEarn::pauseLevel: Invalid level id"
			);

			await LearnAndEarn.pauseLevel(1);
			await LearnAndEarn.pauseLevel(1).should.be.rejectedWith(
				"LearnAndEarn::pauseLevel: Invalid level id"
			);
		});

		it("Should unpause level if owner", async function () {
			await LearnAndEarn.pauseLevel(1);

			await LearnAndEarn.unpauseLevel(1)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, LevelState.Valid);

			const level = await LearnAndEarn.levels(1);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should unpause level if ImpactMarketCouncil", async function () {
			await LearnAndEarn.pauseLevel(1);

			await LearnAndEarn.connect(impactMarketCouncil)
				.unpauseLevel(1)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, LevelState.Valid);

			const level = await LearnAndEarn.levels(1);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should not unpause level if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.pauseLevel(1);

			await LearnAndEarn.connect(signerWallet)
				.unpauseLevel(1)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);

			const level = await LearnAndEarn.levels(1);
			level.state.should.be.equal(LevelState.Paused);
		});

		it("Should not unpause level if the level is not paused", async function () {
			await LearnAndEarn.unpauseLevel(1).should.be.rejectedWith(
				"LearnAndEarn::unpauseLevel: Invalid level id"
			);

			const level = await LearnAndEarn.levels(1);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should fund a level", async function () {
			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100));
			await LearnAndEarn.connect(user1)
				.fundLevel(1, toEther(100))
				.should.emit(LearnAndEarn, "LevelFunded")
				.withArgs(1, user1.address, toEther(100));

			const level = await LearnAndEarn.levels(1);
			level.balance.should.be.equal(toEther(100));

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				toEther(100)
			);
		});

		it("Should fund level multiple times", async function () {
			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(1000));
			await cUSD
				.connect(user2)
				.approve(LearnAndEarn.address, toEther(1000));

			await LearnAndEarn.connect(user1)
				.fundLevel(1, toEther(100))
				.should.emit(LearnAndEarn, "LevelFunded")
				.withArgs(1, user1.address, toEther(100));

			await LearnAndEarn.connect(user2)
				.fundLevel(2, toEther(100))
				.should.emit(LearnAndEarn, "LevelFunded")
				.withArgs(2, user2.address, toEther(100));

			await LearnAndEarn.connect(user1)
				.fundLevel(1, toEther(100))
				.should.emit(LearnAndEarn, "LevelFunded")
				.withArgs(1, user1.address, toEther(100));

			await LearnAndEarn.connect(user1)
				.fundLevel(2, toEther(100))
				.should.emit(LearnAndEarn, "LevelFunded")
				.withArgs(2, user1.address, toEther(100));

			await LearnAndEarn.connect(user2)
				.fundLevel(1, toEther(100))
				.should.emit(LearnAndEarn, "LevelFunded")
				.withArgs(1, user2.address, toEther(100));

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(toEther(300));
			const level2 = await LearnAndEarn.levels(2);
			level2.balance.should.be.equal(toEther(200));

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				toEther(500)
			);
		});

		it("Should fund a paused level", async function () {
			await LearnAndEarn.pauseLevel(1);

			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100));
			await LearnAndEarn.connect(user1)
				.fundLevel(1, toEther(100))
				.should.emit(LearnAndEarn, "LevelFunded")
				.withArgs(1, user1.address, toEther(100));

			const level = await LearnAndEarn.levels(1);
			level.balance.should.be.equal(toEther(100));
		});

		it("Should not fund an invalid level", async function () {
			await LearnAndEarn.connect(user1)
				.fundLevel(4, toEther(100))
				.should.be.rejectedWith(
					"LearnAndEarn::fundLevel: Invalid level id"
				);
		});

		it("Should cancel a level if owner", async function () {
			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100));
			await LearnAndEarn.connect(user1).fundLevel(2, toEther(100));

			const user1Balance = await cUSD.balanceOf(user1.address);
			await LearnAndEarn.connect(owner)
				.cancelLevel(2, user1.address)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(2, LevelState.Canceled);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(0);
			level1.state.should.be.equal(LevelState.Valid);

			const level2 = await LearnAndEarn.levels(2);
			level2.balance.should.be.equal(0);
			level2.state.should.be.equal(LevelState.Canceled);

			(await cUSD.balanceOf(user1.address)).should.eq(
				user1Balance.add(toEther(100))
			);
		});

		it("Should cancel a level if impactMarketCouncil", async function () {
			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100));
			await LearnAndEarn.connect(user1).fundLevel(2, toEther(100));

			const user1Balance = await cUSD.balanceOf(user1.address);
			await LearnAndEarn.connect(impactMarketCouncil)
				.cancelLevel(2, user1.address)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(2, LevelState.Canceled);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(0);
			level1.state.should.be.equal(LevelState.Valid);

			const level2 = await LearnAndEarn.levels(2);
			level2.balance.should.be.equal(0);
			level2.state.should.be.equal(LevelState.Canceled);

			(await cUSD.balanceOf(user1.address)).should.eq(
				user1Balance.add(toEther(100))
			);
		});

		it("Should not cancel level if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(signerWallet)
				.cancelLevel(1, user1.address)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);

			const level = await LearnAndEarn.levels(1);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should not fund a canceled level", async function () {
			await LearnAndEarn.connect(owner).cancelLevel(1, user1.address);

			await LearnAndEarn.connect(user1)
				.fundLevel(1, toEther(100))
				.should.be.rejectedWith(
					"LearnAndEarn::fundLevel: Invalid level id"
				);
		});

		it("Should not unpause level if the level is canceled", async function () {
			await LearnAndEarn.connect(owner).cancelLevel(1, user1.address);

			await LearnAndEarn.unpauseLevel(1).should.be.rejectedWith(
				"LearnAndEarn::unpauseLevel: Invalid level id"
			);

			const level = await LearnAndEarn.levels(1);
			level.state.should.be.equal(LevelState.Canceled);
		});

		it("Should not pause level if the level is canceled", async function () {
			await LearnAndEarn.connect(owner).cancelLevel(1, user1.address);

			await LearnAndEarn.pauseLevel(1).should.be.rejectedWith(
				"LearnAndEarn::pauseLevel: Invalid level id"
			);

			const level = await LearnAndEarn.levels(1);
			level.state.should.be.equal(LevelState.Canceled);
		});
	});

	describe("LearnAndEarn - updateLevel", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100000000));

			await PACT.connect(user1).approve(
				LearnAndEarn.address,
				toEther(100000000)
			);
		});

		it("Should change level token #1", async function () {
			(await cUSD.balanceOf(LearnAndEarn.address)).should.be.equal(0);
			(await PACT.balanceOf(LearnAndEarn.address)).should.be.equal(0);

			await LearnAndEarn.connect(owner).addLevel(1, cUSD.address);

			await LearnAndEarn.connect(owner)
				.updateLevel(1, PACT.address)
				.should.emit(LearnAndEarn, "LevelUpdated")
				.withArgs(1, PACT.address);

			let level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(0);
			level1.state.should.be.equal(LevelState.Valid);
			level1.token.should.be.equal(PACT.address);

			await LearnAndEarn.connect(user1).fundLevel(1, 100);

			(await LearnAndEarn.levels(1)).balance.should.be.equal(100);
			(await cUSD.balanceOf(LearnAndEarn.address)).should.be.equal(0);
			(await PACT.balanceOf(LearnAndEarn.address)).should.be.equal(100);
		});

		it("Should change level token #2", async function () {
			(await cUSD.balanceOf(LearnAndEarn.address)).should.be.equal(0);
			(await PACT.balanceOf(LearnAndEarn.address)).should.be.equal(0);

			await LearnAndEarn.connect(owner).addLevel(1, cUSD.address);
			await LearnAndEarn.connect(owner).addLevel(2, cUSD.address);
			await LearnAndEarn.connect(owner).addLevel(3, cUSD.address);

			await LearnAndEarn.connect(owner)
				.updateLevel(2, PACT.address)
				.should.emit(LearnAndEarn, "LevelUpdated")
				.withArgs(2, PACT.address);

			let level2 = await LearnAndEarn.levels(2);
			level2.balance.should.be.equal(0);
			level2.state.should.be.equal(LevelState.Valid);
			level2.token.should.be.equal(PACT.address);

			await LearnAndEarn.connect(user1).fundLevel(2, 100);

			(await LearnAndEarn.levels(2)).balance.should.be.equal(100);
			(await cUSD.balanceOf(LearnAndEarn.address)).should.be.equal(0);
			(await PACT.balanceOf(LearnAndEarn.address)).should.be.equal(100);
		});

		it("Should not updateLevel if level has balance", async function () {
			await LearnAndEarn.connect(owner).addLevel(1, cUSD.address);

			await LearnAndEarn.connect(user1).fundLevel(1, 100);

			await LearnAndEarn.connect(owner)
				.updateLevel(1, PACT.address)
				.should.be.rejectedWith(
					"LearnAndLearn::updateLevel: This level has funds"
				);
		});

		it("Should not updateLevel if level does not exist", async function () {
			await LearnAndEarn.connect(owner).addLevel(1, cUSD.address);

			await LearnAndEarn.connect(owner)
				.updateLevel(2, PACT.address)
				.should.be.rejectedWith(
					"LearnAndLearn::updateLevel: Invalid level id"
				);
		});

		it("Should not updateLevel if level is paused", async function () {
			await LearnAndEarn.connect(owner).addLevel(1, cUSD.address);
			await LearnAndEarn.connect(owner).pauseLevel(1);

			await LearnAndEarn.connect(owner)
				.updateLevel(1, PACT.address)
				.should.be.rejectedWith(
					"LearnAndLearn::updateLevel: Invalid level id"
				);
		});

		it("Should not updateLevel if level is canceled", async function () {
			await LearnAndEarn.connect(owner).addLevel(1, cUSD.address);
			await LearnAndEarn.connect(owner).cancelLevel(1, user1.address);

			await LearnAndEarn.connect(owner)
				.updateLevel(1, PACT.address)
				.should.be.rejectedWith(
					"LearnAndLearn::updateLevel: Invalid level id"
				);
		});
	});

	describe("LearnAndEarn - Claim", () => {
		const level1InitialBalance = toEther(1001);
		const level2InitialBalance = toEther(1002);
		const level3InitialBalance = toEther(1003);
		const level11InitialBalance = toEther(2001);
		const level12InitialBalance = toEther(2002);
		const level13InitialBalance = toEther(2003);

		const learnAndEarnInitialBalanceCUSD = level1InitialBalance
			.add(level2InitialBalance)
			.add(level3InitialBalance);

		const learnAndEarnInitialBalancePACT = level11InitialBalance
			.add(level12InitialBalance)
			.add(level13InitialBalance);

		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await LearnAndEarn.connect(owner).addLevel(1, cUSD.address);
			await LearnAndEarn.connect(owner).addLevel(2, cUSD.address);
			await LearnAndEarn.connect(owner).addLevel(3, cUSD.address);
			await LearnAndEarn.connect(owner).addLevel(11, PACT.address);
			await LearnAndEarn.connect(owner).addLevel(12, PACT.address);
			await LearnAndEarn.connect(owner).addLevel(13, PACT.address);

			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, learnAndEarnInitialBalanceCUSD);

			await PACT.connect(user1).approve(
				LearnAndEarn.address,
				learnAndEarnInitialBalancePACT
			);

			await LearnAndEarn.connect(user1).fundLevel(
				1,
				level1InitialBalance
			);
			await LearnAndEarn.connect(user1).fundLevel(
				2,
				level2InitialBalance
			);
			await LearnAndEarn.connect(user1).fundLevel(
				3,
				level3InitialBalance
			);
			await LearnAndEarn.connect(user1).fundLevel(
				11,
				level11InitialBalance
			);
			await LearnAndEarn.connect(user1).fundLevel(
				12,
				level12InitialBalance
			);
			await LearnAndEarn.connect(user1).fundLevel(
				13,
				level13InitialBalance
			);
		});

		it("Should claim reward", async function () {
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1],
					[rewardAmount],
					[signedMessage]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1);

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				rewardAmount
			);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(
				level1InitialBalance.sub(rewardAmount)
			);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance.add(rewardAmount)
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD.sub(rewardAmount)
			);
		});

		it("Should claim rewards for multiple levels, multiple claims", async function () {
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				2,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[2],
					[rewardAmount2],
					[signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 2);

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				rewardAmount1
			);
			(await LearnAndEarn.levelClaims(2, beneficiary1.address)).should.eq(
				rewardAmount2
			);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(
				level1InitialBalance.sub(rewardAmount1)
			);

			const level2 = await LearnAndEarn.levels(2);
			level2.balance.should.be.equal(
				level2InitialBalance.sub(rewardAmount2)
			);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance.add(rewardAmount1).add(rewardAmount2)
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
					.sub(rewardAmount1)
					.sub(rewardAmount2)
			);
		});

		it("Should claim rewards for multiple levels one transaction, same token", async function () {
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				2,
				rewardAmount2
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1, 2],
					[rewardAmount1, rewardAmount2],
					[signedMessage1, signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1)
				.withArgs(beneficiary1.address, 2);

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				rewardAmount1
			);
			(await LearnAndEarn.levelClaims(2, beneficiary1.address)).should.eq(
				rewardAmount2
			);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(
				level1InitialBalance.sub(rewardAmount1)
			);

			const level2 = await LearnAndEarn.levels(2);
			level2.balance.should.be.equal(
				level2InitialBalance.sub(rewardAmount2)
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
					.sub(rewardAmount1)
					.sub(rewardAmount2)
			);
		});

		it("Should claim rewards for multiple levels one transaction, different token", async function () {
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				11,
				rewardAmount2
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1, 11],
					[rewardAmount1, rewardAmount2],
					[signedMessage1, signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1)
				.withArgs(beneficiary1.address, 11);

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				rewardAmount1
			);
			(
				await LearnAndEarn.levelClaims(11, beneficiary1.address)
			).should.eq(rewardAmount2);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(
				level1InitialBalance.sub(rewardAmount1)
			);

			const level11 = await LearnAndEarn.levels(11);
			level11.balance.should.be.equal(
				level11InitialBalance.sub(rewardAmount2)
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD.sub(rewardAmount1)
			);

			(await PACT.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalancePACT.sub(rewardAmount2)
			);
		});

		it("Should multiple beneficiaries claim rewards for same level", async function () {
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary2,
				1,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary2.address,
					[1],
					[rewardAmount2],
					[signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary2.address, 1);

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				rewardAmount1
			);
			(await LearnAndEarn.levelClaims(1, beneficiary2.address)).should.eq(
				rewardAmount2
			);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(
				level1InitialBalance.sub(rewardAmount1).sub(rewardAmount2)
			);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance.add(rewardAmount1)
			);
			(await cUSD.balanceOf(beneficiary2.address)).should.eq(
				beneficiary1InitialBalance.add(rewardAmount2)
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
					.sub(rewardAmount1)
					.sub(rewardAmount2)
			);
		});

		it("Should one beneficiary not claim multiple times for same level #1", async function () {
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1);

			await LearnAndEarn.connect(user2).claimRewardForLevels(
				beneficiary1.address,
				[1],
				[rewardAmount2],
				[signedMessage2]
			).should.be.fulfilled;

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				rewardAmount1
			);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(
				level1InitialBalance.sub(rewardAmount1)
			);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance.add(rewardAmount1)
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD.sub(rewardAmount1)
			);
		});

		it("Should one beneficiary not claim multiple times for same level #2", async function () {
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				2,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1);

			const rewardAmount3 = toEther(30);

			const signedMessage3 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount3
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1, 2],
					[rewardAmount3, rewardAmount2],
					[signedMessage3, signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 2);

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				rewardAmount1
			);
			(await LearnAndEarn.levelClaims(2, beneficiary1.address)).should.eq(
				rewardAmount2
			);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(
				level1InitialBalance.sub(rewardAmount1)
			);

			const level2 = await LearnAndEarn.levels(2);
			level2.balance.should.be.equal(
				level2InitialBalance.sub(rewardAmount2)
			);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance.add(rewardAmount1).add(rewardAmount2)
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
					.sub(rewardAmount1)
					.sub(rewardAmount2)
			);
		});

		it("Should not claim reward if there are not enough funds into the level", async function () {
			const rewardAmount = level1InitialBalance.add(1);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Level doesn't have enough funds"
				);

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				0
			);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(level1InitialBalance);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
			);
		});

		it("Should not claim reward if level is not valid", async function () {
			const rewardAmount = toEther(10);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				4,
				rewardAmount
			);

			await LearnAndEarn.pauseLevel(1);
			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount
			);

			await LearnAndEarn.cancelLevel(2, user1.address);
			const signedMessage3 = await signParams(
				signerWallet,
				beneficiary1,
				2,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[4],
					[rewardAmount],
					[signedMessage1]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid level id"
				);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1],
					[rewardAmount],
					[signedMessage2]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid level id"
				);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[2],
					[rewardAmount],
					[signedMessage3]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid level id"
				);

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				0
			);
			(await LearnAndEarn.levelClaims(2, beneficiary1.address)).should.eq(
				0
			);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(level1InitialBalance);

			const level2 = await LearnAndEarn.levels(2);
			level2.balance.should.be.equal(0);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD.sub(level2InitialBalance)
			);
		});

		it("Should not claim if signer is not valid", async function () {
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				user1,
				beneficiary1,
				1,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid signature"
				);

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				0
			);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(level1InitialBalance);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
			);
		});

		it("Should not claim reward if the signature is invalid #beneficiary", async function () {
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);
			const beneficiary2InitialBalance = await cUSD.balanceOf(
				beneficiary2.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary2.address,
					[1],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid signature"
				);

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				0
			);
			(await LearnAndEarn.levelClaims(1, beneficiary2.address)).should.eq(
				0
			);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(level1InitialBalance);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);
			(await cUSD.balanceOf(beneficiary2.address)).should.eq(
				beneficiary2InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
			);
		});

		it("Should not claim reward if the signature is invalid #levelId", async function () {
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[2],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid signature"
				);

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				0
			);
			(await LearnAndEarn.levelClaims(2, beneficiary1.address)).should.eq(
				0
			);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(level1InitialBalance);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
			);
		});

		it("Should not claim reward if the signature is invalid #rewardAmount", async function () {
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				1,
				rewardAmount1
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1],
					[rewardAmount2],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid signature"
				);

			(await LearnAndEarn.levelClaims(1, beneficiary1.address)).should.eq(
				0
			);

			const level1 = await LearnAndEarn.levels(1);
			level1.balance.should.be.equal(level1InitialBalance);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
			);
		});

		it("Should reject when calling claim with less levelIds", async function () {
			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				1,
				toEther(10)
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1],
					[1, 2],
					[signedMessage, signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid data"
				);
		});

		it("Should reject when calling claim with less rewardAmounts", async function () {
			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				1,
				toEther(10)
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1, 2],
					[1],
					[signedMessage, signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid data"
				);
		});

		it("Should reject when calling claim with less signatures", async function () {
			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				1,
				toEther(10)
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					[1, 2],
					[1, 2],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid data"
				);
		});
	});
});
