import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import * as ethersTypes from "ethers";
import { createProposal } from "../../../test/utils/helpers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
const donationMinerProxyAddress = "0x09Cdc8f50994F63103bc165B139631A6ad18EF49";

const claimDelay = 3;

let donationMinerNewImplementationAddress = '0x7D58d4Ca9129A0411e07138369F267FBA5117294';

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

	// await deployNewDonationMiner();
	await createUpgradeDonationMinerProposal();
};

async function deployNewDonationMiner() {
	console.log("Deploying new contract for donation miner");
	await new Promise((resolve) => setTimeout(resolve, 6000));
	donationMinerNewImplementationAddress = (
		await deploy("DonationMinerImplementationV2", {
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
		],
		[0, 0],
		[
			"upgrade(address,address)",
			"updateClaimDelay(uint256)",
		],
		[["address", "address"], ["uint256"]],
		[
			[donationMinerProxyAddress, donationMinerNewImplementationAddress],
			[claimDelay],
		]
	);
}

export default func;
func.tags = ["Release2DonationMiner"];
