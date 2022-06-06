import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal } from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

const timelockAddress = "0xcb0C15AdE117C812E4d96165472EbF83Bed231B0";
const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
const communityAdminProxyAddress = "0x1c33D75bcE52132c7a0e220c1C338B9db7cf3f3A";

let impactMarketCouncilMember: string[] = [];

let communityNewImplementationAddress: string;
let communityMiddleProxyAddress: string;
let communityAdminNewImplementationAddress: string;
let ambassadorsProxyAddress: string;
let ImpactMarketCouncilProxyAddress: string;

let GovernanceProxy: ethersTypes.Contract;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	// const { deployments, ethers } = hre;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];
	impactMarketCouncilMember = [deployer.address];

	GovernanceProxy = await ethers.getContractAt(
		"PACTDelegate",
		governanceDelegatorAddress
	);

	await deployNewCommunity();
	await deployAmbassadors();
	await deployImpactMarketCouncil();
	await createUpgradeCommunityProposal();
};

async function deployNewCommunity() {
	console.log("Deploying new contracts for community");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	communityNewImplementationAddress = (
		await deploy("CommunityImplementation", {
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		})
	).address;

	await new Promise((resolve) => setTimeout(resolve, 6000));

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
	await new Promise((resolve) => setTimeout(resolve, 6000));
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

async function deployImpactMarketCouncil() {
	console.log("Deploying ImpactMarketCouncil contracts");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const implementationResult = await deploy("ImpactMarketCouncilImplementation", {
		from: deployer.address,
		log: true,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const proxyResult = await deploy("ImpactMarketCouncilProxy", {
		from: deployer.address,
		args: [implementationResult.address, proxyAdminAddress],
		log: true,
	});

	const impactMarketCouncil = await ethers.getContractAt(
		"ImpactMarketCouncilImplementation",
		proxyResult.address
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await impactMarketCouncil.initialize(
		1,
		communityAdminProxyAddress,
		impactMarketCouncilMember
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await impactMarketCouncil.transferOwnership(timelockAddress);

	ImpactMarketCouncilProxyAddress = proxyResult.address;
}

async function createUpgradeCommunityProposal() {
	console.log("Creating new proposal for community");

	// await new Promise((resolve) => setTimeout(resolve, 6000));
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
			"updateImpactMarketCouncil(address)",
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
			[ImpactMarketCouncilProxyAddress],
		],
		'Upgrade community and communityAdmin implementations'
	);
}

export default func;
func.tags = ["Release4Community"];
