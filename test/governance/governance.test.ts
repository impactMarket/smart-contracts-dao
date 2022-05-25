// @ts-ignore
import chai from "chai";
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
import {
	advanceBlockNTimes,
	advanceNSeconds,
	getBlockNumber,
} from "../utils/TimeTravel";
import { formatEther, parseEther } from "@ethersproject/units";
import { createAndExecuteProposal, governanceParams } from "../utils/helpers";

chai.use(chaiAsPromised);

const expect = chai.expect;

describe("Governance", function () {
	// Contracts
	let delegate: ethersTypes.ContractFactory;

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
	let stakingToken: ethersTypes.Contract;
	let USDT: ethersTypes.Contract;
	let governanceDelegator: ethersTypes.Contract;
	let governanceDelegate: ethersTypes.Contract;
	let timelock: ethersTypes.Contract;
	let proxyAdmin: ethersTypes.Contract;
	let treasuryProxy: ethersTypes.Contract;
	let ubiCommittee: ethersTypes.Contract;
	let communityMiddleProxy: ethersTypes.Contract;
	let communityAdminProxy: ethersTypes.Contract;

	const ADDRESS_TEST = "0x0000000000000000000000000000000123456789";
	const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

	enum ProposalState {
		Pending,
		Active,
		Canceled,
		Defeated,
		Succeeded,
		Queued,
		Expired,
		Executed,
	}

	async function createTreasuryTransferProposal(user: SignerWithAddress) {
		const targets = [treasuryProxy.address];
		const values = [0];
		const signatures = ["transfer(address,address,uint256)"];

		const calldatas = [
			ethers.utils.defaultAbiCoder.encode(
				["address", "address", "uint256"],
				[USDT.address, user1.address, parseEther("1000")]
			),
		];
		const descriptions = "description";

		await governanceDelegator
			.connect(user)
			.propose(targets, values, signatures, calldatas, descriptions);
	}

	async function deployGovernance() {
		await deployments.fixture("Test", { fallbackToGlobal: false });

		// governance setup
		votingToken = await ethers.getContractAt(
			"PACTToken",
			(
				await deployments.get("PACTToken")
			).address
		);

		timelock = await ethers.getContractAt(
			"PACTTimelock",
			(
				await deployments.get("PACTTimelock")
			).address
		);

		governanceDelegate = await ethers.getContractAt(
			"PACTDelegate",
			(
				await deployments.get("PACTDelegate")
			).address
		);

		governanceDelegator = await ethers.getContractAt(
			"PACTDelegator",
			(
				await deployments.get("PACTDelegator")
			).address
		);

		governanceDelegator = await delegate.attach(
			governanceDelegator.address
		);

		await votingToken.transfer(user1.address, parseEther("100000001")); // 100 mil (1 %)
		await votingToken.transfer(user2.address, parseEther("200000000")); // 200 mil (2 %)
		await votingToken.transfer(user3.address, parseEther("300000000")); // 300 mil (3 %)
		await votingToken.transfer(user4.address, parseEther("400000000")); // 400 mil (4 %)
		await votingToken.transfer(user5.address, parseEther("500000000")); // 500 mil (5 %)
		await votingToken.transfer(user6.address, parseEther("50000001")); // 50 mil (0.5 %)
		await votingToken.transfer(user7.address, parseEther("50000001")); // 50 mil (0.5 %)
		await votingToken.connect(user1).delegate(user1.address);
		await votingToken.connect(user2).delegate(user2.address);
		await votingToken.connect(user3).delegate(user3.address);
		await votingToken.connect(user4).delegate(user4.address);
		await votingToken.connect(user5).delegate(user5.address);
		await votingToken.connect(user6).delegate(user6.address);
		await votingToken.connect(user7).delegate(user7.address);

		proxyAdmin = await ethers.getContractAt(
			"ImpactProxyAdmin",
			(
				await deployments.get("ImpactProxyAdmin")
			).address
		);

		ubiCommittee = await ethers.getContractAt(
			"UBICommitteeImplementation",
			(
				await deployments.get("UBICommitteeProxy")
			).address
		);

		communityAdminProxy = await ethers.getContractAt(
			"CommunityAdminImplementation",
			(
				await deployments.get("CommunityAdminProxy")
			).address
		);

		communityMiddleProxy = await ethers.getContractAt(
			"CommunityMiddleProxy",
			(
				await deployments.get("CommunityMiddleProxy")
			).address
		);

		// treasury setup
		treasuryProxy = await ethers.getContractAt(
			"TreasuryImplementation",
			(
				await deployments.get("TreasuryProxy")
			).address
		);

		USDT = await ethers.getContractAt(
			"TokenMock",
			(
				await deployments.get("TokenMock")
			).address
		);

		await proxyAdmin.transferOwnership(timelock.address);
		await treasuryProxy.transferOwnership(timelock.address);
		await ubiCommittee.transferOwnership(timelock.address);

		await USDT.mint(treasuryProxy.address, parseEther("1000000"));
	}

	describe("Governance - with one token", function () {
		before(async function () {
			delegate = await ethers.getContractFactory("PACTDelegate");

			[
				owner,
				user1,
				user2,
				user3,
				user4,
				user5,
				user6,
				user7,
				user8,
				user9,
			] = await ethers.getSigners();
		});

		beforeEach(async function () {
			await deployGovernance();
		});

		it("should have correct params", async function () {
			expect(await governanceDelegator.votingDelay()).to.be.equal(
				governanceParams.VOTING_DELAY
			);
			expect(await governanceDelegator.votingPeriod()).to.be.equal(
				governanceParams.VOTING_PERIOD
			);
			expect(await governanceDelegator.proposalThreshold()).to.be.equal(
				governanceParams.PROPOSAL_THRESHOLD
			);

			expect(await governanceDelegator.proposalCount()).to.be.equal(1);
			expect(await governanceDelegator.quorumVotes()).to.be.equal(
				governanceParams.QUORUM_VOTES
			);
			expect(await governanceDelegator.timelock()).to.be.equal(
				timelock.address
			);
			expect(await governanceDelegator.token()).to.be.equal(
				votingToken.address
			);
		});

		it("should create proposal if user has enough votingTokens", async function () {
			await expect(createTreasuryTransferProposal(user1)).to.be.fulfilled;

			const startBlock = (await getBlockNumber()) + 1;

			const proposal = await governanceDelegator.proposals(1);
			expect(proposal.id).to.be.equal(1);
			expect(proposal.proposer).to.be.equal(user1.address);
			expect(proposal.eta).to.be.equal("0");
			expect(proposal.startBlock).to.be.equal(startBlock);
			expect(proposal.endBlock).to.be.equal(
				startBlock + governanceParams.VOTING_PERIOD
			);
			expect(proposal.forVotes).to.be.equal("0");
			expect(proposal.againstVotes).to.be.equal("0");
			expect(proposal.abstainVotes).to.be.equal("0");
			expect(proposal.canceled).to.be.equal(false);
			expect(proposal.executed).to.be.equal(false);

			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Pending
			);
		});

		it("should not create proposal if user doesn't have enough votingTokens", async function () {
			await expect(
				createTreasuryTransferProposal(user6)
			).to.be.rejectedWith(
				"PACT::propose: proposer votes below proposal threshold"
			);
		});

		it("should create proposal if user has been delegated", async function () {
			await votingToken.connect(user6).delegate(user8.address);
			await votingToken.connect(user7).delegate(user8.address);

			await expect(createTreasuryTransferProposal(user8)).to.be.fulfilled;
		});

		it("should not vote too early", async function () {
			await createTreasuryTransferProposal(user1);

			await expect(
				governanceDelegator.connect(user6).castVote(1, 1)
			).to.be.rejectedWith("PACT::castVoteInternal: voting is closed");
		});

		it("should vote on proposal after voting delay", async function () {
			await createTreasuryTransferProposal(user1);

			await advanceBlockNTimes(governanceParams.VOTING_DELAY);

			await expect(governanceDelegator.connect(user1).castVote(1, 0)).to
				.be.fulfilled; //  0=against
			await expect(governanceDelegator.connect(user2).castVote(1, 1)).to
				.be.fulfilled; //  1=for
			await expect(governanceDelegator.connect(user3).castVote(1, 2)).to
				.be.fulfilled; //  2=abstain

			const proposal = await governanceDelegator.proposals(1);
			expect(proposal.againstVotes).to.be.equal(parseEther("100000001"));
			expect(proposal.forVotes).to.be.equal(parseEther("200000000"));
			expect(proposal.abstainVotes).to.be.equal(parseEther("300000000"));

			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Active
			);
		});

		it("should vote on proposal after voting delay #2", async function () {
			await createTreasuryTransferProposal(user1);

			await advanceBlockNTimes(governanceParams.VOTING_DELAY);

			await expect(governanceDelegator.connect(user1).castVote(1, 0)).to
				.be.fulfilled; //  0=against
			await expect(governanceDelegator.connect(user4).castVote(1, 0)).to
				.be.fulfilled; //  0=against
			await expect(governanceDelegator.connect(user2).castVote(1, 1)).to
				.be.fulfilled; //  1=for
			await expect(governanceDelegator.connect(user5).castVote(1, 1)).to
				.be.fulfilled; //  1=for
			await expect(governanceDelegator.connect(user3).castVote(1, 2)).to
				.be.fulfilled; //  2=abstain
			await expect(governanceDelegator.connect(user6).castVote(1, 2)).to
				.be.fulfilled; //  2=abstain

			const proposal = await governanceDelegator.proposals(1);
			expect(proposal.againstVotes).to.be.equal(parseEther("500000001"));
			expect(proposal.forVotes).to.be.equal(parseEther("700000000"));
			expect(proposal.abstainVotes).to.be.equal(parseEther("350000001"));

			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Active
			);
		});

		it("should not vote on invalid proposal", async function () {
			await createTreasuryTransferProposal(user1);

			await advanceBlockNTimes(governanceParams.VOTING_DELAY);

			await expect(
				governanceDelegator.connect(user1).castVote(2, 1)
			).to.be.rejectedWith("PACT::state: invalid proposal id");
		});

		it("should not vote on proposal twice", async function () {
			await createTreasuryTransferProposal(user1);

			await advanceBlockNTimes(governanceParams.VOTING_DELAY);

			await governanceDelegator.connect(user1).castVote(1, 1);
			await expect(
				governanceDelegator.connect(user1).castVote(1, 1)
			).to.be.rejectedWith("PACT::castVoteInternal: voter already voted");

			const proposal = await governanceDelegator.proposals(1);
			expect(proposal.forVotes).to.be.equal(parseEther("100000001"));
		});

		it("should not queue proposal too early", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user5).castVote(1, 1);

			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Active
			);
			await expect(governanceDelegator.queue(1)).to.be.rejectedWith(
				"PACT::queue: proposal can only be queued if it is succeeded"
			);
		});

		it("should not queue an invalid proposal", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user5).castVote(1, 1);

			await expect(governanceDelegator.queue(2)).to.be.rejectedWith(
				"PACT::state: invalid proposal id"
			);
		});

		it("should not queue an un-succeeded proposal", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 2);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Defeated
			);
			await expect(governanceDelegator.queue(1)).to.be.rejectedWith(
				"PACT::queue: proposal can only be queued if it is succeeded"
			);
		});

		it("should queue a succeeded proposal", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 1);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Succeeded
			);
			await expect(governanceDelegator.queue(1)).to.be.fulfilled;
			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Queued
			);
		});

		it("should not execute an un-queued proposal", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 1);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await expect(governanceDelegator.execute(1)).to.be.rejectedWith(
				"PACT::execute: proposal can only be executed if it is queued"
			);
		});

		it("should not execute a proposal too early", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 1);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await governanceDelegator.queue(1);
			await expect(governanceDelegator.execute(1)).to.be.rejectedWith(
				"Timelock::executeTransaction: Transaction hasn't surpassed time lock."
			);
		});

		it("should execute a proposal after execution delay", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 1);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await governanceDelegator.queue(1);
			await advanceNSeconds(governanceParams.EXECUTION_DELAY);

			await expect(governanceDelegator.execute(1)).to.be.fulfilled;
			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Executed
			);
		});

		it("should not execute a proposal twice", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 1);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await governanceDelegator.queue(1);
			await advanceNSeconds(governanceParams.EXECUTION_DELAY);

			await governanceDelegator.execute(1);
			await expect(governanceDelegator.execute(1)).to.be.rejectedWith(
				"PACT::execute: proposal can only be executed if it is queued"
			);
		});

		it("should not execute a proposal too late", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 1);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await governanceDelegator.queue(1);
			await advanceNSeconds(
				governanceParams.EXECUTION_DELAY + governanceParams.GRACE_PERIOD
			);
			await expect(governanceDelegator.execute(1)).to.be.rejectedWith(
				"PACT::execute: proposal can only be executed if it is queued"
			);
			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Expired
			);
		});

		it("should cancel a proposal if it is not executed", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 1);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await governanceDelegator.queue(1);
			await advanceNSeconds(governanceParams.EXECUTION_DELAY);
			await expect(governanceDelegator.connect(user1).cancel(1)).to.be
				.fulfilled;
			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Canceled
			);
		});

		it("should cancel a proposal if it is not executed and owner doesn't have enough voting tokens", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 1);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await governanceDelegator.queue(1);
			await advanceNSeconds(governanceParams.EXECUTION_DELAY);

			await votingToken
				.connect(user1)
				.transfer(user7.address, parseEther("100"));
			// user1 will have less than 1% Voting Tokens and this value is lower than proposalThreshold
			// so any user can cancel an ongoing user1 proposal

			await expect(governanceDelegator.connect(user9).cancel(1)).to.be
				.fulfilled;
			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Canceled
			);
		});

		it("should not cancel a proposal if not owner", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 1);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await governanceDelegator.queue(1);
			await advanceNSeconds(governanceParams.EXECUTION_DELAY);
			await expect(
				governanceDelegator.connect(user2).cancel(1)
			).to.be.rejectedWith("PACT::cancel: proposer above threshold");
			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Queued
			);
		});

		it("should not cancel an executed proposal", async function () {
			await createTreasuryTransferProposal(user1);
			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 1);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await governanceDelegator.queue(1);
			await advanceNSeconds(governanceParams.EXECUTION_DELAY);

			await governanceDelegator.execute(1);

			await expect(
				governanceDelegator.connect(user2).cancel(1)
			).to.be.rejectedWith(
				"PACT::cancel: cannot cancel executed proposal"
			);
			expect(await governanceDelegator.state(1)).to.be.equal(
				ProposalState.Executed
			);
		});

		it("should update governance params by proposal", async function () {
			const targets = [
				governanceDelegator.address,
				governanceDelegator.address,
				governanceDelegator.address,
				governanceDelegator.address,
				governanceDelegator.address,
			];
			const values = [0, 0, 0, 0, 0];
			const signatures = [
				"_setVotingDelay(uint256)",
				"_setVotingPeriod(uint256)",
				"_setQuorumVotes(uint256)",
				"_setProposalThreshold(uint256)",
				"_setReleaseToken(address)",
			];

			const calldatas = [
				ethers.utils.defaultAbiCoder.encode(["uint256"], [123]),
				ethers.utils.defaultAbiCoder.encode(["uint256"], [1000]),
				ethers.utils.defaultAbiCoder.encode(
					["uint256"],
					[parseEther("400000000")]
				),
				ethers.utils.defaultAbiCoder.encode(
					["uint256"],
					[parseEther("200000000")]
				),
				ethers.utils.defaultAbiCoder.encode(
					["address"],
					[ADDRESS_TEST]
				),
			];
			const descriptions = "description";

			await governanceDelegator
				.connect(user1)
				.propose(targets, values, signatures, calldatas, descriptions);

			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 1);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await governanceDelegator.queue(1);
			advanceNSeconds(governanceParams.EXECUTION_DELAY);

			await expect(governanceDelegator.execute(1)).to.be.fulfilled;

			expect(await governanceDelegator.votingDelay()).to.be.equal(123);
			expect(await governanceDelegator.votingPeriod()).to.be.equal(1000);
			expect(await governanceDelegator.quorumVotes()).to.be.equal(
				parseEther("400000000")
			);
			expect(await governanceDelegator.proposalThreshold()).to.be.equal(
				parseEther("200000000")
			);
			expect(await governanceDelegator.releaseToken()).to.be.equal(
				ADDRESS_TEST
			);
		});

		it("should update timelock params by proposal", async function () {
			const targets = [timelock.address, timelock.address];
			const values = [0, 0];
			const signatures = [
				"setDelay(uint256)",
				"setPendingAdmin(address)",
			];

			const calldatas = [
				ethers.utils.defaultAbiCoder.encode(["uint256"], [3600 * 9]),
				ethers.utils.defaultAbiCoder.encode(
					["address"],
					[owner.address]
				),
			];
			const descriptions = "description";

			await governanceDelegator
				.connect(user1)
				.propose(targets, values, signatures, calldatas, descriptions);

			await advanceBlockNTimes(governanceParams.VOTING_DELAY);
			await governanceDelegator.connect(user4).castVote(1, 1);

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await governanceDelegator.queue(1);
			advanceNSeconds(governanceParams.EXECUTION_DELAY);

			await expect(governanceDelegator.execute(1)).to.be.fulfilled;

			expect(await timelock.delay()).to.be.equal(3600 * 9);
			expect(await timelock.pendingAdmin()).to.be.equal(owner.address);
		});

		it("should not update params if not timelock", async function () {
			await expect(
				governanceDelegator.connect(user1)._setQuorumVotes(0)
			).to.be.rejectedWith("Ownable: caller is not the owner");
			await expect(
				governanceDelegator.connect(user1)._setProposalThreshold(0)
			).to.be.rejectedWith("Ownable: caller is not the owner");
			await expect(
				governanceDelegator.connect(user1)._setVotingDelay(0)
			).to.be.rejectedWith("Ownable: caller is not the owner");
			await expect(
				governanceDelegator.connect(user1)._setVotingPeriod(0)
			).to.be.rejectedWith("Ownable: caller is not the owner");
			await expect(
				governanceDelegator
					.connect(user1)
					._setReleaseToken(ADDRESS_TEST)
			).to.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("should update implementation by proposal", async function () {
			const governanceDelegateFactory = await ethers.getContractFactory(
				"PACTDelegate"
			);
			const newGovernanceDelegate =
				await governanceDelegateFactory.deploy();

			expect(
				await proxyAdmin.getProxyImplementation(
					governanceDelegator.address
				)
			).to.be.equal(governanceDelegate.address);

			const targets = [proxyAdmin.address];
			const values = [0];
			const signatures = ["upgrade(address,address)"];

			const calldatas = [
				ethers.utils.defaultAbiCoder.encode(
					["address", "address"],
					[governanceDelegator.address, newGovernanceDelegate.address]
				),
			];
			const descriptions = "description";

			await expect(
				governanceDelegator
					.connect(user4)
					.propose(
						targets,
						values,
						signatures,
						calldatas,
						descriptions
					)
			).to.be.fulfilled;

			await advanceBlockNTimes(governanceParams.VOTING_DELAY);

			await expect(governanceDelegator.connect(user4).castVote(1, 1)).to
				.be.fulfilled;

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await expect(governanceDelegator.queue(1)).to.be.fulfilled;

			await advanceNSeconds(governanceParams.EXECUTION_DELAY);

			await expect(governanceDelegator.execute(1)).to.be.fulfilled;

			expect(
				await proxyAdmin.getProxyImplementation(
					governanceDelegator.address
				)
			).to.be.equal(newGovernanceDelegate.address);
		});

		it("should not update implementation if not timelock", async function () {
			const governanceDelegateFactory = await ethers.getContractFactory(
				"PACTDelegate"
			);
			const newGovernanceDelegate =
				await governanceDelegateFactory.deploy();

			expect(
				await proxyAdmin.getProxyImplementation(
					governanceDelegator.address
				)
			).to.be.equal(governanceDelegate.address);
			await expect(
				proxyAdmin.upgrade(
					governanceDelegator.address,
					newGovernanceDelegate.address
				)
			).to.be.rejectedWith("Ownable: caller is not the owner");
			expect(
				await proxyAdmin.getProxyImplementation(
					governanceDelegator.address
				)
			).to.be.equal(governanceDelegate.address);
		});

		it("should add member to ubi committee", async function () {
			const targets = [ubiCommittee.address];
			const values = [0];
			const signatures = ["addMember(address)"];

			const calldatas = [
				ethers.utils.defaultAbiCoder.encode(
					["address"],
					[user8.address]
				),
			];
			const descriptions = "description";

			await expect(
				governanceDelegator
					.connect(user1)
					.propose(
						targets,
						values,
						signatures,
						calldatas,
						descriptions
					)
			).to.be.fulfilled;

			await advanceBlockNTimes(governanceParams.VOTING_DELAY);

			await expect(governanceDelegator.castVote(1, 1)).to.be.fulfilled;

			await expect(governanceDelegator.connect(user1).castVote(1, 1)).to
				.be.fulfilled;

			await advanceBlockNTimes(governanceParams.VOTING_PERIOD);

			await expect(governanceDelegator.connect(user2).queue(1)).to.be
				.fulfilled;

			await advanceNSeconds(governanceParams.EXECUTION_DELAY);

			await expect(governanceDelegator.connect(user1).execute(1)).to.be
				.fulfilled;

			expect(await ubiCommittee.members(user8.address)).to.be.equal(true);
		});

		it("should update communityAdmin & community to V2", async function () {
			const communityImplementationAddress = (
				await deployments.get("CommunityImplementation")
			).address;
			const communityMiddleProxyAddress = (
				await deployments.get("CommunityMiddleProxy")
			).address;
			const communityAdminImplementationAddress = (
				await deployments.get("CommunityAdminImplementation")
			).address;

			await communityAdminProxy.transferOwnership(timelock.address);

			await createAndExecuteProposal(
				governanceDelegator,
				user4,
				[user4],
				[
					proxyAdmin.address,
					communityAdminProxy.address,
					communityAdminProxy.address,
				],
				[0, 0, 0],
				[
					"upgrade(address,address)",
					"updateCommunityMiddleProxy(address)",
					"updateCommunityImplementation(address)",
				],
				[["address", "address"], ["address"], ["address"]],
				[
					[
						communityAdminProxy.address,
						communityAdminImplementationAddress,
					],
					[communityMiddleProxyAddress],
					[communityImplementationAddress],
				]
			);

			expect(
				await communityAdminProxy.communityMiddleProxy()
			).to.be.equal(communityMiddleProxyAddress);

			expect(
				await communityAdminProxy.communityImplementation()
			).to.be.equal(communityImplementationAddress);
		});
	});

	describe("Governance - with two tokens", function () {
		before(async function () {
			delegate = await ethers.getContractFactory("PACTDelegate");

			[
				owner,
				user1,
				user2,
				user3,
				user4,
				user5,
				user6,
				user7,
				user8,
				user9,
			] = await ethers.getSigners();
		});

		beforeEach(async function () {
			await deployGovernance();

			stakingToken = await ethers.getContractAt(
				"SPACTToken",
				(
					await deployments.get("SPACTToken")
				).address
			);

			await stakingToken.mint(user1.address, parseEther("100000001")); // 100 mil (1 %)

			await stakingToken.mint(user6.address, parseEther("50000001")); // 50 mil (0.5 %)
			await stakingToken.connect(user1).delegate(user1.address);
			await stakingToken.connect(user6).delegate(user6.address);
		});

		it("should upgrade and set release token", async function () {
			const governanceDelegateFactory = await ethers.getContractFactory(
				"PACTDelegate"
			);
			const newGovernanceDelegate =
				await governanceDelegateFactory.deploy();

			expect(
				await proxyAdmin.getProxyImplementation(
					governanceDelegator.address
				)
			).to.be.equal(governanceDelegate.address);

			await createAndExecuteProposal(
				governanceDelegator,
				user1,
				[user1],
				[proxyAdmin.address, governanceDelegator.address],
				[0, 0],
				["upgrade(address,address)", "_setReleaseToken(address)"],
				[["address", "address"], ["address"]],
				[
					[
						governanceDelegator.address,
						newGovernanceDelegate.address,
					],
					[ADDRESS_TEST],
				]
			);

			expect(await governanceDelegator.releaseToken()).to.be.equal(
				ADDRESS_TEST
			);
		});

		it("should create proposal if user have enough tokens and stakingTokens", async function () {
			await expect(createTreasuryTransferProposal(user6)).to.be.fulfilled;
		});

		it("should create and execute proposal if user have enough tokens and stakingTokens", async function () {
			await createAndExecuteProposal(
				governanceDelegator,
				user6,
				[user6],
				[treasuryProxy.address],
				[0],
				["transfer(address,address,uint256)"],
				[["address", "address", "uint256"]],
				[[USDT.address, user2.address, parseEther("1234")]]
			);

			expect(await USDT.balanceOf(user2.address)).to.be.equal(
				parseEther("1234")
			);
		});
	});
});
