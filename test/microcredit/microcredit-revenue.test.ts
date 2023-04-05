// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";

// @ts-ignore
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { toEther } from "../utils/helpers";

chai.use(chaiAsPromised);

describe("MicrocreditRevenue", () => {
	let deployer: SignerWithAddress;
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;

	let cUSD: ethersTypes.Contract;
	let MicrocreditRevenue: ethersTypes.Contract;

	const initialBalance = toEther(1000000);

	const deploy = deployments.createFixture(async () => {
		await deployments.fixture("MicrocreditTest", {
			fallbackToGlobal: false,
		});

		cUSD = await ethers.getContractAt(
			"TokenMock",
			(
				await deployments.get("TokenMock")
			).address
		);

		MicrocreditRevenue = await ethers.getContractAt(
			"MicrocreditRevenueImplementation",
			(
				await deployments.get("MicrocreditRevenueProxy")
			).address
		);

		await cUSD.mint(MicrocreditRevenue.address, initialBalance);
	});

	describe("MicrocreditRevenue - basic", () => {
		before(async function () {
			[deployer, owner, user1] = await ethers.getSigners();
		});

		beforeEach(async () => {
			await deploy();
		});

		it("should have correct values", async function () {
			(await MicrocreditRevenue.getVersion()).should.eq(1);
			(await MicrocreditRevenue.owner()).should.eq(owner.address);
		});

		it("Should transferERC20 to address if owner", async function () {
			const initialUserBalance = await cUSD.balanceOf(user1.address);
			await MicrocreditRevenue.connect(owner).transferERC20(
				cUSD.address,
				user1.address,
				toEther("100")
			).should.be.fulfilled;
			(await cUSD.balanceOf(MicrocreditRevenue.address)).should.eq(
				initialBalance.sub(toEther(100))
			);
			(await cUSD.balanceOf(user1.address)).should.eq(
				initialUserBalance.add(toEther("100"))
			);
		});

		it("Should not transferERC20 if not owner", async function () {
			await MicrocreditRevenue.connect(deployer)
				.transferERC20(cUSD.address, user1.address, toEther("100"))
				.should.be.rejectedWith("Ownable: caller is not the owner");
		});
	});
});
