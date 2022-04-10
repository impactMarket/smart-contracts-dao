// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import { ethers, deployments } from "hardhat";
import type * as ethersTypes from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";
import { advanceBlockNTimes } from "../utils/TimeTravel";

chai.use(chaiAsPromised);

const expect = chai.expect;

const communityMinTranche = parseEther("100");
const communityMaxTranche = parseEther("5000");

// Contracts
let PACTDelegate: ethersTypes.ContractFactory;

//users
let alice: SignerWithAddress;
let bob: SignerWithAddress;
let carol: SignerWithAddress;
let entity: SignerWithAddress;
let ambassador: SignerWithAddress;

// contract instances
let pactDelegator: ethersTypes.Contract;
let communityAdmin: ethersTypes.Contract;
let treasury: ethersTypes.Contract;
let ubiCommittee: ethersTypes.Contract;
let cUSD: ethersTypes.Contract;

describe("UBICommittee", function () {
	before(async function () {
		PACTDelegate = await ethers.getContractFactory("PACTDelegate");

		const accounts: SignerWithAddress[] = await ethers.getSigners();

		alice = accounts[1];
		bob = accounts[2];
		carol = accounts[3];
		entity = accounts[4];
		ambassador = accounts[5];
	});

	beforeEach(async function () {
		await deployments.fixture("Test", { fallbackToGlobal: false });

		const pactDelegatorDeployment = await deployments.get("PACTDelegator");
		pactDelegator = await ethers.getContractAt(
			"PACTDelegator",
			pactDelegatorDeployment.address
		);

		pactDelegator = await PACTDelegate.attach(pactDelegator.address);

		const communityAdminDeployment = await deployments.get(
			"CommunityAdminProxy"
		);
		communityAdmin = await ethers.getContractAt(
			"CommunityAdminImplementation",
			communityAdminDeployment.address
		);

		const ubiCommitteeDeployment = await deployments.get(
			"UBICommitteeProxy"
		);
		ubiCommittee = await ethers.getContractAt(
			"UBICommitteeImplementation",
			ubiCommitteeDeployment.address
		);

		const treasuryDeployment = await deployments.get("TreasuryProxy");
		treasury = await ethers.getContractAt(
			"TreasuryImplementation",
			treasuryDeployment.address
		);

		const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");
		const Ambassadors = await deployments.get("AmbassadorsProxy");
		const impactProxyAdmin = await ethers.getContractAt(
			"ImpactProxyAdmin",
			ImpactProxyAdmin.address
		);

		const CommunityAdminImplementationOld = await deployments.get(
			"CommunityAdminImplementationOld"
		);
		const CommunityAdminImplementation = await deployments.get(
			"CommunityAdminImplementation"
		);

		expect(
			await impactProxyAdmin.getProxyImplementation(
				communityAdmin.address
			)
		).to.be.equal(CommunityAdminImplementation.address);

		communityAdmin = await ethers.getContractAt(
			"CommunityAdminImplementation",
			communityAdmin.address
		);

		const ambassadors = await ethers.getContractAt(
			"AmbassadorsImplementation",
			Ambassadors.address
		);

		await communityAdmin.updateUbiCommittee(ubiCommittee.address);
		await communityAdmin.updateAmbassadors(Ambassadors.address);

		await ambassadors.addEntity(entity.address);
		await ambassadors.connect(entity).addAmbassador(ambassador.address);

		await communityAdmin.transferOwnership(pactDelegator.address);
		await expect(ubiCommittee.addMember(alice.address)).to.be.fulfilled;

		const cUSDDeployment = await deployments.get("TokenMock");
		cUSD = await ethers.getContractAt("TokenMock", cUSDDeployment.address);

		await cUSD.mint(treasury.address, parseEther("1000"));
	});

	async function createCommunityProposal() {
		const signatures = [
			"addCommunity(address[],address,uint256,uint256,uint256,uint256,uint256,uint256,uint256)",
		];

		const calldatas = [
			ethers.utils.defaultAbiCoder.encode(
				[
					"address[]",
					"address",
					"uint256",
					"uint256",
					"uint256",
					"uint256",
					"uint256",
					"uint256",
					"uint256",
				],
				[
					[carol.address],
					ambassador.address,
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
			ubiCommittee
				.connect(alice)
				.propose(signatures, calldatas, descriptions)
		).to.be.fulfilled;
	}

	it("should create community if ubi committee", async function () {
		await createCommunityProposal();

		await expect(ubiCommittee.connect(alice).castVote(1, 1)).to.be
			.fulfilled;
		await expect(ubiCommittee.connect(alice).execute(1)).to.be.fulfilled;
	});

	it("should remove a community if ubi committee", async () => {
		await createCommunityProposal();

		await expect(ubiCommittee.connect(alice).castVote(1, 1)).to.be
			.fulfilled;
		await expect(ubiCommittee.connect(alice).execute(1)).to.be.fulfilled;

		const communityAddress = await communityAdmin.communityListAt(0);
		const signatures = ["removeCommunity(address)"];

		const calldatas = [
			ethers.utils.defaultAbiCoder.encode(
				["address"],
				[communityAddress]
			),
		];
		const descriptions = "description";

		await expect(
			ubiCommittee
				.connect(alice)
				.propose(signatures, calldatas, descriptions)
		).to.be.fulfilled;

		await expect(ubiCommittee.connect(alice).castVote(2, 1)).to.be
			.fulfilled;
		await expect(ubiCommittee.connect(alice).execute(2)).to.be.fulfilled;
	});

	it("should update params if owner or ubi committee", async function () {
		await expect(ubiCommittee.setQuorumVotes(2)).to.be.fulfilled;
	});

	it("should not update params if not owner or ubi committee", async function () {
		await expect(
			ubiCommittee.connect(bob).setQuorumVotes(0)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("should add member if owner", async function () {
		await expect(ubiCommittee.addMember(bob.address)).to.be.fulfilled;
	});

	it("should not add member if not owner", async function () {
		await expect(
			ubiCommittee.connect(bob).addMember(carol.address)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("should not be able to add community if not member", async function () {
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
					[carol.address],
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
			ubiCommittee
				.connect(bob)
				.propose(signatures, calldatas, descriptions)
		).to.be.rejectedWith("PACT:: Not a member");
	});

	it("should not be able to add member if already member", async function () {
		await expect(ubiCommittee.addMember(bob.address)).to.be.fulfilled;
		await expect(ubiCommittee.addMember(bob.address)).to.be.rejectedWith(
			"PACT::addMember: already a member"
		);
	});

	it("should not be able to add member if already member", async function () {
		await expect(ubiCommittee.removeMember(bob.address)).to.be.rejectedWith(
			"PACT::removeMember: not a member"
		);
	});

	it("should be able to add many members", async function () {
		await expect(ubiCommittee.addMember(bob.address)).to.be.fulfilled;
		await expect(ubiCommittee.addMember(carol.address)).to.be.fulfilled;
	});

	it("should be able to change quorum", async function () {
		await expect(ubiCommittee.addMember(bob.address)).to.be.fulfilled;
		await expect(ubiCommittee.setQuorumVotes(2)).to.be.fulfilled;
	});

	it("should be able to execute after reaching quorum", async function () {
		await expect(ubiCommittee.addMember(bob.address)).to.be.fulfilled;
		await expect(ubiCommittee.setQuorumVotes(2)).to.be.fulfilled;

		await createCommunityProposal();

		await expect(ubiCommittee.connect(alice).castVote(1, 1)).to.be
			.fulfilled;
		await expect(ubiCommittee.connect(bob).castVote(1, 1)).to.be.fulfilled;
		await expect(ubiCommittee.connect(alice).execute(1)).to.be.fulfilled;
	});

	it("should not be able to execute without reaching quorum", async function () {
		await expect(ubiCommittee.addMember(bob.address)).to.be.fulfilled;
		await expect(ubiCommittee.setQuorumVotes(2)).to.be.fulfilled;

		await createCommunityProposal();

		await expect(ubiCommittee.connect(alice).execute(1)).to.be.rejectedWith(
			"PACT::execute: proposal can only be executed if it is succeeded"
		);
	});

	it("should not be able to execute a canceled proposal", async function () {
		await createCommunityProposal();

		await expect(ubiCommittee.connect(alice).cancel(1)).to.be.fulfilled;
		await expect(
			ubiCommittee.connect(alice).castVote(1, 1)
		).to.be.rejectedWith("PACT::castVoteInternal: voting is closed");
	});

	it("should not be able to vote once proposal meet quorum already", async function () {
		await expect(ubiCommittee.addMember(bob.address)).to.be.fulfilled;

		await createCommunityProposal();

		await expect(ubiCommittee.connect(alice).castVote(1, 1)).to.be
			.fulfilled;
		await expect(
			ubiCommittee.connect(bob).castVote(1, 1)
		).to.be.rejectedWith("PACT::castVoteInternal: voting is closed");
	});

	it("should not be able to vote twice", async function () {
		await expect(ubiCommittee.addMember(bob.address)).to.be.fulfilled;
		await expect(ubiCommittee.setQuorumVotes(2)).to.be.fulfilled;

		await createCommunityProposal();

		await expect(ubiCommittee.connect(alice).castVote(1, 1)).to.be
			.fulfilled;
		await expect(
			ubiCommittee.connect(alice).castVote(1, 1)
		).to.be.rejectedWith("PACT::castVoteInternal: voter already voted");
	});

	it("if quorum is set to a number higher or equal than current votes, should be able to execute", async function () {
		await expect(ubiCommittee.addMember(bob.address)).to.be.fulfilled;
		await expect(ubiCommittee.addMember(carol.address)).to.be.fulfilled;
		await expect(ubiCommittee.setQuorumVotes(3)).to.be.fulfilled;

		await createCommunityProposal();

		await expect(ubiCommittee.connect(alice).castVote(1, 1)).to.be
			.fulfilled;
		await expect(ubiCommittee.connect(bob).castVote(1, 1)).to.be.fulfilled;
		await expect(ubiCommittee.setQuorumVotes(2)).to.be.fulfilled;
		await expect(ubiCommittee.connect(bob).execute(1)).to.be.fulfilled;
	});

	xit("should not be able to vote once vote period ends", async function () {
		await createCommunityProposal();

		const VOTING_PERIOD_BLOCKS = 518400;
		await advanceBlockNTimes(VOTING_PERIOD_BLOCKS);

		await expect(
			ubiCommittee.connect(alice).castVote(1, 1)
		).to.be.rejectedWith("PACT::castVoteInternal: voting is closed");
	});
});
