// @ts-ignore
import chai, { should } from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import {
	ethers,
	network,
	artifacts,
	deployments,
	waffle,
	hardhatArguments,
} from "hardhat";
import type * as ethersTypes from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { formatEther, parseEther } from "@ethersproject/units";
import { advanceBlockNTimes, getBlockNumber } from "../utils/TimeTravel";

chai.use(chaiAsPromised);
const expect = chai.expect;
should();

//users
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

// contract instances
let stakingToken: ethersTypes.Contract;

describe("Staking Token", function () {
	before(async function () {
		[owner, user1, user2, user3, user4, user5, user6, user7, user8, user9] =
			await ethers.getSigners();
	});

	beforeEach(async function () {
		await deployments.fixture("StakingTokenTest", {
			fallbackToGlobal: false,
		});

		stakingToken = await ethers.getContractAt(
			"SPACTToken",
			(
				await deployments.get("SPACTToken")
			).address
		);
	});

	it("should have correct params", async function () {
		expect(await stakingToken.owner()).to.be.equal(owner.address);
		expect(await stakingToken.name()).to.be.equal("StakingPactToken");
		expect(await stakingToken.symbol()).to.be.equal("SPACT");
		expect(await stakingToken.decimals()).to.be.equal(18);
		expect(await stakingToken.totalSupply()).to.be.equal(0);
		expect(await stakingToken.balanceOf(owner.address)).to.be.equal(0);
	});

	it("should not be able to transfer funds", async function () {
		stakingToken = await ethers.getContractAt(
			"PACTToken",
			stakingToken.address
		);

		await expect(
			stakingToken.transfer(user1.address, 1)
		).to.be.rejectedWith(
			"Transaction reverted: function selector was not recognized and there's no fallback function"
		);
	});

	it("should be able to mint and burn tokens if admin", async function () {
		expect(await stakingToken.balanceOf(user1.address)).to.be.equal(0);
		await expect(stakingToken.mint(user1.address, parseEther("1000"))).to.be
			.fulfilled;
		expect(await stakingToken.balanceOf(user1.address)).to.be.equal(
			parseEther("1000")
		);
		expect(await stakingToken.totalSupply()).to.be.equal(
			parseEther("1000")
		);
		await expect(stakingToken.mint(user2.address, parseEther("1000"))).to.be
			.fulfilled;
		expect(await stakingToken.balanceOf(user2.address)).to.be.equal(
			parseEther("1000")
		);
		expect(await stakingToken.totalSupply()).to.be.equal(
			parseEther("2000")
		);
		await expect(stakingToken.burn(user1.address, parseEther("600"))).to.be
			.fulfilled;
		expect(await stakingToken.balanceOf(user1.address)).to.be.equal(
			parseEther("400")
		);
		expect(await stakingToken.totalSupply()).to.be.equal(
			parseEther("1400")
		);
		await expect(stakingToken.burn(user1.address, parseEther("400"))).to.be
			.fulfilled;
		expect(await stakingToken.balanceOf(user1.address)).to.be.equal(0);
		expect(await stakingToken.totalSupply()).to.be.equal(
			parseEther("1000")
		);
	});

	it("should not be able to mint tokens if not admin", async function () {
		await expect(
			stakingToken.connect(user1).mint(user1.address, parseEther("1000"))
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("should not be able to burn too much tokens", async function () {
		await expect(
			stakingToken.burn(user1.address, parseEther("1000"))
		).to.be.rejectedWith("VotingPower::_burnVotes: burn amount underflows");
	});

	it("should be able to delegate voting power", async function () {
		await stakingToken.mint(user1.address, parseEther("1000000"));

		const blockNumber: number = await getBlockNumber();
		await expect(stakingToken.connect(user1).delegate(user2.address)).to.be
			.fulfilled;
		expect(await stakingToken.getCurrentVotes(user2.address)).to.be.equal(
			parseEther("1000000")
		);
		expect(
			await stakingToken.getPriorVotes(user2.address, blockNumber)
		).to.be.equal(0);
		await advanceBlockNTimes(10);
		expect(
			await stakingToken.getPriorVotes(user2.address, blockNumber + 10)
		).to.be.equal(parseEther("1000000"));
	});

	it("should not have same voting power after burning", async function () {
		await stakingToken.mint(user1.address, parseEther("1000000"));

		await stakingToken.connect(user1).delegate(user2.address);
		expect(await stakingToken.getCurrentVotes(user2.address)).to.be.equal(
			parseEther("1000000")
		);

		await stakingToken.burn(user1.address, parseEther("400000"));

		expect(await stakingToken.getCurrentVotes(user2.address)).to.be.equal(
			parseEther("600000")
		);
	});
});
