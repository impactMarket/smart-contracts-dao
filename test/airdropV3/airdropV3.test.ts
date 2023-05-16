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

should();
chai.use(chaiAsPromised);

describe("AirdropV3", () => {
	const socialConnectAddress = "0x70F9314aF173c246669cFb0EEe79F9Cfd9C34ee3";
	const socialConnectIssuerAddress =
		"0xe3475047EF9F9231CD6fAe02B3cBc5148E8eB2c8";

	const startTime = 0;
	const trancheAmount = toEther(100);
	const totalAmount = toEther(1000);
	const cooldown = 3600;

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
	let AirdropV3: ethersTypes.Contract;

	const deploy = deployments.createFixture(async () => {
		await deployments.fixture("AirdropV3Test", { fallbackToGlobal: false });

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
		});

		beforeEach(async () => {
			await deploy();
		});

		it("should have correct values", async function () {
			(await AirdropV3.getVersion()).should.eq(1);
			(await AirdropV3.PACT()).should.eq(PACT.address);
			(await AirdropV3.socialConnect()).should.eq(socialConnectAddress);
			(await AirdropV3.socialConnectIssuer()).should.eq(
				socialConnectIssuerAddress
			);
			(await AirdropV3.startTime()).should.eq(startTime);
			(await AirdropV3.trancheAmount()).should.eq(trancheAmount);
			(await AirdropV3.totalAmount()).should.eq(totalAmount);
			(await AirdropV3.cooldown()).should.eq(cooldown);
		});

		it("Should update startTime if admin", async function () {
			await AirdropV3.updateStartTime(1);
			(await AirdropV3.startTime()).should.eq(1);
		});

		it("Should not update startTime if not admin", async function () {
			await AirdropV3.connect(beneficiary1)
				.updateStartTime(1)
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await AirdropV3.startTime()).should.eq(startTime);
		});

		it("Should update trancheAmount if admin", async function () {
			await AirdropV3.updateTrancheAmount(1);
			(await AirdropV3.trancheAmount()).should.eq(1);
		});

		it("Should not update trancheAmount if not admin", async function () {
			await AirdropV3.connect(beneficiary1)
				.updateTrancheAmount(1)
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await AirdropV3.trancheAmount()).should.eq(trancheAmount);
		});

		it("Should update totalAmount if admin", async function () {
			await AirdropV3.updateTotalAmount(1);
			(await AirdropV3.totalAmount()).should.eq(1);
		});

		it("Should not update totalAmount if not admin", async function () {
			await AirdropV3.connect(beneficiary1)
				.updateTotalAmount(1)
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await AirdropV3.totalAmount()).should.eq(totalAmount);
		});

		it("Should update cooldown if admin", async function () {
			await AirdropV3.updateCooldown(1);
			(await AirdropV3.cooldown()).should.eq(1);
		});

		it("Should not update cooldown if not admin", async function () {
			await AirdropV3.connect(beneficiary1)
				.updateCooldown(1)
				.should.be.rejectedWith("Ownable: caller is not the owner");
			(await AirdropV3.cooldown()).should.eq(cooldown);
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
		});

		beforeEach(async () => {
			await deploy();
			await AirdropV3.updateStartTime(0);
			await PACT.transfer(AirdropV3.address, initialBalance);
		});

		async function claimAndCheck(
			beneficiary: SignerWithAddress,
			trancheAmount: BigNumber
		) {
			const beneficiaryBalanceBefore = await PACT.balanceOf(
				beneficiary.address
			);
			const airdropV3BalanceBefore = await PACT.balanceOf(
				AirdropV3.address
			);
			const beneficiaryBefore = await AirdropV3.beneficiaries(
				beneficiary.address
			);

			await AirdropV3.claim(beneficiary.address)
				.should.emit(AirdropV3, "Claimed")
				.withArgs(beneficiary.address, trancheAmount);

			const beneficiaryBalanceAfter = await PACT.balanceOf(
				beneficiary.address
			);
			const airdropV3BalanceAfter = await PACT.balanceOf(
				AirdropV3.address
			);
			const beneficiaryAfter = await AirdropV3.beneficiaries(
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
			airdropV3BalanceAfter.should.eq(
				airdropV3BalanceBefore.sub(trancheAmount)
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
			await AirdropV3.updateStartTime(1999999999);
			await AirdropV3.claim(beneficiary1.address).should.be.rejectedWith(
				"AirdropV3Implementation::claim: Not yet"
			);
		});

		it("should not claim if not valid beneficiary", async function () {
			await AirdropV3.claim(owner.address).should.be.rejectedWith(
				"AirdropV3Implementation::claim: Incorrect proof"
			);
		});

		it("should not claim with another proof", async function () {
			await AirdropV3.claim(beneficiary1.address).should.be.rejectedWith(
				"AirdropV3Implementation::claim: Incorrect proof"
			);
		});

		it("should not claim again before cooldown", async function () {
			await claimAndCheck(beneficiary1, trancheAmount);
			await AirdropV3.claim(beneficiary1.address).should.be.rejectedWith(
				"AirdropV3Implementation::claim: Not yet"
			);
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

			await AirdropV3.updateTotalAmount(totalAmount);
			await AirdropV3.updateTrancheAmount(trancheAmount);

			for (let claimIndex = 0; claimIndex < 9; claimIndex++) {
				await claimAndCheck(beneficiary1, trancheAmount);
				await advanceNSeconds(cooldown);
			}

			await claimAndCheck(beneficiary1, toEther(9));

			const beneficiaryAfter = await AirdropV3.beneficiaries(
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

			await AirdropV3.claim(beneficiary1.address).should.be.rejectedWith(
				"AirdropV3Implementation::claim: Beneficiary's claimed all amount"
			);
		});
	});
});
