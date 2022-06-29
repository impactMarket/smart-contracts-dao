import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal } from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

// // mainnet
// const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
// const targetAddress = "0xF2CA11DA5c3668DD48774f3Ce8ac09aFDc24aF3E";


//alfajores
const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
const targetAddress = "0x8b32bd23638A2AbDB5D1eA504D2A56c0488AEDDa";


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

	await createUpgradeImplementation();
};

async function createUpgradeImplementation() {
	console.log("Creating new proposal");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		GovernanceProxy,
		deployer,
		[
			targetAddress,
			targetAddress,
			targetAddress
		],
		[0, 0, 0],
		[
			"addMember(address)",
			"addMember(address)",
			"setQuorumVotes(uint256)",
		],
		[["address"],["address"],["uint256"]],
		[
			["0xC48DA24DE334277E7Df2a42725b10e7A3E73B038"],
			["0x8FBE40e856aa31E14840A2eb8d6Ee9d0ea6D8F6e"],
			[2]
		],
		'Add council member members'
	);
}

export default func;
func.tags = ["CallMethod"];
