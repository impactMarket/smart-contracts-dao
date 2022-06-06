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

const proxyAddress = "0x2Bdd85857eDd9A4fAA72b663536189e38D8E3C71";

let newImplementationAddress: string;

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

	await deployNewImplementation();
	await createUpgradeImplementation();
};

async function deployNewImplementation() {
	console.log("Deploying new contract for donation miner");
	newImplementationAddress = (
		await deploy("StakingImplementation", {
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		})
	).address;
}

async function createUpgradeImplementation() {
	console.log("Creating new proposal");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		GovernanceProxy,
		deployer,
		[
			proxyAdminAddress,
			proxyAddress
		],
		[0, 0],
		[
			"upgrade(address,address)",
			"claimAmount(address)"
		],
		[["address", "address"], ["address"]],
		[
			[proxyAddress, newImplementationAddress],
			[deployer.address]
		],
		'Upgrade implementation'
	);
}

export default func;
func.tags = ["UpgradeImplementation"];
