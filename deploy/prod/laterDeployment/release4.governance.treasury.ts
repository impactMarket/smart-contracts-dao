import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal } from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

// // alfajores
// const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
// const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
// const SPACTTokenAddress = "0x6732B3e5643dEBfaB7d1570f313271dD9E24c58C";
// const treasuryProxyAddress = "0xB0deEE097B5227C5E6bbE787665e4e62b4fE85f3";
// const ubeswapRouterAddress = "0xe3d8bd6aed4f159bc8000a9cd47cffdb95f96121";

// mainnet
const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
const SPACTTokenAddress = "0xFC39D3f2cBE4D5efc21CE48047bB2511ACa5cAF3";
const treasuryProxyAddress = "0xa302dd52a4a85e6778E6A64A0E5EB0e8C76463d6";
const ubeswapRouterAddress = "0xe3d8bd6aed4f159bc8000a9cd47cffdb95f96121";

let governanceNewImplementationAddress: string;
let treasuryNewImplementationAddress: string;


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

	await deployNewGovernance();
	await deployNewTreasury();
	await createUpgradeGovernanceProposal();
};

async function deployNewGovernance() {
	console.log("Deploying new contract for governance");
	await new Promise((resolve) => setTimeout(resolve, 6000));
	governanceNewImplementationAddress = (
		await deploy("PACTDelegate", {
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		})
	).address;
}

async function deployNewTreasury() {
	console.log("Deploying new contract for treasury");
	await new Promise((resolve) => setTimeout(resolve, 6000));
	treasuryNewImplementationAddress = (
		await deploy("TreasuryImplementation", {
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		})
	).address;
}

async function createUpgradeGovernanceProposal() {
	console.log("Creating new proposal for governance");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		GovernanceProxy,
		deployer,
		[proxyAdminAddress, governanceDelegatorAddress, proxyAdminAddress, treasuryProxyAddress],
		[0, 0, 0, 0],
		["upgrade(address,address)", "_setReleaseToken(address)", "upgrade(address,address)", "updateUniswapRouter(address)"],
		[["address", "address"], ["address"], ["address", "address"], ["address"]],
		[
			[governanceDelegatorAddress, governanceNewImplementationAddress],
			[SPACTTokenAddress],
			[treasuryProxyAddress, treasuryNewImplementationAddress],
			[ubeswapRouterAddress],
		],
		'Upgrade governance implementation. Upgrade treasury implementation.'
	);
}

export default func;
func.tags = ["Release4Governance"];
