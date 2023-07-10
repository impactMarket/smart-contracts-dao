import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { deployments, ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { toEther } from "../utils/helpers";
import { BigNumber } from "@ethersproject/bignumber";
import {
	advanceNSecondsAndBlock,
	getCurrentBlockTimestamp,
} from "../utils/TimeTravel";

chai.use(chaiAsPromised);
should();

describe("ReferralLink", () => {
	const FAKE_ADDRESS = "0x000000000000000000000000000000000000dEaD";

	let owner: SignerWithAddress;
	let signerWallet: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let sender1: SignerWithAddress;
	let sender2: SignerWithAddress;
	let receiverUnverified: SignerWithAddress;
	let receiver1Address = "0xfCF17Df692AF83b8D59e96C0ab2b0Cc142cE6Ab2";
	let receiver2Address = "0x06677920912dFa402F6400Afb4c16b8347fe2a17";
	let receiver3Address = "0x3CCb60883b01420F39390CD67FDd85fC5632adE1";

	let ImpactProxyAdmin: ethersTypes.Contract;
	let ReferralLink: ethersTypes.Contract;
	let cUSD: ethersTypes.Contract;
	let PACT: ethersTypes.Contract;

	enum CampaignState {
		Invalid = 0,
		Valid = 1,
		Paused = 2,
		Canceled = 3,
	}

	let currentTimestamp: number;

	const deploy = deployments.createFixture(async () => {
		await deployments.fixture("Test", { fallbackToGlobal: false });

		[
			owner,
			signerWallet,
			user1,
			user2,
			sender1,
			sender2,
			receiverUnverified,
		] = await ethers.getSigners();

		ImpactProxyAdmin = await ethers.getContractAt(
			"ImpactProxyAdmin",
			(
				await deployments.get("ImpactProxyAdmin")
			).address
		);

		ReferralLink = await ethers.getContractAt(
			"ReferralLinkImplementation",
			(
				await deployments.get("ReferralLinkProxy")
			).address
		);

		cUSD = await ethers.getContractAt(
			"TokenMock",
			(
				await deployments.get("TokenMock")
			).address
		);

		PACT = await ethers.getContractAt(
			"PACTToken",
			(
				await deployments.get("PACTToken")
			).address
		);

		await cUSD.mint(user1.address, toEther(1000000));
		await cUSD.mint(user2.address, toEther(1000000));
		await PACT.connect(owner).transfer(user1.address, toEther(1000000));

		currentTimestamp = await getCurrentBlockTimestamp();
	});

	async function signParams(
		signer: SignerWithAddress,
		sender: SignerWithAddress,
		campaignId: number,
		receiverAddress: string
	): Promise<string> {
		const encoded = ethers.utils.defaultAbiCoder.encode(
			["address", "uint256", "address"],
			[sender.address, campaignId, receiverAddress]
		);
		const hash = ethers.utils.keccak256(encoded);

		return signer.signMessage(ethers.utils.arrayify(hash));
	}

	describe("ReferralLink - Basic", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();
		});

		it("Should have correct values", async function () {
			(await ReferralLink.signerWalletAddress()).should.eq(
				signerWallet.address
			);
			(await ReferralLink.paused()).should.be.equal(false);
		});

		it("Should update signerWallet if owner", async function () {
			await ReferralLink.updateSignerWalletAddress(FAKE_ADDRESS).should.be
				.fulfilled;
			(await ReferralLink.signerWalletAddress()).should.be.equal(
				FAKE_ADDRESS
			);
		});

		it("Should not update signerWallet if not owner", async function () {
			await ReferralLink.connect(signerWallet)
				.updateSignerWalletAddress(FAKE_ADDRESS)
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await ReferralLink.signerWalletAddress()).should.be.equal(
				signerWallet.address
			);
		});

		it("Should pause if owner", async function () {
			await ReferralLink.pause().should.be.fulfilled;
			(await ReferralLink.paused()).should.be.equal(true);
		});

		it("Should not pause if not owner", async function () {
			await ReferralLink.connect(signerWallet)
				.pause()
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await ReferralLink.paused()).should.be.equal(false);
		});

		it("Should unpause if owner", async function () {
			await ReferralLink.pause();
			await ReferralLink.unpause().should.be.fulfilled;
			(await ReferralLink.paused()).should.be.equal(false);
		});

		it("Should not unpause if not owner", async function () {
			await ReferralLink.pause();
			await ReferralLink.connect(signerWallet)
				.unpause()
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await ReferralLink.paused()).should.be.equal(true);
		});
	});

	describe("ReferralLink - Campaign basic", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();
		});

		it("Should add campaign if owner", async function () {
			await ReferralLink.connect(owner)
				.addCampaign(
					cUSD.address,
					currentTimestamp + 1,
					currentTimestamp + 2,
					toEther(100),
					2
				)
				.should.emit(ReferralLink, "CampaignAdded")
				.withArgs(
					0,
					currentTimestamp + 1,
					currentTimestamp + 2,
					toEther(100),
					2
				);

			(await ReferralLink.campaignsLength()).should.eq(1);

			const campaign = await ReferralLink.campaigns(0);
			campaign.token.should.be.equal(cUSD.address);
			campaign.balance.should.be.equal(0);
			campaign.state.should.be.equal(CampaignState.Valid);
			campaign.startTime.should.be.equal(currentTimestamp + 1);
			campaign.endTime.should.be.equal(currentTimestamp + 2);
			campaign.rewardAmount.should.be.equal(toEther(100));
			campaign.maxReferralLinks.should.be.equal(2);
		});

		it("Should not add campaign if not owner", async function () {
			await ReferralLink.connect(signerWallet)
				.addCampaign(
					cUSD.address,
					currentTimestamp + 1,
					currentTimestamp + 2,
					toEther(100),
					2
				)
				.should.be.rejectedWith("Ownable: caller is not the owner");
		});

		it("Should not add campaign if endTime < startTime", async function () {
			await ReferralLink.connect(owner)
				.addCampaign(
					cUSD.address,
					currentTimestamp + 2,
					currentTimestamp + 1,
					toEther(100),
					2
				)
				.should.be.rejectedWith("ReferralLink: Invalid dates");
		});

		it("Should not add campaign if endTime < currentTimestamp", async function () {
			await ReferralLink.connect(owner)
				.addCampaign(
					cUSD.address,
					currentTimestamp - 100,
					currentTimestamp - 10,
					toEther(100),
					2
				)
				.should.be.rejectedWith("ReferralLink: Invalid dates");
		});

		it("Should add multiple campaigns", async function () {
			await ReferralLink.connect(owner)
				.addCampaign(
					cUSD.address,
					currentTimestamp + 1,
					currentTimestamp + 2,
					toEther(100),
					1
				)
				.should.emit(ReferralLink, "CampaignAdded")
				.withArgs(
					0,
					currentTimestamp + 1,
					currentTimestamp + 2,
					toEther(100),
					1
				);
			await ReferralLink.connect(owner)
				.addCampaign(
					cUSD.address,
					currentTimestamp + 11,
					currentTimestamp + 12,
					toEther(200),
					2
				)
				.should.emit(ReferralLink, "CampaignAdded")
				.withArgs(
					1,
					currentTimestamp + 11,
					currentTimestamp + 12,
					toEther(200),
					2
				);
			await ReferralLink.connect(owner)
				.addCampaign(
					cUSD.address,
					currentTimestamp + 21,
					currentTimestamp + 22,
					toEther(300),
					3
				)
				.should.emit(ReferralLink, "CampaignAdded")
				.withArgs(
					2,
					currentTimestamp + 21,
					currentTimestamp + 22,
					toEther(300),
					3
				);

			(await ReferralLink.campaignsLength()).should.eq(3);

			const campaign1 = await ReferralLink.campaigns(0);
			campaign1.token.should.be.equal(cUSD.address);
			campaign1.balance.should.be.equal(0);
			campaign1.state.should.be.equal(CampaignState.Valid);
			campaign1.startTime.should.be.equal(currentTimestamp + 1);
			campaign1.endTime.should.be.equal(currentTimestamp + 2);
			campaign1.rewardAmount.should.be.equal(toEther(100));
			campaign1.maxReferralLinks.should.be.equal(1);

			const campaign2 = await ReferralLink.campaigns(1);
			campaign2.token.should.be.equal(cUSD.address);
			campaign2.balance.should.be.equal(0);
			campaign2.state.should.be.equal(CampaignState.Valid);
			campaign2.startTime.should.be.equal(currentTimestamp + 11);
			campaign2.endTime.should.be.equal(currentTimestamp + 12);
			campaign2.rewardAmount.should.be.equal(toEther(200));
			campaign2.maxReferralLinks.should.be.equal(2);

			const campaign3 = await ReferralLink.campaigns(2);
			campaign3.token.should.be.equal(cUSD.address);
			campaign3.balance.should.be.equal(0);
			campaign3.state.should.be.equal(CampaignState.Valid);
			campaign3.startTime.should.be.equal(currentTimestamp + 21);
			campaign3.endTime.should.be.equal(currentTimestamp + 22);
			campaign3.rewardAmount.should.be.equal(toEther(300));
			campaign3.maxReferralLinks.should.be.equal(3);
		});
	});

	describe("ReferralLink - manage campaign", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await ReferralLink.connect(owner).addCampaign(
				cUSD.address,
				currentTimestamp,
				currentTimestamp + 100,
				toEther(100),
				2
			);
			await ReferralLink.connect(owner).addCampaign(
				cUSD.address,
				currentTimestamp,
				currentTimestamp + 100,
				toEther(100),
				2
			);
			await ReferralLink.connect(owner).addCampaign(
				cUSD.address,
				currentTimestamp,
				currentTimestamp + 100,
				toEther(100),
				2
			);
		});

		it("Should pause campaign if owner", async function () {
			await ReferralLink.pauseCampaign(0)
				.should.emit(ReferralLink, "CampaignStateChanged")
				.withArgs(0, CampaignState.Paused);

			const campaign = await ReferralLink.campaigns(0);
			campaign.state.should.be.equal(CampaignState.Paused);
		});

		it("Should not pause campaign if not owner", async function () {
			await ReferralLink.connect(signerWallet)
				.pauseCampaign(0)
				.should.be.rejectedWith("Ownable: caller is not the owner");

			const campaign = await ReferralLink.campaigns(0);
			campaign.state.should.be.equal(CampaignState.Valid);
		});

		it("Should not pause campaign if campaign is not valid", async function () {
			await ReferralLink.pauseCampaign(3).should.be.rejectedWith(
				"ReferralLink: Invalid campaign id"
			);

			await ReferralLink.pauseCampaign(1);
			await ReferralLink.pauseCampaign(1).should.be.rejectedWith(
				"ReferralLink: Invalid campaign id"
			);
		});

		it("Should unpause campaign if owner", async function () {
			await ReferralLink.pauseCampaign(1);

			await ReferralLink.unpauseCampaign(1)
				.should.emit(ReferralLink, "CampaignStateChanged")
				.withArgs(1, CampaignState.Valid);

			const campaign = await ReferralLink.campaigns(1);
			campaign.state.should.be.equal(CampaignState.Valid);
		});

		it("Should not unpause campaign if not owner", async function () {
			await ReferralLink.pauseCampaign(1);

			await ReferralLink.connect(signerWallet)
				.unpauseCampaign(1)
				.should.be.rejectedWith("Ownable: caller is not the owner");

			const campaign = await ReferralLink.campaigns(1);
			campaign.state.should.be.equal(CampaignState.Paused);
		});

		it("Should not unpause campaign if the campaign is not paused", async function () {
			await ReferralLink.unpauseCampaign(1).should.be.rejectedWith(
				"ReferralLink: Invalid campaign id"
			);

			const campaign = await ReferralLink.campaigns(1);
			campaign.state.should.be.equal(CampaignState.Valid);
		});

		it("Should fund a campaign", async function () {
			await cUSD
				.connect(user1)
				.approve(ReferralLink.address, toEther(100));
			await ReferralLink.connect(user1)
				.fundCampaign(1, toEther(100))
				.should.emit(ReferralLink, "CampaignFunded")
				.withArgs(1, user1.address, toEther(100));

			const campaign = await ReferralLink.campaigns(1);
			campaign.balance.should.be.equal(toEther(100));

			(await cUSD.balanceOf(ReferralLink.address)).should.eq(
				toEther(100)
			);
		});

		it("Should fund campaign multiple times", async function () {
			await cUSD
				.connect(user1)
				.approve(ReferralLink.address, toEther(1000));
			await cUSD
				.connect(user2)
				.approve(ReferralLink.address, toEther(1000));

			await ReferralLink.connect(user1)
				.fundCampaign(1, toEther(100))
				.should.emit(ReferralLink, "CampaignFunded")
				.withArgs(1, user1.address, toEther(100));

			await ReferralLink.connect(user2)
				.fundCampaign(2, toEther(100))
				.should.emit(ReferralLink, "CampaignFunded")
				.withArgs(2, user2.address, toEther(100));

			await ReferralLink.connect(user1)
				.fundCampaign(1, toEther(100))
				.should.emit(ReferralLink, "CampaignFunded")
				.withArgs(1, user1.address, toEther(100));

			await ReferralLink.connect(user1)
				.fundCampaign(2, toEther(100))
				.should.emit(ReferralLink, "CampaignFunded")
				.withArgs(2, user1.address, toEther(100));

			await ReferralLink.connect(user2)
				.fundCampaign(1, toEther(100))
				.should.emit(ReferralLink, "CampaignFunded")
				.withArgs(1, user2.address, toEther(100));

			const campaign1 = await ReferralLink.campaigns(1);
			campaign1.balance.should.be.equal(toEther(300));
			const campaign2 = await ReferralLink.campaigns(2);
			campaign2.balance.should.be.equal(toEther(200));

			(await cUSD.balanceOf(ReferralLink.address)).should.eq(
				toEther(500)
			);
		});

		it("Should fund a paused campaign", async function () {
			await ReferralLink.pauseCampaign(1);

			await cUSD
				.connect(user1)
				.approve(ReferralLink.address, toEther(100));
			await ReferralLink.connect(user1)
				.fundCampaign(1, toEther(100))
				.should.emit(ReferralLink, "CampaignFunded")
				.withArgs(1, user1.address, toEther(100));

			const campaign = await ReferralLink.campaigns(1);
			campaign.balance.should.be.equal(toEther(100));
		});

		it("Should not fund an invalid campaign", async function () {
			await ReferralLink.connect(user1)
				.fundCampaign(4, toEther(100))
				.should.be.rejectedWith("ReferralLink: Invalid campaign id");
		});

		it("Should cancel a campaign if owner", async function () {
			await cUSD
				.connect(user1)
				.approve(ReferralLink.address, toEther(100));
			await ReferralLink.connect(user1).fundCampaign(2, toEther(100));

			const user1Balance = await cUSD.balanceOf(user1.address);
			await ReferralLink.connect(owner)
				.cancelCampaign(2, user1.address)
				.should.emit(ReferralLink, "CampaignStateChanged")
				.withArgs(2, CampaignState.Canceled);

			const campaign1 = await ReferralLink.campaigns(1);
			campaign1.balance.should.be.equal(0);
			campaign1.state.should.be.equal(CampaignState.Valid);

			const campaign2 = await ReferralLink.campaigns(2);
			campaign2.balance.should.be.equal(0);
			campaign2.state.should.be.equal(CampaignState.Canceled);

			(await cUSD.balanceOf(user1.address)).should.eq(
				user1Balance.add(toEther(100))
			);
		});

		it("Should not cancel campaign if not owner", async function () {
			await ReferralLink.connect(signerWallet)
				.cancelCampaign(1, user1.address)
				.should.be.rejectedWith("Ownable: caller is not the owner");

			const campaign = await ReferralLink.campaigns(1);
			campaign.state.should.be.equal(CampaignState.Valid);
		});

		it("Should not fund a canceled campaign", async function () {
			await ReferralLink.connect(owner).cancelCampaign(1, user1.address);

			await ReferralLink.connect(user1)
				.fundCampaign(1, toEther(100))
				.should.be.rejectedWith("ReferralLink: Invalid campaign id");
		});

		it("Should not unpause campaign if the campaign is canceled", async function () {
			await ReferralLink.connect(owner).cancelCampaign(1, user1.address);

			await ReferralLink.unpauseCampaign(1).should.be.rejectedWith(
				"ReferralLink: Invalid campaign id"
			);

			const campaign = await ReferralLink.campaigns(1);
			campaign.state.should.be.equal(CampaignState.Canceled);
		});

		it("Should not pause campaign if the campaign is canceled", async function () {
			await ReferralLink.connect(owner).cancelCampaign(1, user1.address);

			await ReferralLink.pauseCampaign(1).should.be.rejectedWith(
				"ReferralLink: Invalid campaign id"
			);

			const campaign = await ReferralLink.campaigns(1);
			campaign.state.should.be.equal(CampaignState.Canceled);
		});
	});

	describe("ReferralLink - Claim", () => {
		//these tests work only on a celo mainnet fork network
		const campaign0InitialBalance = toEther(1001);
		const campaign1InitialBalance = toEther(1002);
		const campaign2InitialBalance = toEther(1003);
		const campaign3InitialBalance = toEther(2001);
		const campaign4InitialBalance = toEther(2002);
		const campaign5InitialBalance = toEther(2003);

		const campaign0Reward = toEther(10);
		const campaign1Reward = toEther(11);
		const campaign2Reward = toEther(12);
		const campaign3Reward = toEther(13);
		const campaign4Reward = toEther(14);
		const campaign5Reward = toEther(15);
		const campaign6Reward = toEther(16);

		let sender1InitialBalance: BigNumber;
		let receiver1InitialBalance: BigNumber;
		let receiver2InitialBalance: BigNumber;
		let receiver3InitialBalance: BigNumber;

		const referralLinkInitialBalanceCUSD = campaign0InitialBalance
			.add(campaign1InitialBalance)
			.add(campaign2InitialBalance);

		const referralLinkInitialBalancePACT = campaign3InitialBalance
			.add(campaign4InitialBalance)
			.add(campaign5InitialBalance);

		before(async function () {});

		beforeEach(async () => {
			await deploy();

			await ReferralLink.connect(owner).addCampaign(
				cUSD.address,
				currentTimestamp,
				currentTimestamp + 100,
				campaign0Reward,
				2
			);
			await ReferralLink.connect(owner).addCampaign(
				cUSD.address,
				currentTimestamp,
				currentTimestamp + 100,
				campaign1Reward,
				2
			);
			await ReferralLink.connect(owner).addCampaign(
				cUSD.address,
				currentTimestamp,
				currentTimestamp + 100,
				campaign2Reward,
				2
			);
			await ReferralLink.connect(owner).addCampaign(
				PACT.address,
				currentTimestamp,
				currentTimestamp + 100,
				campaign3Reward,
				2
			);
			await ReferralLink.connect(owner).addCampaign(
				PACT.address,
				currentTimestamp,
				currentTimestamp + 100,
				campaign4Reward,
				2
			);
			await ReferralLink.connect(owner).addCampaign(
				PACT.address,
				currentTimestamp,
				currentTimestamp + 100,
				campaign5Reward,
				2
			);
			await ReferralLink.connect(owner).addCampaign(
				PACT.address,
				currentTimestamp + 100,
				currentTimestamp + 200,
				campaign6Reward,
				2
			);

			await cUSD
				.connect(user1)
				.approve(ReferralLink.address, referralLinkInitialBalanceCUSD);

			await PACT.connect(user1).approve(
				ReferralLink.address,
				referralLinkInitialBalancePACT
			);

			await ReferralLink.connect(user1).fundCampaign(
				0,
				campaign0InitialBalance
			);
			await ReferralLink.connect(user1).fundCampaign(
				1,
				campaign1InitialBalance
			);
			await ReferralLink.connect(user1).fundCampaign(
				2,
				campaign2InitialBalance
			);
			await ReferralLink.connect(user1).fundCampaign(
				3,
				campaign3InitialBalance
			);
			await ReferralLink.connect(user1).fundCampaign(
				4,
				campaign4InitialBalance
			);
			await ReferralLink.connect(user1).fundCampaign(
				5,
				campaign5InitialBalance
			);

			sender1InitialBalance = await cUSD.balanceOf(sender1.address);
			receiver1InitialBalance = await cUSD.balanceOf(receiver1Address);
			receiver2InitialBalance = await cUSD.balanceOf(receiver2Address);
			receiver3InitialBalance = await cUSD.balanceOf(receiver3Address);
		});

		it("Should reject when calling claim with less campaignIds", async function () {
			const signedMessage = await signParams(
				signerWallet,
				sender1,
				1,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[1],
					[receiver1Address, receiver2Address],
					[signedMessage, signedMessage]
				)
				.should.be.rejectedWith("ReferralLink: Invalid data");
		});

		it("Should reject when calling claim with less receivers", async function () {
			const signedMessage = await signParams(
				signerWallet,
				sender1,
				1,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[1, 2],
					[receiver1Address],
					[signedMessage, signedMessage]
				)
				.should.be.rejectedWith("ReferralLink: Invalid data");
		});

		it("Should reject when calling claim with less signatures", async function () {
			const signedMessage = await signParams(
				signerWallet,
				sender1,
				1,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[1, 2],
					[receiver1Address, receiver2Address],
					[signedMessage]
				)
				.should.be.rejectedWith("ReferralLink: Invalid data");
		});

		it("Should not claim reward if invalid campaign id #inexistent", async function () {
			const signedMessage = await signParams(
				signerWallet,
				sender1,
				7,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[7],
					[receiver1Address],
					[signedMessage]
				)
				.should.be.rejectedWith("ReferralLink: Invalid campaign id");
		});

		it("Should not claim reward if invalid campaign id #paused", async function () {
			const signedMessage = await signParams(
				signerWallet,
				sender1,
				0,
				receiver1Address
			);

			await ReferralLink.connect(owner).pauseCampaign(0);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0],
					[receiver1Address],
					[signedMessage]
				)
				.should.be.rejectedWith("ReferralLink: Invalid campaign id");
		});

		it("Should not claim reward if invalid campaign id #canceled", async function () {
			const signedMessage = await signParams(
				signerWallet,
				sender1,
				0,
				receiver1Address
			);

			await ReferralLink.connect(owner).cancelCampaign(0, user1.address);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0],
					[receiver1Address],
					[signedMessage]
				)
				.should.be.rejectedWith("ReferralLink: Invalid campaign id");
		});

		it("Should not claim reward before startTime", async function () {
			const signedMessage = await signParams(
				signerWallet,
				sender1,
				6,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[6],
					[receiver1Address],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"ReferralLink: Campaign has not started yet"
				);
		});

		it("Should not claim reward after endTime", async function () {
			await advanceNSecondsAndBlock(300);
			const signedMessage = await signParams(
				signerWallet,
				sender1,
				6,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[6],
					[receiver1Address],
					[signedMessage]
				)
				.should.be.rejectedWith("ReferralLink: Campaign has ended");
		});

		it("Should not claim reward for a non-verified user", async function () {
			const signedMessage = await signParams(
				signerWallet,
				sender1,
				1,
				receiverUnverified.address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[1],
					[receiverUnverified.address],
					[signedMessage]
				)
				.should.be.rejectedWith(
					"ReferralLink: User has not been verified"
				);
		});

		it("Should claim reward", async function () {
			const signedMessage = await signParams(
				signerWallet,
				sender1,
				1,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[1],
					[receiver1Address],
					[signedMessage]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 1, receiver1Address);

			(
				await ReferralLink.campaignReferralLinks(1, sender1.address)
			).should.eq(1);

			(await ReferralLink.verifiedUsersLength()).should.eq(1);
			(await ReferralLink.verifiedUsersAt(0)).should.eq(receiver1Address);

			const campaign1 = await ReferralLink.campaigns(1);
			campaign1.balance.should.be.equal(
				campaign1InitialBalance.sub(campaign1Reward.mul(2))
			);

			(await cUSD.balanceOf(sender1.address)).should.eq(
				sender1InitialBalance.add(campaign1Reward)
			);

			(await cUSD.balanceOf(receiver1Address)).should.eq(
				receiver1InitialBalance.add(campaign1Reward)
			);

			(await cUSD.balanceOf(ReferralLink.address)).should.eq(
				referralLinkInitialBalanceCUSD.sub(campaign1Reward.mul(2))
			);
		});

		it("Should claim rewards for multiple campaigns, multiple claims", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver1Address
			);

			const signedMessage2 = await signParams(
				signerWallet,
				sender1,
				1,
				receiver2Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0],
					[receiver1Address],
					[signedMessage1]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 0, receiver1Address);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[1],
					[receiver2Address],
					[signedMessage2]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 1, receiver2Address);

			(
				await ReferralLink.campaignReferralLinks(0, sender1.address)
			).should.eq(1);
			(
				await ReferralLink.campaignReferralLinks(1, sender1.address)
			).should.eq(1);

			(await ReferralLink.verifiedUsersLength()).should.eq(2);
			(await ReferralLink.verifiedUsersAt(0)).should.eq(receiver1Address);
			(await ReferralLink.verifiedUsersAt(1)).should.eq(receiver2Address);

			const campaign0 = await ReferralLink.campaigns(0);
			campaign0.balance.should.be.equal(
				campaign0InitialBalance.sub(campaign0Reward.mul(2))
			);

			const campaign1 = await ReferralLink.campaigns(1);
			campaign1.balance.should.be.equal(
				campaign1InitialBalance.sub(campaign1Reward.mul(2))
			);

			(await cUSD.balanceOf(sender1.address)).should.eq(
				sender1InitialBalance.add(campaign0Reward).add(campaign1Reward)
			);

			(await cUSD.balanceOf(receiver1Address)).should.eq(
				receiver1InitialBalance.add(campaign0Reward)
			);

			(await cUSD.balanceOf(receiver2Address)).should.eq(
				receiver2InitialBalance.add(campaign1Reward)
			);

			(await cUSD.balanceOf(ReferralLink.address)).should.eq(
				referralLinkInitialBalanceCUSD
					.sub(campaign0Reward.mul(2))
					.sub(campaign1Reward.mul(2))
			);
		});

		it("Should claim rewards for multiple campaigns one transaction, same token", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				1,
				receiver1Address
			);

			const signedMessage2 = await signParams(
				signerWallet,
				sender1,
				2,
				receiver2Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[1, 2],
					[receiver1Address, receiver2Address],
					[signedMessage1, signedMessage2]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 1, receiver1Address)
				.withArgs(sender1.address, 2, receiver2Address);

			(
				await ReferralLink.campaignReferralLinks(1, sender1.address)
			).should.eq(1);
			(
				await ReferralLink.campaignReferralLinks(2, sender1.address)
			).should.eq(1);

			(await ReferralLink.verifiedUsersLength()).should.eq(2);
			(await ReferralLink.verifiedUsersAt(0)).should.eq(receiver1Address);
			(await ReferralLink.verifiedUsersAt(1)).should.eq(receiver2Address);

			const campaign1 = await ReferralLink.campaigns(1);
			campaign1.balance.should.be.equal(
				campaign1InitialBalance.sub(campaign1Reward.mul(2))
			);

			const campaign2 = await ReferralLink.campaigns(2);
			campaign2.balance.should.be.equal(
				campaign2InitialBalance.sub(campaign2Reward.mul(2))
			);

			(await cUSD.balanceOf(sender1.address)).should.eq(
				sender1InitialBalance.add(campaign1Reward.add(campaign2Reward))
			);

			(await cUSD.balanceOf(receiver1Address)).should.eq(
				receiver1InitialBalance.add(campaign1Reward)
			);

			(await cUSD.balanceOf(receiver2Address)).should.eq(
				receiver2InitialBalance.add(campaign2Reward)
			);

			(await cUSD.balanceOf(ReferralLink.address)).should.eq(
				referralLinkInitialBalanceCUSD
					.sub(campaign1Reward.mul(2))
					.sub(campaign2Reward.mul(2))
			);
		});

		it("Should claim rewards for multiple campaigns one transaction, different token", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				1,
				receiver1Address
			);

			const signedMessage2 = await signParams(
				signerWallet,
				sender1,
				3,
				receiver2Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[1, 3],
					[receiver1Address, receiver2Address],
					[signedMessage1, signedMessage2]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 1, receiver1Address)
				.withArgs(sender1.address, 3, receiver2Address);

			(
				await ReferralLink.campaignReferralLinks(1, sender1.address)
			).should.eq(1);
			(
				await ReferralLink.campaignReferralLinks(3, sender1.address)
			).should.eq(1);

			(await ReferralLink.verifiedUsersLength()).should.eq(2);
			(await ReferralLink.verifiedUsersAt(0)).should.eq(receiver1Address);
			(await ReferralLink.verifiedUsersAt(1)).should.eq(receiver2Address);

			const campaign1 = await ReferralLink.campaigns(1);
			campaign1.balance.should.be.equal(
				campaign1InitialBalance.sub(campaign1Reward.mul(2))
			);

			const campaign11 = await ReferralLink.campaigns(3);
			campaign11.balance.should.be.equal(
				campaign3InitialBalance.sub(campaign3Reward.mul(2))
			);

			(await cUSD.balanceOf(sender1.address)).should.eq(
				sender1InitialBalance.add(campaign1Reward)
			);

			(await PACT.balanceOf(sender1.address)).should.eq(campaign3Reward);

			(await cUSD.balanceOf(receiver1Address)).should.eq(
				receiver1InitialBalance.add(campaign1Reward)
			);

			(await PACT.balanceOf(receiver2Address)).should.eq(
				receiver2InitialBalance.add(campaign3Reward)
			);

			(await cUSD.balanceOf(ReferralLink.address)).should.eq(
				referralLinkInitialBalanceCUSD.sub(campaign1Reward.mul(2))
			);

			(await PACT.balanceOf(ReferralLink.address)).should.eq(
				referralLinkInitialBalancePACT.sub(campaign3Reward.mul(2))
			);
		});

		it("Should multiple beneficiaries claim rewards for same campaign", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				1,
				receiver1Address
			);

			const signedMessage2 = await signParams(
				signerWallet,
				sender2,
				1,
				receiver2Address
			);

			const signedMessage3 = await signParams(
				signerWallet,
				sender2,
				1,
				receiver3Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[1],
					[receiver1Address],
					[signedMessage1]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 1, receiver1Address);

			await ReferralLink.connect(user2)
				.claimReward(
					sender2.address,
					[1, 1],
					[receiver2Address, receiver3Address],
					[signedMessage2, signedMessage3]
				)
				.should.emit(ReferralLink, "RewardClaimed");

			(
				await ReferralLink.campaignReferralLinks(1, sender1.address)
			).should.eq(1);
			(
				await ReferralLink.campaignReferralLinks(1, sender2.address)
			).should.eq(2);

			(await ReferralLink.verifiedUsersLength()).should.eq(3);
			(await ReferralLink.verifiedUsersAt(0)).should.eq(receiver1Address);
			(await ReferralLink.verifiedUsersAt(1)).should.eq(receiver2Address);
			(await ReferralLink.verifiedUsersAt(2)).should.eq(receiver3Address);

			const campaign1 = await ReferralLink.campaigns(1);
			campaign1.balance.should.be.equal(
				campaign1InitialBalance.sub(campaign1Reward.mul(3).mul(2))
			);

			(await cUSD.balanceOf(sender1.address)).should.eq(
				sender1InitialBalance.add(campaign1Reward)
			);
			(await cUSD.balanceOf(sender2.address)).should.eq(
				sender1InitialBalance.add(campaign1Reward.mul(2))
			);

			(await cUSD.balanceOf(receiver2Address)).should.eq(
				receiver2InitialBalance.add(campaign1Reward)
			);

			(await cUSD.balanceOf(receiver1Address)).should.eq(
				receiver1InitialBalance.add(campaign1Reward)
			);

			(await cUSD.balanceOf(receiver3Address)).should.eq(
				receiver3InitialBalance.add(campaign1Reward)
			);

			(await cUSD.balanceOf(ReferralLink.address)).should.eq(
				referralLinkInitialBalanceCUSD.sub(
					campaign1Reward.mul(3).mul(2)
				)
			);
		});

		it("Should not claim rewards if already reached max referral links", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver1Address
			);

			const signedMessage2 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver2Address
			);

			const signedMessage3 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver3Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0, 0],
					[receiver1Address, receiver2Address],
					[signedMessage1, signedMessage2]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 0, receiver1Address);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0],
					[receiver3Address],
					[signedMessage3]
				)
				.should.be.rejectedWith(
					"ReferralLink: Already reached max referral links"
				);
		});

		it("Should claim rewards for multiple campaigns, multiple claims #2", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver1Address
			);

			const signedMessage2 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver2Address
			);

			const signedMessage3 = await signParams(
				signerWallet,
				sender1,
				1,
				receiver3Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0, 0],
					[receiver1Address, receiver2Address],
					[signedMessage1, signedMessage2]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 0, receiver1Address);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[1],
					[receiver3Address],
					[signedMessage3]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 1, receiver3Address);

			(await cUSD.balanceOf(sender1.address)).should.eq(
				sender1InitialBalance.add(
					campaign0Reward.mul(2).add(campaign1Reward)
				)
			);

			(await cUSD.balanceOf(receiver1Address)).should.eq(
				receiver1InitialBalance.add(campaign0Reward)
			);

			(await cUSD.balanceOf(receiver2Address)).should.eq(
				receiver2InitialBalance.add(campaign0Reward)
			);

			(await cUSD.balanceOf(receiver3Address)).should.eq(
				receiver3InitialBalance.add(campaign1Reward)
			);
		});

		it("Should not claim rewards if this user already exists #sameCampaign, #sameSender", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver1Address
			);

			const signedMessage2 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0],
					[receiver1Address],
					[signedMessage1]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 0, receiver1Address);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0],
					[receiver1Address],
					[signedMessage2]
				)
				.should.be.rejectedWith(
					"ReferralLink: This user already exists"
				);
		});

		it("Should not claim rewards if this user already exists #differentCampaign #sameSender", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver1Address
			);

			const signedMessage2 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver2Address
			);

			const signedMessage3 = await signParams(
				signerWallet,
				sender1,
				1,
				receiver2Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0, 0],
					[receiver1Address, receiver2Address],
					[signedMessage1, signedMessage2]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 0, receiver1Address);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[1],
					[receiver2Address],
					[signedMessage3]
				)
				.should.be.rejectedWith(
					"ReferralLink: This user already exists"
				);
		});

		it("Should not claim rewards if this user already exists #sameCampaign, #differentSender", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver1Address
			);

			const signedMessage2 = await signParams(
				signerWallet,
				sender2,
				0,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0],
					[receiver1Address],
					[signedMessage1]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 0, receiver1Address);

			await ReferralLink.connect(user2)
				.claimReward(
					sender2.address,
					[0],
					[receiver1Address],
					[signedMessage2]
				)
				.should.be.rejectedWith(
					"ReferralLink: This user already exists"
				);
		});

		it("Should not claim rewards if this user already exists #differentCampaign #differentSender", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver1Address
			);

			const signedMessage2 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver2Address
			);

			const signedMessage3 = await signParams(
				signerWallet,
				sender2,
				1,
				receiver2Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0, 0],
					[receiver1Address, receiver2Address],
					[signedMessage1, signedMessage2]
				)
				.should.emit(ReferralLink, "RewardClaimed")
				.withArgs(sender1.address, 0, receiver1Address);

			await ReferralLink.connect(user2)
				.claimReward(
					sender2.address,
					[1],
					[receiver2Address],
					[signedMessage3]
				)
				.should.be.rejectedWith(
					"ReferralLink: This user already exists"
				);
		});

		it("Should not claim rewards if campaign doesn't have enough funds", async function () {
			await advanceNSecondsAndBlock(150);
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				6,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[6],
					[receiver1Address],
					[signedMessage1]
				)
				.should.be.rejectedWith(
					"ReferralLink: Campaign doesn't have enough funds"
				);
		});

		it("Should not claim rewards if invalid signature #signer", async function () {
			const signedMessage1 = await signParams(
				user1,
				sender1,
				0,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0],
					[receiver1Address],
					[signedMessage1]
				)
				.should.be.rejectedWith("ReferralLink: Invalid signature");
		});

		it("Should not claim rewards if invalid signature #sender", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender2,
				0,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0],
					[receiver1Address],
					[signedMessage1]
				)
				.should.be.rejectedWith("ReferralLink: Invalid signature");
		});

		it("Should not claim rewards if invalid signature #campaignId", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				1,
				receiver1Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0],
					[receiver1Address],
					[signedMessage1]
				)
				.should.be.rejectedWith("ReferralLink: Invalid signature");
		});

		it("Should not claim rewards if invalid signature #receiver", async function () {
			const signedMessage1 = await signParams(
				signerWallet,
				sender1,
				0,
				receiver2Address
			);

			await ReferralLink.connect(user2)
				.claimReward(
					sender1.address,
					[0],
					[receiver1Address],
					[signedMessage1]
				)
				.should.be.rejectedWith("ReferralLink: Invalid signature");
		});
	});
});
