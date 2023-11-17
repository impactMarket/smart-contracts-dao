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
// const learnAndEarnProxyAddress = "0x959eFf854990948B5F5d46986cd8C5B906741114";

// mainnet
const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
const learnAndEarnProxyAddress = "0x496F7De1420ad52659e257C7Aa3f79a995274dbc";

let newLearnAndEarnImplementationAddress: string;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	// const { deployments, ethers } = hre;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];

	await deployNewLearnAndEarnImplementation();
	await createUpgradeImplementation();
};

async function deployNewLearnAndEarnImplementation() {
	console.log("Deploying new contract for LearnAndEarn");
	newLearnAndEarnImplementationAddress = (
		await deploy('LearnAndEarnImplementation', {
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
			learnAndEarnProxyAddress,
		],
		[0, 0],
		[
			"upgrade(address,address)",
			"levels(uint256)",
		],
		[
			["address", "address"],
			["uint256"],
		],
		[
			[learnAndEarnProxyAddress, newLearnAndEarnImplementationAddress],
			[10],
		],
		'Upgrade LearnAndEarn implementation'
	);
}

export default func;
func.tags = ["LearnAndEarn_upgrade"];
