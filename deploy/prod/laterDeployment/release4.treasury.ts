import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal } from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
const treasuryProxyAddress = "0xB0deEE097B5227C5E6bbE787665e4e62b4fE85f3";
const ubeswapRouterAddress = "0xe3d8bd6aed4f159bc8000a9cd47cffdb95f96121";

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
	await createUpgradeGovernanceProposal();
};

async function deployNewGovernance() {
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
	console.log("Creating new proposal for updating treasury");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		GovernanceProxy,
		deployer,
		[proxyAdminAddress, treasuryProxyAddress],
		[0, 0],
		["upgrade(address,address)", "updateUniswapRouter(address)"],
		[["address", "address"], ["address"]],
		[
			[treasuryProxyAddress, treasuryNewImplementationAddress],
			[ubeswapRouterAddress],
		],
		'Upgrade treasury implementation'
	);
}

export default func;
func.tags = ["Release4Treasury"];
