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
const SPACTTokenAddress = "0x6732B3e5643dEBfaB7d1570f313271dD9E24c58C";

let governanceNewImplementationAddress: string;

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

async function createUpgradeGovernanceProposal() {
	console.log("Creating new proposal for governance");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		GovernanceProxy,
		deployer,
		[proxyAdminAddress, governanceDelegatorAddress],
		[0, 0],
		["upgrade(address,address)", "_setReleaseToken(address)"],
		[["address", "address"], ["address"]],
		[
			[governanceDelegatorAddress, governanceNewImplementationAddress],
			[SPACTTokenAddress],
		]
	);
}

export default func;
func.tags = ["Release4Governance"];
