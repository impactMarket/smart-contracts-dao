// @ts-ignore
import chai, { should } from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";

// @ts-ignore
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import {
	advanceNSecondsAndBlock,
	getCurrentBlockTimestamp,
} from "../utils/TimeTravel";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { fromEther, toEther } from "../utils/helpers";
import { BigNumber } from "@ethersproject/bignumber";
import {uniswapExchangePathCUSDToPACT, uniswapQuoterAddress} from "../utils/uniswap";

chai.use(chaiAsPromised);
should();

describe("Contributor", () => {
	let deployer: SignerWithAddress;
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let user4: SignerWithAddress;

	let PACT: ethersTypes.Contract;
	let Contributor: ethersTypes.Contract;

	const claimDelay = 3600 * 24 * 7;
	const baseDelay = 3600 * 24;

	const initialContributorBalance = toEther(1000000);

	const deploy = deployments.createFixture(async () => {
		await deployments.fixture("ContributorTest", {
			fallbackToGlobal: false,
		});

		[deployer, owner, user1, user2, user3, user4] =
			await ethers.getSigners();

		PACT = await ethers.getContractAt(
			"PACTToken",
			(
				await deployments.get("PACTToken")
			).address
		);

		Contributor = await ethers.getContractAt(
			"ContributorImplementation",
			(
				await deployments.get("ContributorProxy")
			).address
		);

		await PACT.transfer(Contributor.address, initialContributorBalance);
	});

	describe("Contributor - basic", () => {
		before(async function () {});

		beforeEach(async () => {
			await deploy();
		});

		it("should have correct values", async function () {
			(await Contributor.owner()).should.eq(owner.address);
			(await Contributor.getVersion()).should.eq(1);
			(await Contributor.PACT()).should.eq(PACT.address);
			(await Contributor.uniswapQuoter()).should.eq(uniswapQuoterAddress);
			(await Contributor.exchangePathCUSDToPACT()).should.eq(uniswapExchangePathCUSDToPACT);
		});

		// it("Should update revenueAddress if owner", async function () {
		// 	(await Contributor.revenueAddress()).should.eq(
		// 		ContributorRevenue.address
		// 	);
		// 	await Contributor.connect(owner).updateRevenueAddress(user1.address)
		// 		.should.be.fulfilled;
		// 	(await Contributor.revenueAddress()).should.eq(user1.address);
		// });
		//
		// it("Should not update revenueAddress if not owner", async function () {
		// 	await Contributor.connect(user1)
		// 		.updateRevenueAddress(user1.address)
		// 		.should.be.rejectedWith("Ownable: caller is not the owner");
		// });
	});
});
