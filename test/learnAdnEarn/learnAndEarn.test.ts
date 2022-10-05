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

	enum ProgramState {
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
		courseId: number,
		rewardAmount: BigNumber
	): Promise<string> {
		const message = ethers.utils.solidityKeccak256(
			["address", "uint256", "uint256", "uint256"],
			[beneficiary.address, programId, courseId, rewardAmount]
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
			(await LearnAndEarn.programListLength()).should.be.equal(0);

			await LearnAndEarn.connect(owner)
				.addProgram(123, cUSD.address)
				.should.emit(LearnAndEarn, "ProgramStateChanged")
				.withArgs(123, ProgramState.Valid);

			(await LearnAndEarn.programListLength()).should.be.equal(1);
			(await LearnAndEarn.programListAt(0)).should.be.equal(123);

			const program = await LearnAndEarn.programs(123);
			program.token.should.be.equal(cUSD.address);
			program.state.should.be.equal(ProgramState.Valid);
			program.balance.should.be.equal(0);
		});

		it("Should add program if ImpactMarketCouncil", async function () {
			(await LearnAndEarn.programListLength()).should.be.equal(0);

			await LearnAndEarn.connect(impactMarketCouncil)
				.addProgram(123, cUSD.address)
				.should.emit(LearnAndEarn, "ProgramStateChanged")
				.withArgs(123, ProgramState.Valid);
			(await LearnAndEarn.programListLength()).should.be.equal(1);
			(await LearnAndEarn.programListAt(0)).should.be.equal(123);

			const program = await LearnAndEarn.programs(123);
			program.token.should.be.equal(cUSD.address);
			program.state.should.be.equal(ProgramState.Valid);
			program.balance.should.be.equal(0);
		});

		it("Should not add program if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(signerWallet)
				.addProgram(123, cUSD.address)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);
			(await LearnAndEarn.programListLength()).should.be.equal(0);

			const program = await LearnAndEarn.programs(123);
			program.state.should.be.equal(ProgramState.Invalid);
		});

		it("Should add multiple programs if owner", async function () {
			(await LearnAndEarn.programListLength()).should.be.equal(0);

			await LearnAndEarn.connect(owner).addProgram(101, cUSD.address)
				.should.be.fulfilled;
			await LearnAndEarn.connect(owner).addProgram(102, cUSD.address)
				.should.be.fulfilled;
			await LearnAndEarn.connect(owner).addProgram(103, cUSD.address)
				.should.be.fulfilled;

			(await LearnAndEarn.programListLength()).should.be.equal(3);
			(await LearnAndEarn.programListAt(0)).should.be.equal(101);
			(await LearnAndEarn.programListAt(1)).should.be.equal(102);
			(await LearnAndEarn.programListAt(2)).should.be.equal(103);

			let program = await LearnAndEarn.programs(101);
			program.token.should.be.equal(cUSD.address);
			program.state.should.be.equal(ProgramState.Valid);
			program.balance.should.be.equal(0);

			program = await LearnAndEarn.programs(102);
			program.token.should.be.equal(cUSD.address);
			program.state.should.be.equal(ProgramState.Valid);
			program.balance.should.be.equal(0);

			program = await LearnAndEarn.programs(103);
			program.token.should.be.equal(cUSD.address);
			program.state.should.be.equal(ProgramState.Valid);
			program.balance.should.be.equal(0);
		});

		it("Should not add program with same id", async function () {
			await LearnAndEarn.connect(owner).addProgram(101, cUSD.address);

			await LearnAndEarn.connect(owner)
				.addProgram(101, cUSD.address)
				.should.be.rejectedWith(
					"LearnAndEarn::addProgram: Program id must be unique"
				);
			(await LearnAndEarn.programListLength()).should.be.equal(1);
		});

		it("Should pause program if owner", async function () {
			await LearnAndEarn.addProgram(101, cUSD.address);

			await LearnAndEarn.pauseProgram(101)
				.should.emit(LearnAndEarn, "ProgramStateChanged")
				.withArgs(101, ProgramState.Paused);

			let program = await LearnAndEarn.programs(101);
			program.state.should.be.equal(ProgramState.Paused);
		});

		it("Should pause program if ImpactMarketCouncil", async function () {
			await LearnAndEarn.addProgram(101, cUSD.address);

			await LearnAndEarn.connect(impactMarketCouncil)
				.pauseProgram(101)
				.should.emit(LearnAndEarn, "ProgramStateChanged")
				.withArgs(101, ProgramState.Paused);

			let program = await LearnAndEarn.programs(101);
			program.state.should.be.equal(ProgramState.Paused);
		});

		it("Should not pause program if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.addProgram(101, cUSD.address);

			await LearnAndEarn.connect(signerWallet)
				.pauseProgram(101)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);

			let program = await LearnAndEarn.programs(101);
			program.state.should.be.equal(ProgramState.Valid);
		});

		it("Should not pause program if program is not valid", async function () {
			await LearnAndEarn.addProgram(101, cUSD.address);

			await LearnAndEarn.pauseProgram(102).should.be.rejectedWith(
				"LearnAndEarn::pauseProgram: Program must be valid"
			);
			await LearnAndEarn.pauseProgram(101);
			await LearnAndEarn.pauseProgram(101).should.be.rejectedWith(
				"LearnAndEarn::pauseProgram: Program must be valid"
			);

			let program = await LearnAndEarn.programs(101);
			program.state.should.be.equal(ProgramState.Paused);
		});

		it("Should unpause program if owner", async function () {
			await LearnAndEarn.addProgram(101, cUSD.address);
			await LearnAndEarn.pauseProgram(101);

			await LearnAndEarn.unpauseProgram(101)
				.should.emit(LearnAndEarn, "ProgramStateChanged")
				.withArgs(101, ProgramState.Valid);

			let program = await LearnAndEarn.programs(101);
			program.state.should.be.equal(ProgramState.Valid);
		});

		it("Should unpause program if ImpactMarketCouncil", async function () {
			await LearnAndEarn.addProgram(101, cUSD.address);
			await LearnAndEarn.pauseProgram(101);

			await LearnAndEarn.connect(impactMarketCouncil)
				.unpauseProgram(101)
				.should.emit(LearnAndEarn, "ProgramStateChanged")
				.withArgs(101, ProgramState.Valid);

			let program = await LearnAndEarn.programs(101);
			program.state.should.be.equal(ProgramState.Valid);
		});

		it("Should not unpause program if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.addProgram(101, cUSD.address);
			await LearnAndEarn.pauseProgram(101);

			await LearnAndEarn.connect(signerWallet)
				.unpauseProgram(101)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);

			let program = await LearnAndEarn.programs(101);
			program.state.should.be.equal(ProgramState.Paused);
		});

		it("Should not unpause program if the program is not paused", async function () {
			await LearnAndEarn.addProgram(101, cUSD.address);

			await LearnAndEarn.unpauseProgram(101).should.be.rejectedWith(
				"LearnAndEarn::pauseProgram: Program must be paused"
			);
			await LearnAndEarn.unpauseProgram(102).should.be.rejectedWith(
				"LearnAndEarn::pauseProgram: Program must be paused"
			);

			let program = await LearnAndEarn.programs(101);
			program.state.should.be.equal(ProgramState.Valid);
		});

		it("Should fund a program", async function () {
			await LearnAndEarn.connect(owner).addProgram(1, cUSD.address);

			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100));
			await LearnAndEarn.connect(user1)
				.fundProgram(1, toEther(100))
				.should.emit(LearnAndEarn, "ProgramFunded")
				.withArgs(1, user1.address, toEther(100));

			let program = await LearnAndEarn.programs(1);
			program.balance.should.be.equal(toEther(100));

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				toEther(100)
			);
		});

		it("Should fund program multiple times", async function () {
			await LearnAndEarn.connect(owner).addProgram(1, cUSD.address);
			await LearnAndEarn.connect(owner).addProgram(2, cUSD.address);

			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(1000));
			await cUSD
				.connect(user2)
				.approve(LearnAndEarn.address, toEther(1000));

			await LearnAndEarn.connect(user1)
				.fundProgram(1, toEther(100))
				.should.emit(LearnAndEarn, "ProgramFunded")
				.withArgs(1, user1.address, toEther(100));

			await LearnAndEarn.connect(user2)
				.fundProgram(1, toEther(100))
				.should.emit(LearnAndEarn, "ProgramFunded")
				.withArgs(1, user2.address, toEther(100));

			await LearnAndEarn.connect(user1)
				.fundProgram(1, toEther(100))
				.should.emit(LearnAndEarn, "ProgramFunded")
				.withArgs(1, user1.address, toEther(100));

			await LearnAndEarn.connect(user1)
				.fundProgram(2, toEther(100))
				.should.emit(LearnAndEarn, "ProgramFunded")
				.withArgs(2, user1.address, toEther(100));

			await LearnAndEarn.connect(user2)
				.fundProgram(2, toEther(100))
				.should.emit(LearnAndEarn, "ProgramFunded")
				.withArgs(2, user2.address, toEther(100));

			let program1 = await LearnAndEarn.programs(1);
			program1.balance.should.be.equal(toEther(300));
			let program2 = await LearnAndEarn.programs(2);
			program2.balance.should.be.equal(toEther(200));

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				toEther(500)
			);
		});

		it("Should fund a paused program", async function () {
			await LearnAndEarn.connect(owner).addProgram(1, cUSD.address);

			await LearnAndEarn.pauseProgram(1);

			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100));
			await LearnAndEarn.connect(user1)
				.fundProgram(1, toEther(100))
				.should.emit(LearnAndEarn, "ProgramFunded")
				.withArgs(1, user1.address, toEther(100));

			let program = await LearnAndEarn.programs(1);
			program.balance.should.be.equal(toEther(100));
		});

		it("Should not fund an invalid program", async function () {
			await LearnAndEarn.connect(user1)
				.fundProgram(1, toEther(100))
				.should.be.rejectedWith(
					"LearnAndEarn::fundProgram: This program cannot be funded"
				);
		});

		it("Should cancel a program if owner", async function () {
			await LearnAndEarn.connect(owner).addProgram(1, cUSD.address);
			await LearnAndEarn.connect(owner).addProgram(2, cUSD.address);

			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100));
			await LearnAndEarn.connect(user1).fundProgram(2, toEther(100));

			const user1Balance = await cUSD.balanceOf(user1.address);
			await LearnAndEarn.connect(owner)
				.cancelProgram(2, user1.address)
				.should.emit(LearnAndEarn, "ProgramStateChanged")
				.withArgs(2, ProgramState.Canceled);

			let program1 = await LearnAndEarn.programs(1);
			program1.balance.should.be.equal(0);
			program1.state.should.be.equal(ProgramState.Valid);

			let program2 = await LearnAndEarn.programs(2);
			program2.balance.should.be.equal(0);
			program2.state.should.be.equal(ProgramState.Canceled);
			(await cUSD.balanceOf(user1.address)).should.eq(
				user1Balance.add(toEther(100))
			);
		});

		it("Should cancel a program if impactMarketCouncil", async function () {
			await LearnAndEarn.connect(owner).addProgram(1, cUSD.address);
			await LearnAndEarn.connect(owner).addProgram(2, cUSD.address);

			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, toEther(100));
			await LearnAndEarn.connect(user1).fundProgram(2, toEther(100));

			const user1Balance = await cUSD.balanceOf(user1.address);
			await LearnAndEarn.connect(impactMarketCouncil)
				.cancelProgram(2, user1.address)
				.should.emit(LearnAndEarn, "ProgramStateChanged")
				.withArgs(2, ProgramState.Canceled);

			let program1 = await LearnAndEarn.programs(1);
			program1.balance.should.be.equal(0);
			program1.state.should.be.equal(ProgramState.Valid);

			let program2 = await LearnAndEarn.programs(2);
			program2.balance.should.be.equal(0);
			program2.state.should.be.equal(ProgramState.Canceled);
			(await cUSD.balanceOf(user1.address)).should.eq(
				user1Balance.add(toEther(100))
			);
		});

		it("Should not cancel program if not owner nor ImpactMarketCouncil", async function () {
			await LearnAndEarn.connect(owner).addProgram(1, cUSD.address);

			await LearnAndEarn.connect(signerWallet)
				.cancelProgram(1, user1.address)
				.should.be.rejectedWith(
					"LearnAndEarn: caller is not the owner nor ImpactMarketCouncil"
				);

			let program = await LearnAndEarn.programs(1);
			program.state.should.be.equal(ProgramState.Valid);
		});

		it("Should not fund a canceled program", async function () {
			await LearnAndEarn.connect(owner).addProgram(1, cUSD.address);

			await LearnAndEarn.connect(owner).cancelProgram(1, user1.address);

			await LearnAndEarn.connect(user1)
				.fundProgram(1, toEther(100))
				.should.be.rejectedWith(
					"LearnAndEarn::fundProgram: This program cannot be funded"
				);
		});
	});

	describe("LearnAndEarn - Claim", () => {
		const programId1 = 101;
		const programId2 = 102;
		const programId3 = 103;

		const program1InitialBalance = toEther(1000);
		const program2InitialBalance = toEther(2000);
		const program3InitialBalance = toEther(3000);

		const learnAndEarnInitialBalanceCUSD = program1InitialBalance.add(
			program2InitialBalance
		);
		const learnAndEarnInitialBalancePACT = program3InitialBalance;

		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await LearnAndEarn.connect(owner).addProgram(
				programId1,
				cUSD.address
			);
			await LearnAndEarn.connect(owner).addProgram(
				programId2,
				cUSD.address
			);
			await LearnAndEarn.connect(owner).addProgram(
				programId3,
				PACT.address
			);

			await cUSD
				.connect(user1)
				.approve(LearnAndEarn.address, learnAndEarnInitialBalanceCUSD);
			await LearnAndEarn.connect(user1).fundProgram(
				programId1,
				program1InitialBalance
			);
			await LearnAndEarn.connect(user1).fundProgram(
				programId2,
				program2InitialBalance
			);

			await PACT.connect(user1).approve(
				LearnAndEarn.address,
				learnAndEarnInitialBalancePACT
			);
			await LearnAndEarn.connect(user1).fundProgram(
				programId3,
				learnAndEarnInitialBalancePACT
			);
		});

		it("Should claim reward", async function () {
			const courseId = 1;
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId],
					[rewardAmount],
					[signedMessage]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId1, courseId);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId,
					beneficiary1.address
				)
			).should.eq(rewardAmount);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(
				program1InitialBalance.sub(rewardAmount)
			);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance.add(rewardAmount)
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD.sub(rewardAmount)
			);
		});

		it("Should claim rewards for multiple courses for same program multiple transactions", async function () {
			const courseId1 = 1;
			const courseId2 = 2;
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId2,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId1, courseId1);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId2],
					[rewardAmount2],
					[signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId1, courseId2);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);
			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId2,
					beneficiary1.address
				)
			).should.eq(rewardAmount2);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(
				program1InitialBalance.sub(rewardAmount1).sub(rewardAmount2)
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

		it("Should claim rewards for multiple courses for same program multiple transactions", async function () {
			const courseId1 = 1;
			const courseId2 = 2;
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId2,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId1, courseId2],
					[rewardAmount1, rewardAmount2],
					[signedMessage1, signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId1, courseId1)
				.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId1, courseId2);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);
			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId2,
					beneficiary1.address
				)
			).should.eq(rewardAmount2);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(
				program1InitialBalance.sub(rewardAmount1).sub(rewardAmount2)
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

		it("Should claim rewards for multiple programs #1", async function () {
			const courseId1 = 1;
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				programId2,
				courseId1,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId1, courseId1);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId2,
					[courseId1],
					[rewardAmount2],
					[signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId2, courseId1);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);
			(
				await LearnAndEarn.programCourseClaimAmount(
					programId2,
					courseId1,
					beneficiary1.address
				)
			).should.eq(rewardAmount2);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(
				program1InitialBalance.sub(rewardAmount1)
			);

			const program2 = await LearnAndEarn.programs(programId2);
			program2.balance.should.be.equal(
				program2InitialBalance.sub(rewardAmount2)
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
			const courseId1 = 1;
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				programId3,
				courseId1,
				rewardAmount2
			);

			const beneficiary1InitialBalanceCUSD = await cUSD.balanceOf(
				beneficiary1.address
			);
			const beneficiary1InitialBalancePACT = await PACT.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId1, courseId1);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId3,
					[courseId1],
					[rewardAmount2],
					[signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId3, courseId1);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);
			(
				await LearnAndEarn.programCourseClaimAmount(
					programId3,
					courseId1,
					beneficiary1.address
				)
			).should.eq(rewardAmount2);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(
				program1InitialBalance.sub(rewardAmount1)
			);

			const program3 = await LearnAndEarn.programs(programId3);
			program3.balance.should.be.equal(
				learnAndEarnInitialBalancePACT.sub(rewardAmount2)
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

		it("Should multiple beneficiaries claim rewards for same program course", async function () {
			const courseId1 = 1;
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary2,
				programId1,
				courseId1,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId1, courseId1);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary2.address,
					programId1,
					[courseId1],
					[rewardAmount2],
					[signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary2.address, programId1, courseId1);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);
			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId1,
					beneficiary2.address
				)
			).should.eq(rewardAmount2);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(
				program1InitialBalance.sub(rewardAmount1).sub(rewardAmount2)
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

		it("Should one beneficiary not claim multiple times for same course #1", async function () {
			const courseId1 = 1;
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId1,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId1, courseId1);

			await LearnAndEarn.connect(user2).claimRewardForCourses(
				beneficiary1.address,
				programId1,
				[courseId1],
				[rewardAmount2],
				[signedMessage2]
			).should.be.fulfilled;

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(
				program1InitialBalance.sub(rewardAmount1)
			);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance.add(rewardAmount1)
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD.sub(rewardAmount1)
			);
		});

		it("Should one beneficiary not claim multiple times for same course #2", async function () {
			const courseId1 = 1;
			const courseId2 = 2;
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId1,
				rewardAmount1
			);

			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId2,
				rewardAmount2
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId1],
					[rewardAmount1],
					[signedMessage1]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId1, courseId1);

			const rewardAmount3 = toEther(30);

			const signedMessage3 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId1,
				rewardAmount3
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId1, courseId2],
					[rewardAmount3, rewardAmount2],
					[signedMessage3, signedMessage2]
				)
				.should.emit(LearnAndEarn, "RewardClaimed")
				.withArgs(beneficiary1.address, programId1, courseId2);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId1,
					beneficiary1.address
				)
			).should.eq(rewardAmount1);
			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId2,
					beneficiary1.address
				)
			).should.eq(rewardAmount2);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(
				program1InitialBalance.sub(rewardAmount1).sub(rewardAmount2)
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
			const courseId = 1;
			const rewardAmount = program1InitialBalance.add(1);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimReward: Program doesn't have enough funds"
				);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId,
					beneficiary1.address
				)
			).should.eq(0);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(program1InitialBalance);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
			);
		});

		it("Should not claim reward if program is not valid", async function () {
			const courseId = 1;
			const rewardAmount = toEther(10);

			const signedMessage1 = await signParams(
				signerWallet,
				beneficiary1,
				123,
				courseId,
				rewardAmount
			);

			await LearnAndEarn.pauseProgram(programId1);
			const signedMessage2 = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId,
				rewardAmount
			);

			await LearnAndEarn.cancelProgram(programId2, user1.address);
			const signedMessage3 = await signParams(
				signerWallet,
				beneficiary1,
				programId2,
				courseId,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					123,
					[courseId],
					[rewardAmount],
					[signedMessage1]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimReward: Program is not valid"
				);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId],
					[rewardAmount],
					[signedMessage2]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimReward: Program is not valid"
				);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId2,
					[courseId],
					[rewardAmount],
					[signedMessage3]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimReward: Program is not valid"
				);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId,
					beneficiary1.address
				)
			).should.eq(0);
			(
				await LearnAndEarn.programCourseClaimAmount(
					programId2,
					courseId,
					beneficiary1.address
				)
			).should.eq(0);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(program1InitialBalance);

			const program2 = await LearnAndEarn.programs(programId2);
			program2.balance.should.be.equal(0);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				program1InitialBalance
			);
		});

		it("Should not claim is signer is not valid", async function () {
			const courseId = 1;
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				user1,
				beneficiary1,
				programId1,
				courseId,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimReward: Invalid signature"
				);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId,
					beneficiary1.address
				)
			).should.eq(0);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(program1InitialBalance);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
			);
		});

		it("Should not claim reward if the signature is invalid #beneficiary", async function () {
			const courseId = 1;
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);
			const beneficiary2InitialBalance = await cUSD.balanceOf(
				beneficiary2.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary2.address,
					programId1,
					[courseId],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimReward: Invalid signature"
				);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId,
					beneficiary1.address
				)
			).should.eq(0);
			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId,
					beneficiary2.address
				)
			).should.eq(0);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(program1InitialBalance);

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
			const courseId = 1;
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId2,
					[courseId],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimReward: Invalid signature"
				);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId,
					beneficiary1.address
				)
			).should.eq(0);
			(
				await LearnAndEarn.programCourseClaimAmount(
					programId2,
					courseId,
					beneficiary1.address
				)
			).should.eq(0);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(program1InitialBalance);

			const program2 = await LearnAndEarn.programs(programId2);
			program2.balance.should.be.equal(program2InitialBalance);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
			);
		});

		it("Should not claim reward if the signature is invalid #courseId", async function () {
			const courseId1 = 1;
			const courseId2 = 2;
			const rewardAmount = toEther(10);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId1,
				rewardAmount
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId2],
					[rewardAmount],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimReward: Invalid signature"
				);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId1,
					beneficiary1.address
				)
			).should.eq(0);
			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId2,
					beneficiary1.address
				)
			).should.eq(0);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(program1InitialBalance);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
			);
		});

		it("Should not claim reward if the signature is invalid #rewardAmount", async function () {
			const courseId = 1;
			const rewardAmount1 = toEther(10);
			const rewardAmount2 = toEther(20);

			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				courseId,
				rewardAmount1
			);

			const beneficiary1InitialBalance = await cUSD.balanceOf(
				beneficiary1.address
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[courseId],
					[rewardAmount2],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimReward: Invalid signature"
				);

			(
				await LearnAndEarn.programCourseClaimAmount(
					programId1,
					courseId,
					beneficiary1.address
				)
			).should.eq(0);

			const program1 = await LearnAndEarn.programs(programId1);
			program1.balance.should.be.equal(program1InitialBalance);

			(await cUSD.balanceOf(beneficiary1.address)).should.eq(
				beneficiary1InitialBalance
			);

			(await cUSD.balanceOf(LearnAndEarn.address)).should.eq(
				learnAndEarnInitialBalanceCUSD
			);
		});

		it("Should reject when calling claim with less courseIds", async function () {
			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				1,
				toEther(10)
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[1],
					[1, 2],
					[signedMessage, signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimReward: Invalid data"
				);
		});

		it("Should reject when calling claim with less rewardAmounts", async function () {
			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				1,
				toEther(10)
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[1, 2],
					[1],
					[signedMessage, signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimReward: Invalid data"
				);
		});

		it("Should reject when calling claim with less signatures", async function () {
			const signedMessage = await signParams(
				signerWallet,
				beneficiary1,
				programId1,
				1,
				toEther(10)
			);

			await LearnAndEarn.connect(user2)
				.claimRewardForCourses(
					beneficiary1.address,
					programId1,
					[1, 2],
					[1, 2],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"LearnAndEarn::claimReward: Invalid data"
				);
		});
	});
});
