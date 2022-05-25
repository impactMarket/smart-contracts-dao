// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { advanceBlockNTimes, advanceToBlockN } from "../utils/TimeTravel";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { BigNumber } from "@ethersproject/bignumber";
import { toEther } from "../utils/helpers";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Staking", () => {
	const COOLDOWN = 100;
	const DONATION_MINER_FIRST_BLOCK = 130;

	let owner: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let user4: SignerWithAddress;
	let user5: SignerWithAddress;
	let user6: SignerWithAddress;
	let user7: SignerWithAddress;
	let user8: SignerWithAddress;
	let user9: SignerWithAddress;

	let ImpactProxyAdmin: ethersTypes.Contract;
	let DonationMiner: ethersTypes.Contract;
	let PACT: ethersTypes.Contract;
	let SPACT: ethersTypes.Contract;
	let Staking: ethersTypes.Contract;

	const deploy = deployments.createFixture(async () => {
		await deployments.fixture("Test", { fallbackToGlobal: false });

		[owner, user1, user2, user3, user4, user5, user6, user7, user8, user9] =
			await ethers.getSigners();

		ImpactProxyAdmin = await ethers.getContractAt(
			"ImpactProxyAdmin",
			(
				await deployments.get("ImpactProxyAdmin")
			).address
		);

		DonationMiner = await ethers.getContractAt(
			"DonationMinerImplementation",
			(
				await deployments.get("DonationMinerProxy")
			).address
		);

		PACT = await ethers.getContractAt(
			"PACTToken",
			(
				await deployments.get("PACTToken")
			).address
		);

		SPACT = await ethers.getContractAt(
			"SPACTToken",
			(
				await deployments.get("SPACTToken")
			).address
		);

		Staking = await ethers.getContractAt(
			"StakingImplementation",
			(
				await deployments.get("StakingProxy")
			).address
		);

		await PACT.transfer(user1.address, toEther("1000000"));
		await PACT.transfer(user2.address, toEther("2000000"));
		await PACT.transfer(user3.address, toEther("3000000"));
		await PACT.transfer(user4.address, toEther("4000000"));
		await PACT.transfer(user5.address, toEther("5000000"));

		await SPACT.transferOwnership(Staking.address);
	});

	async function checkDonationMinerRewardPeriod(
		totalAmount: number | BigNumber
	) {
		const rewardPeriodCount = await DonationMiner.rewardPeriodCount();
		const rewardPeriod = await DonationMiner.rewardPeriods(
			rewardPeriodCount
		);

		expect(rewardPeriod.stakesAmount).to.be.equal(totalAmount);
	}

	describe("Staking - basic", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await advanceToBlockN(DONATION_MINER_FIRST_BLOCK);
		});

		it("should have correct values", async function () {
			expect(await Staking.PACT()).to.be.equal(PACT.address);
			expect(await Staking.SPACT()).to.be.equal(SPACT.address);
			expect(await Staking.cooldown()).to.be.equal(COOLDOWN);
			expect(await Staking.donationMiner()).to.be.equal(
				DonationMiner.address
			);
		});

		it("should not stake 0", async function () {
			await expect(
				Staking.connect(user1).stake(user1.address, 0)
			).to.be.rejectedWith("Stake::stake: Amount can't be 0");
			await checkDonationMinerRewardPeriod(0);
		});

		it("should stake", async function () {
			let spactBalance: any;

			const stakeAmount = toEther("100");
			const initialPACTBalance = await PACT.balanceOf(user1.address);

			await PACT.connect(user1).approve(Staking.address, stakeAmount);

			await expect(
				Staking.connect(user1).stake(user1.address, stakeAmount)
			).to.be.fulfilled;

			expect(await Staking.stakeholdersListLength()).to.be.equal(1);
			expect(await Staking.stakeholdersListAt(0)).to.be.equal(
				user1.address
			);

			expect(await Staking.stakeholderAmount(user1.address)).to.be.equal(
				stakeAmount
			);
			expect(await Staking.currentTotalAmount()).to.be.equal(stakeAmount);
			await checkDonationMinerRewardPeriod(stakeAmount);

			spactBalance = stakeAmount;
			expect(await SPACT.balanceOf(user1.address)).to.be.equal(
				spactBalance
			);
			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				initialPACTBalance.sub(spactBalance)
			);

			expect(await PACT.totalSupply()).to.be.equal(
				toEther("10000000000")
			);
			expect(await SPACT.totalSupply()).to.be.equal(stakeAmount);
		});

		it("should stake for someone else", async function () {
			const stakeAmount = toEther("100");
			const user1InitialPACTBalance = await PACT.balanceOf(user1.address);
			const user2InitialPACTBalance = await PACT.balanceOf(user2.address);

			await PACT.connect(user1).approve(Staking.address, stakeAmount);

			await expect(
				Staking.connect(user1).stake(user2.address, stakeAmount)
			).to.be.fulfilled;

			expect(await Staking.stakeholdersListLength()).to.be.equal(1);
			expect(await Staking.stakeholdersListAt(0)).to.be.equal(
				user2.address
			);

			expect(await Staking.stakeholderAmount(user1.address)).to.be.equal(
				0
			);
			expect(await Staking.stakeholderAmount(user2.address)).to.be.equal(
				stakeAmount
			);
			expect(await Staking.currentTotalAmount()).to.be.equal(stakeAmount);

			expect(await SPACT.balanceOf(user1.address)).to.be.equal(0);
			expect(await SPACT.balanceOf(user2.address)).to.be.equal(
				stakeAmount
			);
			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.sub(stakeAmount)
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance
			);

			expect(await PACT.totalSupply()).to.be.equal(
				toEther("10000000000")
			);
			expect(await SPACT.totalSupply()).to.be.equal(stakeAmount);
		});

		it("should stake multiples holders", async function () {
			let spactBalance: any;
			const user1StakeAmount1 = toEther("101");
			const user1StakeAmount2 = toEther("102");
			const user2StakeAmount1 = toEther("201");
			const totalAmount = toEther("404");
			const user1InitialPACTBalance = await PACT.balanceOf(user1.address);
			const user2InitialPACTBalance = await PACT.balanceOf(user2.address);

			await PACT.connect(user1).approve(
				Staking.address,
				user1StakeAmount1.add(user1StakeAmount2)
			);
			await PACT.connect(user2).approve(
				Staking.address,
				user2StakeAmount1
			);

			await expect(
				Staking.connect(user1).stake(user1.address, user1StakeAmount1)
			).to.be.fulfilled;
			await expect(
				Staking.connect(user2).stake(user2.address, user2StakeAmount1)
			).to.be.fulfilled;
			await expect(
				Staking.connect(user1).stake(user1.address, user1StakeAmount2)
			).to.be.fulfilled;

			expect(await Staking.stakeholdersListLength()).to.be.equal(2);
			expect(await Staking.stakeholdersListAt(0)).to.be.equal(
				user1.address
			);
			expect(await Staking.stakeholdersListAt(1)).to.be.equal(
				user2.address
			);

			expect(await Staking.stakeholderAmount(user1.address)).to.be.equal(
				user1StakeAmount1.add(user1StakeAmount2)
			);
			expect(await Staking.currentTotalAmount()).to.be.equal(totalAmount);
			await checkDonationMinerRewardPeriod(totalAmount);

			spactBalance = user1StakeAmount1.add(user1StakeAmount2);
			expect(await SPACT.balanceOf(user1.address)).to.be.equal(
				spactBalance
			);
			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.sub(spactBalance)
			);

			spactBalance = user2StakeAmount1;
			expect(await SPACT.balanceOf(user2.address)).to.be.equal(
				spactBalance
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(spactBalance)
			);

			expect(await PACT.totalSupply()).to.be.equal(
				toEther("10000000000")
			);
			expect(await SPACT.totalSupply()).to.be.equal(totalAmount);
		});

		it("should emit event when staking", async function () {
			const stakeAmount = toEther("100");

			await PACT.connect(user1).approve(Staking.address, stakeAmount);
			await expect(
				Staking.connect(user1).stake(user1.address, stakeAmount)
			)
				.to.emit(Staking, "Staked")
				.withArgs(user1.address, stakeAmount);
		});

		it("should not unstake 0", async function () {
			await expect(Staking.connect(user1).unstake(0)).to.be.rejectedWith(
				"Stake::unstake: Unstake amount should not be 0"
			);
		});

		it("should not unstake if not enough funds #1", async function () {
			await expect(Staking.connect(user1).unstake(1)).to.be.rejectedWith(
				"Stake::unstake: Not enough funds"
			);
		});

		it("should unstake", async function () {
			let spactBalance: any;
			const stakeAmount = toEther("100");
			const user1InitialPACTBalance = await PACT.balanceOf(user1.address);

			await PACT.connect(user1).approve(Staking.address, stakeAmount);
			await Staking.connect(user1).stake(user1.address, stakeAmount);
			await expect(Staking.connect(user1).unstake(toEther("60"))).to.be
				.fulfilled;

			expect(await Staking.stakeholderAmount(user1.address)).to.be.equal(
				toEther("40")
			);
			expect(await Staking.currentTotalAmount()).to.be.equal(
				toEther("40")
			);
			await checkDonationMinerRewardPeriod(toEther("40"));

			spactBalance = stakeAmount;
			expect(await SPACT.balanceOf(user1.address)).to.be.equal(
				stakeAmount
			);
			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.sub(spactBalance)
			);
		});

		it("should not unstake if not enough funds #2", async function () {
			const stakeAmount = toEther("100");

			await PACT.connect(user1).approve(Staking.address, stakeAmount);
			await Staking.connect(user1).stake(user1.address, stakeAmount);
			await expect(
				Staking.connect(user1).unstake(toEther("200"))
			).to.be.rejectedWith("Stake::unstake: Not enough funds");
		});

		it("should not unstake if not enough funds #3", async function () {
			const stakeAmount = toEther("100");

			await PACT.connect(user1).approve(Staking.address, stakeAmount);
			await Staking.connect(user1).stake(user1.address, stakeAmount);
			await expect(Staking.connect(user1).unstake(toEther("90"))).to.be
				.fulfilled;
			await expect(
				Staking.connect(user1).unstake(toEther("50"))
			).to.be.rejectedWith("Stake::unstake: Not enough funds");
		});

		it("should not claim if not enough funds #1", async function () {
			await expect(Staking.connect(user1).claim()).to.be.rejectedWith(
				"Stake::claim: No funds to claim"
			);
		});

		it("should not claim if not enough funds #2", async function () {
			const stakeAmount = toEther("100");

			await PACT.connect(user1).approve(Staking.address, stakeAmount);
			await Staking.connect(user1).stake(user1.address, stakeAmount);
			await expect(Staking.connect(user1).unstake(toEther("50"))).to.be
				.fulfilled;

			await expect(Staking.connect(user1).claim()).to.be.rejectedWith(
				"Stake::claim: No funds to claim"
			);
		});

		it("should claim", async function () {
			let spactBalance: any;
			const stakeAmount = toEther("100");
			const user1InitialPACTBalance = await PACT.balanceOf(user1.address);

			await PACT.connect(user1).approve(Staking.address, stakeAmount);
			await Staking.connect(user1).stake(user1.address, stakeAmount);
			await expect(Staking.connect(user1).unstake(toEther("60"))).to.be
				.fulfilled;

			await advanceBlockNTimes(COOLDOWN);

			await expect(Staking.connect(user1).claim()).to.be.fulfilled;

			expect(await Staking.stakeholderAmount(user1.address)).to.be.equal(
				toEther("40")
			);
			expect(await Staking.currentTotalAmount()).to.be.equal(
				toEther("40")
			);
			await checkDonationMinerRewardPeriod(toEther("40"));

			spactBalance = toEther("40");
			expect(await SPACT.balanceOf(user1.address)).to.be.equal(
				spactBalance
			);
			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.sub(spactBalance)
			);
		});

		it("should not claim partial if lastUnstakeId to big", async function () {
			let spactBalance: any;
			const stakeAmount = toEther("100");

			await PACT.connect(user1).approve(Staking.address, stakeAmount);
			await Staking.connect(user1).stake(user1.address, stakeAmount);
			await expect(Staking.connect(user1).unstake(toEther("60"))).to.be
				.fulfilled;

			await advanceBlockNTimes(COOLDOWN);

			await expect(
				Staking.connect(user1).claimPartial(1)
			).to.be.rejectedWith("Stake::claimPartial: lastUnstakeId too big");
		});

		it("should claim partial #1", async function () {
			let spactBalance: any;
			const stakeAmount = toEther("100");
			const user1InitialPACTBalance = await PACT.balanceOf(user1.address);

			await PACT.connect(user1).approve(Staking.address, stakeAmount);
			await Staking.connect(user1).stake(user1.address, stakeAmount);
			await expect(Staking.connect(user1).unstake(toEther("60"))).to.be
				.fulfilled;
			await expect(Staking.connect(user1).unstake(toEther("10"))).to.be
				.fulfilled;

			await advanceBlockNTimes(COOLDOWN);

			await expect(Staking.connect(user1).claimPartial(0)).to.be
				.fulfilled;

			expect(await Staking.stakeholderAmount(user1.address)).to.be.equal(
				toEther("30")
			);
			expect(await Staking.currentTotalAmount()).to.be.equal(
				toEther("30")
			);
			await checkDonationMinerRewardPeriod(toEther("30"));

			spactBalance = toEther("40");
			expect(await SPACT.balanceOf(user1.address)).to.be.equal(
				spactBalance
			);
			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.sub(spactBalance)
			);
		});

		it("should claim partial #2", async function () {
			let spactBalance: any;
			const stakeAmount = toEther("100");
			const user1InitialPACTBalance = await PACT.balanceOf(user1.address);

			await PACT.connect(user1).approve(Staking.address, stakeAmount);
			await Staking.connect(user1).stake(user1.address, stakeAmount);
			await expect(Staking.connect(user1).unstake(toEther("50"))).to.be
				.fulfilled;
			await expect(Staking.connect(user1).unstake(toEther("10"))).to.be
				.fulfilled;

			await advanceBlockNTimes(COOLDOWN);

			await expect(Staking.connect(user1).claimPartial(1)).to.be
				.fulfilled;

			expect(await Staking.stakeholderAmount(user1.address)).to.be.equal(
				toEther("40")
			);
			expect(await Staking.currentTotalAmount()).to.be.equal(
				toEther("40")
			);
			await checkDonationMinerRewardPeriod(toEther("40"));

			spactBalance = toEther("40");
			expect(await SPACT.balanceOf(user1.address)).to.be.equal(
				spactBalance
			);
			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.sub(spactBalance)
			);
		});

		it("should stake, unstake and claim multiple holders", async function () {
			let spactBalance: any;
			const user1StakeAmount1 = toEther("101");
			const user1StakeAmount2 = toEther("102");
			const user1StakeAmount3 = toEther("103");
			const user2StakeAmount1 = toEther("201");
			const user2StakeAmount2 = toEther("202");
			const user3StakeAmount1 = toEther("301");
			const user3StakeAmount2 = toEther("302");
			const totalAmount = toEther("1312");

			const user1InitialPACTBalance = await PACT.balanceOf(user1.address);
			const user2InitialPACTBalance = await PACT.balanceOf(user2.address);
			const user3InitialPACTBalance = await PACT.balanceOf(user3.address);

			await PACT.connect(user1).approve(Staking.address, toEther("306"));
			await PACT.connect(user2).approve(Staking.address, toEther("403"));
			await PACT.connect(user3).approve(Staking.address, toEther("603"));

			await expect(
				Staking.connect(user1).stake(user1.address, user1StakeAmount1)
			).to.be.fulfilled; //0
			await expect(
				Staking.connect(user2).stake(user2.address, user2StakeAmount1)
			).to.be.fulfilled; //1
			await expect(
				Staking.connect(user3).stake(user3.address, user3StakeAmount1)
			).to.be.fulfilled; //2

			await expect(Staking.connect(user2).unstake(toEther("50"))).to.be
				.fulfilled;

			await expect(
				Staking.connect(user3).stake(user3.address, user3StakeAmount2)
			).to.be.fulfilled; //3

			await expect(Staking.connect(user3).unstake(toEther("60"))).to.be
				.fulfilled;

			await advanceBlockNTimes(COOLDOWN);

			await expect(Staking.connect(user3).unstake(toEther("70"))).to.be
				.fulfilled;

			await expect(
				Staking.connect(user1).stake(user1.address, user1StakeAmount2)
			).to.be.fulfilled; //4
			await expect(Staking.connect(user1).unstake(toEther("80"))).to.be
				.fulfilled;

			await expect(Staking.connect(user3).claim()).to.be.fulfilled;

			await expect(
				Staking.connect(user2).stake(user2.address, user2StakeAmount2)
			).to.be.fulfilled; //5
			await expect(
				Staking.connect(user1).stake(user1.address, user1StakeAmount3)
			).to.be.fulfilled; //6

			//general asserts
			expect(await Staking.currentTotalAmount()).to.be.equal(
				totalAmount.sub(toEther(50 + 60 + 70 + 80))
			);
			await checkDonationMinerRewardPeriod(
				totalAmount.sub(toEther(50 + 60 + 70 + 80))
			);
			expect(await Staking.stakeholdersListLength()).to.be.equal(3);

			expect(await Staking.stakeholdersListAt(0)).to.be.equal(
				user1.address
			);
			expect(await Staking.stakeholdersListAt(1)).to.be.equal(
				user2.address
			);
			expect(await Staking.stakeholdersListAt(2)).to.be.equal(
				user3.address
			);

			expect(await PACT.totalSupply()).to.be.equal(
				toEther("10000000000")
			);
			expect(await SPACT.totalSupply()).to.be.equal(
				totalAmount.sub(toEther("60"))
			);

			//user asserts
			expect(await Staking.stakeholderAmount(user1.address)).to.be.equal(
				user1StakeAmount1
					.add(user1StakeAmount2)
					.add(user1StakeAmount3)
					.sub(toEther("80"))
			);
			spactBalance = user1StakeAmount1
				.add(user1StakeAmount2)
				.add(user1StakeAmount3);
			expect(await SPACT.balanceOf(user1.address)).to.be.equal(
				spactBalance
			);
			expect(await PACT.balanceOf(user1.address)).to.be.equal(
				user1InitialPACTBalance.sub(spactBalance)
			);

			expect(await Staking.stakeholderAmount(user2.address)).to.be.equal(
				user2StakeAmount1.add(user2StakeAmount2).sub(toEther("50"))
			);
			spactBalance = user2StakeAmount1.add(user2StakeAmount2);
			expect(await SPACT.balanceOf(user2.address)).to.be.equal(
				spactBalance
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance
					.sub(user2StakeAmount1)
					.sub(user2StakeAmount2)
			);

			expect(await Staking.stakeholderAmount(user3.address)).to.be.equal(
				user3StakeAmount1.add(user3StakeAmount2).sub(toEther(60 + 70))
			);
			spactBalance = user3StakeAmount1
				.add(user3StakeAmount2)
				.sub(toEther("60"));
			expect(await SPACT.balanceOf(user3.address)).to.be.equal(
				spactBalance
			);
			expect(await PACT.balanceOf(user3.address)).to.be.equal(
				user3InitialPACTBalance.sub(spactBalance)
			);

			await expect(Staking.connect(user2).unstake(toEther("10"))).to.be
				.fulfilled;
			await expect(Staking.connect(user2).unstake(toEther("20"))).to.be
				.fulfilled;
			await expect(Staking.connect(user2).unstake(toEther("30"))).to.be
				.fulfilled;
			await expect(Staking.connect(user2).unstake(toEther("40"))).to.be
				.fulfilled;

			await expect(Staking.connect(user2).claim()).to.be.fulfilled;

			expect(await SPACT.totalSupply()).to.be.equal(
				totalAmount.sub(toEther(50 + 60))
			);
			expect(await Staking.stakeholderAmount(user2.address)).to.be.equal(
				user2StakeAmount1
					.add(user2StakeAmount2)
					.sub(toEther(10 + 20 + 30 + 40 + 50))
			);
			spactBalance = user2StakeAmount1
				.add(user2StakeAmount2)
				.sub(toEther("50"));
			expect(await SPACT.balanceOf(user2.address)).to.be.equal(
				spactBalance
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(spactBalance)
			);

			await advanceBlockNTimes(COOLDOWN);
			await expect(Staking.connect(user2).claim()).to.be.fulfilled;
			expect(await SPACT.totalSupply()).to.be.equal(
				totalAmount.sub(toEther(10 + 20 + 30 + 40 + 50 + 60))
			);
			expect(await Staking.stakeholderAmount(user2.address)).to.be.equal(
				user2StakeAmount1
					.add(user2StakeAmount2)
					.sub(toEther(10 + 20 + 30 + 40 + 50))
			);
			spactBalance = user2StakeAmount1
				.add(user2StakeAmount2)
				.sub(toEther(10 + 20 + 30 + 40 + 50));
			expect(await SPACT.balanceOf(user2.address)).to.be.equal(
				spactBalance
			);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance.sub(spactBalance)
			);

			await expect(
				Staking.connect(user2).unstake(
					user2StakeAmount1
						.add(user2StakeAmount2)
						.sub(toEther(10 + 20 + 30 + 40 + 50))
				)
			).to.be.fulfilled;
			await advanceBlockNTimes(COOLDOWN);
			await expect(Staking.connect(user2).claim()).to.be.fulfilled;
			expect(await SPACT.balanceOf(user2.address)).to.be.equal(0);
			expect(await PACT.balanceOf(user2.address)).to.be.equal(
				user2InitialPACTBalance
			);
		});
	});
});
