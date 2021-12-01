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
import { parseEther, formatEther } from "@ethersproject/units";
import { zeroOutAddresses } from "hardhat/internal/hardhat-network/stack-traces/library-utils";
import { BigNumber } from "@ethersproject/bignumber";

const {
	expectRevert,
	expectEvent,
	time,
	constants,
} = require("@openzeppelin/test-helpers");

chai.use(chaiAsPromised);

const expect = chai.expect;

const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60; // 2 days
const VOTING_PERIOD_BLOCKS = 720;
const VOTING_DELAY_BLOCKS = 1;
const PROPOSAL_THRESHOLD: BigNumberish = parseEther("100000000"); // 100 millions units (1%)
const QUORUM_VOTES: BigNumberish = parseEther("100000000"); // 400 millions units (4%)
const communityMinTranche = parseEther("100");
const communityMaxTranche = parseEther("5000");

// Contracts
let IPCTDelegate: ethersTypes.ContractFactory;

//users
let owner: SignerWithAddress;
let alice: SignerWithAddress;
let bob: SignerWithAddress;
let carol: SignerWithAddress;

// contract instances
let pactToken: ethersTypes.Contract;
let ipctDelegator: ethersTypes.Contract;
let ipctDelegate: ethersTypes.Contract;
let ipctTimelock: ethersTypes.Contract;
let communityAdmin: ethersTypes.Contract;
let proxyAdmin: ethersTypes.Contract;
let donationMiner: ethersTypes.Contract;
let treasury: ethersTypes.Contract;
let impactLabsVesting: ethersTypes.Contract;
let cUSD: ethersTypes.Contract;
let ImpactProxyAdmin: ethersTypes.Contract;

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

		const pactTokenDeployment = await deployments.get("PACTToken");
		pactToken = await ethers.getContractAt(
			"PACTToken",
			pactTokenDeployment.address
		);

		const ipctTimelockDeployment = await deployments.get("IPCTTimelock");
		ipctTimelock = await ethers.getContractAt(
			"IPCTTimelock",
			ipctTimelockDeployment.address
		);

		const ipctDelegateDeployment = await deployments.get("IPCTDelegate");
		ipctDelegate = await ethers.getContractAt(
			"IPCTDelegate",
			ipctDelegateDeployment.address
		);

		const ipctDelegatorDeployment = await deployments.get("IPCTDelegator");
		ipctDelegator = await ethers.getContractAt(
			"IPCTDelegator",
			ipctDelegatorDeployment.address
		);

		ipctDelegator = await IPCTDelegate.attach(ipctDelegator.address);

		const communityAdminDeployment = await deployments.get(
			"CommunityAdminProxy"
		);
		communityAdmin = await ethers.getContractAt(
			"CommunityAdminImplementation",
			communityAdminDeployment.address
		);

		donationMiner = await ethers.getContractAt(
			"DonationMinerImplementation",
			(
				await deployments.get("DonationMinerProxy")
			).address
		);

		proxyAdmin = await ethers.getContractAt(
			"ImpactProxyAdmin",
			(
				await deployments.get("ImpactProxyAdmin")
			).address
		);

		const treasuryDeployment = await deployments.get("TreasuryProxy");
		treasury = await ethers.getContractAt(
			"TreasuryImplementation",
			treasuryDeployment.address
		);

		const impactLabsVestingDeployment = await deployments.get(
			"ImpactLabsVestingProxy"
		);
		impactLabsVesting = await ethers.getContractAt(
			"ImpactLabsVestingImplementation",
			impactLabsVestingDeployment.address
		);

		ImpactProxyAdmin = await ethers.getContractAt(
			"ImpactProxyAdmin",
			(
				await deployments.get("ImpactProxyAdmin")
			).address
		);

		const cUSDDeployment = await deployments.get("TokenMock");
		cUSD = await ethers.getContractAt("TokenMock", cUSDDeployment.address);

		await cUSD.mint(treasury.address, parseEther("1000"));

		await pactToken.transfer(alice.address, parseEther("40000000"));
		// await pactToken.transfer(bob.address, parseEther("100000000"));
		// await pactToken.transfer(carol.address, parseEther("100000000"));

		await pactToken.delegate(owner.address);
		await pactToken.connect(alice).delegate(owner.address);
		// await pactToken.connect(bob).delegate(bob.address);
		// await pactToken.connect(carol).delegate(carol.address);

		await communityAdmin.transferOwnership(ipctTimelock.address);
	});

	async function createCommunityProposal() {
		const targets = [communityAdmin.address];
		const values = [0];
		const signatures = [
			"addCommunity(address[],uint256,uint256,uint256,uint256,uint256,uint256,uint256)",
		];

		const calldatas = [
			ethers.utils.defaultAbiCoder.encode(
				[
					"address[]",
					"uint256",
					"uint256",
					"uint256",
					"uint256",
					"uint256",
					"uint256",
					"uint256",
				],
				[
					[alice.address],
					parseEther("100"),
					parseEther("1000"),
					parseEther("0.01"),
					1111,
					111,
					communityMinTranche,
					communityMaxTranche,
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
	}

	it("should create community", async function () {
		await createCommunityProposal();

		await advanceBlockNTimes(VOTING_DELAY_BLOCKS);

		await expect(ipctDelegator.castVote(1, 1)).to.be.fulfilled;

		await expect(ipctDelegator.connect(alice).castVote(1, 1)).to.be
			.fulfilled;

		await advanceBlockNTimes(VOTING_PERIOD_BLOCKS);

		await expect(ipctDelegator.connect(alice).queue(1)).to.be.fulfilled;

		await advanceNSeconds(TWO_DAYS_SECONDS);

		await expect(ipctDelegator.connect(alice).execute(1)).to.be.fulfilled;
	});

	it("should update community implementation", async function () {
		await createCommunityProposal();

		await advanceBlockNTimes(VOTING_DELAY_BLOCKS);

		await expect(ipctDelegator.castVote(1, 1)).to.be.fulfilled;
		await expect(ipctDelegator.connect(alice).castVote(1, 1)).to.be
			.fulfilled;

		await advanceBlockNTimes(VOTING_PERIOD_BLOCKS);

		await expect(ipctDelegator.connect(alice).queue(1)).to.be.fulfilled;

		await advanceNSeconds(TWO_DAYS_SECONDS);

		await expect(ipctDelegator.connect(alice).execute(1)).to.be.fulfilled;

		//***************************************************************************

		const targets2 = [communityAdmin.address];
		const values2 = [0];
		const descriptions2 = "description";

		let communityTemplateNewAddress: string =
			"0xf41B47c54dEFF12f8fE830A411a09D865eBb120E";

		const signatures2 = ["updateCommunityTemplate(address)"];

		const calldatas2 = [
			ethers.utils.defaultAbiCoder.encode(
				["address"],
				[communityTemplateNewAddress]
			),
		];

		await expect(
			ipctDelegator.propose(
				targets2,
				values2,
				signatures2,
				calldatas2,
				descriptions2
			)
		).to.be.fulfilled;

		await advanceBlockNTimes(VOTING_DELAY_BLOCKS);

		await expect(ipctDelegator.castVote(2, 1)).to.be.fulfilled;
		// await expect(ipctDelegator.connect(alice).castVote(2, 1)).to.be
		// 	.fulfilled;

		await advanceBlockNTimes(VOTING_PERIOD_BLOCKS);

		await expect(ipctDelegator.connect(alice).queue(2)).to.be.fulfilled;

		await advanceNSeconds(TWO_DAYS_SECONDS);

		await expect(ipctDelegator.connect(alice).execute(2)).to.be.fulfilled;

		expect(await communityAdmin.communityTemplate()).to.be.equal(
			communityTemplateNewAddress
		);
	});

	it("should update params if owner", async function () {
		await expect(ipctDelegator._setVotingDelay(123)).to.be.fulfilled;
		await expect(ipctDelegator._setVotingPeriod(730)).to.be.fulfilled;
		await expect(ipctDelegator._setQuorumVotes(QUORUM_VOTES.mul(2))).to.be
			.fulfilled;
		await expect(
			ipctDelegator._setProposalThreshold(PROPOSAL_THRESHOLD.mul(2))
		).to.be.fulfilled;
	});

	it("should not update params if not owner", async function () {
		await expect(
			ipctDelegator.connect(alice)._setVotingDelay(0)
		).to.be.rejectedWith("Ownable: caller is not the owner");
		await expect(
			ipctDelegator.connect(alice)._setVotingPeriod(0)
		).to.be.rejectedWith("Ownable: caller is not the owner");
		await expect(
			ipctDelegator.connect(alice)._setQuorumVotes(0)
		).to.be.rejectedWith("Ownable: caller is not the owner");
		await expect(
			ipctDelegator.connect(alice)._setProposalThreshold(0)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("should update delegate if owner", async function () {
		const NewIPCTDelegateFactory = await ethers.getContractFactory(
			"IPCTDelegate"
		);
		const newIPCTDelegate = await NewIPCTDelegateFactory.deploy();

		expect(
			await ImpactProxyAdmin.getProxyImplementation(ipctDelegator.address)
		).to.be.equal(ipctDelegate.address);
		await expect(
			ImpactProxyAdmin.upgrade(
				ipctDelegator.address,
				newIPCTDelegate.address
			)
		).to.be.fulfilled;
		expect(
			await ImpactProxyAdmin.getProxyImplementation(ipctDelegator.address)
		).to.be.equal(newIPCTDelegate.address);
	});

	it("should not update delegate if not owner", async function () {
		await ImpactProxyAdmin.transferOwnership(ipctTimelock.address);

		const NewIPCTDelegateFactory = await ethers.getContractFactory(
			"IPCTDelegate"
		);
		const newIPCTDelegate = await NewIPCTDelegateFactory.deploy();

		expect(
			await ImpactProxyAdmin.getProxyImplementation(ipctDelegator.address)
		).to.be.equal(ipctDelegate.address);
		await expect(
			ImpactProxyAdmin.upgrade(
				ipctDelegator.address,
				newIPCTDelegate.address
			)
		).to.be.rejectedWith("Ownable: caller is not the owner");
		expect(
			await ImpactProxyAdmin.getProxyImplementation(ipctDelegator.address)
		).to.be.equal(ipctDelegate.address);
	});

	it("should update delegate if timelock is owner", async function () {
		await ImpactProxyAdmin.transferOwnership(ipctTimelock.address);

		const NewIPCTDelegateFactory = await ethers.getContractFactory(
			"IPCTDelegate"
		);
		const newIPCTDelegate = await NewIPCTDelegateFactory.deploy();

		expect(
			await ImpactProxyAdmin.getProxyImplementation(ipctDelegator.address)
		).to.be.equal(ipctDelegate.address);

		const targets = [ImpactProxyAdmin.address];
		const values = [0];
		const signatures = ["upgrade(address,address)"];

		const calldatas = [
			ethers.utils.defaultAbiCoder.encode(
				["address", "address"],
				[ipctDelegator.address, newIPCTDelegate.address]
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

		expect(
			await ImpactProxyAdmin.getProxyImplementation(ipctDelegator.address)
		).to.be.equal(newIPCTDelegate.address);
	});

	it("should update donation miner", async function () {
		donationMiner.transferOwnership(ipctTimelock.address);
		const donationMinerImplementationFactory =
			await ethers.getContractFactory("DonationMinerImplementation");
		const newDonationMinerImplementation =
			await donationMinerImplementationFactory.deploy();

		const donationMinerProxyFactory = await ethers.getContractFactory(
			"DonationMinerProxy"
		);

		const newDonationMinerProxy = await donationMinerProxyFactory.deploy(
			newDonationMinerImplementation.address,
			proxyAdmin.address
		);

		const newDonationMinerContract = await ethers.getContractAt(
			"DonationMinerImplementation",
			newDonationMinerProxy.address
		);

		await newDonationMinerContract.initialize(
			cUSD.address,
			pactToken.address,
			treasury.address,
			parseEther("1234"),
			30,
			100,
			"998902",
			"1000000"
		);

		await newDonationMinerContract.transferOwnership(ipctTimelock.address);

		const targets = [donationMiner.address];
		const values = [0];
		const descriptions = "description";

		const signatures = ["transfer(address,address,uint256)"];

		const calldatas = [
			ethers.utils.defaultAbiCoder.encode(
				["address", "address", "uint256"],
				[
					pactToken.address,
					newDonationMinerProxy.address,
					parseEther("4000000000"),
				]
			),
		];

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

		await advanceBlockNTimes(VOTING_PERIOD_BLOCKS);

		await expect(ipctDelegator.connect(alice).queue(1)).to.be.fulfilled;

		await advanceNSeconds(TWO_DAYS_SECONDS);

		await expect(ipctDelegator.connect(alice).execute(1)).to.be.fulfilled;

		expect(
			await pactToken.balanceOf(newDonationMinerContract.address)
		).to.be.equal(parseEther("4000000000"));
		expect(await pactToken.balanceOf(donationMiner.address)).to.be.equal(
			parseEther("0")
		);
	});

	it("should transfer token from treasury", async function () {
		treasury.transferOwnership(ipctTimelock.address);

		const treasuryInitialBalance: BigNumber = await cUSD.balanceOf(
			treasury.address
		);
		const bobInitialBalance: BigNumber = await cUSD.balanceOf(bob.address);
		const amount = "123456";

		const targets = [treasury.address];
		const values = [0];
		const descriptions = "description";

		const signatures = ["transfer(address,address,uint256)"];

		const calldatas = [
			ethers.utils.defaultAbiCoder.encode(
				["address", "address", "uint256"],
				[cUSD.address, bob.address, amount]
			),
		];

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

		await advanceBlockNTimes(VOTING_PERIOD_BLOCKS);

		await expect(ipctDelegator.connect(alice).queue(1)).to.be.fulfilled;

		await advanceNSeconds(TWO_DAYS_SECONDS);

		await expect(ipctDelegator.connect(alice).execute(1)).to.be.fulfilled;

		expect(await cUSD.balanceOf(treasury.address)).to.be.equal(
			treasuryInitialBalance.sub(amount)
		);
		expect(await cUSD.balanceOf(bob.address)).to.be.equal(
			bobInitialBalance.add(amount)
		);
	});

	it("should transfer token from delegator", async function () {
		ipctDelegator.transferOwnership(ipctTimelock.address);

		const delegatorInitialBalance: BigNumber = await pactToken.balanceOf(
			ipctDelegator.address
		);
		const bobInitialBalance: BigNumber = await pactToken.balanceOf(
			bob.address
		);
		const amount = "123456";

		const targets = [ipctDelegator.address];
		const values = [0];
		const descriptions = "description";

		const signatures = ["transfer(address,address,uint256)"];

		const calldatas = [
			ethers.utils.defaultAbiCoder.encode(
				["address", "address", "uint256"],
				[pactToken.address, bob.address, amount]
			),
		];

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

		await advanceBlockNTimes(VOTING_PERIOD_BLOCKS);

		await expect(ipctDelegator.connect(alice).queue(1)).to.be.fulfilled;

		await advanceNSeconds(TWO_DAYS_SECONDS);

		await expect(ipctDelegator.connect(alice).execute(1)).to.be.fulfilled;

		expect(await pactToken.balanceOf(ipctDelegator.address)).to.be.equal(
			delegatorInitialBalance.sub(amount)
		);
		expect(await pactToken.balanceOf(bob.address)).to.be.equal(
			bobInitialBalance.add(amount)
		);
	});
});
