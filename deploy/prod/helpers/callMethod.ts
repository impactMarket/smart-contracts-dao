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


//alfajores
const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
const targetAddress = "0x09Cdc8f50994F63103bc165B139631A6ad18EF49";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	// const { deployments, ethers } = hre;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];

	await createUpgradeImplementation();
};

async function createUpgradeImplementation() {
	console.log("Creating new proposal");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		governanceDelegatorAddress,
		deployer,
		[
			targetAddress,
		],
		[0],
		[
			"transfer(address,address,uint256)",
		],
		[["address", "address", "uint256"]],
		[
			["0x73A2De6A8370108D43c3C80430C84c30df323eD2","0xa34737409091eBD0726A3Ab5863Fc7Ee9243Edab", toEther(150000000)],
		],
		'Send reserve PACTs from DonationMiner to marketing'
	);
}

export default func;
func.tags = ["CallMethod"];
