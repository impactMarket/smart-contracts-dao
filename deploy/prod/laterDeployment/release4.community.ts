import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal } from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

const FAKE_ADDRESS = "0x000000000000000000000000000000000000dEaD";

//mainnet
const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
const timelockAddress = "0xca3171A5FCda4D840Aa375E907b7A1162aDA9379";
const communityAdminProxyAddress = "0xd61c407c3A00dFD8C355973f7a14c55ebaFDf6F9";

// const impactMarketCouncilMember: string[] = [
// 	'0x92eEC82a3f34bc06892528C1d0a09f15D9f7033d',
// 	'0xFFf5b69C512D539E3e9740480bd2925da9217df0',
// 	'0x53927A9A4908521c637c8b0e68aDe32cCFE469cb'
// ];
// const entityMember: string = '0x266f8E061AD13dDF79Cb662FF633Ddb6dd40725d';


// //alfajores
// const timelockAddress = "0xcb0C15AdE117C812E4d96165472EbF83Bed231B0";
// const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
// const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
// const communityAdminProxyAddress = "0x1c33D75bcE52132c7a0e220c1C338B9db7cf3f3A";

const impactMarketCouncilMember: string[] = []
const entityMember: string = '0x266f8E061AD13dDF79Cb662FF633Ddb6dd40725d';


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

	GovernanceProxy = await ethers.getContractAt(
		"PACTDelegate",
		governanceDelegatorAddress
	);

	await deployNewCommunity();
	// await deployAmbassadors();
	// await deployImpactMarketCouncil();
	await createUpgradeCommunityProposal();
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
	//
	// // constructor's parameters are not important because this is a middle proxy contract
	// // so, we can use any contract address and any address in order to create the contract
	// communityMiddleProxyAddress = (
	// 	await deploy("CommunityMiddleProxy", {
	// 		from: deployer.address,
	// 		args: [
	// 			communityAdminProxyAddress,
	// 			communityAdminProxyAddress,
	// 		],
	// 		log: true,
	// 		// gasLimit: 13000000,
	// 	})
	// ).address;
	// await new Promise((resolve) => setTimeout(resolve, 6000));
	// communityAdminNewImplementationAddress = (
	// 	await deploy("CommunityAdminImplementation", {
	// 		from: deployer.address,
	// 		args: [],
	// 		log: true,
	// 		// gasLimit: 13000000,
	// 	})
	// ).address;
}

// async function deployAmbassadors() {
// 	console.log("Deploying ambassadors contracts");
//
// 	await new Promise((resolve) => setTimeout(resolve, 6000));
// 	const implementationResult = await deploy("AmbassadorsImplementation", {
// 		from: deployer.address,
// 		log: true,
// 	});
//
// 	await new Promise((resolve) => setTimeout(resolve, 6000));
// 	const proxyResult = await deploy("AmbassadorsProxy", {
// 		from: deployer.address,
// 		args: [implementationResult.address, proxyAdminAddress],
// 		log: true,
// 	});
//
// 	await new Promise((resolve) => setTimeout(resolve, 6000));
// 	const Ambassadors = await ethers.getContractAt(
// 		"AmbassadorsImplementation",
// 		proxyResult.address
// 	);
//
// 	await new Promise((resolve) => setTimeout(resolve, 6000));
// 	await Ambassadors.initialize(communityAdminProxyAddress);
//
// 	await new Promise((resolve) => setTimeout(resolve, 6000));
// 	await Ambassadors.transferOwnership(timelockAddress);
//
// 	ambassadorsProxyAddress = proxyResult.address;
// }

// async function deployImpactMarketCouncil() {
// 	console.log("Deploying ImpactMarketCouncil contracts");
//
// 	await new Promise((resolve) => setTimeout(resolve, 6000));
// 	const implementationResult = await deploy("ImpactMarketCouncilImplementation", {
// 		from: deployer.address,
// 		log: true,
// 	});
//
// 	await new Promise((resolve) => setTimeout(resolve, 6000));
// 	const proxyResult = await deploy("ImpactMarketCouncilProxy", {
// 		from: deployer.address,
// 		args: [implementationResult.address, proxyAdminAddress],
// 		log: true,
// 	});
//
// 	const impactMarketCouncil = await ethers.getContractAt(
// 		"ImpactMarketCouncilImplementation",
// 		proxyResult.address
// 	);
//
// 	await new Promise((resolve) => setTimeout(resolve, 6000));
// 	await impactMarketCouncil.initialize(
// 		2,
// 		communityAdminProxyAddress,
// 		impactMarketCouncilMember
// 	);
//
// 	await new Promise((resolve) => setTimeout(resolve, 6000));
// 	await impactMarketCouncil.transferOwnership(timelockAddress);
//
// 	ImpactMarketCouncilProxyAddress = proxyResult.address;
// }

async function createUpgradeCommunityProposal() {
	console.log("Creating new proposal for community");

	// await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		GovernanceProxy,
		deployer,
		[
			communityAdminProxyAddress,
		],
		[0],
		[
			"updateCommunityImplementation(address)"
		],
		[
			["address"]
		],
		[
			[communityNewImplementationAddress],
		],
		'Upgrade communityImplementation'
	);
}

export default func;
func.tags = ["Release4Community"];
