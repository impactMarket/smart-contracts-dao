// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { advanceBlockNTimes, advanceToBlockN } from "../utils/TimeTravel";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { fromEther, toEther } from "../utils/helpers";
import deposit from "../../deploy/test/deposit";
import { ZERO_ADDRESS } from "../../integrations/moola/helpers/constants";
import { BigNumber } from "@ethersproject/bignumber";


const MTokenABI = require('../../integrations/moola/abi/MToken.json');


chai.use(chaiAsPromised);
const expect = chai.expect;

//these tests work only on a celo mainnet fork network
describe.only("Deposit", () => {
	const LENDING_POOL_ADDRESS = "0x970b12522CA9b4054807a2c5B736149a5BE6f670"; //mainnet
	const CELO_ADDRESS = "0x471EcE3750Da237f93B8E339c536989b8978a438"; //mainnet
	const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a"; //mainnet
	const MCUSD_ADDRESS = "0x918146359264C492BD6934071c6Bd31C854EDBc3"; //mainnet
	const UNISWAP_ADDRESS = "0x67316300f17f063085Ca8bCa4bd3f7a5a3C66275"; //mainnet
	const CELO_VALIDATOR_ADDRESS = "0xaEb865bCa93DdC8F47b8e29F40C5399cE34d0C58"; //mainnet

	const FAKE_ADDRESS = "0x000000000000000000000000000000000000dEaD";

	const IRRELEVANT_DECIMALS = 1e14;

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
	let cUSD: ethersTypes.Contract;
	let mcUSD: ethersTypes.Contract;
	let celo: ethersTypes.Contract;
	let Deposit: ethersTypes.Contract;
	let Treasury: ethersTypes.Contract;
	let UniswapRouter: ethersTypes.Contract;

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

		cUSD = await ethers.getContractAt("TokenMock", CUSD_ADDRESS);
		mcUSD = await ethers.getContractAt(MTokenABI, MCUSD_ADDRESS);
		celo = await ethers.getContractAt("TokenMock", CELO_ADDRESS);

		// UniswapRouter = await ethers.getContractAt("UniswapV2Router02", UNISWAP_ADDRESS);

		Treasury = await ethers.getContractAt(
			"TreasuryImplementation",
			(
				await deployments.get("TreasuryProxy")
			).address
		);

		Deposit = await ethers.getContractAt(
			"DepositImplementation",
			(
				await deployments.get("DepositProxy")
			).address
		);
	});

	function closeToAssert(a: BigNumber, b: BigNumber, irrelevantDecimals: number = 14) {
		const precision = Math.pow(10, irrelevantDecimals);
		expect(a.div(precision)).eq(b.div(precision));
	}

	describe("Deposit - basic", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();
		});

		it("should have correct values", async function () {
			expect(await Deposit.getVersion()).to.be.equal(1);
			expect(await Deposit.treasury()).to.be.equal(Treasury.address);
			expect(await Deposit.lendingPool()).to.be.equal(LENDING_POOL_ADDRESS);
			expect(await Deposit.owner()).to.be.equal(owner.address);
			expect(await Deposit.tokenListLength()).to.be.equal(0);
		});

		// it("should emit event when staking", async function () {
		// 	const stakeAmount = toEther("100");
		//
		// 	await PACT.connect(user1).approve(Staking.address, stakeAmount);
		// 	await expect(
		// 		Staking.connect(user1).stake(user1.address, stakeAmount)
		// 	)
		// 		.to.emit(Staking, "Staked")
		// 		.withArgs(user1.address, stakeAmount);
		// });

		it("Should update treasury if admin", async function () {
			expect(await Deposit.treasury()).to.be.equal(
				Treasury.address
			);
			await Deposit.updateTreasury(FAKE_ADDRESS);
			expect(await Deposit.treasury()).to.be.equal(FAKE_ADDRESS);
		});

		it("Should not update treasury if not admin", async function () {
			expect(await Deposit.treasury()).to.be.equal(
				Treasury.address
			);
			await expect(
				Deposit.connect(user1).updateTreasury(FAKE_ADDRESS)
			).to.be.rejectedWith("Ownable: caller is not the owner");
			expect(await Deposit.treasury()).to.be.equal(Treasury.address);
		});

		it("Should update lendingPool if admin", async function () {
			expect(await Deposit.lendingPool()).to.be.equal(
				LENDING_POOL_ADDRESS
			);
			await Deposit.updateLendingPool(FAKE_ADDRESS);
			expect(await Deposit.lendingPool()).to.be.equal(FAKE_ADDRESS);
		});

		it("Should not update lendingPool if not admin", async function () {
			expect(await Deposit.lendingPool()).to.be.equal(
				LENDING_POOL_ADDRESS
			);
			await expect(
				Deposit.connect(user1).updateLendingPool(FAKE_ADDRESS)
			).to.be.rejectedWith("Ownable: caller is not the owner");
			expect(await Deposit.lendingPool()).to.be.equal(LENDING_POOL_ADDRESS);
		});

		it("Should transfer ownership if admin", async function () {
			expect(await Deposit.owner()).to.be.equal(
				owner.address
			);
			await Deposit.transferOwnership(user1.address);
			expect(await Deposit.owner()).to.be.equal(user1.address);
		});

		it("Should not transfer ownership if not admin", async function () {
			expect(await Deposit.owner()).to.be.equal(
				owner.address
			);
			await expect(
				Deposit.connect(user1).transferOwnership(user2.address)
			).to.be.rejectedWith("Ownable: caller is not the owner");
			expect(await Deposit.owner()).to.be.equal(owner.address);
		});

		it("Should not add token if not owner", async function () {
			await expect(
				Deposit.connect(user1).addToken(cUSD.address)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(await Deposit.tokenListLength()).to.be.equal(0);
			expect(await Deposit.isToken(cUSD.address)).to.be.equal(false);
		});

		it("Should not add an invalid treasury token", async function () {
			await expect(
				Deposit.addToken(FAKE_ADDRESS)
			).to.be.rejectedWith("Deposit::addToken: it must be a valid treasury token");

			expect(await Deposit.tokenListLength()).to.be.equal(0);
			expect(await Deposit.isToken(cUSD.address)).to.be.equal(false);
		});

		it("Should not add an invalid lendingPool token", async function () {
			await Treasury.setToken(FAKE_ADDRESS, 500, []);

			await expect(
				Deposit.addToken(FAKE_ADDRESS)
			).to.be.rejectedWith("Deposit::addToken: it must be a valid lendingPool token");

			expect(await Deposit.tokenListLength()).to.be.equal(0);
			expect(await Deposit.isToken(FAKE_ADDRESS)).to.be.equal(false);
		});

		it("Should add a valid token if admin", async function () {
			await Treasury.setToken(cUSD.address, 1000, []);

			await expect(Deposit.addToken(cUSD.address))
				.to.emit(Deposit, "TokenAdded")
				.withArgs(cUSD.address);

			expect(await Deposit.tokenListLength()).to.be.equal(1);
			expect(await Deposit.isToken(cUSD.address)).to.be.equal(true);
		});

		it("Should not add a valid token twice", async function () {
			await Treasury.setToken(cUSD.address, 1000, []);

			await Deposit.addToken(cUSD.address);

			await expect(
				Deposit.addToken(cUSD.address)
			).to.be.rejectedWith("Deposit::addToken: token already added");

			expect(await Deposit.tokenListLength()).to.be.equal(1);
			expect(await Deposit.isToken(cUSD.address)).to.be.equal(true);
		});

		it("Should not remove token if not admin", async function () {
			await Treasury.setToken(cUSD.address, 1000, []);

			await Deposit.addToken(cUSD.address);

			await expect(
				Deposit.connect(user1).removeToken(cUSD.address)
			).to.be.rejectedWith("Ownable: caller is not the owner");

			expect(await Deposit.tokenListLength()).to.be.equal(1);
			expect(await Deposit.isToken(cUSD.address)).to.be.equal(true);
		});

		it("Should remove token if admin", async function () {
			await Treasury.setToken(cUSD.address, 1000, []);

			await Deposit.addToken(cUSD.address);

			await expect(Deposit.removeToken(cUSD.address))
				.to.emit(Deposit, "TokenRemoved")
				.withArgs(cUSD.address);

			expect(await Deposit.tokenListLength()).to.be.equal(0);
			expect(await Deposit.isToken(cUSD.address)).to.be.equal(false);
		});
	});

	describe.only("Deposit - deposit", () => {
		before(async function() {
		});

		beforeEach(async () => {
			await deploy();

			await Treasury.setToken(cUSD.address, 1000, []);
			await Deposit.addToken(cUSD.address);


			await ethers.provider.send("hardhat_impersonateAccount", [CUSD_ADDRESS]);
			const cUSDWallet = await ethers.provider.getSigner(CUSD_ADDRESS);

			await cUSD.connect(cUSDWallet).transfer(user1.address, toEther(1000))
			await cUSD.connect(cUSDWallet).transfer(user2.address, toEther(1000))
			await cUSD.connect(cUSDWallet).transfer(user3.address, toEther(1000))
			await cUSD.connect(cUSDWallet).transfer(user4.address, toEther(1000))
			await cUSD.connect(cUSDWallet).transfer(user5.address, toEther(1000))

			// await cUSD.connect(user1).approve(UniswapRouter.address, toEther(1000));
			// await UniswapRouter.connect(user1).swapExactTokensForTokensSupportingFeeOnTransferTokens(
			// 	toEther(500),
			// 	1,
			// 	[CELO_ADDRESS, CUSD_ADDRESS],
			// 	user1.address,
			// 	1779710677
			// );

			// console.log(await cUSD.balanceOf(user1.address));







			// await celo.transfer(celoValidator.getAddress(), toEther(1));
			//
			//
			// console.log(await ethers.provider.getBalance(owner.address));
			// console.log(await ethers.provider.getBalance(celoValidator.getAddress()));
			//
			// await owner.sendTransaction({
			// 	to: celoValidator.getAddress(),
			// 	value: toEther(1)
			// });
			//
			// // await owner.sendTransaction({
			// // 	to: cUSDRegistry.getAddress(),
			// // 	value: toEther(1)
			// // });
			// console.log(await ethers.provider.getBalance(owner.address));
			// console.log(await ethers.provider.getBalance(celoValidator.getAddress()));
			// //
			// //
			// //
			// await cUSD.connect(celoValidator).mint(user1.address, toEther(1000));
			// await cUSD.connect(celoValidator).mint(user2.address, toEther(1000));
			// await cUSD.connect(celoValidator).mint(user3.address, toEther(1000));
			// await cUSD.connect(celoValidator).mint(user4.address, toEther(1000));
			// await cUSD.connect(celoValidator).mint(user5.address, toEther(1000));
		});

		it("Should not deposit invalid token", async function() {
			await expect(
				Deposit.connect(user1).deposit(FAKE_ADDRESS, toEther(1))
			).to.be.rejectedWith("Deposit::deposit: this is not a token");
		});

		it("Should not deposit 0 amount", async function() {
			await expect(
				Deposit.connect(user1).deposit(cUSD.address, toEther(0))
			).to.be.rejectedWith("Deposit::deposit: invalid amount");
		});

		it("Should deposit, one user #1", async function() {
			const user1Amount1 = toEther(100);

			await cUSD.connect(user1).approve(Deposit.address, user1Amount1);
			await expect(Deposit.connect(user1).deposit(cUSD.address, user1Amount1))
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user1.address, cUSD.address, user1Amount1);

			expect(await mcUSD.balanceOf(Deposit.address)).equal(user1Amount1);

			const deposit = await Deposit.tokenDeposit(cUSD.address, user1.address);
			expect(deposit.amount).eq(user1Amount1);
			expect(deposit.scaledBalance).lt(user1Amount1);
			expect(await mcUSD.balanceOf(Deposit.address)).eq(deposit.amount);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(deposit.scaledBalance);
		});

		it("Should deposit, one user #2", async function() {
			const user1Amount1 = toEther(100);
			const user1Amount2 = toEther(200);

			const user1TotalAmount = user1Amount1.add(user1Amount2);
			await cUSD.connect(user1).approve(Deposit.address, user1TotalAmount);

			await expect(Deposit.connect(user1).deposit(cUSD.address, user1Amount1))
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user1.address, cUSD.address, user1Amount1);

			expect(await mcUSD.balanceOf(Deposit.address)).equal(user1Amount1);

			let deposit = await Deposit.tokenDeposit(cUSD.address, user1.address);
			expect(deposit.amount).eq(user1Amount1);
			expect(await mcUSD.balanceOf(Deposit.address)).eq(deposit.amount);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(deposit.scaledBalance);

			await expect(Deposit.connect(user1).deposit(cUSD.address, user1Amount2))
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user1.address, cUSD.address, user1Amount2);

			deposit = await Deposit.tokenDeposit(cUSD.address, user1.address);
			expect(deposit.amount).eq(user1TotalAmount);
			closeToAssert(await mcUSD.balanceOf(Deposit.address),deposit.amount);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(deposit.scaledBalance);
		});

		it("Should deposit, multiple users #1", async function() {
			const user1Amount1 = toEther(100);
			const user2Amount1 = toEther(200);

			await cUSD.connect(user1).approve(Deposit.address, user1Amount1);
			await cUSD.connect(user2).approve(Deposit.address, user2Amount1);

			await expect(Deposit.connect(user1).deposit(cUSD.address, user1Amount1))
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user1.address, cUSD.address, user1Amount1);

			expect(await mcUSD.balanceOf(Deposit.address)).equal(user1Amount1);

			let user1Deposit = await Deposit.tokenDeposit(cUSD.address, user1.address);
			expect(user1Deposit.amount).eq(user1Amount1);
			expect(await mcUSD.balanceOf(Deposit.address)).eq(user1Deposit.amount);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(user1Deposit.scaledBalance);

			await expect(Deposit.connect(user2).deposit(cUSD.address, user2Amount1))
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user2.address, cUSD.address, user2Amount1);

			user1Deposit = await Deposit.tokenDeposit(cUSD.address, user1.address);
			expect(user1Deposit.amount).eq(user1Amount1);

			const user2Deposit = await Deposit.tokenDeposit(cUSD.address, user2.address);
			expect(user2Deposit.amount).eq(user2Amount1);

			closeToAssert(await mcUSD.balanceOf(Deposit.address), user1Deposit.amount.add(user2Deposit.amount))
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(user1Deposit.scaledBalance.add(user2Deposit.scaledBalance));
		});
	});
});
