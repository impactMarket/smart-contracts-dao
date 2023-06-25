// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";

// @ts-ignore
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { advanceNSeconds, getCurrentBlockTimestamp } from "../utils/TimeTravel";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { toEther } from "../utils/helpers";
import { BigNumber } from "@ethersproject/bignumber";
import { should } from "chai";
import {
	createDefaultCommunity,
	createDefaultCommunityAdmin,
} from "../community/helpers";

should();
chai.use(chaiAsPromised);

describe("AirdropV3", () => {
	const socialConnectAddress = "0x0aD5b1d0C25ecF6266Dd951403723B2687d6aff2";
	const socialConnectIssuerAddress =
		"0x388612590F8cC6577F19c9b61811475Aa432CB44";

	const AIRDROP_V3_TOKEN_ADDRESS =
		"0x00000000000000000000000000000000000000A3";

	const amount = toEther(1);

	let owner: SignerWithAddress;
	let ambassadorsEntity1: SignerWithAddress;
	let ambassador1: SignerWithAddress;
	let manager1: SignerWithAddress;
	let manager2: SignerWithAddress;
	let user1: SignerWithAddress;
	let unverifiedBeneficiary1: SignerWithAddress;
	let unverifiedBeneficiary2: SignerWithAddress;
	let verifiedBeneficiary1Address =
		"0xfCF17Df692AF83b8D59e96C0ab2b0Cc142cE6Ab2";
	let verifiedBeneficiary2Address =
		"0x06677920912dFa402F6400Afb4c16b8347fe2a17";
	let verifiedBeneficiary3Address =
		"0x3CCb60883b01420F39390CD67FDd85fC5632adE1";

	let ImpactProxyAdmin: ethersTypes.Contract;
	let PACT: ethersTypes.Contract;
	let AirdropV3: ethersTypes.Contract;
	let DonationMiner: ethersTypes.Contract;
	let Treasury: ethersTypes.Contract;

	const deploy = deployments.createFixture(async () => {
		await deployments.fixture("Test", { fallbackToGlobal: false });

		[
			owner,
			ambassadorsEntity1,
			ambassador1,
			manager1,
			manager2,
			user1,
			unverifiedBeneficiary1,
			unverifiedBeneficiary2,
		] = await ethers.getSigners();

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

		AirdropV3 = await ethers.getContractAt(
			"AirdropV3Implementation",
			(
				await deployments.get("AirdropV3Proxy")
			).address
		);

		DonationMiner = await ethers.getContractAt(
			"DonationMinerImplementation",
			(
				await deployments.get("DonationMinerProxy")
			).address
		);

		Treasury = await ethers.getContractAt(
			"TreasuryImplementation",
			(
				await deployments.get("TreasuryProxy")
			).address
		);
	});

	describe("Airdrop  - basic", () => {
		before(async function () {
			[owner] = await ethers.getSigners();
		});

		beforeEach(async () => {
			await deploy();
		});

		it("should have correct values", async function () {
			(await AirdropV3.getVersion()).should.eq(1);
			(await AirdropV3.donationMiner()).should.eq(DonationMiner.address);
			(await AirdropV3.socialConnect()).should.eq(socialConnectAddress);
			(await AirdropV3.socialConnectIssuer()).should.eq(
				socialConnectIssuerAddress
			);
			(await AirdropV3.amount()).should.eq(amount);
		});

		it("Should update amount if admin", async function () {
			await AirdropV3.updateAmount(1);
			(await AirdropV3.amount()).should.eq(1);
		});

		it("Should not update amount if not admin", async function () {
			await AirdropV3.connect(user1)
				.updateAmount(1)
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await AirdropV3.amount()).should.eq(amount);
		});
	});

	describe("Airdrop - register", () => {
		let CommunityAdmin: ethersTypes.Contract;
		let CommunityA: ethersTypes.Contract;
		let CommunityB: ethersTypes.Contract;

		beforeEach(async () => {
			await deploy();

			CommunityAdmin = await createDefaultCommunityAdmin(
				ambassadorsEntity1,
				ambassador1
			);
			CommunityA = await createDefaultCommunity(
				CommunityAdmin,
				manager1,
				ambassador1
			);
			CommunityB = await createDefaultCommunity(
				CommunityAdmin,
				manager2,
				ambassador1
			);

			await CommunityA.connect(manager1).addBeneficiary(
				unverifiedBeneficiary1.address
			);
			await CommunityA.connect(manager1).addBeneficiary(
				verifiedBeneficiary1Address
			);
			await CommunityA.connect(manager1).addBeneficiary(
				verifiedBeneficiary2Address
			);
			await CommunityB.connect(manager2).addBeneficiary(
				verifiedBeneficiary2Address
			);
			await CommunityB.connect(manager2).addBeneficiary(
				verifiedBeneficiary3Address
			);
			await CommunityB.connect(manager2).addBeneficiary(
				unverifiedBeneficiary2.address
			);
		});

		it("should register one beneficiary", async function () {
			await AirdropV3.connect(user1)
				.register([verifiedBeneficiary1Address], [CommunityA.address])
				.should.emit(AirdropV3, "Registered")
				.withArgs(
					verifiedBeneficiary1Address,
					CommunityA.address,
					amount
				);

			const donation1 = await DonationMiner.donations(1);
			donation1.donor.should.equal(verifiedBeneficiary1Address);
			donation1.target.should.equal(Treasury.address);
			donation1.rewardPeriod.should.equal(1);
			donation1.amount.should.equal(amount);
			donation1.token.should.equal(AIRDROP_V3_TOKEN_ADDRESS);
			donation1.initialAmount.should.equal(amount);
		});

		it("should register multiple beneficiaries", async function () {
			await AirdropV3.connect(user1)
				.register(
					[
						verifiedBeneficiary1Address,
						verifiedBeneficiary2Address,
						verifiedBeneficiary3Address,
					],
					[CommunityA.address, CommunityA.address, CommunityB.address]
				)
				.should.emit(AirdropV3, "Registered")
				.withArgs(
					verifiedBeneficiary1Address,
					CommunityA.address,
					amount
				)
				.withArgs(
					verifiedBeneficiary2Address,
					CommunityA.address,
					amount
				)
				.withArgs(
					verifiedBeneficiary3Address,
					CommunityB.address,
					amount
				);

			const donation1 = await DonationMiner.donations(1);
			donation1.donor.should.equal(verifiedBeneficiary1Address);
			donation1.target.should.equal(Treasury.address);
			donation1.rewardPeriod.should.equal(1);
			donation1.amount.should.equal(amount);
			donation1.token.should.equal(AIRDROP_V3_TOKEN_ADDRESS);
			donation1.initialAmount.should.equal(amount);

			const donation2 = await DonationMiner.donations(2);
			donation2.donor.should.equal(verifiedBeneficiary2Address);
			donation2.target.should.equal(Treasury.address);
			donation2.rewardPeriod.should.equal(1);
			donation2.amount.should.equal(amount);
			donation2.token.should.equal(AIRDROP_V3_TOKEN_ADDRESS);
			donation2.initialAmount.should.equal(amount);

			const donation3 = await DonationMiner.donations(3);
			donation3.donor.should.equal(verifiedBeneficiary3Address);
			donation3.target.should.equal(Treasury.address);
			donation3.rewardPeriod.should.equal(1);
			donation3.amount.should.equal(amount);
			donation3.token.should.equal(AIRDROP_V3_TOKEN_ADDRESS);
			donation3.initialAmount.should.equal(amount);
		});

		it("should not register if beneficiaries.length != communities.length", async function () {
			await AirdropV3.connect(user1)
				.register(
					[verifiedBeneficiary1Address, verifiedBeneficiary2Address],
					[CommunityA.address]
				)
				.should.be.rejectedWith("AirdropV3: Invalid data");
		});

		it("should not register same beneficiary multiple times", async function () {
			await AirdropV3.connect(user1)
				.register([verifiedBeneficiary1Address], [CommunityA.address])
				.should.emit(AirdropV3, "Registered")
				.withArgs(
					verifiedBeneficiary1Address,
					CommunityA.address,
					amount
				);

			await AirdropV3.connect(user1)
				.register([verifiedBeneficiary1Address], [CommunityA.address])
				.should.be.rejectedWith(
					"AirdropV3: Beneficiary already registered"
				);
		});

		it("should not register if the community is not valid", async function () {
			await CommunityAdmin.connect(owner).removeCommunity(
				CommunityA.address
			);

			await AirdropV3.connect(user1)
				.register([verifiedBeneficiary1Address], [CommunityA.address])
				.should.be.rejectedWith("AirdropV3: Invalid community");
		});

		it("should not register if the beneficiary is not part of that community", async function () {
			await AirdropV3.connect(user1)
				.register([verifiedBeneficiary1Address], [CommunityB.address])
				.should.be.rejectedWith(
					"AirdropV3: Invalid beneficiary - community pair"
				);
		});

		it("should not register if the beneficiary has not been verified", async function () {
			await AirdropV3.connect(user1)
				.register(
					[unverifiedBeneficiary1.address],
					[CommunityA.address]
				)
				.should.be.rejectedWith(
					"AirdropV3: User has not been verified"
				);
		});
	});
});
