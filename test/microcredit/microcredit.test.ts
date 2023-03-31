// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";

// @ts-ignore
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import {
	advanceNSecondsAndBlock,
	getCurrentBlockTimestamp,
} from "../utils/TimeTravel";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { toEther } from "../utils/helpers";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe.only("Microcredit", () => {
	let deployer: SignerWithAddress;
	let owner: SignerWithAddress;
	let manager1: SignerWithAddress;
	let manager2: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let user4: SignerWithAddress;

	let cUSD: ethersTypes.Contract;
	let Microcredit: ethersTypes.Contract;
	let MicrocreditRevenue: ethersTypes.Contract;

	const oneMonth = 3600 * 24 * 30;
	const sixMonth = oneMonth * 6;

	const initialMicrocreditBalance = toEther(1000000);
	const initialUser1Balance = toEther(10000);
	const initialUser2Balance = toEther(20000);

	const deploy = deployments.createFixture(async () => {
		await deployments.fixture("MicrocreditTest", {
			fallbackToGlobal: false,
		});

		[deployer, owner, manager1, manager2, user1, user2, user3, user4] =
			await ethers.getSigners();

		cUSD = await ethers.getContractAt(
			"TokenMock",
			(
				await deployments.get("TokenMock")
			).address
		);

		Microcredit = await ethers.getContractAt(
			"MicrocreditImplementation",
			(
				await deployments.get("MicrocreditProxy")
			).address
		);

		MicrocreditRevenue = await ethers.getContractAt(
			"MicrocreditRevenueImplementation",
			(
				await deployments.get("MicrocreditRevenueProxy")
			).address
		);

		await cUSD.mint(Microcredit.address, initialMicrocreditBalance);
		await cUSD.mint(user1.address, initialUser1Balance);
		await cUSD.mint(user2.address, initialUser2Balance);
	});

	describe("Microcredit - basic", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();
		});

		it("should have correct values", async function () {
			(await Microcredit.owner()).should.eq(owner.address);
			(await Microcredit.getVersion()).should.eq(1);
			(await Microcredit.cUSD()).should.eq(cUSD.address);
			(await Microcredit.revenueAddress()).should.eq(
				MicrocreditRevenue.address
			);

			await Microcredit.userLoans(
				user1.address,
				0
			).should.be.rejectedWith("Microcredit: Invalid wallet address");
		});

		it("Should update revenueAddress if owner", async function () {
			(await Microcredit.revenueAddress()).should.eq(
				MicrocreditRevenue.address
			);
			await Microcredit.connect(owner).updateRevenueAddress(user1.address)
				.should.be.fulfilled;
			(await Microcredit.revenueAddress()).should.eq(user1.address);
		});

		it("Should not update revenueAddress if not owner", async function () {
			await Microcredit.connect(user1)
				.updateRevenueAddress(user1.address)
				.should.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("Should addManagers if owner #1", async function () {
			(await Microcredit.managerListLength()).should.eq(0);
			await Microcredit.connect(owner).addManagers([manager1.address])
				.should.be.fulfilled;

			(await Microcredit.managerListLength()).should.eq(1);
			(await Microcredit.managerListAt(0)).should.eq(manager1.address);
		});

		it("Should addManagers if owner #2", async function () {
			(await Microcredit.managerListLength()).should.eq(0);
			await Microcredit.connect(owner).addManagers([
				manager1.address,
				manager2.address,
			]).should.be.fulfilled;

			(await Microcredit.managerListLength()).should.eq(2);
			(await Microcredit.managerListAt(0)).should.eq(manager1.address);
			(await Microcredit.managerListAt(1)).should.eq(manager2.address);
		});

		it("Should not addManagers if not owner", async function () {
			await Microcredit.connect(user1)
				.addManagers([manager1.address])
				.should.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("Should removeManagers if owner #1", async function () {
			await Microcredit.connect(owner).addManagers([manager1.address])
				.should.be.fulfilled;
			await Microcredit.connect(owner).removeManagers([manager1.address])
				.should.be.fulfilled;

			(await Microcredit.managerListLength()).should.eq(0);
		});

		it("Should removeManagers if owner #2", async function () {
			await Microcredit.connect(owner).addManagers([
				manager1.address,
				manager2.address,
			]).should.be.fulfilled;
			await Microcredit.connect(owner).removeManagers([
				manager1.address,
				manager2.address,
			]).should.be.fulfilled;

			(await Microcredit.managerListLength()).should.eq(0);
		});

		it("Should removeManagers if owner #3", async function () {
			await Microcredit.connect(owner).addManagers([
				manager1.address,
				manager2.address,
			]).should.be.fulfilled;
			await Microcredit.connect(owner).removeManagers([manager2.address])
				.should.be.fulfilled;

			(await Microcredit.managerListLength()).should.eq(1);
			(await Microcredit.managerListAt(0)).should.eq(manager1.address);
		});

		it("Should removeManagers if owner #4", async function () {
			await Microcredit.connect(owner).addManagers([
				manager1.address,
				manager2.address,
			]).should.be.fulfilled;
			await Microcredit.connect(owner).removeManagers([manager1.address])
				.should.be.fulfilled;

			(await Microcredit.managerListLength()).should.eq(1);
			(await Microcredit.managerListAt(0)).should.eq(manager2.address);
		});

		it("Should not removeManagers if not owner", async function () {
			await Microcredit.connect(user1)
				.removeManagers([manager1.address])
				.should.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("Should transferERC20 to address if owner", async function () {
			const initialUserBalance = await cUSD.balanceOf(user1.address);
			await Microcredit.connect(owner).transferERC20(
				cUSD.address,
				user1.address,
				toEther("100")
			).should.be.fulfilled;
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(toEther(100))
			);
			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUserBalance.add(toEther("100"))
			);
		});

		it("Should not transferERC20 if not owner", async function () {
			await Microcredit.connect(deployer)
				.transferERC20(cUSD.address, user1.address, toEther("100"))
				.should.be.rejectedWith("Ownable: caller is not the owner");
		});
	});

	describe("Microcredit - loan functionalities (revenue address = 0)", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await Microcredit.connect(owner).updateRevenueAddress(
				ethers.constants.AddressZero
			);
			await Microcredit.connect(owner).addManagers([manager1.address]);
		});

		it("Should not addLoan if not manager", async function () {
			await Microcredit.connect(user1)
				.addLoan(
					user1.address,
					toEther(100),
					sixMonth,
					toEther(0.2),
					2000000000
				)
				.should.be.rejectedWith("Microcredit: caller is not a manager");
		});

		it("Should not addLoan if claimDeadline in the past", async function () {
			const claimDeadline = (await getCurrentBlockTimestamp()) - 1;
			await Microcredit.connect(manager1)
				.addLoan(
					user1.address,
					toEther(100),
					sixMonth,
					toEther(0.2),
					claimDeadline
				)
				.should.be.rejectedWith("Microcredit: invalid claimDeadline");
		});

		it("Should not addLoan if the user has been moved", async function () {
			await Microcredit.connect(manager1).addLoan(
				user1.address,
				toEther(100),
				sixMonth,
				toEther(0.2),
				2000000000
			);

			await Microcredit.connect(manager1).changeUserAddress(
				user1.address,
				user2.address
			);

			await Microcredit.connect(manager1)
				.addLoan(
					user1.address,
					toEther(100),
					sixMonth,
					toEther(0.2),
					2000000000
				)
				.should.be.rejectedWith("Microcredit: The user has been moved");
		});

		it("should addLoan if manager", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			let walletMetadata = await Microcredit.walletMetadata(
				user1.address
			);
			walletMetadata.userId.should.eq(0);
			walletMetadata.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata.loansLength.should.eq(0);

			await Microcredit.connect(manager1)
				.addLoan(
					user1.address,
					amount,
					period,
					dailyInterest,
					claimDeadline
				)
				.should.emit(Microcredit, "LoanAdded")
				.withArgs(
					user1.address,
					0,
					amount,
					period,
					dailyInterest,
					claimDeadline
				);

			walletMetadata = await Microcredit.walletMetadata(user1.address);
			walletMetadata.userId.should.eq(1);
			walletMetadata.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata.loansLength.should.eq(1);

			(await Microcredit.walletListLength()).should.eq(1);
			(await Microcredit.walletListAt(0)).should.eq(user1.address);

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(0);
			loan.lastComputedDebt.should.eq(0);
			loan.currentDebt.should.eq(0);
			loan.amountRepayed.should.eq(0);
			loan.repaymentsLength.should.eq(0);
			loan.lastComputedDate.should.eq(0);

			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
			);
		});

		it("should not addLoan for a user with an active loan", async function () {
			const amount1 = toEther(100);
			const period1 = sixMonth;
			const dailyInterest1 = toEther(0.2);
			const claimDeadline1 = (await getCurrentBlockTimestamp()) + 1000;

			const amount2 = toEther(200);
			const period2 = oneMonth;
			const dailyInterest2 = toEther(0.3);
			const claimDeadline2 = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1)
				.addLoan(
					user1.address,
					amount1,
					period1,
					dailyInterest1,
					claimDeadline1
				)
				.should.emit(Microcredit, "LoanAdded")
				.withArgs(
					user1.address,
					0,
					amount1,
					period1,
					dailyInterest1,
					claimDeadline1
				);
			await Microcredit.connect(manager1)
				.addLoan(
					user1.address,
					amount2,
					period2,
					dailyInterest2,
					claimDeadline2
				)
				.should.be.rejectedWith(
					"Microcredit: The user already has an active loan"
				);

			let walletMetadata1 = await Microcredit.walletMetadata(
				user1.address
			);
			walletMetadata1.userId.should.eq(1);
			walletMetadata1.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata1.loansLength.should.eq(1);

			(await Microcredit.walletListLength()).should.eq(1);
			(await Microcredit.walletListAt(0)).should.eq(user1.address);

			let loan1 = await Microcredit.userLoans(user1.address, 0);
			loan1.amountBorrowed.should.eq(amount1);
			loan1.period.should.eq(period1);
			loan1.dailyInterest.should.eq(dailyInterest1);
			loan1.claimDeadline.should.eq(claimDeadline1);
			loan1.startDate.should.eq(0);
			loan1.lastComputedDebt.should.eq(0);
			loan1.currentDebt.should.eq(0);
			loan1.amountRepayed.should.eq(0);
			loan1.repaymentsLength.should.eq(0);
			loan1.lastComputedDate.should.eq(0);

			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
			);
		});

		it("should addLoan after fully paid previous loan", async function () {
			const amount1 = toEther(100);
			const period1 = sixMonth;
			const dailyInterest1 = toEther(0.2);
			const claimDeadline1 = (await getCurrentBlockTimestamp()) + 1000;

			const amount2 = toEther(200);
			const period2 = oneMonth;
			const dailyInterest2 = toEther(0.3);
			const claimDeadline2 = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1)
				.addLoan(
					user1.address,
					amount1,
					period1,
					dailyInterest1,
					claimDeadline1
				)
				.should.emit(Microcredit, "LoanAdded")
				.withArgs(
					user1.address,
					0,
					amount1,
					period1,
					dailyInterest1,
					claimDeadline1
				);

			await Microcredit.connect(user1).claimLoan(0);
			await cUSD.connect(user1).approve(Microcredit.address, amount1);

			await Microcredit.connect(user1).repayLoan(0, amount1);

			await Microcredit.connect(manager1)
				.addLoan(
					user1.address,
					amount2,
					period2,
					dailyInterest2,
					claimDeadline2
				)
				.should.emit(Microcredit, "LoanAdded")
				.withArgs(
					user1.address,
					1,
					amount2,
					period2,
					dailyInterest2,
					claimDeadline2
				);

			let walletMetadata1 = await Microcredit.walletMetadata(
				user1.address
			);
			walletMetadata1.userId.should.eq(1);
			walletMetadata1.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata1.loansLength.should.eq(2);

			(await Microcredit.walletListLength()).should.eq(1);
			(await Microcredit.walletListAt(0)).should.eq(user1.address);

			let loan1 = await Microcredit.userLoans(user1.address, 0);
			loan1.amountBorrowed.should.eq(amount1);
			loan1.period.should.eq(period1);
			loan1.dailyInterest.should.eq(dailyInterest1);
			loan1.claimDeadline.should.eq(claimDeadline1);

			let loan2 = await Microcredit.userLoans(user1.address, 1);
			loan2.amountBorrowed.should.eq(amount2);
			loan2.period.should.eq(period2);
			loan2.dailyInterest.should.eq(dailyInterest2);
			loan2.claimDeadline.should.eq(claimDeadline2);
			loan2.startDate.should.eq(0);
			loan2.lastComputedDebt.should.eq(0);
			loan2.currentDebt.should.eq(0);
			loan2.amountRepayed.should.eq(0);
			loan2.repaymentsLength.should.eq(0);
			loan2.lastComputedDate.should.eq(0);

			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
			);
		});

		it("should addLoan after the previous loan has expired", async function () {
			const amount1 = toEther(100);
			const period1 = sixMonth;
			const dailyInterest1 = toEther(0.2);
			const claimDeadline1 = (await getCurrentBlockTimestamp()) + 1000;

			const amount2 = toEther(200);
			const period2 = oneMonth;
			const dailyInterest2 = toEther(0.3);
			const claimDeadline2 = (await getCurrentBlockTimestamp()) + 3000;

			await Microcredit.connect(manager1)
				.addLoan(
					user1.address,
					amount1,
					period1,
					dailyInterest1,
					claimDeadline1
				)
				.should.emit(Microcredit, "LoanAdded")
				.withArgs(
					user1.address,
					0,
					amount1,
					period1,
					dailyInterest1,
					claimDeadline1
				);

			await advanceNSecondsAndBlock(2000);

			await Microcredit.connect(manager1)
				.addLoan(
					user1.address,
					amount2,
					period2,
					dailyInterest2,
					claimDeadline2
				)
				.should.emit(Microcredit, "LoanAdded")
				.withArgs(
					user1.address,
					1,
					amount2,
					period2,
					dailyInterest2,
					claimDeadline2
				);

			let walletMetadata1 = await Microcredit.walletMetadata(
				user1.address
			);
			walletMetadata1.userId.should.eq(1);
			walletMetadata1.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata1.loansLength.should.eq(2);

			(await Microcredit.walletListLength()).should.eq(1);
			(await Microcredit.walletListAt(0)).should.eq(user1.address);

			let loan1 = await Microcredit.userLoans(user1.address, 0);
			loan1.amountBorrowed.should.eq(amount1);
			loan1.period.should.eq(period1);
			loan1.dailyInterest.should.eq(dailyInterest1);
			loan1.claimDeadline.should.eq(claimDeadline1);
			loan1.startDate.should.eq(0);
			loan1.lastComputedDebt.should.eq(0);
			loan1.currentDebt.should.eq(0);
			loan1.amountRepayed.should.eq(0);
			loan1.repaymentsLength.should.eq(0);
			loan1.lastComputedDate.should.eq(0);

			let loan2 = await Microcredit.userLoans(user1.address, 1);
			loan2.amountBorrowed.should.eq(amount2);
			loan2.period.should.eq(period2);
			loan2.dailyInterest.should.eq(dailyInterest2);
			loan2.claimDeadline.should.eq(claimDeadline2);
			loan2.startDate.should.eq(0);
			loan2.lastComputedDebt.should.eq(0);
			loan2.currentDebt.should.eq(0);
			loan2.amountRepayed.should.eq(0);
			loan2.repaymentsLength.should.eq(0);
			loan2.lastComputedDate.should.eq(0);

			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
			);
		});

		it("should not addLoan if previous loan has been claimed", async function () {
			const amount1 = toEther(100);
			const period1 = sixMonth;
			const dailyInterest1 = toEther(0.2);
			const claimDeadline1 = (await getCurrentBlockTimestamp()) + 1000;

			const amount2 = toEther(200);
			const period2 = oneMonth;
			const dailyInterest2 = toEther(0.3);
			const claimDeadline2 = (await getCurrentBlockTimestamp()) + 3000;

			await Microcredit.connect(manager1)
				.addLoan(
					user1.address,
					amount1,
					period1,
					dailyInterest1,
					claimDeadline1
				)
				.should.emit(Microcredit, "LoanAdded")
				.withArgs(
					user1.address,
					0,
					amount1,
					period1,
					dailyInterest1,
					claimDeadline1
				);

			await Microcredit.connect(user1).claimLoan(0);
			await cUSD
				.connect(user1)
				.approve(Microcredit.address, amount1.div(2));

			await Microcredit.connect(user1).repayLoan(0, amount1.div(2));

			await advanceNSecondsAndBlock(2000);

			await Microcredit.connect(manager1)
				.addLoan(
					user1.address,
					amount2,
					period2,
					dailyInterest2,
					claimDeadline2
				)
				.should.be.rejectedWith(
					"Microcredit: The user already has an active loan"
				);

			let walletMetadata1 = await Microcredit.walletMetadata(
				user1.address
			);
			walletMetadata1.userId.should.eq(1);
			walletMetadata1.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata1.loansLength.should.eq(1);

			(await Microcredit.walletListLength()).should.eq(1);
			(await Microcredit.walletListAt(0)).should.eq(user1.address);
		});

		it("should addLoan for multiple users", async function () {
			const amount1 = toEther(100);
			const period1 = sixMonth;
			const dailyInterest1 = toEther(0.2);
			const claimDeadline1 = (await getCurrentBlockTimestamp()) + 1000;

			const amount2 = toEther(200);
			const period2 = oneMonth;
			const dailyInterest2 = toEther(0.3);
			const claimDeadline2 = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount1,
				period1,
				dailyInterest1,
				claimDeadline1
			).should.be.fulfilled;
			await Microcredit.connect(manager1).addLoan(
				user2.address,
				amount2,
				period2,
				dailyInterest2,
				claimDeadline2
			).should.be.fulfilled;

			let walletMetadata1 = await Microcredit.walletMetadata(
				user1.address
			);
			walletMetadata1.userId.should.eq(1);
			walletMetadata1.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata1.loansLength.should.eq(1);

			let walletMetadata2 = await Microcredit.walletMetadata(
				user2.address
			);
			walletMetadata2.userId.should.eq(2);
			walletMetadata2.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata2.loansLength.should.eq(1);

			(await Microcredit.walletListLength()).should.eq(2);
			(await Microcredit.walletListAt(0)).should.eq(user1.address);
			(await Microcredit.walletListAt(1)).should.eq(user2.address);

			let loan1 = await Microcredit.userLoans(user1.address, 0);
			loan1.amountBorrowed.should.eq(amount1);
			loan1.period.should.eq(period1);
			loan1.dailyInterest.should.eq(dailyInterest1);
			loan1.claimDeadline.should.eq(claimDeadline1);
			loan1.startDate.should.eq(0);
			loan1.lastComputedDebt.should.eq(0);
			loan1.currentDebt.should.eq(0);
			loan1.amountRepayed.should.eq(0);
			loan1.repaymentsLength.should.eq(0);
			loan1.lastComputedDate.should.eq(0);

			let loan2 = await Microcredit.userLoans(user2.address, 0);
			loan2.amountBorrowed.should.eq(amount2);
			loan2.period.should.eq(period2);
			loan2.dailyInterest.should.eq(dailyInterest2);
			loan2.claimDeadline.should.eq(claimDeadline2);
			loan2.startDate.should.eq(0);
			loan2.lastComputedDebt.should.eq(0);
			loan2.currentDebt.should.eq(0);
			loan2.amountRepayed.should.eq(0);
			loan2.repaymentsLength.should.eq(0);
			loan2.lastComputedDate.should.eq(0);

			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
			);
		});

		it("Should not addLoans if not manager", async function () {
			await Microcredit.connect(user1)
				.addLoans(
					[user1.address],
					[toEther(100)],
					[sixMonth],
					[toEther(0.2)],
					[2000000000]
				)
				.should.be.rejectedWith("Microcredit: caller is not a manager");
		});

		it("should addLoans if manager", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			let walletMetadata = await Microcredit.walletMetadata(
				user1.address
			);
			walletMetadata.userId.should.eq(0);
			walletMetadata.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata.loansLength.should.eq(0);

			await Microcredit.connect(manager1)
				.addLoans(
					[user1.address],
					[amount],
					[period],
					[dailyInterest],
					[claimDeadline]
				)
				.should.emit(Microcredit, "LoanAdded")
				.withArgs(
					user1.address,
					0,
					amount,
					period,
					dailyInterest,
					claimDeadline
				);

			walletMetadata = await Microcredit.walletMetadata(user1.address);
			walletMetadata.userId.should.eq(1);
			walletMetadata.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata.loansLength.should.eq(1);

			(await Microcredit.walletListLength()).should.eq(1);
			(await Microcredit.walletListAt(0)).should.eq(user1.address);

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.startDate.should.eq(0);
			loan.lastComputedDebt.should.eq(0);
			loan.currentDebt.should.eq(0);
			loan.amountRepayed.should.eq(0);
			loan.repaymentsLength.should.eq(0);
			loan.lastComputedDate.should.eq(0);

			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
			);
		});

		it("should not addLoans twice for same user", async function () {
			const amount1 = toEther(100);
			const period1 = sixMonth;
			const dailyInterest1 = toEther(0.2);
			const claimDeadline1 = (await getCurrentBlockTimestamp()) + 1000;

			const amount2 = toEther(200);
			const period2 = oneMonth;
			const dailyInterest2 = toEther(0.3);
			const claimDeadline2 = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1)
				.addLoans(
					[user1.address, user1.address],
					[amount1, amount2],
					[period1, period2],
					[dailyInterest1, dailyInterest2],
					[claimDeadline1, claimDeadline2]
				)
				.should.be.rejectedWith(
					"Microcredit: The user already has an active loan"
				);

			let walletMetadata1 = await Microcredit.walletMetadata(
				user1.address
			);
			walletMetadata1.userId.should.eq(0);
			walletMetadata1.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata1.loansLength.should.eq(0);
		});

		it("should addLoans for multiple users", async function () {
			const amount1 = toEther(100);
			const period1 = sixMonth;
			const dailyInterest1 = toEther(0.2);
			const claimDeadline1 = (await getCurrentBlockTimestamp()) + 1000;

			const amount2 = toEther(200);
			const period2 = oneMonth;
			const dailyInterest2 = toEther(0.3);
			const claimDeadline2 = (await getCurrentBlockTimestamp()) + 2000;

			await Microcredit.connect(manager1)
				.addLoans(
					[user1.address, user2.address],
					[amount1, amount2],
					[period1, period2],
					[dailyInterest1, dailyInterest2],
					[claimDeadline1, claimDeadline2]
				)
				.should.emit(Microcredit, "LoanAdded")
				.withArgs(
					user1.address,
					0,
					amount1,
					period1,
					dailyInterest1,
					claimDeadline1
				)
				.emit(Microcredit, "LoanAdded")
				.withArgs(
					user2.address,
					0,
					amount2,
					period2,
					dailyInterest2,
					claimDeadline2
				);

			let walletMetadata1 = await Microcredit.walletMetadata(
				user1.address
			);
			walletMetadata1.userId.should.eq(1);
			walletMetadata1.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata1.loansLength.should.eq(1);

			let walletMetadata2 = await Microcredit.walletMetadata(
				user2.address
			);
			walletMetadata2.userId.should.eq(2);
			walletMetadata2.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata2.loansLength.should.eq(1);

			(await Microcredit.walletListLength()).should.eq(2);
			(await Microcredit.walletListAt(0)).should.eq(user1.address);
			(await Microcredit.walletListAt(1)).should.eq(user2.address);

			let loan1 = await Microcredit.userLoans(user1.address, 0);
			loan1.amountBorrowed.should.eq(amount1);
			loan1.period.should.eq(period1);
			loan1.dailyInterest.should.eq(dailyInterest1);
			loan1.claimDeadline.should.eq(claimDeadline1);
			loan1.startDate.should.eq(0);
			loan1.lastComputedDebt.should.eq(0);
			loan1.currentDebt.should.eq(0);
			loan1.amountRepayed.should.eq(0);
			loan1.repaymentsLength.should.eq(0);
			loan1.lastComputedDate.should.eq(0);

			let loan2 = await Microcredit.userLoans(user2.address, 0);
			loan2.amountBorrowed.should.eq(amount2);
			loan2.period.should.eq(period2);
			loan2.dailyInterest.should.eq(dailyInterest2);
			loan2.claimDeadline.should.eq(claimDeadline2);
			loan2.startDate.should.eq(0);
			loan2.lastComputedDebt.should.eq(0);
			loan2.currentDebt.should.eq(0);
			loan2.amountRepayed.should.eq(0);
			loan2.repaymentsLength.should.eq(0);
			loan2.lastComputedDate.should.eq(0);

			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
			);
		});

		it("should claimLoan #1", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;

			await Microcredit.connect(user1)
				.claimLoan(0)
				.should.emit(Microcredit, "LoanClaimed")
				.withArgs(user1.address, 0);

			const statDate = await getCurrentBlockTimestamp();

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(amount);
			loan.currentDebt.should.eq(amount);
			loan.amountRepayed.should.eq(0);
			loan.repaymentsLength.should.eq(0);
			loan.lastComputedDate.should.eq(statDate);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(amount)
			);
		});

		it("should claimLoan #2", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user2.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;

			const statDate = await getCurrentBlockTimestamp();

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(amount);
			loan.currentDebt.should.eq(amount);
			loan.amountRepayed.should.eq(0);
			loan.repaymentsLength.should.eq(0);
			loan.lastComputedDate.should.eq(statDate);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(amount)
			);
		});

		it("should not claimLoan if invalid loan id", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;

			await Microcredit.connect(user1)
				.claimLoan(1)
				.should.be.rejectedWith("Microcredit: Loan doesn't exist");
			await Microcredit.connect(user2)
				.claimLoan(0)
				.should.be.rejectedWith("Microcredit: Invalid wallet address");
		});

		it("should not claimLoan after claimDeadline", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 5;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;

			await advanceNSecondsAndBlock(10);

			await Microcredit.connect(user1)
				.claimLoan(0)
				.should.be.rejectedWith("Microcredit: Loan expired");
		});

		it("should repayLoan (interest=0)", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;
			const repaymentAmount1 = toEther(10);

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			await cUSD
				.connect(user1)
				.approve(Microcredit.address, repaymentAmount1);

			await Microcredit.connect(user1)
				.repayLoan(0, repaymentAmount1)
				.should.emit(Microcredit, "RepaymentAdded")
				.withArgs(
					user1.address,
					0,
					repaymentAmount1,
					amount.sub(repaymentAmount1)
				);
			const repaymentDate = await getCurrentBlockTimestamp();

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(amount.sub(repaymentAmount1));
			loan.currentDebt.should.eq(amount.sub(repaymentAmount1));
			loan.amountRepayed.should.eq(repaymentAmount1);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate);

			let repayment = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment.amount.should.eq(repaymentAmount1);
			repayment.date.should.eq(repaymentDate);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(repaymentAmount1)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(amount).add(repaymentAmount1)
			);
		});

		it("should repayLoan multiple times (interest=0)", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			const repaymentAmount1 = toEther(10);
			const repaymentAmount2 = toEther(20);

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			await cUSD
				.connect(user1)
				.approve(
					Microcredit.address,
					repaymentAmount1.add(repaymentAmount2)
				);

			await Microcredit.connect(user1).repayLoan(0, repaymentAmount1)
				.should.be.fulfilled;
			const repaymentDate1 = await getCurrentBlockTimestamp();
			await Microcredit.connect(user1).repayLoan(0, repaymentAmount2)
				.should.be.fulfilled;
			const repaymentDate2 = await getCurrentBlockTimestamp();

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(
				amount.sub(repaymentAmount1.add(repaymentAmount2))
			);
			loan.currentDebt.should.eq(
				amount.sub(repaymentAmount1.add(repaymentAmount2))
			);
			loan.amountRepayed.should.eq(
				repaymentAmount1.add(repaymentAmount2)
			);
			loan.repaymentsLength.should.eq(2);
			loan.lastComputedDate.should.eq(repaymentDate2);

			let repayment1 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment1.amount.should.eq(repaymentAmount1);
			repayment1.date.should.eq(repaymentDate1);

			let repayment2 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				1
			);
			repayment2.amount.should.eq(repaymentAmount2);
			repayment2.date.should.eq(repaymentDate2);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance
					.add(amount)
					.sub(repaymentAmount1.add(repaymentAmount2))
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
					.sub(amount)
					.add(repaymentAmount1.add(repaymentAmount2))
			);
		});

		it("should changeUserAddress if manager", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			const repaymentAmount1 = toEther(10);
			const repaymentAmount2 = toEther(20);

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			await cUSD
				.connect(user1)
				.approve(Microcredit.address, repaymentAmount1);

			await Microcredit.connect(user1).repayLoan(0, repaymentAmount1)
				.should.be.fulfilled;
			const repaymentDate = await getCurrentBlockTimestamp();

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(amount.sub(repaymentAmount1));
			loan.currentDebt.should.eq(amount.sub(repaymentAmount1));
			loan.amountRepayed.should.eq(repaymentAmount1);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate);

			let repayment = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment.amount.should.eq(repaymentAmount1);
			repayment.date.should.eq(repaymentDate);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(repaymentAmount1)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(amount).add(repaymentAmount1)
			);

			await Microcredit.connect(manager1)
				.changeUserAddress(user1.address, user2.address)
				.should.emit(Microcredit, "UserAddressChanged")
				.withArgs(user1.address, user2.address);

			let walletMetadata1 = await Microcredit.walletMetadata(
				user1.address
			);
			walletMetadata1.userId.should.eq(1);
			walletMetadata1.movedTo.should.eq(user2.address);
			walletMetadata1.loansLength.should.eq(1);

			let walletMetadata2 = await Microcredit.walletMetadata(
				user2.address
			);
			walletMetadata2.userId.should.eq(1);
			walletMetadata2.movedTo.should.eq(ethers.constants.AddressZero);
			walletMetadata2.loansLength.should.eq(1);

			(await Microcredit.walletListLength()).should.eq(2);
			(await Microcredit.walletListAt(0)).should.eq(user1.address);
			(await Microcredit.walletListAt(1)).should.eq(user2.address);

			await Microcredit.userLoans(
				user1.address,
				0
			).should.be.rejectedWith("Microcredit: Invalid wallet address");

			loan = await Microcredit.userLoans(user2.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(amount.sub(repaymentAmount1));
			loan.currentDebt.should.eq(amount.sub(repaymentAmount1));
			loan.amountRepayed.should.eq(repaymentAmount1);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate);

			await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			).should.be.rejectedWith("Microcredit: Invalid wallet address");
			repayment = await Microcredit.userLoanRepayments(
				user2.address,
				0,
				0
			);
			repayment.amount.should.eq(repaymentAmount1);
			repayment.date.should.eq(repaymentDate);

			await Microcredit.connect(user1)
				.repayLoan(0, repaymentAmount1)
				.should.be.rejectedWith("Microcredit: Invalid wallet address");
			await cUSD
				.connect(user2)
				.approve(Microcredit.address, repaymentAmount2);
			await Microcredit.connect(user2).repayLoan(0, repaymentAmount2)
				.should.be.fulfilled;
			const repayment2 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user2.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(
				amount.sub(repaymentAmount1.add(repaymentAmount2))
			);
			loan.currentDebt.should.eq(
				amount.sub(repaymentAmount1.add(repaymentAmount2))
			);
			loan.amountRepayed.should.eq(
				repaymentAmount1.add(repaymentAmount2)
			);
			loan.repaymentsLength.should.eq(2);
			loan.lastComputedDate.should.eq(repayment2);

			repayment = await Microcredit.userLoanRepayments(
				user2.address,
				0,
				1
			);
			repayment.amount.should.eq(repaymentAmount2);
			repayment.date.should.eq(repayment2);
		});

		it("should not changeUserAddress if not user", async function () {
			await Microcredit.connect(manager1)
				.changeUserAddress(user1.address, user2.address)
				.should.be.rejectedWith(
					"Microcredit: This user cannot be moved"
				);
		});

		it("should not changeUserAddress if already moved", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;

			await Microcredit.connect(manager1).changeUserAddress(
				user1.address,
				user2.address
			).should.be.fulfilled;
			await Microcredit.connect(manager1)
				.changeUserAddress(user1.address, user2.address)
				.should.be.rejectedWith(
					"Microcredit: This user cannot be moved"
				);
		});

		it("should not changeUserAddress if target address is user", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(manager1).addLoan(
				user2.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;

			await Microcredit.connect(manager1)
				.changeUserAddress(user1.address, user2.address)
				.should.be.rejectedWith(
					"Microcredit: Target wallet address is invalid"
				);
		});

		it("should not changeUserAddress if not manager", async function () {
			await Microcredit.connect(user1)
				.changeUserAddress(user1.address, user2.address)
				.should.be.rejectedWith("Microcredit: caller is not a manager");
		});

		it("should calculate currentDebt (interest=0)", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1)
				.claimLoan(0)
				.should.emit(Microcredit, "LoanClaimed")
				.withArgs(user1.address, 0);

			const statDate = await getCurrentBlockTimestamp();

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(amount);
			loan.currentDebt.should.eq(amount);
			loan.amountRepayed.should.eq(0);
			loan.repaymentsLength.should.eq(0);
			loan.lastComputedDate.should.eq(statDate);

			await advanceNSecondsAndBlock(3600 * 24);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(amount);
			loan.currentDebt.should.eq(amount);
			loan.amountRepayed.should.eq(0);
			loan.repaymentsLength.should.eq(0);
			loan.lastComputedDate.should.eq(statDate);

			await advanceNSecondsAndBlock(3600 * 24);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(amount);

			await advanceNSecondsAndBlock(3600 * 24);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(amount);

			await advanceNSecondsAndBlock(3600 * 24 * 27);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(amount);

			await advanceNSecondsAndBlock(3600 * 24 * 150);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(amount);
		});

		it("should calculate currentDebt #1", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1)
				.claimLoan(0)
				.should.emit(Microcredit, "LoanClaimed")
				.withArgs(user1.address, 0);

			const statDate = await getCurrentBlockTimestamp();

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(amount);
			loan.currentDebt.should.eq(amount);
			loan.amountRepayed.should.eq(0);
			loan.repaymentsLength.should.eq(0);
			loan.lastComputedDate.should.eq(statDate);

			await advanceNSecondsAndBlock(3600 * 24);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(amount);
			loan.currentDebt.should.eq(toEther("100.2"));
			loan.amountRepayed.should.eq(0);
			loan.repaymentsLength.should.eq(0);
			loan.lastComputedDate.should.eq(statDate);

			await advanceNSecondsAndBlock(3600 * 24);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(toEther("100.4004"));

			await advanceNSecondsAndBlock(3600 * 24);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(toEther("100.6012008"));

			await advanceNSecondsAndBlock(3600 * 24 * 27);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(toEther("106.177292307845568797"));

			await advanceNSecondsAndBlock(3600 * 24 * 150);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(toEther("143.281419556037096897"));
		});

		it("should calculate currentDebt #2", async function () {
			const amount = toEther(2000);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1)
				.claimLoan(0)
				.should.emit(Microcredit, "LoanClaimed")
				.withArgs(user1.address, 0);

			let loan;

			await advanceNSecondsAndBlock(3600 * 24);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(toEther("2004"));

			await advanceNSecondsAndBlock(3600 * 24);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(toEther("2008.008"));

			await advanceNSecondsAndBlock(3600 * 24);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(toEther("2012.024016"));

			await advanceNSecondsAndBlock(3600 * 24 * 27);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(toEther("2123.545846156911376201"));

			await advanceNSecondsAndBlock(3600 * 24 * 150);
			loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(toEther("2865.628391120741939846"));
		});

		it("should repayLoan after 1 day", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			await advanceNSecondsAndBlock(3600 * 24);

			const expectedCurrentDebt = toEther("100.2");

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(expectedCurrentDebt);

			await cUSD
				.connect(user1)
				.approve(Microcredit.address, expectedCurrentDebt);

			await Microcredit.connect(user1).repayLoan(0, expectedCurrentDebt)
				.should.be.fulfilled;
			const repaymentDate1 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(0);
			loan.currentDebt.should.eq(0);
			loan.amountRepayed.should.eq(expectedCurrentDebt);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate1);

			let repayment1 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment1.amount.should.eq(expectedCurrentDebt);
			repayment1.date.should.eq(repaymentDate1);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(expectedCurrentDebt)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(amount).add(expectedCurrentDebt)
			);
		});

		it("should repayLoan after 2 days", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			await advanceNSecondsAndBlock(3600 * 24 * 2);

			const expectedCurrentDebt = toEther("100.4004");

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(expectedCurrentDebt);

			await cUSD
				.connect(user1)
				.approve(Microcredit.address, expectedCurrentDebt);

			await Microcredit.connect(user1).repayLoan(0, expectedCurrentDebt)
				.should.be.fulfilled;
			const repaymentDate1 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(0);
			loan.currentDebt.should.eq(0);
			loan.amountRepayed.should.eq(expectedCurrentDebt);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate1);

			let repayment1 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment1.amount.should.eq(expectedCurrentDebt);
			repayment1.date.should.eq(repaymentDate1);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(expectedCurrentDebt)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(amount).add(expectedCurrentDebt)
			);
		});

		it("should repayLoan after 3 days", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			await advanceNSecondsAndBlock(3600 * 24 * 3);

			const expectedCurrentDebt = toEther("100.6012008");

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(expectedCurrentDebt);

			await cUSD
				.connect(user1)
				.approve(Microcredit.address, expectedCurrentDebt);

			await Microcredit.connect(user1).repayLoan(0, expectedCurrentDebt)
				.should.be.fulfilled;
			const repaymentDate1 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(0);
			loan.currentDebt.should.eq(0);
			loan.amountRepayed.should.eq(expectedCurrentDebt);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate1);

			let repayment1 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment1.amount.should.eq(expectedCurrentDebt);
			repayment1.date.should.eq(repaymentDate1);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(expectedCurrentDebt)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(amount).add(expectedCurrentDebt)
			);
		});

		it("should repayLoan after 30 days", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			await advanceNSecondsAndBlock(3600 * 24 * 30);

			const expectedCurrentDebt = toEther("106.177292307845568797");

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(expectedCurrentDebt);

			await cUSD
				.connect(user1)
				.approve(Microcredit.address, expectedCurrentDebt);

			await Microcredit.connect(user1).repayLoan(0, expectedCurrentDebt)
				.should.be.fulfilled;
			const repaymentDate1 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(0);
			loan.currentDebt.should.eq(0);
			loan.amountRepayed.should.eq(expectedCurrentDebt);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate1);

			let repayment1 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment1.amount.should.eq(expectedCurrentDebt);
			repayment1.date.should.eq(repaymentDate1);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(expectedCurrentDebt)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(amount).add(expectedCurrentDebt)
			);
		});

		it("should repayLoan after 180 days", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			await advanceNSecondsAndBlock(3600 * 24 * 180);

			const expectedCurrentDebt = toEther("143.281419556037096897");

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(expectedCurrentDebt);

			await cUSD
				.connect(user1)
				.approve(Microcredit.address, expectedCurrentDebt);

			await Microcredit.connect(user1).repayLoan(0, expectedCurrentDebt)
				.should.be.fulfilled;
			const repaymentDate1 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(0);
			loan.currentDebt.should.eq(0);
			loan.amountRepayed.should.eq(expectedCurrentDebt);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate1);

			let repayment1 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment1.amount.should.eq(expectedCurrentDebt);
			repayment1.date.should.eq(repaymentDate1);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(expectedCurrentDebt)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(amount).add(expectedCurrentDebt)
			);
		});

		it("should not repay more than current debt", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			await advanceNSecondsAndBlock(3600 * 24);

			const expectedCurrentDebt = toEther("100.2");
			const repaymentAmount = toEther("200");

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(expectedCurrentDebt);

			await cUSD
				.connect(user1)
				.approve(Microcredit.address, repaymentAmount);

			await Microcredit.connect(user1)
				.repayLoan(0, repaymentAmount)
				.should.emit(Microcredit, "RepaymentAdded")
				.withArgs(user1.address, 0, expectedCurrentDebt, 0);

			const repaymentDate1 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(0);
			loan.currentDebt.should.eq(0);
			loan.amountRepayed.should.eq(expectedCurrentDebt);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate1);

			let repayment1 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment1.amount.should.eq(expectedCurrentDebt);
			repayment1.date.should.eq(repaymentDate1);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(expectedCurrentDebt)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(amount).add(expectedCurrentDebt)
			);
		});

		it("should not repayLoan after fully repayed", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;

			await advanceNSecondsAndBlock(3600 * 24);

			const expectedCurrentDebt = toEther("100.2");

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(expectedCurrentDebt);

			await cUSD
				.connect(user1)
				.approve(Microcredit.address, expectedCurrentDebt);

			await Microcredit.connect(user1).repayLoan(0, expectedCurrentDebt)
				.should.be.fulfilled;
			await Microcredit.connect(user1)
				.repayLoan(0, expectedCurrentDebt)
				.should.be.rejectedWith(
					"Microcredit: Loan has already been fully repayed"
				);
		});

		it("should not repayLoan if not claimed yet", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;

			await Microcredit.connect(user1)
				.repayLoan(0, amount)
				.should.be.rejectedWith("Microcredit: Loan not claimed");
		});

		it("should not repayLoan if invalid wallet address", async function () {
			await Microcredit.connect(user1)
				.repayLoan(0, toEther(1))
				.should.be.rejectedWith("Microcredit: Invalid wallet address");
		});

		it("should not repayLoan if invalid wallet address", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;

			await Microcredit.connect(user1)
				.repayLoan(1, amount)
				.should.be.rejectedWith("Microcredit: Loan doesn't exist");
		});

		it("should repayLoan multiple times in same day", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			const expectedCurrentDebt = toEther("100.2");
			const repaymentAmount1 = expectedCurrentDebt.div(3);
			const repaymentAmount2 = expectedCurrentDebt.sub(repaymentAmount1);

			await advanceNSecondsAndBlock(3600 * 24);

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(expectedCurrentDebt);

			await cUSD
				.connect(user1)
				.approve(
					Microcredit.address,
					repaymentAmount1.add(repaymentAmount2)
				);

			await Microcredit.connect(user1).repayLoan(0, repaymentAmount1)
				.should.be.fulfilled;
			const repaymentDate1 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(
				expectedCurrentDebt.sub(repaymentAmount1)
			);
			loan.currentDebt.should.eq(
				expectedCurrentDebt.sub(repaymentAmount1)
			);
			loan.amountRepayed.should.eq(repaymentAmount1);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate1);

			await Microcredit.connect(user1).repayLoan(0, repaymentAmount2)
				.should.be.fulfilled;
			const repaymentDate2 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(0);
			loan.currentDebt.should.eq(0);
			loan.amountRepayed.should.eq(
				repaymentAmount1.add(repaymentAmount2)
			);
			loan.repaymentsLength.should.eq(2);
			loan.lastComputedDate.should.eq(repaymentDate2);

			let repayment1 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment1.amount.should.eq(repaymentAmount1);
			repayment1.date.should.eq(repaymentDate1);

			let repayment2 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				1
			);
			repayment2.amount.should.eq(repaymentAmount2);
			repayment2.date.should.eq(repaymentDate2);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance
					.add(amount)
					.sub(repaymentAmount1.add(repaymentAmount2))
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
					.sub(amount)
					.add(repaymentAmount1.add(repaymentAmount2))
			);
		});

		it("should repayLoan multiple times in multiple days", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			const expectedCurrentDebt1 = toEther("100.2");
			const repaymentAmount1 = expectedCurrentDebt1.div(5);
			const repaymentAmount2 = expectedCurrentDebt1.sub(repaymentAmount1);

			await advanceNSecondsAndBlock(3600 * 24);

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(expectedCurrentDebt1);

			await cUSD
				.connect(user1)
				.approve(
					Microcredit.address,
					repaymentAmount1.add(repaymentAmount2)
				);

			await Microcredit.connect(user1).repayLoan(0, repaymentAmount1)
				.should.be.fulfilled;
			const repaymentDate1 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(
				expectedCurrentDebt1.sub(repaymentAmount1)
			);
			loan.currentDebt.should.eq(
				expectedCurrentDebt1.sub(repaymentAmount1)
			);
			loan.amountRepayed.should.eq(repaymentAmount1);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate1);

			await advanceNSecondsAndBlock(3600 * 24);

			const expectedCurrentDebt2 = toEther("80.320320000000000000");

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(
				expectedCurrentDebt1.sub(repaymentAmount1)
			);
			loan.currentDebt.should.eq(expectedCurrentDebt2);
			loan.amountRepayed.should.eq(repaymentAmount1);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate1);

			await Microcredit.connect(user1).repayLoan(0, repaymentAmount2)
				.should.be.fulfilled;
			const repaymentDate2 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(
				expectedCurrentDebt2.sub(repaymentAmount2)
			);
			loan.currentDebt.should.eq(
				expectedCurrentDebt2.sub(repaymentAmount2)
			);
			loan.amountRepayed.should.eq(
				repaymentAmount1.add(repaymentAmount2)
			);
			loan.repaymentsLength.should.eq(2);
			loan.lastComputedDate.should.eq(repaymentDate2);

			let repayment1 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment1.amount.should.eq(repaymentAmount1);
			repayment1.date.should.eq(repaymentDate1);

			let repayment2 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				1
			);
			repayment2.amount.should.eq(repaymentAmount2);
			repayment2.date.should.eq(repaymentDate2);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance
					.add(amount)
					.sub(repaymentAmount1.add(repaymentAmount2))
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
					.sub(amount)
					.add(repaymentAmount1.add(repaymentAmount2))
			);
		});
	});

	describe("Microcredit - loan functionalities (revenue address != 0)", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await Microcredit.connect(owner).addManagers([manager1.address]);
		});

		it("should repayLoan and redirect revenue #1", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			await advanceNSecondsAndBlock(3600 * 24 * 180);

			const expectedCurrentDebt = toEther("143.281419556037096897");

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(expectedCurrentDebt);

			await cUSD
				.connect(user1)
				.approve(Microcredit.address, expectedCurrentDebt);

			await Microcredit.connect(user1).repayLoan(0, expectedCurrentDebt)
				.should.be.fulfilled;
			const repaymentDate1 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(0);
			loan.currentDebt.should.eq(0);
			loan.amountRepayed.should.eq(expectedCurrentDebt);
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate1);

			let repayment1 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment1.amount.should.eq(expectedCurrentDebt);
			repayment1.date.should.eq(repaymentDate1);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(expectedCurrentDebt)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
			);
			(await cUSD.balanceOf(MicrocreditRevenue.address)).should.eq(
				expectedCurrentDebt.sub(amount)
			);
		});

		it("should repayLoan and redirect revenue #2", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			await advanceNSecondsAndBlock(3600 * 24 * 180);

			const expectedCurrentDebt = toEther("143.281419556037096897");

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(expectedCurrentDebt);

			await cUSD.connect(user1).approve(Microcredit.address, toEther(40));
			await Microcredit.connect(user1).repayLoan(0, toEther(40)).should.be
				.fulfilled;
			const repaymentDate1 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(toEther("103.281419556037096897"));
			loan.currentDebt.should.eq(toEther("103.281419556037096897"));
			loan.amountRepayed.should.eq(toEther(40));
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate1);

			let repayment1 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment1.amount.should.eq(toEther(40));
			repayment1.date.should.eq(repaymentDate1);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(toEther(40))
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(amount).add(toEther(40))
			);
			(await cUSD.balanceOf(MicrocreditRevenue.address)).should.eq(0);

			await cUSD.connect(user1).approve(Microcredit.address, toEther(60));
			await Microcredit.connect(user1).repayLoan(0, toEther(60)).should.be
				.fulfilled;
			const repaymentDate2 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(toEther("43.281419556037096897"));
			loan.currentDebt.should.eq(toEther("43.281419556037096897"));
			loan.amountRepayed.should.eq(toEther(100));
			loan.repaymentsLength.should.eq(2);
			loan.lastComputedDate.should.eq(repaymentDate2);

			let repayment2 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				1
			);
			repayment2.amount.should.eq(toEther(60));
			repayment2.date.should.eq(repaymentDate2);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(toEther(100))
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
			);
			(await cUSD.balanceOf(MicrocreditRevenue.address)).should.eq(0);

			await cUSD
				.connect(user1)
				.approve(Microcredit.address, toEther("43.281419556037096897"));
			await Microcredit.connect(user1).repayLoan(
				0,
				toEther("43.281419556037096897")
			).should.be.fulfilled;
			const repaymentDate3 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(0);
			loan.currentDebt.should.eq(0);
			loan.amountRepayed.should.eq(toEther("143.281419556037096897"));
			loan.repaymentsLength.should.eq(3);
			loan.lastComputedDate.should.eq(repaymentDate3);

			let repayment3 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				2
			);
			repayment3.amount.should.eq(toEther("43.281419556037096897"));
			repayment3.date.should.eq(repaymentDate3);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(expectedCurrentDebt)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
			);
			(await cUSD.balanceOf(MicrocreditRevenue.address)).should.eq(
				toEther("43.281419556037096897")
			);
		});

		it("should repayLoan and redirect revenue #3", async function () {
			const amount = toEther(100);
			const period = sixMonth;
			const dailyInterest = toEther(0.2);
			const claimDeadline = (await getCurrentBlockTimestamp()) + 1000;

			await Microcredit.connect(manager1).addLoan(
				user1.address,
				amount,
				period,
				dailyInterest,
				claimDeadline
			).should.be.fulfilled;
			await Microcredit.connect(user1).claimLoan(0).should.be.fulfilled;
			const statDate = await getCurrentBlockTimestamp();

			await advanceNSecondsAndBlock(3600 * 24 * 180);

			const expectedCurrentDebt = toEther("143.281419556037096897");

			let loan = await Microcredit.userLoans(user1.address, 0);
			loan.currentDebt.should.eq(expectedCurrentDebt);

			await cUSD.connect(user1).approve(Microcredit.address, toEther(40));
			await Microcredit.connect(user1).repayLoan(0, toEther(40)).should.be
				.fulfilled;
			const repaymentDate1 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(toEther("103.281419556037096897"));
			loan.currentDebt.should.eq(toEther("103.281419556037096897"));
			loan.amountRepayed.should.eq(toEther(40));
			loan.repaymentsLength.should.eq(1);
			loan.lastComputedDate.should.eq(repaymentDate1);

			let repayment1 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				0
			);
			repayment1.amount.should.eq(toEther(40));
			repayment1.date.should.eq(repaymentDate1);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(toEther(40))
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance.sub(amount).add(toEther(40))
			);
			(await cUSD.balanceOf(MicrocreditRevenue.address)).should.eq(0);

			await cUSD.connect(user1).approve(Microcredit.address, toEther(70));
			await Microcredit.connect(user1).repayLoan(0, toEther(70)).should.be
				.fulfilled;
			const repaymentDate2 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(toEther("33.281419556037096897"));
			loan.currentDebt.should.eq(toEther("33.281419556037096897"));
			loan.amountRepayed.should.eq(toEther(110));
			loan.repaymentsLength.should.eq(2);
			loan.lastComputedDate.should.eq(repaymentDate2);

			let repayment2 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				1
			);
			repayment2.amount.should.eq(toEther(70));
			repayment2.date.should.eq(repaymentDate2);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(toEther(110))
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
			);
			(await cUSD.balanceOf(MicrocreditRevenue.address)).should.eq(
				toEther(10)
			);

			await cUSD
				.connect(user1)
				.approve(Microcredit.address, toEther("33.281419556037096897"));
			await Microcredit.connect(user1).repayLoan(
				0,
				toEther("33.281419556037096897")
			).should.be.fulfilled;
			const repaymentDate3 = await getCurrentBlockTimestamp();

			loan = await Microcredit.userLoans(user1.address, 0);
			loan.amountBorrowed.should.eq(amount);
			loan.period.should.eq(period);
			loan.dailyInterest.should.eq(dailyInterest);
			loan.claimDeadline.should.eq(claimDeadline);
			loan.startDate.should.eq(statDate);
			loan.lastComputedDebt.should.eq(0);
			loan.currentDebt.should.eq(0);
			loan.amountRepayed.should.eq(toEther("143.281419556037096897"));
			loan.repaymentsLength.should.eq(3);
			loan.lastComputedDate.should.eq(repaymentDate3);

			let repayment3 = await Microcredit.userLoanRepayments(
				user1.address,
				0,
				2
			);
			repayment3.amount.should.eq(toEther("33.281419556037096897"));
			repayment3.date.should.eq(repaymentDate3);

			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUser1Balance.add(amount).sub(expectedCurrentDebt)
			);
			(await cUSD.balanceOf(Microcredit.address)).should.eq(
				initialMicrocreditBalance
			);
			(await cUSD.balanceOf(MicrocreditRevenue.address)).should.eq(
				toEther("43.281419556037096897")
			);
		});
	});
});
