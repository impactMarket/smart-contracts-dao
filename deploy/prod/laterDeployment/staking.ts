import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal } from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

const PACTTokenAddress = "0x73A2De6A8370108D43c3C80430C84c30df323eD2";
const timelockAddress = "0xcb0C15AdE117C812E4d96165472EbF83Bed231B0";
const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
const donationMinerProxyAddress = "0x09Cdc8f50994F63103bc165B139631A6ad18EF49";


const stakingDonationRatio = 1000000000;
const communityDonationRatio = 2;
const stakingCooldown = 259200; // 14 days or 15 reward periods (as donationMiner.claimDelay)

let donationMinerNewImplementationAddress: string;
let stakingProxyAddress: string;
let SPACTTokenAddress: string;

let GovernanceProxy: ethersTypes.Contract;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	// const { deployments, ethers } = hre;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];

	GovernanceProxy = await ethers.getContractAt(
		"PACTDelegate",
		governanceDelegatorAddress
	);

	await deployStaking();
	await deployNewDonationMiner();
	await createUpgradeDonationMinerProposal();
};

async function deployStaking() {
	console.log("Deploying Staking contracts");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const SPACTTokenResult = await deploy("SPACTToken", {
		from: deployer.address,
		args: [],
		log: true,
	});

	const SPACTToken = await ethers.getContractAt(
		"SPACTToken",
		SPACTTokenResult.address
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const stakingImplementationResult = await deploy("StakingImplementation", {
		from: deployer.address,
		args: [],
		log: true,
		// gasLimit: 13000000,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const stakingProxyResult = await deploy("StakingProxy", {
		from: deployer.address,
		args: [stakingImplementationResult.address, proxyAdminAddress],
		log: true,
		// gasLimit: 13000000,
	});

	const stakingContract = await ethers.getContractAt(
		"StakingImplementation",
		stakingProxyResult.address
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await stakingContract.initialize(
		PACTTokenAddress,
		SPACTTokenResult.address,
		donationMinerProxyAddress,
		stakingCooldown
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await stakingContract.transferOwnership(timelockAddress);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await SPACTToken.transferOwnership(stakingContract.address);

	stakingProxyAddress = stakingProxyResult.address;
	SPACTTokenAddress = SPACTToken.address;
}

async function deployNewDonationMiner() {
	console.log("Deploying new contract for donation miner");
	await new Promise((resolve) => setTimeout(resolve, 6000));
	donationMinerNewImplementationAddress = (
		await deploy("DonationMinerImplementation", {
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		})
	).address;
}

async function createUpgradeDonationMinerProposal() {
	console.log("Creating new proposal for donation miner");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		GovernanceProxy,
		deployer,
		[
			proxyAdminAddress,
			donationMinerProxyAddress,
			donationMinerProxyAddress,
			donationMinerProxyAddress,
		],
		[0, 0, 0, 0],
		[
			"upgrade(address,address)",
			"updateStaking(address)",
			"updateStakingDonationRatio(uint256)",
			"updateCommunityDonationRatio(uint256)",
		],
		[["address", "address"], ["address"], ["uint256"], ["uint256"]],
		[
			[donationMinerProxyAddress, donationMinerNewImplementationAddress],
			[stakingProxyAddress],
			[stakingDonationRatio],
			[communityDonationRatio],
		],
		'Upgrade DonationMiner to allow Staking features'
	);
}

export default func;
func.tags = ["Staking"];
