import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal, toEther } from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

//alfajores
const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
const referralLinkProxyAddress = "0x223b3b11e7eB4542178e787Ab1402f6b23261B84";


// // mainnet
// const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
// const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
// const referralLinkProxyAddress = "";

const contractName = 'ReferralLinkImplementation';

let newReferralLinkImplementationAddress: string;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	// const { deployments, ethers } = hre;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];

	await deployNewImplementation();
	await createUpgradeImplementation();
};

async function deployNewImplementation() {
	console.log("Deploying new " + contractName);
	newReferralLinkImplementationAddress = (
		await deploy(contractName, {
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
			proxyAdminAddress,
			referralLinkProxyAddress
		],
		[0, 0],
		[
			"upgrade(address,address)",
			"campaignReferralLinks(uint256,address)"   //this method is called only to check if the new implementation is correct
		],
		[["address", "address"], ["uint256", "address"]],
		[
			[referralLinkProxyAddress, newReferralLinkImplementationAddress],
			[1234, ethers.constants.AddressZero]
		],
		'Upgrade ReferralLink implementation'
	);
}

export default func;
func.tags = ["ReferralLink_upgrade"];
