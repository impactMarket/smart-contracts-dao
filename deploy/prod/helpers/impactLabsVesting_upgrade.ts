import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import {createProposal, toEther} from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

// //alfajores
// const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
// const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
// const impactLabsVestingProxyAddress = "0x60c631E7FB4224ad3C0E4BdA0610Dd10CE77756b";
// const newImpactLabsAddress = '0xcb0c15ade117c812e4d96165472ebf83bed231b0';

// mainnet
const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
const impactLabsVestingProxyAddress = "0x767DA1d208DDA5bc517dcd4ba2A83591D68A5535";
const newImpactLabsAddress = '0xE6662E970CD54c154af8b9dEd54C95a69b133A5a';

let newImpactLabsVestingImplementationAddress: string;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	// const { deployments, ethers } = hre;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];

	// await deployNewImpactLabsImplementation();
	await createUpgradeImplementation();
};

async function deployNewImpactLabsImplementation() {
	console.log("Deploying new contract for ImpactLabsVesting");
	newImpactLabsVestingImplementationAddress = (
		await deploy('ImpactLabsVestingImplementation', {
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		})
	).address;
}
async function createUpgradeImplementation() {
	console.log("Creating new proposal");

	await createProposal(
		governanceDelegatorAddress,
		deployer,
		[
			// proxyAdminAddress,
			impactLabsVestingProxyAddress,
		],
		[0],
		[
			// "upgrade(address,address)",
			"updateImpactLabs(address)",
		],
		[
			// ["address", "address"],
			["address"],
		],
		[
			// [impactLabsVestingProxyAddress, newImpactLabsVestingImplementationAddress],
			[newImpactLabsAddress],
		],
		'Upgrade ImpactLabsVesting implementation'
	);
}

export default func;
func.tags = ["ImpactLabsVesting_upgrade"];
