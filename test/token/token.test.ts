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
let votingToken: ethersTypes.Contract;
describe("Token", function () {
	before(async function () {
		[owner, user1, user2, user3, user4, user5, user6, user7, user8, user9] =
			await ethers.getSigners();
	});

	beforeEach(async function () {
		await deployments.fixture("TokenTest", { fallbackToGlobal: false });

		votingToken = await ethers.getContractAt(
			"PACTToken",
			(
				await deployments.get("PACTToken")
			).address
		);

		await votingToken.transfer(user1.address, parseEther("1000000"));
	});

	it("should have correct params", async function () {
		expect(await votingToken.name()).to.be.equal("PactToken");
		expect(await votingToken.symbol()).to.be.equal("PACT");
		expect(await votingToken.decimals()).to.be.equal(18);
		expect(await votingToken.totalSupply()).to.be.equal(
			parseEther("10000000000")
		);
	});

	it("should be able to transfer funds", async function () {
		await expect(votingToken.transfer(user2.address, 1)).to.be.fulfilled;
		expect(await votingToken.balanceOf(user2.address)).to.be.equal(1);
	});

	it("should be able to delegate voting power", async function () {
		const blockNumber: number = await getBlockNumber();
		await expect(votingToken.connect(user1).delegate(user2.address)).to.be
			.fulfilled;
		expect(await votingToken.getCurrentVotes(user2.address)).to.be.equal(
			parseEther("1000000")
		);
		expect(
			await votingToken.getPriorVotes(user2.address, blockNumber)
		).to.be.equal(0);
		await advanceBlockNTimes(10);
		expect(
			await votingToken.getPriorVotes(user2.address, blockNumber + 10)
		).to.be.equal(parseEther("1000000"));
	});

	it("should not have same voting power after transferring", async function () {
		await votingToken.connect(user1).delegate(user2.address);
		expect(await votingToken.getCurrentVotes(user2.address)).to.be.equal(
			parseEther("1000000")
		);

		await votingToken
			.connect(user1)
			.transfer(user3.address, parseEther("400000"));

		expect(await votingToken.getCurrentVotes(user2.address)).to.be.equal(
			parseEther("600000")
		);

		await votingToken.connect(user1).delegate(user4.address);
		expect(await votingToken.getCurrentVotes(user2.address)).to.be.equal(0);
		expect(await votingToken.getCurrentVotes(user4.address)).to.be.equal(
			parseEther("600000")
		);
	});
});
