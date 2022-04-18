import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal } from "../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

const PACTTokenAddress = "0x6FA09BC0CF975fABFAAAF8231886F66c1c22B53e";
const timelockAddress = "0x64809F1F86e85E257FBf8f2feFB120A5a1921551";
const governanceDelegatorAddress = "0xBf35872f98E716bfc06B03aB173037576DebE1F5";
const proxyAdminAddress = "0x837F4E8AcF4265C3f09d71c3c9bc8abdFCBC49e1";
const communityAdminProxyAddress = "0x88B101c163bbFE1dc4764225248a6DAd282d7A39";
const donationMinerProxyAddress = "0xac66FDe03Efc73879424d2bD61F846e964ce6639";

const stakingDonationRatio = 1000000000;
const stakingCooldown = 1000;
let committeeMember: string[] = [];

let communityNewImplementationAddress: string;
let communityMiddleProxyAddress: string;
let communityAdminNewImplementationAddress: string;
let ambassadorsProxyAddress: string;
let UBICommitteeProxyAddress: string;
let donationMinerNewImplementationAddress: string;
let governanceNewImplementationAddress: string;
let stakingProxyAddress: string;
let SPACTTokenAddress: string;

let GovernanceProxy: ethersTypes.Contract;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	// const { deployments, ethers } = hre;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];
	committeeMember = [deployer.address];

	GovernanceProxy = await ethers.getContractAt(
		"PACTDelegate",
		governanceDelegatorAddress
	);

	await deployNewCommunity();
	await deployAmbassadors();
	await deployUBICommittee();
	await createUpgradeCommunityProposal();
	await deployStaking();
	await deployNewDonationMiner();
	await createUpgradeDonationMinerProposal();
	await deployNewGovernance();
	await createUpgradeGovernanceProposal();
};

async function deployNewCommunity() {
	console.log("Deploying new contracts for community");

	// await new Promise((resolve) => setTimeout(resolve, 6000));
	communityNewImplementationAddress = (
		await deploy("CommunityImplementation", {
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		})
	).address;

	// await new Promise((resolve) => setTimeout(resolve, 6000));

	// constructor's parameters are not important because this is a middle proxy contract
	// so, we can use any contract address and any address in order to create the contract
	communityMiddleProxyAddress = (
		await deploy("CommunityMiddleProxy", {
			from: deployer.address,
			args: [
				communityNewImplementationAddress,
				communityNewImplementationAddress,
			],
			log: true,
			// gasLimit: 13000000,
		})
	).address;
	// await new Promise((resolve) => setTimeout(resolve, 6000));
	communityAdminNewImplementationAddress = (
		await deploy("CommunityAdminImplementation", {
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		})
	).address;
}

async function deployAmbassadors() {
	console.log("Deploying ambassadors contracts");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const implementationResult = await deploy("AmbassadorsImplementation", {
		from: deployer.address,
		log: true,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const proxyResult = await deploy("AmbassadorsProxy", {
		from: deployer.address,
		args: [implementationResult.address, proxyAdminAddress],
		log: true,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const Ambassadors = await ethers.getContractAt(
		"AmbassadorsImplementation",
		proxyResult.address
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await Ambassadors.initialize(communityAdminProxyAddress);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await Ambassadors.transferOwnership(timelockAddress);

	ambassadorsProxyAddress = proxyResult.address;
}

async function deployUBICommittee() {
	console.log("Deploying UBICommittee contracts");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const implementationResult = await deploy(
		"UBICommitteeImplementation",
		{
			from: deployer.address,
			log: true,
		}
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const proxyResult = await deploy("UBICommitteeProxy", {
		from: deployer.address,
		args: [implementationResult.address, proxyAdminAddress],
		log: true,
	});

	const ubiCommittee = await ethers.getContractAt(
		"UBICommitteeImplementation",
		proxyResult.address
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await ubiCommittee.initialize(
		1,
		communityAdminProxyAddress,
		committeeMember
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await ubiCommittee.transferOwnership(timelockAddress);

	UBICommitteeProxyAddress = proxyResult.address;
}

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
	const stakingImplementationResult = await deploy(
		"StakingImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

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

async function deployNewGovernance() {
	console.log("Deploying new contract for governance");
	await new Promise((resolve) => setTimeout(resolve, 6000));
	governanceNewImplementationAddress = (
		await deploy("IPCTDelegate", {
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		})
	).address;
}

async function createUpgradeCommunityProposal() {
	console.log("Creating new proposal for community");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		GovernanceProxy,
		deployer,
		[
			proxyAdminAddress,
			communityAdminProxyAddress,
			communityAdminProxyAddress,
			communityAdminProxyAddress,
			communityAdminProxyAddress,
		],
		[0, 0, 0, 0, 0],
		[
			"upgrade(address,address)",
			"updateCommunityMiddleProxy(address)",
			"updateCommunityImplementation(address)",
			"updateAmbassadors(address)",
			"updateUbiCommittee(address)",
		],
		[
			["address", "address"],
			["address"],
			["address"],
			["address"],
			["address"],
		],
		[
			[
				communityAdminProxyAddress,
				communityAdminNewImplementationAddress,
			],
			[communityMiddleProxyAddress],
			[communityNewImplementationAddress],
			[ambassadorsProxyAddress],
			[UBICommitteeProxyAddress],
		]
	);
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
		],
		[0, 0, 0],
		[
			"upgrade(address,address)",
			"updateStaking(address)",
			"updateStakingDonationRatio(uint256)",
		],
		[["address", "address"], ["address"], ["uint256"]],
		[
			[donationMinerProxyAddress, donationMinerNewImplementationAddress],
			[stakingProxyAddress],
			[stakingDonationRatio],
		]
	);
}

async function createUpgradeGovernanceProposal() {
	console.log("Creating new proposal for governance");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		GovernanceProxy,
		deployer,
		[proxyAdminAddress],
		[0],
		["upgrade(address,address)"],
		[["address", "address"]],
		[
			[governanceDelegatorAddress, governanceNewImplementationAddress]
		]
	);
}

export default func;
func.tags = ["Release4Prod"];
