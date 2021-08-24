// @ts-ignore
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { expect } from "../utils/chai-setup";
import { advanceTimeAndBlockNTimes } from "../utils/TimeTravel";
import { parseEther, formatEther } from "@ethersproject/units";

const REWARD_PERIOD_SIZE = 14;
const STARTING_REWARD_PER_BLOCK = 100;

const initialize = deployments.createFixture(
	async ({ deployments, getNamedAccounts, ethers }, options) => {
		await deployments.fixture("Test", { fallbackToGlobal: false });
		const { deployer, user1, user2, user3 } = await getNamedAccounts();

		const cUSD = await deployments.get("TokenMock");
		const cUSDContract = await ethers.getContractAt(
			"TokenMock",
			cUSD.address
		);
		const DonationMiner = await deployments.get("DonationMiner2");
		const DonationMinerContract = await ethers.getContractAt(
			"DonationMiner2",
			DonationMiner.address
		);
		const IPCT = await deployments.get("IPCTToken");
		const IPCTContract = await ethers.getContractAt(
			"IPCTToken",
			IPCT.address
		);

		// Mint each of the test some cUSD
		await cUSDContract.mint(user1, parseEther("1000000"));
		await cUSDContract.mint(user2, parseEther("10000000"));
		await cUSDContract.mint(user3, parseEther("100000000"));

		// Mint the DonationMiner some IPCT
		await IPCTContract.transfer(
			DonationMiner.address,
			parseEther("100000")
		);

		// Get signers for write tests
		const [ownerSigner, user1Signer, user2Signer, user3Signer] =
			await ethers.getSigners();

		return {
			cUSD: {
				owner: deployer,
				deployed: cUSD,
				contract: cUSDContract,
			},
			IPCT: {
				owner: deployer,
				deployed: IPCT,
				contract: IPCTContract,
			},
			DonationMiner: {
				owner: deployer,
				deployed: DonationMiner,
				contract: DonationMinerContract,
			},
			signers: [ownerSigner, user1Signer, user2Signer, user3Signer],
		};
	}
);

describe("Donation Miner2", () => {
	it("Should approve and donate 100 cUSD from user1", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("200");

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);

		const userBalance = await cUSD.contract.balanceOf(
			signers[1].getAddress()
		);
		expect(userBalance).to.equal(parseEther("999800"));
	});

	it("Should approve and donate 100 cUSD from user1, advance time and claim their reward", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user1ExpectedReward = parseEther("1400");

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE, REWARD_PERIOD_SIZE);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);

		// Claim the rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);

		console.log(
			`User1 donated ${formatEther(
				user1Donation
			)} cUSD and claimed: ${formatEther(user1ExpectedReward)} IPCT`
		);
	});

	it("Should not be able to claim after the end of the reward period", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user1ExpectedReward = parseEther("0");

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE, REWARD_PERIOD_SIZE);

		// Claim the rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);

		console.log(
			`User1 donated ${formatEther(
				user1Donation
			)} cUSD and claimed: ${formatEther(user1ExpectedReward)} IPCT`
		);
	});

	it("Should claim reward, 2 donors #1", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("700");
		const user2ExpectedReward = parseEther("375");

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE, REWARD_PERIOD_SIZE);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);
		await cUSD.contract
			.connect(signers[2])
			.approve(DonationMiner.deployed.address, user2Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);

		// Claim their rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();
		await DonationMiner.contract.connect(signers[2]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);
		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
			user2ExpectedReward
		);

		console.log(`User1 donated ${formatEther(user1Donation)} cUSD`);
		console.log(`User2 donated ${formatEther(user2Donation)} cUSD`);
		console.log(`User1 claimed: ${formatEther(user1ExpectedReward)} IPCT`);
		console.log(`User2 claimed: ${formatEther(user2ExpectedReward)} IPCT`);
	});

	it("Should claim reward, 2 donors #2", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user2Donation = parseEther("200");
		const user1ExpectedReward = parseEther("466.666666666666666662");
		const user2ExpectedReward = parseEther("644.444444444444444438");

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE, REWARD_PERIOD_SIZE);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);
		await cUSD.contract
			.connect(signers[2])
			.approve(DonationMiner.deployed.address, user2Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);

		// Claim their rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();
		await DonationMiner.contract.connect(signers[2]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);
		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
			user2ExpectedReward
		);

		console.log(`User1 donated ${formatEther(user1Donation)} cUSD`);
		console.log(`User2 donated ${formatEther(user2Donation)} cUSD`);
		console.log(`User1 claimed: ${formatEther(user1ExpectedReward)} IPCT`);
		console.log(`User2 claimed: ${formatEther(user2ExpectedReward)} IPCT`);
	});

	it("Should claim reward, 2 donors #3", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("300");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("1050");
		const user2ExpectedReward = parseEther("106.25");

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE, REWARD_PERIOD_SIZE);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);
		await cUSD.contract
			.connect(signers[2])
			.approve(DonationMiner.deployed.address, user2Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);

		// Claim their rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();
		await DonationMiner.contract.connect(signers[2]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);
		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
			user2ExpectedReward
		);

		console.log(`User1 donated ${formatEther(user1Donation)} cUSD`);
		console.log(`User2 donated ${formatEther(user2Donation)} cUSD`);
		console.log(`User1 claimed: ${formatEther(user1ExpectedReward)} IPCT`);
		console.log(`User2 claimed: ${formatEther(user2ExpectedReward)} IPCT`);
	});

	//*******************************************************************************************************
	it("Should claim reward, 2 donors #4", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("1");
		const user2Donation = parseEther("1000000");
		const user1ExpectedReward = parseEther("0.001399998600001386");
		const user2ExpectedReward = parseEther("1399.997300003999994713");

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE, REWARD_PERIOD_SIZE);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);
		await cUSD.contract
			.connect(signers[2])
			.approve(DonationMiner.deployed.address, user2Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);
		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);

		// Claim their rewards
		await DonationMiner.contract.connect(signers[1]).claimRewards();
		await DonationMiner.contract.connect(signers[2]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);
		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
			user2ExpectedReward
		);

		console.log(`User1 donated ${formatEther(user1Donation)} cUSD`);
		console.log(`User2 donated ${formatEther(user2Donation)} cUSD`);
		console.log(`User1 claimed: ${formatEther(user1ExpectedReward)} IPCT`);
		console.log(`User2 claimed: ${formatEther(user2ExpectedReward)} IPCT`);
	});

	it("Should claim reward, 2 donors #4", async function () {
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("1");
		const user2Donation = parseEther("1000000");
		const user1ExpectedReward = parseEther("1400");
		const user2ExpectedReward = parseEther("199.999800000199999800");

		await advanceTimeAndBlockNTimes(REWARD_PERIOD_SIZE, REWARD_PERIOD_SIZE);

		// Approve from user1
		await cUSD.contract
			.connect(signers[1])
			.approve(DonationMiner.deployed.address, user1Donation);
		await cUSD.contract
			.connect(signers[2])
			.approve(DonationMiner.deployed.address, user2Donation);

		await DonationMiner.contract.connect(signers[1]).donate(user1Donation);

		await DonationMiner.contract.connect(signers[1]).claimRewards();

		await DonationMiner.contract.connect(signers[2]).donate(user2Donation);

		await DonationMiner.contract.connect(signers[2]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);
		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
			user2ExpectedReward
		);

		console.log(`User1 donated ${formatEther(user1Donation)} cUSD`);
		console.log(`User2 donated ${formatEther(user2Donation)} cUSD`);
		console.log(`User1 claimed: ${formatEther(user1ExpectedReward)} IPCT`);
		console.log(`User2 claimed: ${formatEther(user2ExpectedReward)} IPCT`);
	});
});
