import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal } from "../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

const governanceDelegatorAddress = "0x7De1E20fcbe8beBaaCb1973afB795dCD00Cd6745";
const proxyAdminAddress = "0xc472dC6EceB2D5AB4407d9456511FB081077aefc";
const SPACTTokenAddress = "0xC472Cc65bCbbDBd705429D14f09e20526cd7B5E4";

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
