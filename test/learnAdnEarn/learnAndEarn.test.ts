import chai from "chai";
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
const expect = chai.expect;

describe.only("LearnAndEarn", () => {
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
		signerManager: SignerWithAddress,
		beneficiary: SignerWithAddress,
		programId: number,
		levelId: number,
		rewardAmount: BigNumber
	): Promise<string> {
		const message = ethers.utils.solidityKeccak256(
			["address", "uint256", "uint256", "uint256"],
			[beneficiary.address, programId, levelId, rewardAmount]
		);
		const arrayifyMessage = ethers.utils.arrayify(message);
		return signerManager.signMessage(arrayifyMessage);
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

	describe("LearnAndEarn - Program", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();
		});

		it("Should add program if owner", async function () {
			await LearnAndEarn.connect(owner)
				.addProgram(123, "program name", cUSD.address)
				.should.emit(LearnAndEarn, "ProgramAdded")
				.withArgs(123);

			const program = await LearnAndEarn.programs(123);
			program.token.should.be.equal(cUSD.address);
			program.name.should.be.equal("program name");
		});

		it("Should add program if ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(impactMarketCouncil)
				.addProgram(123, "program name", cUSD.address)
				.should.emit(LearnAndEarn, "ProgramAdded")
				.withArgs(123);

			const program = await LearnAndEarn.programs(123);
			program.token.should.be.equal(cUSD.address);
			program.name.should.be.equal("program name");
		});

		it("Should not add program if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(signerWallet)
				.addProgram(123, "program name 1", cUSD.address)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);
		});

		it("Should not re-add program ", async function () {
			await LearnAndEarn.connect(owner).addProgram(
				123,
				"program name 1",
				cUSD.address
			);

			await LearnAndEarn.connect(owner)
				.addProgram(123, "program name 1", cUSD.address)
				.should.be.rejectedWith(
					"LearnAndLearn::addProgram: Invalid program id"
				);
		});

		it("Should add multiple programs if owner", async function () {
			await LearnAndEarn.connect(owner).addProgram(
				1,
				"program 1 name",
				cUSD.address
			).should.be.fulfilled;
			await LearnAndEarn.connect(owner).addProgram(
				2,
				"program 2 name",
				cUSD.address
			).should.be.fulfilled;
			await LearnAndEarn.connect(owner).addProgram(
				3,
				"program 3 name",
				cUSD.address
			).should.be.fulfilled;

			let program = await LearnAndEarn.programs(1);
			program.token.should.be.equal(cUSD.address);
			program.name.should.be.equal("program 1 name");

			program = await LearnAndEarn.programs(2);
			program.token.should.be.equal(cUSD.address);
			program.name.should.be.equal("program 2 name");

			program = await LearnAndEarn.programs(3);
			program.token.should.be.equal(cUSD.address);
			program.name.should.be.equal("program 3 name");
		});
	});

	describe("LearnAndEarn - add program level", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await LearnAndEarn.connect(owner).addProgram(
				1,
				"program 1 name",
				cUSD.address
			);
			await LearnAndEarn.connect(owner).addProgram(
				2,
				"program 2 name",
				cUSD.address
			);
			await LearnAndEarn.connect(owner).addProgram(
				3,
				"program 3 name",
				cUSD.address
			);
		});

		it("Should add program level if owner", async function () {
			await LearnAndEarn.connect(owner)
				.addProgramLevel(1, 1)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, 1, LevelState.Valid);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.balance.should.be.equal(0);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should add program level if ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(owner)
				.addProgramLevel(1, 1)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, 1, LevelState.Valid);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.balance.should.be.equal(0);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should not add program level if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(signerWallet)
				.addProgramLevel(1, 1)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);
		});

		it("Should add multiple program levels", async function () {
			await LearnAndEarn.connect(owner)
				.addProgramLevel(1, 1)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, 1, LevelState.Valid);
			await LearnAndEarn.connect(owner)
				.addProgramLevel(1, 2)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, 2, LevelState.Valid);
			await LearnAndEarn.connect(owner)
				.addProgramLevel(1, 3)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, 3, LevelState.Valid);

			const level1 = await LearnAndEarn.programLevels(1, 1);
			level1.balance.should.be.equal(0);
			level1.state.should.be.equal(LevelState.Valid);

			const level2 = await LearnAndEarn.programLevels(1, 2);
			level2.balance.should.be.equal(0);
			level2.state.should.be.equal(LevelState.Valid);

			const level3 = await LearnAndEarn.programLevels(1, 3);
			level3.balance.should.be.equal(0);
			level3.state.should.be.equal(LevelState.Valid);
		});

		it("Should add multiple program levels #2", async function () {
			await LearnAndEarn.connect(owner).addProgramLevel(1, 1);
			await LearnAndEarn.connect(owner).addProgramLevel(1, 2);
			await LearnAndEarn.connect(owner).addProgramLevel(1, 3);

			await LearnAndEarn.connect(owner).addProgramLevel(2, 1);

			await LearnAndEarn.connect(owner).addProgramLevel(3, 1);
			await LearnAndEarn.connect(owner).addProgramLevel(3, 2);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(0);
			program1Level1.state.should.be.equal(LevelState.Valid);

			const program1Level2 = await LearnAndEarn.programLevels(1, 2);
			program1Level2.balance.should.be.equal(0);
			program1Level2.state.should.be.equal(LevelState.Valid);

			const program1Level3 = await LearnAndEarn.programLevels(1, 3);
			program1Level3.balance.should.be.equal(0);
			program1Level3.state.should.be.equal(LevelState.Valid);

			const program2Level1 = await LearnAndEarn.programLevels(2, 1);
			program2Level1.balance.should.be.equal(0);
			program2Level1.state.should.be.equal(LevelState.Valid);

			const program3Level1 = await LearnAndEarn.programLevels(3, 1);
			program3Level1.balance.should.be.equal(0);
			program3Level1.state.should.be.equal(LevelState.Valid);

			const program3Level2 = await LearnAndEarn.programLevels(3, 2);
			program3Level2.balance.should.be.equal(0);
			program3Level2.state.should.be.equal(LevelState.Valid);
		});
	});

	describe("LearnAndEarn - manage program level", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await LearnAndEarn.connect(owner).addProgram(
				1,
				"program 1 name",
				cUSD.address
			);
			await LearnAndEarn.connect(owner).addProgram(
				2,
				"program 2 name",
				cUSD.address
			);
			await LearnAndEarn.connect(owner).addProgram(
				3,
				"program 3 name",
				cUSD.address
			);

			await LearnAndEarn.connect(owner).addProgramLevel(1, 1);
			await LearnAndEarn.connect(owner).addProgramLevel(1, 2);
			await LearnAndEarn.connect(owner).addProgramLevel(1, 3);

			await LearnAndEarn.connect(owner).addProgramLevel(2, 1);
			await LearnAndEarn.connect(owner).addProgramLevel(2, 2);
			await LearnAndEarn.connect(owner).addProgramLevel(2, 3);

			await LearnAndEarn.connect(owner).addProgramLevel(3, 1);
			await LearnAndEarn.connect(owner).addProgramLevel(3, 2);
			await LearnAndEarn.connect(owner).addProgramLevel(3, 3);
		});

		it("Should pause program level if owner", async function () {
			await LearnAndEarn.pauseProgramLevel(1, 1)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, 1, LevelState.Paused);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.state.should.be.equal(LevelState.Paused);
		});

		it("Should pause program level  if ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(impactMarketCouncil)
				.pauseProgramLevel(1, 1)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, 1, LevelState.Paused);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.state.should.be.equal(LevelState.Paused);
		});

		it("Should not pause program level if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(signerWallet)
				.pauseProgramLevel(1, 1)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should not pause program level if program is not valid", async function () {
			await LearnAndEarn.pauseProgramLevel(4, 1).should.be.rejectedWith(
				"LearnAndEarn::pauseProgram: Invalid program level id"
			);

			await LearnAndEarn.pauseProgramLevel(1, 4).should.be.rejectedWith(
				"LearnAndEarn::pauseProgram: Invalid program level id"
			);

			await LearnAndEarn.pauseProgramLevel(1, 1);
			await LearnAndEarn.pauseProgramLevel(1, 1).should.be.rejectedWith(
				"LearnAndEarn::pauseProgram: Invalid program level id"
			);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.state.should.be.equal(LevelState.Paused);
		});

		it("Should unpause program level if owner", async function () {
			await LearnAndEarn.pauseProgramLevel(1, 1);

			await LearnAndEarn.unpauseProgramLevel(1, 1)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, 1, LevelState.Valid);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should unpause program level if ImpactMarketCouncil", async function () {
			await LearnAndEarn.pauseProgramLevel(1, 1);

			await LearnAndEarn.connect(impactMarketCouncil)
				.unpauseProgramLevel(1, 1)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, 1, LevelState.Valid);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should not unpause program level if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.pauseProgramLevel(1, 1);

			await LearnAndEarn.connect(signerWallet)
				.unpauseProgramLevel(1, 1)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.state.should.be.equal(LevelState.Paused);
		});

		it("Should not unpause program level if the program is not paused", async function () {
			await LearnAndEarn.unpauseProgramLevel(1, 1).should.be.rejectedWith(
				"LearnAndEarn::unpauseProgram: Invalid program level id"
			);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should fund a program level", async function () {
			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100));
			await LearnAndEarn.connect(user1)
				.fundProgramLevel(1, 1, toEther(100))
				.should.emit(LearnAndEarn, "ProgramLevelFunded")
				.withArgs(1, 1, user1.address, toEther(100));

			const level = await LearnAndEarn.programLevels(1, 1);
			level.balance.should.be.equal(toEther(100));

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				toEther(100)
			);
		});

		it("Should fund program level multiple times", async function () {
			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(1000));
			await cUSD
				.connect(user2)
				.approve(LearnAndEarn.address, toEther(1000));

			await LearnAndEarn.connect(user1)
				.fundProgramLevel(1, 1, toEther(100))
				.should.emit(LearnAndEarn, "ProgramLevelFunded")
				.withArgs(1, 1, user1.address, toEther(100));

			await LearnAndEarn.connect(user2)
				.fundProgramLevel(1, 1, toEther(100))
				.should.emit(LearnAndEarn, "ProgramLevelFunded")
				.withArgs(1, 1, user2.address, toEther(100));

			await LearnAndEarn.connect(user1)
				.fundProgramLevel(1, 1, toEther(100))
				.should.emit(LearnAndEarn, "ProgramLevelFunded")
				.withArgs(1, 1, user1.address, toEther(100));

			await LearnAndEarn.connect(user1)
				.fundProgramLevel(1, 2, toEther(100))
				.should.emit(LearnAndEarn, "ProgramLevelFunded")
				.withArgs(1, 2, user1.address, toEther(100));

			await LearnAndEarn.connect(user2)
				.fundProgramLevel(1, 2, toEther(100))
				.should.emit(LearnAndEarn, "ProgramLevelFunded")
				.withArgs(1, 2, user2.address, toEther(100));

			const level1 = await LearnAndEarn.programLevels(1, 1);
			level1.balance.should.be.equal(toEther(300));
			const level2 = await LearnAndEarn.programLevels(1, 2);
			level2.balance.should.be.equal(toEther(200));

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				toEther(500)
			);
		});

		it("Should fund a paused program level", async function () {
			await LearnAndEarn.pauseProgramLevel(1, 1);

			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100));
			await LearnAndEarn.connect(user1)
				.fundProgramLevel(1, 1, toEther(100))
				.should.emit(LearnAndEarn, "ProgramLevelFunded")
				.withArgs(1, 1, user1.address, toEther(100));

			const level = await LearnAndEarn.programLevels(1, 1);
			level.balance.should.be.equal(toEther(100));
		});

		it("Should not fund an invalid program level", async function () {
			await LearnAndEarn.connect(user1)
				.fundProgramLevel(4, 1, toEther(100))
				.should.be.rejectedWith(
					"LearnAndEarn::fundProgram: Invalid program level id"
				);

			await LearnAndEarn.connect(user1)
				.fundProgramLevel(1, 4, toEther(100))
				.should.be.rejectedWith(
					"LearnAndEarn::fundProgram: Invalid program level id"
				);
		});

		it("Should cancel a program level if owner", async function () {
			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100));
			await LearnAndEarn.connect(user1).fundProgramLevel(
				1,
				2,
				toEther(100)
			);

			const user1Balance = await cUSD.balanceOf(user1.address);
			await LearnAndEarn.connect(owner)
				.cancelProgramLevel(1, 2, user1.address)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, 2, LevelState.Canceled);

			const level1 = await LearnAndEarn.programLevels(1, 1);
			level1.balance.should.be.equal(0);
			level1.state.should.be.equal(LevelState.Valid);

			const level2 = await LearnAndEarn.programLevels(1, 2);
			level2.balance.should.be.equal(0);
			level2.state.should.be.equal(LevelState.Canceled);

			(await cUSD.balanceOf(user1.address)).should.eq(
				user1Balance.add(toEther(100))
			);
		});

		it("Should cancel a program level if impactMarketCouncil", async function () {
			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100));
			await LearnAndEarn.connect(user1).fundProgramLevel(
				1,
				2,
				toEther(100)
			);

			const user1Balance = await cUSD.balanceOf(user1.address);
			await LearnAndEarn.connect(impactMarketCouncil)
				.cancelProgramLevel(1, 2, user1.address)
				.should.emit(LearnAndEarn, "LevelStateChanged")
				.withArgs(1, 2, LevelState.Canceled);

			const level1 = await LearnAndEarn.programLevels(1, 1);
			level1.balance.should.be.equal(0);
			level1.state.should.be.equal(LevelState.Valid);

			const level2 = await LearnAndEarn.programLevels(1, 2);
			level2.balance.should.be.equal(0);
			level2.state.should.be.equal(LevelState.Canceled);

			(await cUSD.balanceOf(user1.address)).should.eq(
				user1Balance.add(toEther(100))
			);
		});

		it("Should not cancel program level if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(signerWallet)
				.cancelProgramLevel(1, 1, user1.address)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.state.should.be.equal(LevelState.Valid);
		});

		it("Should not fund a canceled program level", async function () {
			await LearnAndEarn.connect(owner).cancelProgramLevel(
				1,
				1,
				user1.address
			);

			await LearnAndEarn.connect(user1)
				.fundProgramLevel(1, 1, toEther(100))
				.should.be.rejectedWith(
					"LearnAndEarn::fundProgram: Invalid program level id"
				);
		});

		it("Should not unpause program level if the program is canceled", async function () {
			await LearnAndEarn.connect(owner).cancelProgramLevel(
				1,
				1,
				user1.address
			);

			await LearnAndEarn.unpauseProgramLevel(1, 1).should.be.rejectedWith(
				"LearnAndEarn::unpauseProgram: Invalid program level id"
			);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.state.should.be.equal(LevelState.Canceled);
		});

		it("Should not pause program level if the program is canceled", async function () {
			await LearnAndEarn.connect(owner).cancelProgramLevel(
				1,
				1,
				user1.address
			);

			await LearnAndEarn.pauseProgramLevel(1, 1).should.be.rejectedWith(
				"LearnAndEarn::pauseProgram: Invalid program level id"
			);

			const level = await LearnAndEarn.programLevels(1, 1);
			level.state.should.be.equal(LevelState.Canceled);
		});
	});

	describe("LearnAndEarn - Claim", () => {
		const program1Level1InitialBalance = toEther(1001);
		const program1Level2InitialBalance = toEther(1002);
		const program1Level3InitialBalance = toEther(1003);
		const program2Level1InitialBalance = toEther(2001);
		const program2Level2InitialBalance = toEther(2002);
		const program2Level3InitialBalance = toEther(2003);
		const program3Level1InitialBalance = toEther(3001);
		const program3Level2InitialBalance = toEther(3002);
		const program3Level3InitialBalance = toEther(3003);

		const learnAndEarnInitialBalanceCUSD = program1Level1InitialBalance
			.add(program1Level2InitialBalance)
			.add(program1Level3InitialBalance)
			.add(program2Level1InitialBalance)
			.add(program2Level2InitialBalance)
			.add(program2Level3InitialBalance);
		const learnAndEarnInitialBalancePACT = program3Level1InitialBalance
			.add(program3Level2InitialBalance)
			.add(program3Level3InitialBalance);

		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await LearnAndEarn.connect(owner).addProgram(
				1,
				"name1",
				cUSD.address
			);
			await LearnAndEarn.connect(owner).addProgram(
				2,
				"name2",
				cUSD.address
			);
			await LearnAndEarn.connect(owner).addProgram(
				3,
				"name3",
				PACT.address
			);

			await LearnAndEarn.connect(owner).addProgramLevel(1, 1);
			await LearnAndEarn.connect(owner).addProgramLevel(1, 2);
			await LearnAndEarn.connect(owner).addProgramLevel(1, 3);

			await LearnAndEarn.connect(owner).addProgramLevel(2, 1);
			await LearnAndEarn.connect(owner).addProgramLevel(2, 2);
			await LearnAndEarn.connect(owner).addProgramLevel(2, 3);

			await LearnAndEarn.connect(owner).addProgramLevel(3, 1);
			await LearnAndEarn.connect(owner).addProgramLevel(3, 2);
			await LearnAndEarn.connect(owner).addProgramLevel(3, 3);

			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, learnAndEarnInitialBalanceCUSD);
			await PACT.connect(user1).approve(
				LearnAndEarn.address,
				learnAndEarnInitialBalancePACT
			);

			await LearnAndEarn.connect(user1).fundProgramLevel(
				1,
				1,
				program1Level1InitialBalance
			);
			await LearnAndEarn.connect(user1).fundProgramLevel(
				1,
				2,
				program1Level2InitialBalance
			);
			await LearnAndEarn.connect(user1).fundProgramLevel(
				1,
				3,
				program1Level3InitialBalance
			);
			await LearnAndEarn.connect(user1).fundProgramLevel(
				2,
				1,
				program2Level1InitialBalance
			);
			await LearnAndEarn.connect(user1).fundProgramLevel(
				2,
				2,
				program2Level2InitialBalance
			);
			await LearnAndEarn.connect(user1).fundProgramLevel(
				2,
				3,
				program2Level3InitialBalance
			);
			await LearnAndEarn.connect(user1).fundProgramLevel(
				3,
				1,
				program3Level1InitialBalance
			);
			await LearnAndEarn.connect(user1).fundProgramLevel(
				3,
				2,
				program3Level2InitialBalance
			);
			await LearnAndEarn.connect(user1).fundProgramLevel(
				3,
				3,
				program3Level3InitialBalance
			);
		});

		it("Should claim reward", async function () {
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				1,
				1,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1],
					[rewardAmount],
					[signedMessage]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1, 1);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(rewardAmount);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance.sub(rewardAmount)
			);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance.add(rewardAmount)
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD.sub(rewardAmount)
			);
		});

		it("Should claim rewards for multiple levels for same program multiple transactions", async function () {
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				2,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1, 1);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[2],
					[rewardAmount2],
					[signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1, 2);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);
			(
				await LearnAndEarn.programLevelClaims(
					1,
					2,
					beneficiary1.address
				)
			).should.eq(rewardAmount2);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance.sub(rewardAmount1)
			);

			const program1Level2 = await LearnAndEarn.programLevels(1, 2);
			program1Level2.balance.should.be.equal(
				program1Level2InitialBalance.sub(rewardAmount2)
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

		it("Should claim rewards for multiple levels for same program one transactions", async function () {
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				2,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1, 2],
					[rewardAmount1, rewardAmount2],
					[signedMessage1, signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1, 1)
				.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1, 2);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);
			(
				await LearnAndEarn.programLevelClaims(
					1,
					2,
					beneficiary1.address
				)
			).should.eq(rewardAmount2);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance.sub(rewardAmount1)
			);

			const program1Level2 = await LearnAndEarn.programLevels(1, 2);
			program1Level2.balance.should.be.equal(
				program1Level2InitialBalance.sub(rewardAmount2)
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
					.sub(rewardAmount1)
					.sub(rewardAmount2)
			);
		});

		it("Should claim rewards for multiple programs #1", async function () {
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				2,
				1,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1, 1);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					2,
					[1],
					[rewardAmount2],
					[signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 2, 1);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);
			(
				await LearnAndEarn.programLevelClaims(
					2,
					1,
					beneficiary1.address
				)
			).should.eq(rewardAmount2);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance.sub(rewardAmount1)
			);

			const program2Level1 = await LearnAndEarn.programLevels(2, 1);
			program2Level1.balance.should.be.equal(
				program2Level1InitialBalance.sub(rewardAmount2)
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

		it("Should claim rewards for multiple programs #2", async function () {
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				3,
				1,
				rewardAmount2
			);

			const beneficiary1InitialBalanceCUSD = await cUSD.balanceOf(
				beneficiary1.address
			);
			const beneficiary1InitialBalancePACT = await PACT.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1, 1);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					3,
					[1],
					[rewardAmount2],
					[signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 3, 1);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);
			(
				await LearnAndEarn.programLevelClaims(
					3,
					1,
					beneficiary1.address
				)
			).should.eq(rewardAmount2);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance.sub(rewardAmount1)
			);

			const program3Level1 = await LearnAndEarn.programLevels(3, 1);
			program3Level1.balance.should.be.equal(
				program3Level1InitialBalance.sub(rewardAmount2)
			);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalanceCUSD.add(rewardAmount1)
			);
			(await PACT.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalancePACT.add(rewardAmount2)
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD.sub(rewardAmount1)
			);
			(await PACT.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalancePACT.sub(rewardAmount2)
			);
		});

		it("Should multiple beneficiaries claim rewards for same program level", async function () {
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary2,
				1,
				1,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1, 1);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary2.address,
					1,
					[1],
					[rewardAmount2],
					[signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary2.address, 1, 1);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);
			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary2.address
				)
			).should.eq(rewardAmount2);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance
					.sub(rewardAmount1)
					.sub(rewardAmount2)
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
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				1,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1, 1);

			await LearnAndEarn.connect(user2).claimRewardForLevels(
				beneficiary1.address,
				1,
				[1],
				[rewardAmount2],
				[signedMessage2]
			).should.be.fulfilled;

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance.sub(rewardAmount1)
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
				1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				2,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1, 1);

			const rewardAmount3 = toEther(30);

			const signedMessage3 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				1,
				rewardAmount3
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1, 2],
					[rewardAmount3, rewardAmount2],
					[signedMessage3, signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, 1, 2);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);
			(
				await LearnAndEarn.programLevelClaims(
					1,
					2,
					beneficiary1.address
				)
			).should.eq(rewardAmount2);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance.sub(rewardAmount1)
			);

			const program1Level2 = await LearnAndEarn.programLevels(1, 2);
			program1Level2.balance.should.be.equal(
				program1Level2InitialBalance.sub(rewardAmount2)
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

		it("Should not claim reward if there are not enough funds into the program", async function () {
			const rewardAmount = program1Level1InitialBalance.add(1);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				1,
				1,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Program level doesn't have enough funds"
				);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(0);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance
			);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
			);
		});

		it("Should not claim reward if program level is not valid", async function () {
			const rewardAmount = toEther(10);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				4,
				rewardAmount
			);

			await LearnAndEarn.pauseProgramLevel(1, 1);
			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				1,
				1,
				rewardAmount
			);

			await LearnAndEarn.cancelProgramLevel(2, 1, user1.address);
			const signedMessage3 = await signParams(
				signerWallet,
				beneficiary1,
				2,
				1,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[4],
					[rewardAmount],
					[signedMessage1]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid program level id"
				);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1],
					[rewardAmount],
					[signedMessage2]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid program level id"
				);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					2,
					[1],
					[rewardAmount],
					[signedMessage3]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid program level id"
				);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(0);
			(
				await LearnAndEarn.programLevelClaims(
					2,
					1,
					beneficiary1.address
				)
			).should.eq(0);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance
			);

			const program2Level1 = await LearnAndEarn.programLevels(2, 1);
			program2Level1.balance.should.be.equal(0);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD.sub(program2Level1InitialBalance)
			);
		});

		it("Should not claim if signer is not valid", async function () {
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				user1,
				beneficiary1,
				1,
				1,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid signature"
				);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(0);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance
			);

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
					1,
					[1],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid signature"
				);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(0);
			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary2.address
				)
			).should.eq(0);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance
			);

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

		it("Should not claim reward if the signature is invalid #progrramId", async function () {
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				1,
				1,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					2,
					[1],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid signature"
				);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(0);
			(
				await LearnAndEarn.programLevelClaims(
					2,
					1,
					beneficiary1.address
				)
			).should.eq(0);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance
			);

			const program2Level1 = await LearnAndEarn.programLevels(2, 1);
			program2Level1.balance.should.be.equal(
				program2Level1InitialBalance
			);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
			);
		});

		it("Should not claim reward if the signature is invalid #1", async function () {
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				1,
				1,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[2],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid signature"
				);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(0);
			(
				await LearnAndEarn.programLevelClaims(
					1,
					2,
					beneficiary1.address
				)
			).should.eq(0);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance
			);

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
				1,
				rewardAmount1
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
					[1],
					[rewardAmount2],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimRewardForLevels: Invalid signature"
				);

			(
				await LearnAndEarn.programLevelClaims(
					1,
					1,
					beneficiary1.address
				)
			).should.eq(0);

			const program1Level1 = await LearnAndEarn.programLevels(1, 1);
			program1Level1.balance.should.be.equal(
				program1Level1InitialBalance
			);

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
				1,
				toEther(10)
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
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
				1,
				toEther(10)
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
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
				1,
				toEther(10)
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForLevels(
					beneficiary1.address,
					1,
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
