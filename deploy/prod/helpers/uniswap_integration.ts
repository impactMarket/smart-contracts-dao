import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import {createProposal, toEther} from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";
import {getExchangePath, getExchangePathProd} from "../../../test/utils/uniswap";

const { deploy } = deployments;
let deployer: SignerWithAddress;

// //alfajores
// const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
// const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
// const communityAdminProxyAddress = "0x1c33D75bcE52132c7a0e220c1C338B9db7cf3f3A";
// const treasuryLpSwapAddress = "0xef2A764fB65654FBDd257Ad5ffE97b48e468E7c2";
// const treasuryAddress = "0xB0deEE097B5227C5E6bbE787665e4e62b4fE85f3";
// const donationMinerAddress = "0x09Cdc8f50994F63103bc165B139631A6ad18EF49";
// const PACTAddress = "0x73A2De6A8370108D43c3C80430C84c30df323eD2";
// const cUSDAddress = "0x874069fa1eb16d44d622f2e0ca25eea172369bc1";
// const uniswapNFTPositionManagerId = 13739;



// mainnet
const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
const communityAdminProxyAddress = "0xd61c407c3A00dFD8C355973f7a14c55ebaFDf6F9";
const treasuryLpSwapAddress = "0xb062e54eBe08d3f720Fc2798f5D6B282df7753ED";
const treasuryAddress = "0xa302dd52a4a85e6778E6A64A0E5EB0e8C76463d6";
const donationMinerAddress = "0x1C51657af2ceBA3D5492bA0c5A17E562F7ba6593";
const PACTAddress = "0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58";
const cUSDAddress = "0x765de816845861e75a25fca122bb6898b8b1282a";
const uniswapNFTPositionManagerId = 3108;

let newCommunityAdminImplementationAddress: string;
let newCommunityImplementationAddress: string;
let newDonationMinerImplementationAddress: string;
let newTreasuryImplementationAddress: string;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	// const { deployments, ethers } = hre;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];

	await deployNewCommunityImplementation();
	await deployNewCommunityAdminImplementation();
	await deployNewDonationMinerImplementation();
	await deployNewTreasuryImplementation();
	await createUpgradeImplementation();
};

async function deployNewCommunityImplementation() {
	console.log("Deploying new contract for Community");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	newCommunityImplementationAddress = (
		await deploy('CommunityImplementation', {
			from: deployer.address,
			args: [],
			log: true,
		})
	).address;
}

async function deployNewCommunityAdminImplementation() {
	console.log("Deploying new contract for CommunityAdmin");
	newCommunityAdminImplementationAddress = (
		await deploy('CommunityAdminImplementation', {
			from: deployer.address,
			args: [],
			log: true,
		})
	).address;
}

async function deployNewDonationMinerImplementation() {
	console.log("Deploying new contract for DonationMiner");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	newDonationMinerImplementationAddress = (
		await deploy('DonationMinerImplementation', {
			from: deployer.address,
			args: [],
			log: true,
		})
	).address;
}

async function deployNewTreasuryImplementation() {
	console.log("Deploying new contract for Treasury");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	newTreasuryImplementationAddress = (
		await deploy('TreasuryImplementation', {
			from: deployer.address,
			args: [],
			log: true,
		})
	).address;
}

async function createUpgradeImplementation() {
	console.log("Creating new proposal");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		governanceDelegatorAddress,
		deployer,
		[
			proxyAdminAddress,
			communityAdminProxyAddress,
			communityAdminProxyAddress,
			proxyAdminAddress,
			donationMinerAddress,
			proxyAdminAddress,
			treasuryAddress,
			treasuryAddress,
			treasuryAddress,
			treasuryAddress,
		],
		[0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[
			"upgrade(address,address)",  //upgrade communityAdmin
			"updateCommunityImplementation(address)", //upgrade community
			"communityListAt(uint256)", //only to check if the communityAdmin upgrade works
			"upgrade(address,address)", //upgrade donationMiner
			"currentRewardPeriodNumber()", //only to check if the donation miner upgrade works
			"upgrade(address,address)", //upgrade treasury
			"updatePACT(address)", //treasury.updatePACT
			"updateDonationMiner(address)", //treasury.updateDonationMiner
			"updateLpSwap(address)", //treasury.updateLpSwap
			"setToken(address,uint256,uint8,uint256,uint256,uint256,bytes,bytes)", //treasury.setToken
		],
		[
			["address", "address"], //update communityAdmin
			["address"], //update communityImplementation
			["uint256"], //only to check if the update works
			["address", "address"], //update donationMiner
			[], //only to check if the update works
			["address", "address"], //update treasury
			["address"], //treasury.updatePACT
			["address"], //treasury.updateDonationMiner
			["address"], //treasury.updateLpSwap
			["address", "uint256", "uint8", "uint256", "uint256", "uint256", "bytes", "bytes"], //treasury.setToken(cUSD)
		],
		[
			[communityAdminProxyAddress, newCommunityAdminImplementationAddress], //upgrade communityAdmin
			[newCommunityImplementationAddress], //upgrade communityImplementation
			[2], //[200] on prod
			[donationMinerAddress, newDonationMinerImplementationAddress], //upgrade donationMiner
			[],
			[treasuryAddress, newTreasuryImplementationAddress], //upgrade treasury
			[PACTAddress],
			[donationMinerAddress],
			[treasuryLpSwapAddress],
			// [cUSDAddress, toEther(1), 1, toEther(0), toEther(300), 0, "0x", "0x"]
			[cUSDAddress, toEther(1), 1, toEther(10), toEther(300), uniswapNFTPositionManagerId, "0x", getExchangePathProd(cUSDAddress, PACTAddress)]
		],
		'Upgrade CommunityAdmin, Community, DonationMiner and Treasury for uniswap integration'
	);

	// !!!! dont forget to transfer the ownership of the uniswapNFTPositionManager to the treasuryLpSwap contract
}

export default func;
func.tags = ["uniswap_integration"];
