import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import {createProposal, toEther} from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

// // //alfajores
// const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
// const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
// const impactMarketCouncilAddress = "0x8b32bd23638A2AbDB5D1eA504D2A56c0488AEDDa";

// mainnet
const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
const impactMarketCouncilAddress = "0xF2CA11DA5c3668DD48774f3Ce8ac09aFDc24aF3E";

let newImpactMarketCouncilImplementationAddress: string;

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

	await deployNewImpactMarketCouncilImplementation();
	await createUpgradeImplementationProposal();
};

async function deployNewImpactMarketCouncilImplementation() {
	console.log("Deploying new ImpactMarketCouncilImplementation");
	newImpactMarketCouncilImplementationAddress = (
		await deploy('ImpactMarketCouncilImplementation', {
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		})
	).address;
}
async function createUpgradeImplementationProposal() {
	console.log("Creating new proposal");

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		GovernanceProxy,
		deployer,
		[
			proxyAdminAddress,
			impactMarketCouncilAddress
		],
		[0, 0],
		[
			"upgrade(address,address)",
			"getActions(uint256)",
		],
		[
			["address", "address"],
			["uint256"],
		],
		[
			[impactMarketCouncilAddress, newImpactMarketCouncilImplementationAddress],
			[0],
		],
		'Upgrade ImpactMarketCouncil implementation'
	);
}

export default func;
func.tags = ["UpgradeImpactMarketCouncil"];
