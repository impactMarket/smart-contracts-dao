import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal, toEther } from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

// // mainnet
// const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
// const targetAddress = "0x1C51657af2ceBA3D5492bA0c5A17E562F7ba6593";
// const newOwnerAddress = "";


//alfajores
const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
const targetAddress = "0x223b3b11e7eB4542178e787Ab1402f6b23261B84";
const newOwnerAddress = "0x9bDD1df7e44c120C51E74E5C6FA2e0b41487De9F";


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

	await createProposal(
		GovernanceProxy,
		deployer,
		[
			targetAddress,
		],
		[0],
		[
			"transferOwnership(address)",
		],
		[["address"]],
		[
			[newOwnerAddress],
		],
		'Change contract ownership'
	);
}

export default func;
func.tags = ["TransferOwnership"];
