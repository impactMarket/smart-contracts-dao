// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";

// @ts-ignore
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import {
	advanceBlockNTimes,
	advanceNSeconds,
	advanceToBlockN,
	getBlockNumber,
} from "../utils/TimeTravel";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { fromEther, toEther } from "../utils/helpers";
import { BigNumber } from "@ethersproject/bignumber";
import { parseUnits } from "@ethersproject/units";

const MTokenABI = require("../../integrations/moola/abi/MToken.json");

chai.use(chaiAsPromised);
const expect = chai.expect;

describe.only("Deposit", () => {
	const LENDING_POOL_ADDRESS = "0x970b12522CA9b4054807a2c5B736149a5BE6f670"; //mainnet
	const CELO_ADDRESS = "0x471EcE3750Da237f93B8E339c536989b8978a438"; //mainnet
	const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a"; //mainnet
	const MCUSD_ADDRESS = "0x918146359264C492BD6934071c6Bd31C854EDBc3"; //mainnet
	const CEUR_ADDRESS = "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73"; //mainnet
	const MCEUR_ADDRESS = "0xE273Ad7ee11dCfAA87383aD5977EE1504aC07568"; //mainnet

	const FAKE_ADDRESS = "0x000000000000000000000000000000000000dEaD";

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
	let cEUR: ethersTypes.Contract;
	let mcEUR: ethersTypes.Contract;
	let celo: ethersTypes.Contract;
	let Deposit: ethersTypes.Contract;
	let Treasury: ethersTypes.Contract;

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

		PACT = await ethers.getContractAt(
			"PACTToken",
			(
				await deployments.get("PACTToken")
			).address
		);

		cUSD = await ethers.getContractAt("TokenMock", CUSD_ADDRESS);
		mcUSD = await ethers.getContractAt(MTokenABI, MCUSD_ADDRESS);
		cEUR = await ethers.getContractAt("TokenMock", CEUR_ADDRESS);
		mcEUR = await ethers.getContractAt(MTokenABI, MCEUR_ADDRESS);
		celo = await ethers.getContractAt("TokenMock", CELO_ADDRESS);

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

		DonationMiner = await ethers.getContractAt(
			"DonationMinerImplementation",
			(
				await deployments.get("DonationMinerProxy")
			).address
		);
	});

	function closeToAssert(
		a: BigNumber,
		b: BigNumber,
		irrelevantDecimals: number = 14
	) {
		const precision = parseUnits("1", irrelevantDecimals);
		expect(
			a.div(precision),
			"Expected " +
				fromEther(a) +
				" to be almost equal " +
				fromEther(b) +
				" (ignoring " +
				irrelevantDecimals +
				" decimals)"
		).eq(b.div(precision));
	}

	async function advanceTimeNMonths(n: number) {
		for (let i = 0; i < n; i++) {
			await advanceBlockNTimes(1);
			await advanceNSeconds(3600 * 24 * 30);
			await advanceBlockNTimes(1);
		}
	}

	async function withdrawAndCheck(
		user: SignerWithAddress,
		token: ethersTypes.Contract,
		amount: BigNumber
	): Promise<BigNumber> {
		const approximateInterest = await Deposit.interest(
			user.address,
			token.address,
			amount
		);
		const tx = await Deposit.connect(user).withdraw(token.address, amount);
		const receipt = await tx.wait();

		const event = receipt.events?.filter((x: any) => {
			return x.event == "Withdraw";
		})[0];

		expect(event.args.depositorAddress).eq(user.address);
		expect(event.args.token).eq(cUSD.address);
		expect(event.args.amount).eq(amount);

		closeToAssert(event.args.interest, approximateInterest);

		const lastDonation = await DonationMiner.donations(
			await DonationMiner.donationCount()
		);

		expect(lastDonation.donor).eq(user.address);
		closeToAssert(lastDonation.initialAmount, approximateInterest);
		expect(lastDonation.token).eq(token.address);

		return approximateInterest;
	}

	async function donateInterestAndCheck(
		user: SignerWithAddress,
		token: ethersTypes.Contract,
		amount: BigNumber
	): Promise<BigNumber> {
		const approximateInterest = await Deposit.interest(
			user.address,
			token.address,
			amount
		);
		const tx = await Deposit.connect(user).donateInterest(
			user.address,
			token.address,
			amount
		);
		const receipt = await tx.wait();

		const event = receipt.events?.filter((x: any) => {
			return x.event == "DonateInterest";
		})[0];

		expect(event.args.depositorAddress).eq(user.address);
		expect(event.args.token).eq(cUSD.address);
		expect(event.args.amount).eq(amount);

		closeToAssert(event.args.interest, approximateInterest);

		const lastDonation = await DonationMiner.donations(
			await DonationMiner.donationCount()
		);

		expect(lastDonation.donor).eq(user.address);
		closeToAssert(lastDonation.initialAmount, approximateInterest);
		expect(lastDonation.token).eq(token.address);

		return approximateInterest;
	}

	describe("Deposit - basic", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();
		});

		it("should have correct values", async function () {
			expect(await Deposit.getVersion()).to.be.equal(1);
			expect(await Deposit.treasury()).to.be.equal(Treasury.address);
			expect(await Deposit.lendingPool()).to.be.equal(
				LENDING_POOL_ADDRESS
			);
			expect(await Deposit.owner()).to.be.equal(owner.address);
			expect(await Deposit.tokenListLength()).to.be.equal(0);
		});

		it("Should update treasury if admin", async function () {
			expect(await Deposit.treasury()).to.be.equal(Treasury.address);
			await Deposit.updateTreasury(FAKE_ADDRESS);
			expect(await Deposit.treasury()).to.be.equal(FAKE_ADDRESS);
		});

		it("Should not update treasury if not admin", async function () {
			expect(await Deposit.treasury()).to.be.equal(Treasury.address);
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
			expect(await Deposit.lendingPool()).to.be.equal(
				LENDING_POOL_ADDRESS
			);
		});

		it("Should transfer ownership if admin", async function () {
			expect(await Deposit.owner()).to.be.equal(owner.address);
			await Deposit.transferOwnership(user1.address);
			expect(await Deposit.owner()).to.be.equal(user1.address);
		});

		it("Should not transfer ownership if not admin", async function () {
			expect(await Deposit.owner()).to.be.equal(owner.address);
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
			await expect(Deposit.addToken(FAKE_ADDRESS)).to.be.rejectedWith(
				"Deposit::addToken: it must be a valid treasury token"
			);

			expect(await Deposit.tokenListLength()).to.be.equal(0);
			expect(await Deposit.isToken(cUSD.address)).to.be.equal(false);
		});
	});

	//these tests work only on a celo mainnet fork network
	xdescribe("Deposit - basic - forking", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();
		});

		it("Should not add an invalid lendingPool token", async function () {
			await Treasury.setToken(FAKE_ADDRESS, 500, []);

			await expect(Deposit.addToken(FAKE_ADDRESS)).to.be.rejectedWith(
				"Deposit::addToken: it must be a valid lendingPool token"
			);

			expect(await Deposit.tokenListLength()).to.be.equal(0);
			expect(await Deposit.isToken(FAKE_ADDRESS)).to.be.equal(false);
		});

		it("Should add a valid token if admin", async function () {
			await Treasury.setToken(cUSD.address, 1000, []);

			await expect(Deposit.addToken(cUSD.address))
				.to.emit(Deposit, "TokenAdded")
				.withArgs(cUSD.address);

			expect(await Deposit.tokenListLength()).to.be.equal(1);
			expect(await Deposit.tokenListAt(0)).to.be.equal(cUSD.address);
			expect(await Deposit.isToken(cUSD.address)).to.be.equal(true);
		});

		it("Should add multiple valid tokens if admin", async function () {
			await Treasury.setToken(cUSD.address, 1000, []);
			await Treasury.setToken(cEUR.address, 1000, []);

			await expect(Deposit.addToken(cUSD.address))
				.to.emit(Deposit, "TokenAdded")
				.withArgs(cUSD.address);

			await expect(Deposit.addToken(cEUR.address))
				.to.emit(Deposit, "TokenAdded")
				.withArgs(cEUR.address);

			expect(await Deposit.tokenListLength()).to.be.equal(2);
			expect(await Deposit.tokenListAt(0)).to.be.equal(cUSD.address);
			expect(await Deposit.tokenListAt(1)).to.be.equal(cEUR.address);
			expect(await Deposit.isToken(cUSD.address)).to.be.equal(true);
			expect(await Deposit.isToken(cEUR.address)).to.be.equal(true);
		});

		it("Should not add a valid token twice", async function () {
			await Treasury.setToken(cUSD.address, 1000, []);

			await Deposit.addToken(cUSD.address);

			await expect(Deposit.addToken(cUSD.address)).to.be.rejectedWith(
				"Deposit::addToken: token already added"
			);

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

	//these tests work only on a celo mainnet fork network
	xdescribe("Deposit - deposit - forking", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await Treasury.setToken(cUSD.address, 1000, []);
			await Deposit.addToken(cUSD.address);

			await ethers.provider.send("hardhat_impersonateAccount", [
				CUSD_ADDRESS,
			]);
			const cUSDWallet = await ethers.provider.getSigner(CUSD_ADDRESS);

			await cUSD
				.connect(cUSDWallet)
				.transfer(user1.address, toEther(1000));
			await cUSD
				.connect(cUSDWallet)
				.transfer(user2.address, toEther(1000));
			await cUSD
				.connect(cUSDWallet)
				.transfer(user3.address, toEther(1000));
			await cUSD
				.connect(cUSDWallet)
				.transfer(user4.address, toEther(1000));
			await cUSD
				.connect(cUSDWallet)
				.transfer(user5.address, toEther(1000));

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

		it("Should not deposit invalid token", async function () {
			await expect(
				Deposit.connect(user1).deposit(FAKE_ADDRESS, toEther(1))
			).to.be.rejectedWith("Deposit::deposit: this is not a token");
		});

		it("Should not deposit 0 amount", async function () {
			await expect(
				Deposit.connect(user1).deposit(cUSD.address, toEther(0))
			).to.be.rejectedWith("Deposit::deposit: invalid amount");
		});

		it("Should deposit, one user #1", async function () {
			const user1Amount1 = toEther(100);

			await cUSD.connect(user1).approve(Deposit.address, user1Amount1);
			await expect(
				Deposit.connect(user1).deposit(cUSD.address, user1Amount1)
			)
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user1.address, cUSD.address, user1Amount1);

			closeToAssert(
				await mcUSD.balanceOf(Deposit.address),
				user1Amount1,
				2
			);

			const depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			expect(depositor.amount).eq(user1Amount1);
			expect(depositor.scaledBalance).lt(user1Amount1);
			expect(await mcUSD.balanceOf(Deposit.address)).eq(depositor.amount);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(
				depositor.scaledBalance
			);

			const token = await Deposit.token(cUSD.address);
			expect(token.totalAmount).eq(user1Amount1);
			expect(token.depositorListLength).eq(1);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 0)
			).to.be.equal(user1.address);
		});

		it("Should deposit, one user #2", async function () {
			const user1Amount1 = toEther(100);
			const user1Amount2 = toEther(200);

			const user1TotalAmount = user1Amount1.add(user1Amount2);
			await cUSD
				.connect(user1)
				.approve(Deposit.address, user1TotalAmount);

			await expect(
				Deposit.connect(user1).deposit(cUSD.address, user1Amount1)
			)
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user1.address, cUSD.address, user1Amount1);

			expect(await mcUSD.balanceOf(Deposit.address)).equal(user1Amount1);

			let depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			expect(depositor.amount).eq(user1Amount1);
			expect(await mcUSD.balanceOf(Deposit.address)).eq(depositor.amount);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(
				depositor.scaledBalance
			);

			await expect(
				Deposit.connect(user1).deposit(cUSD.address, user1Amount2)
			)
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user1.address, cUSD.address, user1Amount2);

			depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			expect(depositor.amount).eq(user1TotalAmount);
			closeToAssert(
				await mcUSD.balanceOf(Deposit.address),
				depositor.amount
			);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(
				depositor.scaledBalance
			);

			const token = await Deposit.token(cUSD.address);
			expect(token.totalAmount).eq(user1TotalAmount);
			expect(token.depositorListLength).eq(1);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 0)
			).to.be.equal(user1.address);
		});

		it("Should deposit, multiple users #1", async function () {
			const user1Amount1 = toEther(100);
			const user2Amount1 = toEther(200);

			await cUSD.connect(user1).approve(Deposit.address, user1Amount1);
			await cUSD.connect(user2).approve(Deposit.address, user2Amount1);

			await expect(
				Deposit.connect(user1).deposit(cUSD.address, user1Amount1)
			)
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user1.address, cUSD.address, user1Amount1);

			expect(await mcUSD.balanceOf(Deposit.address)).equal(user1Amount1);

			let user1Depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			expect(user1Depositor.amount).eq(user1Amount1);
			expect(await mcUSD.balanceOf(Deposit.address)).eq(
				user1Depositor.amount
			);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(
				user1Depositor.scaledBalance
			);

			await expect(
				Deposit.connect(user2).deposit(cUSD.address, user2Amount1)
			)
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user2.address, cUSD.address, user2Amount1);

			user1Depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			expect(user1Depositor.amount).eq(user1Amount1);

			const user2Depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user2.address
			);
			expect(user2Depositor.amount).eq(user2Amount1);

			closeToAssert(
				await mcUSD.balanceOf(Deposit.address),
				user1Depositor.amount.add(user2Depositor.amount)
			);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(
				user1Depositor.scaledBalance.add(user2Depositor.scaledBalance)
			);

			const token = await Deposit.token(cUSD.address);
			expect(token.totalAmount).eq(user1Amount1.add(user2Amount1));
			expect(token.depositorListLength).eq(2);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 0)
			).to.be.equal(user1.address);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 1)
			).to.be.equal(user2.address);
		});

		it("Should deposit, multiple users #2", async function () {
			const user1Amount1 = toEther(100);
			const user1Amount2 = toEther(100);
			const user2Amount1 = toEther(200);

			await cUSD
				.connect(user1)
				.approve(Deposit.address, user1Amount1.add(user1Amount2));
			await cUSD.connect(user2).approve(Deposit.address, user2Amount1);

			await expect(
				Deposit.connect(user1).deposit(cUSD.address, user1Amount1)
			)
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user1.address, cUSD.address, user1Amount1);

			expect(await mcUSD.balanceOf(Deposit.address)).equal(user1Amount1);

			let user1Depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			expect(user1Depositor.amount).eq(user1Amount1);
			expect(await mcUSD.balanceOf(Deposit.address)).eq(
				user1Depositor.amount
			);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(
				user1Depositor.scaledBalance
			);

			await expect(
				Deposit.connect(user2).deposit(cUSD.address, user2Amount1)
			)
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user2.address, cUSD.address, user2Amount1);

			user1Depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			expect(user1Depositor.amount).eq(user1Amount1);

			const user2Depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user2.address
			);
			expect(user2Depositor.amount).eq(user2Amount1);

			closeToAssert(
				await mcUSD.balanceOf(Deposit.address),
				user1Depositor.amount.add(user2Depositor.amount)
			);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(
				user1Depositor.scaledBalance.add(user2Depositor.scaledBalance)
			);

			await expect(
				Deposit.connect(user1).deposit(cUSD.address, user1Amount1)
			)
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user1.address, cUSD.address, user1Amount1);

			closeToAssert(
				await mcUSD.balanceOf(Deposit.address),
				user1Amount1.add(user1Amount2).add(user2Amount1)
			);

			user1Depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			expect(user1Depositor.amount).eq(user1Amount1.add(user1Amount2));

			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(
				user1Depositor.scaledBalance.add(user2Depositor.scaledBalance)
			);

			const token = await Deposit.token(cUSD.address);
			expect(token.totalAmount).eq(
				user1Amount1.add(user1Amount2).add(user2Amount1)
			);
			expect(token.depositorListLength).eq(2);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 0)
			).to.be.equal(user1.address);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 1)
			).to.be.equal(user2.address);
		});

		it("Should deposit, multiple users #3", async function () {
			const user1Amount1 = toEther(100);
			const user1Amount2 = toEther(100);
			const user2Amount1 = toEther(200);

			await cUSD
				.connect(user1)
				.approve(Deposit.address, user1Amount1.add(user1Amount2));
			await cUSD.connect(user2).approve(Deposit.address, user2Amount1);

			await expect(
				Deposit.connect(user1).deposit(cUSD.address, user1Amount1)
			)
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user1.address, cUSD.address, user1Amount1);

			expect(await mcUSD.balanceOf(Deposit.address)).equal(user1Amount1);

			let user1Depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			expect(user1Depositor.amount).eq(user1Amount1);
			expect(await mcUSD.balanceOf(Deposit.address)).eq(
				user1Depositor.amount
			);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(
				user1Depositor.scaledBalance
			);

			await expect(
				Deposit.connect(user2).deposit(cUSD.address, user2Amount1)
			)
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user2.address, cUSD.address, user2Amount1);

			user1Depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			expect(user1Depositor.amount).eq(user1Amount1);

			const user2Depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user2.address
			);
			expect(user2Depositor.amount).eq(user2Amount1);

			closeToAssert(
				await mcUSD.balanceOf(Deposit.address),
				user1Depositor.amount.add(user2Depositor.amount)
			);
			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(
				user1Depositor.scaledBalance.add(user2Depositor.scaledBalance)
			);

			await expect(
				Deposit.connect(user1).deposit(cUSD.address, user1Amount1)
			)
				.to.emit(Deposit, "DepositAdded")
				.withArgs(user1.address, cUSD.address, user1Amount1);

			closeToAssert(
				await mcUSD.balanceOf(Deposit.address),
				user1Amount1.add(user1Amount2).add(user2Amount1)
			);

			user1Depositor = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			expect(user1Depositor.amount).eq(user1Amount1.add(user1Amount2));

			expect(await mcUSD.scaledBalanceOf(Deposit.address)).eq(
				user1Depositor.scaledBalance.add(user2Depositor.scaledBalance)
			);

			const token = await Deposit.token(cUSD.address);
			expect(token.totalAmount).eq(
				user1Amount1.add(user1Amount2).add(user2Amount1)
			);
			expect(token.depositorListLength).eq(2);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 0)
			).to.be.equal(user1.address);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 1)
			).to.be.equal(user2.address);
		});

		it("Should donateInterest, one user #1", async function () {
			const user1Amount1 = toEther(1000);
			const user1Withdraw1 = toEther(100);

			await cUSD.connect(user1).approve(Deposit.address, user1Amount1);
			await Deposit.connect(user1).deposit(cUSD.address, user1Amount1);

			await advanceTimeNMonths(2);

			const depositorBefore = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);

			const balanceBefore = await mcUSD.balanceOf(Deposit.address);
			const scaledBalanceBefore = await mcUSD.scaledBalanceOf(
				Deposit.address
			);

			let tokenBefore = await Deposit.token(cUSD.address);
			expect(tokenBefore.totalAmount).eq(user1Amount1);
			expect(tokenBefore.depositorListLength).eq(1);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 0)
			).to.be.equal(user1.address);

			const interest1 = await donateInterestAndCheck(
				user1,
				cUSD,
				user1Withdraw1
			);

			const depositorAfter = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);

			const balanceAfter = await mcUSD.balanceOf(Deposit.address);
			const scaledBalanceAfter = await mcUSD.scaledBalanceOf(
				Deposit.address
			);

			expect(depositorAfter.amount).eq(depositorBefore.amount);
			closeToAssert(depositorAfter.scaledBalance, scaledBalanceAfter, 2);
			closeToAssert(balanceAfter, balanceBefore.sub(interest1));
			closeToAssert(
				scaledBalanceAfter,
				scaledBalanceBefore.sub(
					depositorBefore.scaledBalance.sub(
						depositorAfter.scaledBalance
					)
				)
			);

			let tokenAfter = await Deposit.token(cUSD.address);
			expect(tokenAfter.totalAmount).eq(user1Amount1);
			expect(tokenAfter.depositorListLength).eq(1);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 0)
			).to.be.equal(user1.address);
		});

		it("Should not donateInterest if no deposit", async function () {
			const user1Amount1 = toEther(1000);
			const user1Withdraw1 = toEther(100);

			await cUSD.connect(user1).approve(Deposit.address, user1Amount1);
			await Deposit.connect(user1).deposit(cUSD.address, user1Amount1);

			await expect(
				Deposit.connect(user1).donateInterest(
					user1.address,
					cEUR.address,
					user1Withdraw1
				)
			).to.be.rejectedWith("Deposit::donateInterest: invalid amount");
		});

		it("Should withdraw, one user #1", async function () {
			const user1Amount1 = toEther(1000);
			const user1Withdraw1 = toEther(100);

			await cUSD.connect(user1).approve(Deposit.address, user1Amount1);
			await Deposit.connect(user1).deposit(cUSD.address, user1Amount1);

			await advanceTimeNMonths(2);

			const depositorBefore = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);

			const balanceBefore = await mcUSD.balanceOf(Deposit.address);
			const scaledBalanceBefore = await mcUSD.scaledBalanceOf(
				Deposit.address
			);

			let tokenBefore = await Deposit.token(cUSD.address);
			expect(tokenBefore.totalAmount).eq(user1Amount1);
			expect(tokenBefore.depositorListLength).eq(1);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 0)
			).to.be.equal(user1.address);

			const interest1 = await withdrawAndCheck(
				user1,
				cUSD,
				user1Withdraw1
			);

			const depositorAfter = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);

			const balanceAfter = await mcUSD.balanceOf(Deposit.address);
			const scaledBalanceAfter = await mcUSD.scaledBalanceOf(
				Deposit.address
			);

			expect(depositorAfter.amount).eq(
				depositorBefore.amount.sub(user1Withdraw1)
			);
			closeToAssert(depositorAfter.scaledBalance, scaledBalanceAfter, 2);
			closeToAssert(
				balanceAfter,
				balanceBefore
					.sub(depositorBefore.amount.sub(depositorAfter.amount))
					.sub(interest1)
			);
			closeToAssert(
				scaledBalanceAfter,
				scaledBalanceBefore.sub(
					depositorBefore.scaledBalance.sub(
						depositorAfter.scaledBalance
					)
				)
			);

			let tokenAfter = await Deposit.token(cUSD.address);
			expect(tokenAfter.totalAmount).eq(user1Amount1.sub(user1Withdraw1));
			expect(tokenAfter.depositorListLength).eq(1);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 0)
			).to.be.equal(user1.address);
		});

		it("Should not withdraw if no deposit", async function () {
			const user1Amount1 = toEther(1000);
			const user1Withdraw1 = toEther(100);

			await cUSD.connect(user1).approve(Deposit.address, user1Amount1);
			await Deposit.connect(user1).deposit(cUSD.address, user1Amount1);

			await expect(
				Deposit.connect(user1).withdraw(cEUR.address, user1Withdraw1)
			).to.be.rejectedWith("Deposit::withdraw: invalid amount");
		});

		it("Should withdraw, multiple users #1", async function () {
			const user1Amount1 = toEther(1000);
			const user2Amount1 = toEther(1000);
			const user3Amount1 = toEther(1000);

			await cUSD.connect(user1).approve(Deposit.address, user1Amount1);
			await Deposit.connect(user1).deposit(cUSD.address, user1Amount1);

			await cUSD.connect(user2).approve(Deposit.address, user2Amount1);
			await Deposit.connect(user2).deposit(cUSD.address, user2Amount1);

			await cUSD.connect(user3).approve(Deposit.address, user3Amount1);
			await Deposit.connect(user3).deposit(cUSD.address, user3Amount1);

			await advanceTimeNMonths(2);

			let tokenBefore = await Deposit.token(cUSD.address);
			expect(tokenBefore.totalAmount).eq(
				user1Amount1.add(user2Amount1).add(user3Amount1)
			);
			expect(tokenBefore.depositorListLength).eq(3);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 0)
			).to.be.equal(user1.address);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 1)
			).to.be.equal(user2.address);
			expect(
				await Deposit.tokenDepositorListAt(cUSD.address, 2)
			).to.be.equal(user3.address);

			const user1Interest = await withdrawAndCheck(
				user1,
				cUSD,
				user1Amount1
			);
			const user2Interest = await withdrawAndCheck(
				user2,
				cUSD,
				user2Amount1
			);
			const user3Interest = await withdrawAndCheck(
				user3,
				cUSD,
				user3Amount1
			);

			closeToAssert(user1Interest, user2Interest);
			closeToAssert(user1Interest, user3Interest);

			closeToAssert(
				await mcUSD.balanceOf(Deposit.address),
				toEther(0),
				2
			);

			let tokenAfter = await Deposit.token(cUSD.address);
			expect(tokenAfter.totalAmount).eq(0);
			expect(tokenAfter.depositorListLength).eq(0);

			const user1After = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			const user2After = await Deposit.tokenDepositor(
				cUSD.address,
				user2.address
			);
			const user3After = await Deposit.tokenDepositor(
				cUSD.address,
				user3.address
			);

			expect(user1After.amount).eq(0);
			expect(user2After.amount).eq(0);
			expect(user3After.amount).eq(0);
		});

		it("Should withdraw, multiple users #2", async function () {
			const user1Amount1 = toEther(500);
			const user2Amount1 = toEther(1000);

			await cUSD.connect(user1).approve(Deposit.address, user1Amount1);
			await Deposit.connect(user1).deposit(cUSD.address, user1Amount1);

			await advanceTimeNMonths(1);

			await cUSD.connect(user2).approve(Deposit.address, user2Amount1);
			await Deposit.connect(user2).deposit(cUSD.address, user2Amount1);

			await advanceTimeNMonths(1);

			const user1Interest = await withdrawAndCheck(
				user1,
				cUSD,
				user1Amount1
			);
			const user2Interest = await withdrawAndCheck(
				user2,
				cUSD,
				user2Amount1
			);

			closeToAssert(user1Interest, user2Interest, 18);

			closeToAssert(
				await mcUSD.balanceOf(Deposit.address),
				toEther(0),
				2
			);

			let tokenAfter = await Deposit.token(cUSD.address);
			expect(tokenAfter.totalAmount).eq(0);
			expect(tokenAfter.depositorListLength).eq(0);

			const user1After = await Deposit.tokenDepositor(
				cUSD.address,
				user1.address
			);
			const user2After = await Deposit.tokenDepositor(
				cUSD.address,
				user2.address
			);

			expect(user1After.amount).eq(0);
			expect(user2After.amount).eq(0);
		});
	});
});
