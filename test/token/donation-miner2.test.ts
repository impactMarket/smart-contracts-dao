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
		console.log(
			"*********************************************************************************** #1"
		);
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
		console.log(
			"*********************************************************************************** #2"
		);
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user1ExpectedReward = parseEther("1400");

		await advanceTimeAndBlockNTimes(5, REWARD_PERIOD_SIZE);

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
		console.log(
			"*********************************************************************************** #3"
		);
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
			`User1 donated: ${formatEther(
				user1Donation
			)} cUSD and claimed: ${formatEther(user1ExpectedReward)} IPCT`
		);
	});

	it("Should claim reward, 2 donors #1", async function () {
		console.log(
			"*********************************************************************************** #4"
		);
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("700");
		const user2ExpectedReward = parseEther("400");

		await advanceTimeAndBlockNTimes(3, REWARD_PERIOD_SIZE);

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

		console.log(`User1 donated: ${formatEther(user1Donation)} cUSD`);
		console.log(`User2 donated: ${formatEther(user2Donation)} cUSD`);
		console.log(`User1 wants to claim:`);
		console.log(`       - total_donations = 200`);
		console.log(`       - his_donations = 100`);
		console.log(`       - unclaimed_reward = 1400`);
		console.log(
			`     =>User1 will get 50% of the unclaimed reward =  ${formatEther(
				user1ExpectedReward
			)} IPCT`
		);
		console.log(`User2 wants to claim:`);
		console.log(`       - total_donations = 200`);
		console.log(`       - his_donations = 100`);
		console.log(
			`       - unclaimed_reward = 800 (700 left + 100 from the new block)`
		);
		console.log(
			`     =>User2 will get 50% of the unclaimed reward =  ${formatEther(
				user2ExpectedReward
			)} IPCT`
		);
	});

	it("Should claim reward, 2 donors #1 bis", async function () {
		console.log(
			"*********************************************************************************** #5"
		);
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("400");
		const user2ExpectedReward = parseEther("700");

		await advanceTimeAndBlockNTimes(3, REWARD_PERIOD_SIZE);

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
		await DonationMiner.contract.connect(signers[2]).claimRewards();
		await DonationMiner.contract.connect(signers[1]).claimRewards();

		// Check their IPCT balance
		expect(await IPCT.contract.balanceOf(signers[1].getAddress())).to.equal(
			user1ExpectedReward
		);
		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
			user2ExpectedReward
		);

		console.log(`User1 donated: ${formatEther(user1Donation)} cUSD`);
		console.log(`User2 donated: ${formatEther(user2Donation)} cUSD`);

		console.log(`User2 wants to claim:`);
		console.log(`       - total_donations = 200`);
		console.log(`       - his_donations = 100`);
		console.log(`       - unclaimed_reward = 1400`);
		console.log(
			`     =>User2 will get 50% of the unclaimed reward =  ${formatEther(
				user2ExpectedReward
			)} IPCT`
		);
		console.log(`User1 wants to claim:`);
		console.log(`       - total_donations = 200`);
		console.log(`       - his_donations = 100`);
		console.log(
			`       - unclaimed_reward = 800 (700 left + 100 from the new block)`
		);
		console.log(
			`     =>User1 will get 50% of the unclaimed reward =  ${formatEther(
				user1ExpectedReward
			)} IPCT`
		);
	});

	it("Should claim reward, 2 donors #2", async function () {
		console.log(
			"*********************************************************************************** #6"
		);
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("100");
		const user2Donation = parseEther("200");
		const user1ExpectedReward = parseEther("466.666666666666666666");
		const user2ExpectedReward = parseEther("688.888888888888888889");

		await advanceTimeAndBlockNTimes(3, REWARD_PERIOD_SIZE);

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
		console.log(`User1 wants to claim:`);
		console.log(`       - total_donations = 300`);
		console.log(`       - his_donations = 100`);
		console.log(`       - unclaimed_reward = 1400`);
		console.log(
			`     =>User1 will get 33.33% of the unclaimed reward =  ${formatEther(
				user1ExpectedReward
			)} IPCT`
		);
		console.log(`User2 wants to claim:`);
		console.log(`       - total_donations = 300`);
		console.log(`       - his_donations = 200`);
		console.log(
			`       - unclaimed_reward = 1033.3333 (933.333333 left + 100 from the new block)`
		);
		console.log(
			`     =>User2 will get 66.66% of the unclaimed reward =  ${formatEther(
				user2ExpectedReward
			)} IPCT`
		);
	});

	it("Should claim reward, 2 donors #3", async function () {
		console.log(
			"*********************************************************************************** #7"
		);
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("300");
		const user2Donation = parseEther("100");
		const user1ExpectedReward = parseEther("1050");
		const user2ExpectedReward = parseEther("112.5");

		await advanceTimeAndBlockNTimes(3, REWARD_PERIOD_SIZE);

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
		console.log(`User1 wants to claim:`);
		console.log(`       - total_donations = 400`);
		console.log(`       - his_donations = 300`);
		console.log(`       - unclaimed_reward = 1400`);
		console.log(
			`     =>User1 will get 75% of the unclaimed reward =  ${formatEther(
				user1ExpectedReward
			)} IPCT`
		);
		console.log(`User2 wants to claim:`);
		console.log(`       - total_donations = 200`);
		console.log(`       - his_donations = 100`);
		console.log(
			`       - unclaimed_reward = 350 (350 left + 100 from the new block)`
		);
		console.log(
			`     =>User2 will get 25% of the unclaimed reward =  ${formatEther(
				user2ExpectedReward
			)} IPCT`
		);
	});

	//*******************************************************************************************************
	it("Should claim reward, 2 donors #4", async function () {
		console.log(
			"*********************************************************************************** #8"
		);
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("1");
		const user2Donation = parseEther("1000000");
		const user1ExpectedReward = parseEther("0.001399998600001399");
		const user2ExpectedReward = parseEther("1499.997100004299994301");

		await advanceTimeAndBlockNTimes(3, REWARD_PERIOD_SIZE);

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
		REWARD_PERIOD_SIZE;
		expect(await IPCT.contract.balanceOf(signers[2].getAddress())).to.equal(
			user2ExpectedReward
		);

		console.log(`User1 donated ${formatEther(user1Donation)} cUSD`);
		console.log(`User2 donated ${formatEther(user2Donation)} cUSD`);
		console.log(`User1 wants to claim:`);
		console.log(`       - total_donations = 1000001`);
		console.log(`       - his_donations = 1`);
		console.log(`       - unclaimed_reward = 1400`);
		console.log(
			`     =>User1 will get 0.001% of the unclaimed reward =  ${formatEther(
				user1ExpectedReward
			)} IPCT`
		);
		console.log(`User2 wants to claim:`);
		console.log(`       - total_donations = 1000001`);
		console.log(`       - his_donations = 1000000`);
		console.log(
			`       - unclaimed_reward = 1499.99 (1399.9 left + 100 from the new block)`
		);
		console.log(
			`     =>User2 will get 99.99% of the unclaimed reward =  ${formatEther(
				user2ExpectedReward
			)} IPCT`
		);
	});

	it("Should claim reward, 2 donors #4 bis", async function () {
		console.log(
			"*********************************************************************************** #9"
		);
		const { cUSD, IPCT, DonationMiner, signers } = await initialize();

		const user1Donation = parseEther("1");
		const user2Donation = parseEther("1000000");
		const user1ExpectedReward = parseEther("1400");
		const user2ExpectedReward = parseEther("199.999800000199999800");

		await advanceTimeAndBlockNTimes(4, REWARD_PERIOD_SIZE);

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

		console.log(`User1 wants to claim:`);
		console.log(`       - total_donations = 1000001`);
		console.log(`       - his_donations = 1`);
		console.log(`       - unclaimed_reward = 1400`);
		console.log(
			`     =>User1 will get 100% of the unclaimed reward =  ${formatEther(
				user1ExpectedReward
			)} IPCT`
		);

		console.log(`User2 donated ${formatEther(user2Donation)} cUSD`);

		console.log(`User2 wants to claim:`);
		console.log(`       - total_donations = 1000001`);
		console.log(`       - his_donations = 1000000`);
		console.log(
			`       - unclaimed_reward = 200 (0 left + 200 from the new blocks)`
		);
		console.log(
			`     =>User2 will get 99.99% of the unclaimed reward =  ${formatEther(
				user2ExpectedReward
			)} IPCT`
		);
	});
});
