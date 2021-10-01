// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import { ethers, network, artifacts, deployments, waffle } from "hardhat";
import type * as ethersTypes from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumberish } from "ethers";
import { advanceBlockNTimes, advanceNSeconds } from "../utils/TimeTravel";
import { parseEther } from "@ethersproject/units";

const {
	expectRevert,
	expectEvent,
	time,
	constants,
} = require("@openzeppelin/test-helpers");

chai.use(chaiAsPromised);

const expect = chai.expect;

const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60; // 2 days
const VOTING_PERIOD_BLOCKS = 10;
const VOTING_DELAY_BLOCKS = 10;
const PROPOSAL_THRESHOLD: BigNumberish = parseEther("100000000"); // 100 millions units (1%)
const QUORUM_VOTES: BigNumberish = parseEther("400000000"); // 400 millions units (4%)

// Contracts
let IPCTDelegate: ethersTypes.ContractFactory;

//users
let owner: SignerWithAddress;
let alice: SignerWithAddress;
let bob: SignerWithAddress;
let carol: SignerWithAddress;

// contract instances
let ipctToken: ethersTypes.Contract;
let ipctDelegator: ethersTypes.Contract;
let ipctTimelock: ethersTypes.Contract;
let communityAdminHelper: ethersTypes.Contract;
let communityAdmin: ethersTypes.Contract;
let treasury: ethersTypes.Contract;
let cUSD: ethersTypes.Contract;

describe("IPCTGovernator", function () {
	before(async function () {
		IPCTDelegate = await ethers.getContractFactory("IPCTDelegate");

		const accounts: SignerWithAddress[] = await ethers.getSigners();

		owner = accounts[0];
		alice = accounts[1];
		bob = accounts[2];
		carol = accounts[3];
	});

	beforeEach(async function () {
		await deployments.fixture("Test", { fallbackToGlobal: false });

		const ipctTokenDeployment = await deployments.get("IPCTToken");
		ipctToken = await ethers.getContractAt(
			"IPCTToken",
			ipctTokenDeployment.address
		);

		const ipctTimelockDeployment = await deployments.get("IPCTTimelock");
		ipctTimelock = await ethers.getContractAt(
			"IPCTTimelock",
			ipctTimelockDeployment.address
		);

		const ipctDelegatorDeployment = await deployments.get("IPCTDelegator");
		ipctDelegator = await ethers.getContractAt(
			"IPCTDelegator",
			ipctDelegatorDeployment.address
		);

		ipctDelegator = await IPCTDelegate.attach(ipctDelegator.address);
		ipctDelegator._setVotingPeriod(5);

		const communityAdminDeployment = await deployments.get(
			"CommunityAdminMock"
		);
		communityAdmin = await ethers.getContractAt(
			"CommunityAdminMock",
			communityAdminDeployment.address
		);

		const communityAdminHelperDeployment = await deployments.get(
			"CommunityAdminHelper"
		);
		communityAdminHelper = await ethers.getContractAt(
			"CommunityAdminHelper",
			communityAdminHelperDeployment.address
		);

		const treasuryDeployment = await deployments.get("TreasuryMock");
		treasury = await ethers.getContractAt(
			"TreasuryMock",
			treasuryDeployment.address
		);

		const cUSDDeployment = await deployments.get("TokenMock");
		cUSD = await ethers.getContractAt("TokenMock", cUSDDeployment.address);

		await cUSD.mint(treasury.address, parseEther("1000"));

		await ipctDelegator._setVotingPeriod(VOTING_PERIOD_BLOCKS);
		await ipctDelegator._setVotingDelay(VOTING_PERIOD_BLOCKS);

		await ipctToken.transfer(alice.address, parseEther("100000000"));
		await ipctToken.transfer(bob.address, parseEther("100000000"));
		await ipctToken.transfer(carol.address, parseEther("100000000"));

		await ipctToken.delegate(owner.address);
		await ipctToken.connect(alice).delegate(alice.address);
		await ipctToken.connect(bob).delegate(bob.address);
		await ipctToken.connect(carol).delegate(carol.address);
	});

	it("should create community", async function () {
		await ipctToken.transfer(ipctDelegator.address, parseEther("1234"));

		const targets = [communityAdmin.address];
		const values = [0];
		const signatures = [
			"addCommunity(address,uint256,uint256,uint256,uint256)",
		];

		const calldatas = [
			ethers.utils.defaultAbiCoder.encode(
				["address", "uint256", "uint256", "uint256", "uint256"],
				[
					alice.address,
					parseEther("100"),
					parseEther("1000"),
					1111,
					111,
				]
			),
		];
		const descriptions = "description";

		await expect(
			ipctDelegator.propose(
				targets,
				values,
				signatures,
				calldatas,
				descriptions
			)
		).to.be.fulfilled;

		await advanceBlockNTimes(VOTING_DELAY_BLOCKS);

		await expect(ipctDelegator.castVote(1, 1)).to.be.fulfilled;
		await expect(ipctDelegator.connect(alice).castVote(1, 1)).to.be
			.fulfilled;

		await advanceBlockNTimes(VOTING_PERIOD_BLOCKS);

		await expect(ipctDelegator.connect(alice).queue(1)).to.be.fulfilled;

		await network.provider.send("evm_increaseTime", [TWO_DAYS_SECONDS]);

		await expect(ipctDelegator.connect(alice).execute(1)).to.be.fulfilled;
	});

	it("should create community 2", async function () {
		await ipctToken.transfer(ipctDelegator.address, parseEther("1234"));

		const targets = [communityAdmin.address];
		const values = [0];
		const signatures = [
			"addCommunity(address,uint256,uint256,uint256,uint256)",
		];

		const calldatas = [
			ethers.utils.defaultAbiCoder.encode(
				["address", "uint256", "uint256", "uint256", "uint256"],
				[
					alice.address,
					parseEther("100"),
					parseEther("1000"),
					1111,
					111,
				]
			),
		];
		const descriptions = "description";

		await expect(
			ipctDelegator.propose(
				targets,
				values,
				signatures,
				calldatas,
				descriptions
			)
		).to.be.fulfilled;

		await advanceBlockNTimes(VOTING_DELAY_BLOCKS);

		await expect(ipctDelegator.castVote(1, 1)).to.be.fulfilled;
		await expect(ipctDelegator.connect(alice).castVote(1, 1)).to.be
			.fulfilled;

		await advanceBlockNTimes(VOTING_PERIOD_BLOCKS);

		await expect(ipctDelegator.connect(alice).queue(1)).to.be.fulfilled;

		await advanceNSeconds(TWO_DAYS_SECONDS);

		await expect(ipctDelegator.connect(alice).execute(1)).to.be.fulfilled;
	});
});
