// @ts-ignore
import chai, { should } from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";

// @ts-ignore
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import {
	advanceBlockNTimes,
	advanceNSeconds,
	advanceToBlockN,
	getBlockNumber,
	getCurrentBlockTimestamp,
} from "../utils/TimeTravel";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { fromEther, toEther } from "../utils/helpers";
import { BigNumber } from "@ethersproject/bignumber";
import { parseUnits } from "@ethersproject/units";
import {
	generateMerkleTree,
	getMerkleTree,
	getProof,
} from "../../script/merkleTree/generateMerkleTree";

const MTokenABI = require("../../integrations/moola/abi/MToken.json");

chai.use(chaiAsPromised);
should();

xdescribe("AirdropV2", () => {
	const FAKE_ADDRESS = "0x000000000000000000000000000000000000dEaD";

	const startTime = 0;
	const trancheAmount = toEther(100);
	const totalAmount = toEther(1000);
	const cooldown = 3600;
	let merkleRoot: string;

	let owner: SignerWithAddress;
	let beneficiary1: SignerWithAddress;
	let beneficiary2: SignerWithAddress;
	let beneficiary3: SignerWithAddress;
	let beneficiary4: SignerWithAddress;
	let beneficiary5: SignerWithAddress;
	let beneficiary6: SignerWithAddress;
	let beneficiary7: SignerWithAddress;
	let beneficiary8: SignerWithAddress;
	let beneficiary9: SignerWithAddress;

	let ImpactProxyAdmin: ethersTypes.Contract;
	let PACT: ethersTypes.Contract;
	let AirdropV2: ethersTypes.Contract;

	const deploy = deployments.createFixture(async () => {
		await deployments.fixture("AirdropV2Test", { fallbackToGlobal: false });

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

		AirdropV2 = await ethers.getContractAt(
			"AirdropV2Implementation",
			(
				await deployments.get("AirdropV2Proxy")
			).address
		);
	});

	describe("Airdrop  - basic", () => {
		before(async function () {
			[
				owner,
				beneficiary1,
				beneficiary2,
				beneficiary3,
				beneficiary4,
				beneficiary5,
				beneficiary6,
				beneficiary7,
				beneficiary8,
				beneficiary9,
			] = await ethers.getSigners();

			merkleRoot = generateMerkleTree([owner.address]);
		});

		beforeEach(async () => {
			await deploy();
		});

		it("should have correct values", async function () {
			console.log(getMerkleTree());
			(await AirdropV2.getVersion()).should.eq(1);
			(await AirdropV2.PACT()).should.eq(PACT.address);
			(await AirdropV2.startTime()).should.eq(startTime);
			(await AirdropV2.trancheAmount()).should.eq(trancheAmount);
			(await AirdropV2.totalAmount()).should.eq(totalAmount);
			(await AirdropV2.cooldown()).should.eq(cooldown);
			(await AirdropV2.merkleRoot()).should.eq(merkleRoot);
		});

		it("Should update startTime if admin", async function () {
			await AirdropV2.updateStartTime(1);
			(await AirdropV2.startTime()).should.eq(1);
		});

		it("Should not update startTime if not admin", async function () {
			await AirdropV2.connect(beneficiary1)
				.updateStartTime(1)
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await AirdropV2.startTime()).should.eq(startTime);
		});

		it("Should update trancheAmount if admin", async function () {
			await AirdropV2.updateTrancheAmount(1);
			(await AirdropV2.trancheAmount()).should.eq(1);
		});

		it("Should not update trancheAmount if not admin", async function () {
			await AirdropV2.connect(beneficiary1)
				.updateTrancheAmount(1)
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await AirdropV2.trancheAmount()).should.eq(trancheAmount);
		});

		it("Should update totalAmount if admin", async function () {
			await AirdropV2.updateTotalAmount(1);
			(await AirdropV2.totalAmount()).should.eq(1);
		});

		it("Should not update totalAmount if not admin", async function () {
			await AirdropV2.connect(beneficiary1)
				.updateTotalAmount(1)
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await AirdropV2.totalAmount()).should.eq(totalAmount);
		});

		it("Should update cooldown if admin", async function () {
			await AirdropV2.updateCooldown(1);
			(await AirdropV2.cooldown()).should.eq(1);
		});

		it("Should not update cooldown if not admin", async function () {
			await AirdropV2.connect(beneficiary1)
				.updateCooldown(1)
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await AirdropV2.cooldown()).should.eq(cooldown);
		});

		it("Should update merkleRoot if admin", async function () {
			await AirdropV2.updateMerkleRoot(
				"0x38dcc0e7f12d1a4e073ada370d73e10888b68a9809659d2d13be1540285f88f9"
			);
			(await AirdropV2.merkleRoot()).should.eq(
				"0x38dcc0e7f12d1a4e073ada370d73e10888b68a9809659d2d13be1540285f88f9"
			);
		});

		it("Should not update merkleRoot if not admin", async function () {
			await AirdropV2.connect(beneficiary1)
				.updateMerkleRoot(
					"0x38dcc0e7f12d1a4e073ada370d73e10888b68a9809659d2d13be1540285f88f9"
				)
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await AirdropV2.merkleRoot()).should.eq(merkleRoot);
		});
	});

	describe("Airdrop - claim", () => {
		const initialBalance = toEther(1000000);

		before(async function () {
			[
				owner,
				beneficiary1,
				beneficiary2,
				beneficiary3,
				beneficiary4,
				beneficiary5,
				beneficiary6,
				beneficiary7,
				beneficiary8,
				beneficiary9,
			] = await ethers.getSigners();

			merkleRoot = generateMerkleTree([
				beneficiary1.address,
				beneficiary2.address,
				beneficiary3.address,
				beneficiary4.address,
				beneficiary5.address,
				beneficiary6.address,
			]);
		});

		beforeEach(async () => {
			await deploy();
			await AirdropV2.updateMerkleRoot(merkleRoot);
			await AirdropV2.updateStartTime(0);
			await PACT.transfer(AirdropV2.address, initialBalance);
		});

		async function claimAndCheck(
			beneficiary: SignerWithAddress,
			trancheAmount: BigNumber
		) {
			const beneficiaryBalanceBefore = await PACT.balanceOf(
				beneficiary.address
			);
			const airdropV2BalanceBefore = await PACT.balanceOf(
				AirdropV2.address
			);
			const beneficiaryBefore = await AirdropV2.beneficiaries(
				beneficiary.address
			);

			await AirdropV2.claim(
				beneficiary.address,
				getProof(beneficiary.address)
			)
				.should.emit(AirdropV2, "Claimed")
				.withArgs(beneficiary.address, trancheAmount);

			const beneficiaryBalanceAfter = await PACT.balanceOf(
				beneficiary.address
			);
			const airdropV2BalanceAfter = await PACT.balanceOf(
				AirdropV2.address
			);
			const beneficiaryAfter = await AirdropV2.beneficiaries(
				beneficiary.address
			);

			beneficiaryAfter.claimedAmount.should.eq(
				beneficiaryBefore.claimedAmount.add(trancheAmount)
			);
			beneficiaryAfter.lastClaimTime.should.eq(
				await getCurrentBlockTimestamp()
			);
			beneficiaryBalanceAfter.should.eq(
				beneficiaryBalanceBefore.add(trancheAmount)
			);
			airdropV2BalanceAfter.should.eq(
				airdropV2BalanceBefore.sub(trancheAmount)
			);
		}

		it("should claim #1", async function () {
			await claimAndCheck(beneficiary1, trancheAmount);
		});

		it("should claim #2", async function () {
			await claimAndCheck(beneficiary1, trancheAmount);
			await claimAndCheck(beneficiary2, trancheAmount);
			await claimAndCheck(beneficiary3, trancheAmount);
			await claimAndCheck(beneficiary4, trancheAmount);
			await claimAndCheck(beneficiary5, trancheAmount);
		});

		it("should not claim before startTime", async function () {
			await AirdropV2.updateStartTime(1999999999);
			await AirdropV2.claim(
				beneficiary1.address,
				getProof(beneficiary1.address)
			).should.be.rejectedWith("AirdropV2Implementation::claim: Not yet");
		});

		it("should not claim if not valid beneficiary", async function () {
			await AirdropV2.claim(
				owner.address,
				getProof(owner.address)
			).should.be.rejectedWith(
				"AirdropV2Implementation::claim: Incorrect proof"
			);
		});

		it("should not claim with another proof", async function () {
			await AirdropV2.claim(
				beneficiary1.address,
				getProof(beneficiary2.address)
			).should.be.rejectedWith(
				"AirdropV2Implementation::claim: Incorrect proof"
			);
		});

		it("should not claim again before cooldown", async function () {
			await claimAndCheck(beneficiary1, trancheAmount);
			await AirdropV2.claim(
				beneficiary1.address,
				getProof(beneficiary1.address)
			).should.be.rejectedWith("AirdropV2Implementation::claim: Not yet");
		});

		it("should claim again after cooldown", async function () {
			await claimAndCheck(beneficiary1, trancheAmount);
			await advanceNSeconds(cooldown);
			await claimAndCheck(beneficiary1, trancheAmount);
		});

		it("should claim total amount #1", async function () {
			const numberOfClaims = Math.ceil(
				Number(totalAmount.div(trancheAmount))
			);

			for (
				let claimIndex = 0;
				claimIndex < numberOfClaims;
				claimIndex++
			) {
				await claimAndCheck(beneficiary1, trancheAmount);
				await advanceNSeconds(cooldown);
			}
		});

		it("should claim total amount #2", async function () {
			const totalAmount = toEther(99);
			const trancheAmount = toEther(10);

			await AirdropV2.updateTotalAmount(totalAmount);
			await AirdropV2.updateTrancheAmount(trancheAmount);

			for (let claimIndex = 0; claimIndex < 9; claimIndex++) {
				await claimAndCheck(beneficiary1, trancheAmount);
				await advanceNSeconds(cooldown);
			}

			await claimAndCheck(beneficiary1, toEther(9));

			const beneficiaryAfter = await AirdropV2.beneficiaries(
				beneficiary1.address
			);

			beneficiaryAfter.claimedAmount.should.eq(totalAmount);
			(await PACT.balanceOf(beneficiary1.address)).should.eq(totalAmount);
		});

		it("should not claim more than total amount", async function () {
			const numberOfClaims = Math.ceil(
				Number(totalAmount.div(trancheAmount))
			);

			for (
				let claimIndex = 0;
				claimIndex < numberOfClaims;
				claimIndex++
			) {
				await claimAndCheck(beneficiary1, trancheAmount);
				await advanceNSeconds(cooldown);
			}

			await AirdropV2.claim(
				beneficiary1.address,
				getProof(beneficiary1.address)
			).should.be.rejectedWith(
				"AirdropV2Implementation::claim: Beneficiary's claimed all amount"
			);
		});
	});
});
