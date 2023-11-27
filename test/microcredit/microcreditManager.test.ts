import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { deployments, ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { toEther } from "../utils/helpers";
import {createPool, getExactInput, uniswapQuoterAddress} from "../utils/uniswap";
import {advanceNSecondsAndBlock, getCurrentBlockTimestamp} from "../utils/TimeTravel";
import aave from "../../integrations/moola/markets/aave";
import {BigNumber, BigNumberish} from "@ethersproject/bignumber";

chai.use(chaiAsPromised);
should();

describe("MicrocreditManager", () => {
	let deployer: SignerWithAddress;
	let owner: SignerWithAddress;
	let manager1: SignerWithAddress;
	let manager2: SignerWithAddress;
	let manager3: SignerWithAddress;
	let borrower1: SignerWithAddress;
	let borrower2: SignerWithAddress;
	let borrower3: SignerWithAddress;

	let token1: ethersTypes.Contract;
	let token2: ethersTypes.Contract;
	let token3: ethersTypes.Contract;

	let MicrocreditManager: ethersTypes.Contract;
	let Microcredit: ethersTypes.Contract;

	const initialMicrocreditManagerToken1Balance = toEther(1000000);
	const initialManager1Token1Balance = toEther(11000);
	const initialManager2Token1Balance = toEther(21000);
	const initialManager3Token1Balance = toEther(21000);
	const initialBorrower1Token1Balance = toEther(1100);
	const initialBorrower2Token1Balance = toEther(2100);
	const initialBorrower3Token1Balance = toEther(3100);

	const initialMicrocreditManagerToken2Balance = toEther(2000000);
	const initialManager1Token2Balance = toEther(12000);
	const initialManager2Token2Balance = toEther(22000);
	const initialManager3Token2Balance = toEther(22000);
	const initialBorrower1Token2Balance = toEther(1200);
	const initialBorrower2Token2Balance = toEther(2200);
	const initialBorrower3Token2Balance = toEther(3200);

	let baseRewardDefault = toEther(100);
	let claimDelayDefault = 3600 * 24 * 30;
	let baseRewardDefaultClaimToken: BigNumber;

	const rewardPercentage = 10;

	const deploy = deployments.createFixture(async () => {
		await deployments.fixture("MicrocreditManagerTest", {
			fallbackToGlobal: false,
		});

		[deployer, owner, manager1, manager2, manager3, borrower1, borrower2, borrower3] =
			await ethers.getSigners();

		MicrocreditManager = await ethers.getContractAt(
			"MicrocreditManagerImplementation",
			(
				await deployments.get("MicrocreditManagerProxy")
			).address
		);

		Microcredit = await ethers.getContractAt(
			"MicrocreditImplementation",
			(
				await deployments.get("MicrocreditProxy")
			).address
		);

		const tokenFactory = await ethers.getContractFactory("TokenMock");
		token1 = await ethers.getContractAt(
			"TokenMock",
			(
				await deployments.get("TokenMock")
			).address
		);
		token2 = await tokenFactory.deploy("Token2", "Token2");
		token3 = await tokenFactory.deploy("Token3", "Token3");

		await token1.mint(MicrocreditManager.address, initialMicrocreditManagerToken1Balance);
		await token1.mint(manager1.address, initialManager1Token1Balance);
		await token1.mint(manager2.address, initialManager2Token1Balance);
		await token1.mint(manager3.address, initialManager3Token1Balance);
		await token1.mint(borrower1.address, initialBorrower1Token1Balance);
		await token1.mint(borrower2.address, initialBorrower2Token1Balance);
		await token1.mint(borrower3.address, initialBorrower3Token1Balance);
		await token1.mint(deployer.address, toEther(1000000000));

		await token2.mint(MicrocreditManager.address, initialMicrocreditManagerToken2Balance);
		await token2.mint(manager1.address, initialManager1Token2Balance);
		await token2.mint(manager2.address, initialManager2Token2Balance);
		await token2.mint(manager3.address, initialManager3Token2Balance);
		await token2.mint(borrower1.address, initialBorrower1Token2Balance);
		await token2.mint(borrower2.address, initialBorrower2Token2Balance);
		await token2.mint(borrower3.address, initialBorrower3Token2Balance);
		await token2.mint(deployer.address, toEther(1000000000));

		await createPool(
			deployer,
			token1,
			token2,
			toEther(500000),
			toEther(1000000)
		);

		baseRewardDefaultClaimToken = await getExactInput(token1, token2, baseRewardDefault);
		baseRewardDefaultClaimToken.should.eq(toEther('197.960803760855350640'));
	});

	describe("MicrocreditManager - basic", () => {
		before(async function () {
		});

		beforeEach(async () => {
			await deploy();
		});

		it("should have correct values", async function () {
			(await MicrocreditManager.owner()).should.eq(owner.address);
			(await MicrocreditManager.getVersion()).should.eq(1);
			(await MicrocreditManager.microcredit()).should.eq(Microcredit.address);
			(await MicrocreditManager.uniswapQuoter()).should.eq(uniswapQuoterAddress);
			(await MicrocreditManager.rewardPercentage()).should.eq(toEther(10));
		});
	});

	describe("MicrocreditManager - editToken", () => {
		before(async function () {
		});

		beforeEach(async () => {
			await deploy();
		});

		it("Should not editTokenPair if not owner", async function () {
			await MicrocreditManager.connect(deployer)
				.editTokenPair(token1.address, token2.address, 10000)
				.should.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("Should editTokenPair if owner", async function () {
			(await MicrocreditManager.referenceTokenListLength()).should.eq(0);

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token2.address, 10000)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token2.address, 10000);

			(await MicrocreditManager.referenceTokenListLength()).should.eq(1);
			(await MicrocreditManager.referenceTokenListAt(0)).should.eq(token1.address);

			(await MicrocreditManager.referenceToken(token1.address)).should.eq(1);

			(await MicrocreditManager.referenceTokenClaimTokenListAt(token1.address, 0)).should.eq(token2.address);

			const tokenPair = await MicrocreditManager.tokenPair(token1.address, token2.address);
			tokenPair.uniswapFee.should.eq(10000);


			const tokenPairReverse = await MicrocreditManager.tokenPair(token2.address, token1.address);
			tokenPairReverse.uniswapFee.should.eq(0);
		});

		it("Should editTokenPair multiple times for same referenceToken", async function () {
			(await MicrocreditManager.referenceTokenListLength()).should.eq(0);

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token2.address, 10000)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token2.address, 10000);

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token3.address, 500)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token3.address, 500);

			(await MicrocreditManager.referenceTokenListLength()).should.eq(1);
			(await MicrocreditManager.referenceTokenListAt(0)).should.eq(token1.address);

			(await MicrocreditManager.referenceToken(token1.address)).should.eq(2);

			(await MicrocreditManager.referenceTokenClaimTokenListAt(token1.address, 0)).should.eq(token2.address);
			(await MicrocreditManager.referenceTokenClaimTokenListAt(token1.address, 1)).should.eq(token3.address);

			const tokenPair1 = await MicrocreditManager.tokenPair(token1.address, token2.address);
			tokenPair1.uniswapFee.should.eq(10000);

			const tokenPair2 = await MicrocreditManager.tokenPair(token1.address, token3.address);
			tokenPair2.uniswapFee.should.eq(500);
		});

		it("Should editTokenPair multiple times for same multiple referenceToken", async function () {
			(await MicrocreditManager.referenceTokenListLength()).should.eq(0);

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token2.address, 10000)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token2.address, 10000);

			await MicrocreditManager.connect(owner)
				.editTokenPair(token2.address, token3.address, 500)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token2.address, token3.address, 500);

			(await MicrocreditManager.referenceTokenListLength()).should.eq(2);
			(await MicrocreditManager.referenceTokenListAt(0)).should.eq(token1.address);
			(await MicrocreditManager.referenceTokenListAt(1)).should.eq(token2.address);

			(await MicrocreditManager.referenceToken(token1.address)).should.eq(1);

			(await MicrocreditManager.referenceTokenClaimTokenListAt(token1.address, 0)).should.eq(token2.address);

			const tokenPair1 = await MicrocreditManager.tokenPair(token1.address, token2.address);
			tokenPair1.uniswapFee.should.eq(10000);

			(await MicrocreditManager.referenceToken(token2.address)).should.eq(1);

			(await MicrocreditManager.referenceTokenClaimTokenListAt(token2.address, 0)).should.eq(token3.address);

			const tokenPair2 = await MicrocreditManager.tokenPair(token2.address, token3.address);
			tokenPair2.uniswapFee.should.eq(500);

			(await MicrocreditManager.referenceToken(token3.address)).should.eq(0);
		});

		it("Should remove token pair (using editTokenPair)", async function () {
			(await MicrocreditManager.referenceTokenListLength()).should.eq(0);

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token2.address, 10000)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token2.address, 10000);

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token3.address, 500)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token3.address, 500);

			(await MicrocreditManager.referenceTokenListLength()).should.eq(1);
			(await MicrocreditManager.referenceTokenListAt(0)).should.eq(token1.address);

			(await MicrocreditManager.referenceToken(token1.address)).should.eq(2);

			(await MicrocreditManager.referenceTokenClaimTokenListAt(token1.address, 0)).should.eq(token2.address);
			(await MicrocreditManager.referenceTokenClaimTokenListAt(token1.address, 1)).should.eq(token3.address);

			const tokenPair1 = await MicrocreditManager.tokenPair(token1.address, token2.address);
			tokenPair1.uniswapFee.should.eq(10000);

			const tokenPair2 = await MicrocreditManager.tokenPair(token1.address, token3.address);
			tokenPair2.uniswapFee.should.eq(500);

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token2.address, 0)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token2.address, 0);

			(await MicrocreditManager.referenceTokenListLength()).should.eq(1);
			(await MicrocreditManager.referenceTokenListAt(0)).should.eq(token1.address);

			(await MicrocreditManager.referenceToken(token1.address)).should.eq(1);

			(await MicrocreditManager.referenceTokenClaimTokenListAt(token1.address, 0)).should.eq(token3.address);

			const tokenPair1After = await MicrocreditManager.tokenPair(token1.address, token2.address);
			tokenPair1After.uniswapFee.should.eq(0);

			const tokenPair2After = await MicrocreditManager.tokenPair(token1.address, token3.address);
			tokenPair2After.uniswapFee.should.eq(500);
		});

		it("Should remove referenceToken if no claimToken pair available", async function () {
			(await MicrocreditManager.referenceTokenListLength()).should.eq(0);

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token2.address, 10000)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token2.address, 10000);

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token3.address, 500)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token3.address, 500);

			(await MicrocreditManager.referenceTokenListLength()).should.eq(1);
			(await MicrocreditManager.referenceTokenListAt(0)).should.eq(token1.address);

			(await MicrocreditManager.referenceToken(token1.address)).should.eq(2);

			(await MicrocreditManager.referenceTokenClaimTokenListAt(token1.address, 0)).should.eq(token2.address);
			(await MicrocreditManager.referenceTokenClaimTokenListAt(token1.address, 1)).should.eq(token3.address);

			const tokenPair1 = await MicrocreditManager.tokenPair(token1.address, token2.address);
			tokenPair1.uniswapFee.should.eq(10000);

			const tokenPair2 = await MicrocreditManager.tokenPair(token1.address, token3.address);
			tokenPair2.uniswapFee.should.eq(500);

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token2.address, 0)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token2.address, 0);


			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token3.address, 0)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token3.address, 0);

			(await MicrocreditManager.referenceTokenListLength()).should.eq(0);

			(await MicrocreditManager.referenceToken(token1.address)).should.eq(0);

			const tokenPair1After = await MicrocreditManager.tokenPair(token1.address, token2.address);
			tokenPair1After.uniswapFee.should.eq(0);

			const tokenPair2After = await MicrocreditManager.tokenPair(token1.address, token3.address);
			tokenPair2After.uniswapFee.should.eq(0);
		});

		it("Should editTokenPair with same reference and claimToken", async function () {
			(await MicrocreditManager.referenceTokenListLength()).should.eq(0);

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token1.address, 10000)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token1.address, 10000);

			(await MicrocreditManager.referenceTokenListLength()).should.eq(1);
			(await MicrocreditManager.referenceTokenListAt(0)).should.eq(token1.address);

			(await MicrocreditManager.referenceToken(token1.address)).should.eq(1);

			(await MicrocreditManager.referenceTokenClaimTokenListAt(token1.address, 0)).should.eq(token1.address);

			const tokenPair = await MicrocreditManager.tokenPair(token1.address, token1.address);
			tokenPair.uniswapFee.should.eq(10000);
		});
	});


	describe("MicrocreditManager - addManager", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token2.address, 10000)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token2.address, 10000);
		});

		it("Should not addManager if not owner", async function () {
			await MicrocreditManager.connect(deployer)
				.addManager(manager1.address, token1.address, token2.address, baseRewardDefault, claimDelayDefault)
				.should.be.rejectedWith("Ownable: caller is not the owner");
		});


		it("Should not addManager if invalid (referenceToken, claimToken) pair", async function () {
			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token3.address, baseRewardDefault, claimDelayDefault)
				.should.be.rejectedWith("MicrocreditManager: Invalid (referenceToken, claimToken) pair");
		});

		it("Should addManager if owner", async function () {
			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token2.address, baseRewardDefault, claimDelayDefault)
				.should.emit(MicrocreditManager, "ManagerAdded")
				.withArgs(manager1.address, token1.address, token2.address, baseRewardDefault, claimDelayDefault);

			const startDate = await getCurrentBlockTimestamp();

			const manager1Data = await MicrocreditManager.managers(manager1.address);
			manager1Data.referenceToken.should.eq(token1.address);
			manager1Data.claimToken.should.eq(token2.address);
			manager1Data.baseReward.should.eq(baseRewardDefault);
			manager1Data.claimDelay.should.eq(claimDelayDefault);
			manager1Data.rewardPeriodsLength.should.eq(1);
			manager1Data.rewardPeriodToClaim.should.eq(0);

			const manager1RewardPeriod1 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 0);
			manager1RewardPeriod1.startDate.should.eq(startDate);
			manager1RewardPeriod1.endDate.should.eq(startDate + claimDelayDefault - 1);
			manager1RewardPeriod1.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod1.extraReward.should.eq(0);
			manager1RewardPeriod1.completedLoansLength.should.eq(0);

			(await MicrocreditManager.managerListLength()).should.eq(1);
			(await MicrocreditManager.managerListAt(0)).should.eq(manager1.address);
		});

		it("Should not add same manager multiple times", async function () {
			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token2.address, baseRewardDefault, claimDelayDefault)
				.should.be.fulfilled;

			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token2.address, baseRewardDefault, claimDelayDefault)
				.should.be.rejectedWith("MicrocreditManager: Manager already added");
		});

		it("Should add multiple managers", async function () {
			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token2.address, baseRewardDefault, claimDelayDefault)
				.should.emit(MicrocreditManager, "ManagerAdded")
				.withArgs(manager1.address, token1.address, token2.address, baseRewardDefault, claimDelayDefault);

			const manager1StartDate = await getCurrentBlockTimestamp();

			await MicrocreditManager.connect(owner)
				.addManager(
					manager2.address,
					token1.address,
					token2.address,
					baseRewardDefault.mul(2),
					claimDelayDefault * 3
				)
				.should.emit(MicrocreditManager, "ManagerAdded")
				.withArgs(manager2.address, token1.address, token2.address, baseRewardDefault.mul(2), claimDelayDefault * 3);

			const manager2StartDate = manager1StartDate + 1;

			const manager1Data = await MicrocreditManager.managers(manager1.address);
			manager1Data.referenceToken.should.eq(token1.address);
			manager1Data.claimToken.should.eq(token2.address);
			manager1Data.baseReward.should.eq(baseRewardDefault);
			manager1Data.claimDelay.should.eq(claimDelayDefault);
			manager1Data.rewardPeriodsLength.should.eq(1);

			manager1Data.rewardPeriodToClaim.should.eq(0);
			const manager1RewardPeriod1 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 0);
			manager1RewardPeriod1.startDate.should.eq(manager1StartDate);
			manager1RewardPeriod1.endDate.should.eq(manager1StartDate + claimDelayDefault - 1);
			manager1RewardPeriod1.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod1.extraReward.should.eq(0);

			manager1RewardPeriod1.completedLoansLength.should.eq(0);
			const manager2Data = await MicrocreditManager.managers(manager2.address);
			manager2Data.referenceToken.should.eq(token1.address);
			manager2Data.claimToken.should.eq(token2.address);
			manager2Data.baseReward.should.eq(baseRewardDefault.mul(2));
			manager2Data.claimDelay.should.eq(claimDelayDefault*3);
			manager2Data.rewardPeriodsLength.should.eq(1);
			manager2Data.rewardPeriodToClaim.should.eq(0);

			const manager2RewardPeriod1 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager2.address, 0);
			manager2RewardPeriod1.startDate.should.eq(manager2StartDate);
			manager2RewardPeriod1.endDate.should.eq(manager2StartDate + claimDelayDefault * 3 - 1);
			manager2RewardPeriod1.baseReward.should.eq(baseRewardDefault.mul(2));
			manager1RewardPeriod1.extraReward.should.eq(0);
			manager2RewardPeriod1.completedLoansLength.should.eq(0);

			(await MicrocreditManager.managerListLength()).should.eq(2);
			(await MicrocreditManager.managerListAt(0)).should.eq(manager1.address);
			(await MicrocreditManager.managerListAt(1)).should.eq(manager2.address);
		});
	});

	describe("MicrocreditManager - claim (same reference token, no extra rewards) ", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token1.address, 10000)
				.should.emit(MicrocreditManager, "TokenPairEdited")
				.withArgs(token1.address, token1.address, 10000);
		});

		it("Should not claim if no reward available", async function () {
			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token1.address, baseRewardDefault, claimDelayDefault)
				.should.be.fulfilled;

			let claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(0);
			claimAmounts.totalExtraReward.should.eq(0);

			await MicrocreditManager.connect(manager1)
				.claim().should.be.rejectedWith('MicrocreditManager: No rewards to claim');
		});

		it("Should claim after one reward period", async function () {
			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token1.address, baseRewardDefault, claimDelayDefault)
				.should.be.fulfilled;

			const manager1StartDate0 = await getCurrentBlockTimestamp();

			let claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(0);
			claimAmounts.totalExtraReward.should.eq(0);

			await advanceNSecondsAndBlock(claimDelayDefault);

			claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(baseRewardDefault);
			claimAmounts.totalExtraReward.should.eq(0);

			await MicrocreditManager.connect(manager1).claim()
				.should.emit(MicrocreditManager, "Claimed")
				.withArgs(manager1.address, 0, 0, baseRewardDefault, baseRewardDefault);

			const manager1Data = await MicrocreditManager.managers(manager1.address);
			manager1Data.rewardPeriodsLength.should.eq(2);

			manager1Data.rewardPeriodToClaim.should.eq(1);
			const manager1RewardPeriod0 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 0);
			manager1RewardPeriod0.startDate.should.eq(manager1StartDate0);
			manager1RewardPeriod0.endDate.should.eq(manager1StartDate0 + claimDelayDefault - 1);
			manager1RewardPeriod0.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod0.extraReward.should.eq(0);
			manager1RewardPeriod0.completedLoansLength.should.eq(0);

			const manager1StartDate1 = manager1StartDate0 + claimDelayDefault;
			const manager1RewardPeriod1 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 1);
			manager1RewardPeriod1.startDate.should.eq(manager1StartDate1);
			manager1RewardPeriod1.endDate.should.eq(manager1StartDate1 + claimDelayDefault - 1);
			manager1RewardPeriod1.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod1.extraReward.should.eq(0);
			manager1RewardPeriod1.completedLoansLength.should.eq(0);

			(await token1.balanceOf(MicrocreditManager.address))
				.should.eq(initialMicrocreditManagerToken1Balance.sub(baseRewardDefault));
			(await token1.balanceOf(manager1.address))
				.should.eq(initialManager1Token1Balance.add(baseRewardDefault));

			await MicrocreditManager.connect(manager1).claim()
				.should.be.rejectedWith('MicrocreditManager: No rewards to claim');
		});

		it("Should claim multiple times", async function () {
			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token1.address, baseRewardDefault, claimDelayDefault)
				.should.be.fulfilled;

			const manager1StartDate0 = await getCurrentBlockTimestamp();

			let claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(0);
			claimAmounts.totalExtraReward.should.eq(0);

			await advanceNSecondsAndBlock(claimDelayDefault);

			claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(baseRewardDefault);
			claimAmounts.totalExtraReward.should.eq(0);

			await MicrocreditManager.connect(manager1).claim()
				.should.emit(MicrocreditManager, "Claimed")
				.withArgs(manager1.address, 0, 0, baseRewardDefault, baseRewardDefault);

			let manager1Data = await MicrocreditManager.managers(manager1.address);
			manager1Data.rewardPeriodsLength.should.eq(2);

			manager1Data.rewardPeriodToClaim.should.eq(1);
			const manager1RewardPeriod0 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 0);
			manager1RewardPeriod0.startDate.should.eq(manager1StartDate0);
			manager1RewardPeriod0.endDate.should.eq(manager1StartDate0 + claimDelayDefault - 1);
			manager1RewardPeriod0.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod0.extraReward.should.eq(0);
			manager1RewardPeriod0.completedLoansLength.should.eq(0);

			const manager1StartDate1 = manager1StartDate0 + claimDelayDefault;
			const manager1RewardPeriod1 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 1);
			manager1RewardPeriod1.startDate.should.eq(manager1StartDate1);
			manager1RewardPeriod1.endDate.should.eq(manager1StartDate1 + claimDelayDefault - 1);
			manager1RewardPeriod1.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod1.extraReward.should.eq(0);
			manager1RewardPeriod1.completedLoansLength.should.eq(0);

			(await token1.balanceOf(MicrocreditManager.address))
				.should.eq(initialMicrocreditManagerToken1Balance.sub(baseRewardDefault));
			(await token1.balanceOf(manager1.address))
				.should.eq(initialManager1Token1Balance.add(baseRewardDefault));

			await advanceNSecondsAndBlock(claimDelayDefault);

			claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(baseRewardDefault);
			claimAmounts.totalExtraReward.should.eq(0);

			await MicrocreditManager.connect(manager1).claim()
				.should.emit(MicrocreditManager, "Claimed")
				.withArgs(manager1.address, 1, 1, baseRewardDefault, baseRewardDefault);

			manager1Data = await MicrocreditManager.managers(manager1.address);
			manager1Data.rewardPeriodsLength.should.eq(3);
			manager1Data.rewardPeriodToClaim.should.eq(2);

			const manager1StartDate2 = manager1StartDate1 + claimDelayDefault;
			const manager1RewardPeriod2 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 2);
			manager1RewardPeriod2.startDate.should.eq(manager1StartDate2);
			manager1RewardPeriod2.endDate.should.eq(manager1StartDate2 + claimDelayDefault - 1);
			manager1RewardPeriod2.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod2.extraReward.should.eq(0);
			manager1RewardPeriod2.completedLoansLength.should.eq(0);

			(await token1.balanceOf(MicrocreditManager.address))
				.should.eq(initialMicrocreditManagerToken1Balance.sub(baseRewardDefault.mul(2)));
			(await token1.balanceOf(manager1.address))
				.should.eq(initialManager1Token1Balance.add(baseRewardDefault.mul(2)));

			await MicrocreditManager.connect(manager1).claim()
				.should.be.rejectedWith('MicrocreditManager: No rewards to claim');
		});

		it("Should claim after multiple rewardPeriods", async function () {
			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token1.address, baseRewardDefault, claimDelayDefault)
				.should.be.fulfilled;

			const manager1StartDate0 = await getCurrentBlockTimestamp();

			let claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(0);
			claimAmounts.totalExtraReward.should.eq(0);

			await advanceNSecondsAndBlock(claimDelayDefault);

			claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(baseRewardDefault);
			claimAmounts.totalExtraReward.should.eq(0);

			await MicrocreditManager.connect(manager1).claim()
				.should.emit(MicrocreditManager, "Claimed")
				.withArgs(manager1.address, 0, 0, baseRewardDefault, baseRewardDefault);

			let manager1Data = await MicrocreditManager.managers(manager1.address);
			manager1Data.rewardPeriodsLength.should.eq(2);

			manager1Data.rewardPeriodToClaim.should.eq(1);
			const manager1RewardPeriod0 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 0);
			manager1RewardPeriod0.startDate.should.eq(manager1StartDate0);
			manager1RewardPeriod0.endDate.should.eq(manager1StartDate0 + claimDelayDefault - 1);
			manager1RewardPeriod0.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod0.extraReward.should.eq(0);
			manager1RewardPeriod0.completedLoansLength.should.eq(0);

			const manager1StartDate1 = manager1StartDate0 + claimDelayDefault;
			const manager1RewardPeriod1 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 1);
			manager1RewardPeriod1.startDate.should.eq(manager1StartDate1);
			manager1RewardPeriod1.endDate.should.eq(manager1StartDate1 + claimDelayDefault - 1);
			manager1RewardPeriod1.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod1.extraReward.should.eq(0);
			manager1RewardPeriod1.completedLoansLength.should.eq(0);

			(await token1.balanceOf(MicrocreditManager.address))
				.should.eq(initialMicrocreditManagerToken1Balance.sub(baseRewardDefault));
			(await token1.balanceOf(manager1.address))
				.should.eq(initialManager1Token1Balance.add(baseRewardDefault));

			await advanceNSecondsAndBlock(claimDelayDefault * 3);

			claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(baseRewardDefault.mul(3));
			claimAmounts.totalExtraReward.should.eq(0);

			await MicrocreditManager.connect(manager1).claim()
				.should.emit(MicrocreditManager, "Claimed")
				.withArgs(manager1.address, 1, 3, baseRewardDefault.mul(3), baseRewardDefault.mul(3));

			manager1Data = await MicrocreditManager.managers(manager1.address);
			manager1Data.rewardPeriodsLength.should.eq(5);
			manager1Data.rewardPeriodToClaim.should.eq(4);

			const manager1StartDate2 = manager1StartDate1 + claimDelayDefault;
			const manager1RewardPeriod2 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 2);
			manager1RewardPeriod2.startDate.should.eq(manager1StartDate2);
			manager1RewardPeriod2.endDate.should.eq(manager1StartDate2 + claimDelayDefault - 1);
			manager1RewardPeriod2.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod2.extraReward.should.eq(0);
			manager1RewardPeriod2.completedLoansLength.should.eq(0);

			const manager1StartDate3 = manager1StartDate2 + claimDelayDefault;
			const manager1RewardPeriod3 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 3);
			manager1RewardPeriod3.startDate.should.eq(manager1StartDate3);
			manager1RewardPeriod3.endDate.should.eq(manager1StartDate3 + claimDelayDefault - 1);
			manager1RewardPeriod3.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod3.extraReward.should.eq(0);
			manager1RewardPeriod3.completedLoansLength.should.eq(0);

			const manager1StartDate4 = manager1StartDate3 + claimDelayDefault;
			const manager1RewardPeriod4 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 4);
			manager1RewardPeriod4.startDate.should.eq(manager1StartDate4);
			manager1RewardPeriod4.endDate.should.eq(manager1StartDate4 + claimDelayDefault - 1);
			manager1RewardPeriod4.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod4.extraReward.should.eq(0);
			manager1RewardPeriod4.completedLoansLength.should.eq(0);

			(await token1.balanceOf(MicrocreditManager.address))
				.should.eq(initialMicrocreditManagerToken1Balance.sub(baseRewardDefault.mul(4)));
			(await token1.balanceOf(manager1.address))
				.should.eq(initialManager1Token1Balance.add(baseRewardDefault.mul(4)));

			await MicrocreditManager.connect(manager1).claim()
				.should.be.rejectedWith('MicrocreditManager: No rewards to claim');
		});
	});

	describe("MicrocreditManager - claim (different reference token, no extra rewards) ", () => {
		before(async function () {
		});

		beforeEach(async () => {
			await deploy();

			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token2.address, 10000)
				.should.emit(MicrocreditManager, "TokenPairEdited");
		});

		it("Should claim after one reward period", async function () {
			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token2.address, baseRewardDefault, claimDelayDefault)
				.should.be.fulfilled;

			const manager1StartDate0 = await getCurrentBlockTimestamp();

			let claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(0);
			claimAmounts.totalExtraReward.should.eq(0);

			await advanceNSecondsAndBlock(claimDelayDefault);

			claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(baseRewardDefault);
			claimAmounts.totalExtraReward.should.eq(0);

			await MicrocreditManager.connect(manager1).claim()
				.should.emit(MicrocreditManager, "Claimed")
				.withArgs(manager1.address, 0, 0, baseRewardDefault, baseRewardDefaultClaimToken);

			const manager1Data = await MicrocreditManager.managers(manager1.address);
			manager1Data.rewardPeriodsLength.should.eq(2);

			manager1Data.rewardPeriodToClaim.should.eq(1);
			const manager1RewardPeriod0 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 0);
			manager1RewardPeriod0.startDate.should.eq(manager1StartDate0);
			manager1RewardPeriod0.endDate.should.eq(manager1StartDate0 + claimDelayDefault - 1);
			manager1RewardPeriod0.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod0.extraReward.should.eq(0);
			manager1RewardPeriod0.completedLoansLength.should.eq(0);

			const manager1StartDate1 = manager1StartDate0 + claimDelayDefault;
			const manager1RewardPeriod1 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 1);
			manager1RewardPeriod1.startDate.should.eq(manager1StartDate1);
			manager1RewardPeriod1.endDate.should.eq(manager1StartDate1 + claimDelayDefault - 1);
			manager1RewardPeriod1.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod1.extraReward.should.eq(0);
			manager1RewardPeriod1.completedLoansLength.should.eq(0);

			(await token1.balanceOf(MicrocreditManager.address))
				.should.eq(initialMicrocreditManagerToken1Balance);
			(await token1.balanceOf(manager1.address))
				.should.eq(initialManager1Token1Balance);

			(await token2.balanceOf(MicrocreditManager.address))
				.should.eq(initialMicrocreditManagerToken2Balance.sub(baseRewardDefaultClaimToken));
			(await token2.balanceOf(manager1.address))
				.should.eq(initialManager1Token2Balance.add(baseRewardDefaultClaimToken));

			await MicrocreditManager.connect(manager1).claim()
				.should.be.rejectedWith('MicrocreditManager: No rewards to claim');
		});

		it("Should claim multiple times", async function () {
			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token2.address, baseRewardDefault, claimDelayDefault)
				.should.be.fulfilled;

			const manager1StartDate0 = await getCurrentBlockTimestamp();

			let claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(0);
			claimAmounts.totalExtraReward.should.eq(0);

			await advanceNSecondsAndBlock(claimDelayDefault);

			claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(baseRewardDefault);
			claimAmounts.totalExtraReward.should.eq(0);

			await MicrocreditManager.connect(manager1).claim()
				.should.emit(MicrocreditManager, "Claimed")
				.withArgs(manager1.address, 0, 0, baseRewardDefault, baseRewardDefaultClaimToken);

			let manager1Data = await MicrocreditManager.managers(manager1.address);
			manager1Data.rewardPeriodsLength.should.eq(2);

			manager1Data.rewardPeriodToClaim.should.eq(1);
			const manager1RewardPeriod0 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 0);
			manager1RewardPeriod0.startDate.should.eq(manager1StartDate0);
			manager1RewardPeriod0.endDate.should.eq(manager1StartDate0 + claimDelayDefault - 1);
			manager1RewardPeriod0.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod0.extraReward.should.eq(0);
			manager1RewardPeriod0.completedLoansLength.should.eq(0);

			const manager1StartDate1 = manager1StartDate0 + claimDelayDefault;
			const manager1RewardPeriod1 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 1);
			manager1RewardPeriod1.startDate.should.eq(manager1StartDate1);
			manager1RewardPeriod1.endDate.should.eq(manager1StartDate1 + claimDelayDefault - 1);
			manager1RewardPeriod1.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod1.extraReward.should.eq(0);
			manager1RewardPeriod1.completedLoansLength.should.eq(0);

			(await token2.balanceOf(MicrocreditManager.address))
				.should.eq(initialMicrocreditManagerToken2Balance.sub(baseRewardDefaultClaimToken));
			(await token2.balanceOf(manager1.address))
				.should.eq(initialManager1Token2Balance.add(baseRewardDefaultClaimToken));

			await advanceNSecondsAndBlock(claimDelayDefault);

			claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(baseRewardDefault);
			claimAmounts.totalExtraReward.should.eq(0);

			await MicrocreditManager.connect(manager1).claim()
				.should.emit(MicrocreditManager, "Claimed")
				.withArgs(manager1.address, 1, 1, baseRewardDefault, baseRewardDefaultClaimToken);

			manager1Data = await MicrocreditManager.managers(manager1.address);
			manager1Data.rewardPeriodsLength.should.eq(3);
			manager1Data.rewardPeriodToClaim.should.eq(2);

			const manager1StartDate2 = manager1StartDate1 + claimDelayDefault;
			const manager1RewardPeriod2 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 2);
			manager1RewardPeriod2.startDate.should.eq(manager1StartDate2);
			manager1RewardPeriod2.endDate.should.eq(manager1StartDate2 + claimDelayDefault - 1);
			manager1RewardPeriod2.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod2.extraReward.should.eq(0);
			manager1RewardPeriod2.completedLoansLength.should.eq(0);

			(await token2.balanceOf(MicrocreditManager.address))
				.should.eq(initialMicrocreditManagerToken2Balance.sub(baseRewardDefaultClaimToken.mul(2)));
			(await token2.balanceOf(manager1.address))
				.should.eq(initialManager1Token2Balance.add(baseRewardDefaultClaimToken.mul(2)));

			await MicrocreditManager.connect(manager1).claim()
				.should.be.rejectedWith('MicrocreditManager: No rewards to claim');
		});

		it("Should claim after multiple rewardPeriods", async function () {
			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token2.address, baseRewardDefault, claimDelayDefault)
				.should.be.fulfilled;

			const manager1StartDate0 = await getCurrentBlockTimestamp();

			let claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(0);
			claimAmounts.totalExtraReward.should.eq(0);

			await advanceNSecondsAndBlock(claimDelayDefault);

			claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(baseRewardDefault);
			claimAmounts.totalExtraReward.should.eq(0);

			await MicrocreditManager.connect(manager1).claim()
				.should.emit(MicrocreditManager, "Claimed")
				.withArgs(manager1.address, 0, 0, baseRewardDefault, baseRewardDefaultClaimToken);

			let manager1Data = await MicrocreditManager.managers(manager1.address);
			manager1Data.rewardPeriodsLength.should.eq(2);

			manager1Data.rewardPeriodToClaim.should.eq(1);
			const manager1RewardPeriod0 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 0);
			manager1RewardPeriod0.startDate.should.eq(manager1StartDate0);
			manager1RewardPeriod0.endDate.should.eq(manager1StartDate0 + claimDelayDefault - 1);
			manager1RewardPeriod0.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod0.extraReward.should.eq(0);
			manager1RewardPeriod0.completedLoansLength.should.eq(0);

			const manager1StartDate1 = manager1StartDate0 + claimDelayDefault;
			const manager1RewardPeriod1 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 1);
			manager1RewardPeriod1.startDate.should.eq(manager1StartDate1);
			manager1RewardPeriod1.endDate.should.eq(manager1StartDate1 + claimDelayDefault - 1);
			manager1RewardPeriod1.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod1.extraReward.should.eq(0);
			manager1RewardPeriod1.completedLoansLength.should.eq(0);

			(await token2.balanceOf(MicrocreditManager.address))
				.should.eq(initialMicrocreditManagerToken2Balance.sub(baseRewardDefaultClaimToken));
			(await token2.balanceOf(manager1.address))
				.should.eq(initialManager1Token2Balance.add(baseRewardDefaultClaimToken));

			await advanceNSecondsAndBlock(claimDelayDefault * 3);

			claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			claimAmounts.totalBaseReward.should.eq(baseRewardDefault.mul(3));
			claimAmounts.totalExtraReward.should.eq(0);


			const baseRewardDefaultClaimTokenX3After = await getExactInput(token1, token2, baseRewardDefault.mul(3));
			baseRewardDefaultClaimTokenX3After.should.eq(toEther('593.647373460164662190'));

			await MicrocreditManager.connect(manager1).claim()
				.should.emit(MicrocreditManager, "Claimed")
				.withArgs(manager1.address, 1, 3, baseRewardDefault.mul(3), baseRewardDefaultClaimTokenX3After);

			manager1Data = await MicrocreditManager.managers(manager1.address);
			manager1Data.rewardPeriodsLength.should.eq(5);
			manager1Data.rewardPeriodToClaim.should.eq(4);

			const manager1StartDate2 = manager1StartDate1 + claimDelayDefault;
			const manager1RewardPeriod2 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 2);
			manager1RewardPeriod2.startDate.should.eq(manager1StartDate2);
			manager1RewardPeriod2.endDate.should.eq(manager1StartDate2 + claimDelayDefault - 1);
			manager1RewardPeriod2.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod2.extraReward.should.eq(0);
			manager1RewardPeriod2.completedLoansLength.should.eq(0);

			const manager1StartDate3 = manager1StartDate2 + claimDelayDefault;
			const manager1RewardPeriod3 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 3);
			manager1RewardPeriod3.startDate.should.eq(manager1StartDate3);
			manager1RewardPeriod3.endDate.should.eq(manager1StartDate3 + claimDelayDefault - 1);
			manager1RewardPeriod3.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod3.extraReward.should.eq(0);
			manager1RewardPeriod3.completedLoansLength.should.eq(0);

			const manager1StartDate4 = manager1StartDate3 + claimDelayDefault;
			const manager1RewardPeriod4 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 4);
			manager1RewardPeriod4.startDate.should.eq(manager1StartDate4);
			manager1RewardPeriod4.endDate.should.eq(manager1StartDate4 + claimDelayDefault - 1);
			manager1RewardPeriod4.baseReward.should.eq(baseRewardDefault);
			manager1RewardPeriod4.extraReward.should.eq(0);
			manager1RewardPeriod4.completedLoansLength.should.eq(0);

			(await token2.balanceOf(MicrocreditManager.address))
				.should.eq(initialMicrocreditManagerToken2Balance.sub(baseRewardDefaultClaimToken).sub(baseRewardDefaultClaimTokenX3After));
			(await token2.balanceOf(manager1.address))
				.should.eq(initialManager1Token2Balance.add(baseRewardDefaultClaimToken).add(baseRewardDefaultClaimTokenX3After));

			await MicrocreditManager.connect(manager1).claim()
				.should.be.rejectedWith('MicrocreditManager: No rewards to claim');
		});
	});

	describe("MicrocreditManager - claim (same reference token, with extra rewards) ", () => {
		const oneMonth = 3600 * 24 * 30;
		const sixMonth = oneMonth * 6;

		function getDebtOnDayX(
			amount: BigNumber,
			dailyInterest: BigNumber,
			nrOfDays: number
		): BigNumber {
			while (nrOfDays >= 0) {
				amount = amount.add(
					amount.mul(dailyInterest).div(100).div(toEther(1))
				);
				nrOfDays--;
			}
			return amount;
		}
		
		before(async function () {
		});

		beforeEach(async () => {
			await deploy();
			
			await MicrocreditManager.connect(owner)
				.editTokenPair(token1.address, token2.address, 10000)
				.should.emit(MicrocreditManager, "TokenPairEdited");

			await Microcredit.connect(owner).addToken(token1.address, [], []);

			await token1.connect(deployer).mint(Microcredit.address, toEther(1000000));

			await Microcredit.connect(owner).addManagers(
				[manager1.address, manager2.address],
				[
					toEther(100000),
					toEther(100000)
				]
			);
		});

		it("Should repay even if the manager isn't added into MicrocreditManager", async function () {
			const amount1 = toEther(100);
			const period1 = sixMonth;
			const dailyInterest1 = toEther(0.2);
			const claimDeadline1 = (await getCurrentBlockTimestamp()) + 1000;


			const expectedDebt1 = getDebtOnDayX(amount1, dailyInterest1, 0);

			await Microcredit.connect(manager1)
				.addLoan(
					borrower1.address,
					token1.address,
					amount1,
					period1,
					dailyInterest1,
					claimDeadline1
				);

			await Microcredit.connect(borrower1).claimLoan(0);

			await token1
				.connect(borrower1)
				.approve(Microcredit.address, expectedDebt1);

			await Microcredit.connect(borrower1).repayLoan(0, expectedDebt1);
		});
		
		it("Should claim after one reward period", async function () {
			await MicrocreditManager.connect(owner)
				.addManager(manager1.address, token1.address, token2.address, baseRewardDefault, claimDelayDefault);

			const manager1StartDate0 = await getCurrentBlockTimestamp();

			const amount1 = toEther(100);
			const period1 = sixMonth;
			const dailyInterest1 = toEther(0.2);
			const claimDeadline1 = (await getCurrentBlockTimestamp()) + 1000;

			const expectedDebt1 = getDebtOnDayX(amount1, dailyInterest1, 0);

			await Microcredit.connect(manager1)
				.addLoan(
					borrower1.address,
					token1.address,
					amount1,
					period1,
					dailyInterest1,
					claimDeadline1
				);

			await Microcredit.connect(borrower1).claimLoan(0);

			await token1
				.connect(borrower1)
				.approve(Microcredit.address, expectedDebt1);

			await Microcredit.connect(borrower1).repayLoan(0, expectedDebt1);

			const manager1RewardPeriod0 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 0);
			manager1RewardPeriod0.startDate.should.eq(manager1StartDate0);
			manager1RewardPeriod0.endDate.should.eq(manager1StartDate0 + claimDelayDefault - 1);
			manager1RewardPeriod0.baseReward.should.eq(baseRewardDefault);
			// manager1RewardPeriod0.extraReward.should.eq((expectedDebt1.sub(amount1).mul(rewardPercentage).div(100)));
			manager1RewardPeriod0.extraReward.should.eq(0);
			manager1RewardPeriod0.completedLoansLength.should.eq(1);


			const manager1RewardPeriod0Loan0 =  await MicrocreditManager.managerRewardPeriodLoan(manager1.address, 0, 0);
			manager1RewardPeriod0Loan0.borrowerAddress.should.eq(borrower1.address);
			manager1RewardPeriod0Loan0.borrowerLoanId.should.eq(0);







			// let claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			// claimAmounts.totalBaseReward.should.eq(0);
			// claimAmounts.totalExtraReward.should.eq(0);
			//
			// await advanceNSecondsAndBlock(claimDelayDefault);
			//
			// claimAmounts = await MicrocreditManager.callStatic.claimAmounts(manager1.address);
			// claimAmounts.totalBaseReward.should.eq(baseRewardDefault);
			// claimAmounts.totalExtraReward.should.eq(0);
			//
			// await MicrocreditManager.connect(manager1).claim()
			// 	.should.emit(MicrocreditManager, "Claimed")
			// 	.withArgs(manager1.address, 0, 0, baseRewardDefault, baseRewardDefaultClaimToken);
			//
			// const manager1Data = await MicrocreditManager.managers(manager1.address);
			// manager1Data.rewardPeriodsLength.should.eq(2);
			//
			// manager1Data.rewardPeriodToClaim.should.eq(1);
			// const manager1RewardPeriod0 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 0);
			// manager1RewardPeriod0.startDate.should.eq(manager1StartDate0);
			// manager1RewardPeriod0.endDate.should.eq(manager1StartDate0 + claimDelayDefault - 1);
			// manager1RewardPeriod0.baseReward.should.eq(baseRewardDefault);
			// manager1RewardPeriod0.extraReward.should.eq(0);
			// manager1RewardPeriod0.completedLoansLength.should.eq(0);
			//
			// const manager1StartDate1 = manager1StartDate0 + claimDelayDefault;
			// const manager1RewardPeriod1 =  await MicrocreditManager.callStatic.managerRewardPeriods(manager1.address, 1);
			// manager1RewardPeriod1.startDate.should.eq(manager1StartDate1);
			// manager1RewardPeriod1.endDate.should.eq(manager1StartDate1 + claimDelayDefault - 1);
			// manager1RewardPeriod1.baseReward.should.eq(baseRewardDefault);
			// manager1RewardPeriod1.extraReward.should.eq(0);
			// manager1RewardPeriod1.completedLoansLength.should.eq(0);
			//
			// (await token1.balanceOf(MicrocreditManager.address))
			// 	.should.eq(initialMicrocreditManagerToken1Balance);
			// (await token1.balanceOf(manager1.address))
			// 	.should.eq(initialManager1Token1Balance);
			//
			// (await token2.balanceOf(MicrocreditManager.address))
			// 	.should.eq(initialMicrocreditManagerToken2Balance.sub(baseRewardDefaultClaimToken));
			// (await token2.balanceOf(manager1.address))
			// 	.should.eq(initialManager1Token2Balance.add(baseRewardDefaultClaimToken));
			//
			// await MicrocreditManager.connect(manager1).claim()
			// 	.should.be.rejectedWith('MicrocreditManager: No rewards to claim');
		});
	});
});
