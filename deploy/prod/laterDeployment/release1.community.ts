import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import * as ethersTypes from "ethers";
import { parseEther } from "@ethersproject/units";
import { createProposal } from "../../../test/utils/helpers";

const { deploy } = deployments;
let deployer: SignerWithAddress;

const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
const communityAdminProxyAddress = "0x1c33D75bcE52132c7a0e220c1C338B9db7cf3f3A";

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

	// await createMigrateCommunityProposal('0xFf9c28dF21037Ec15CaF8C82cAf49644932516f0');
	await createAddCommunityProposal();
	// await createUpdateCommunityProposal();
};

async function createMigrateCommunityProposal(oldCommunityAddress: string) {
	console.log("Creating new proposal for governance");
	await createProposal(
		GovernanceProxy,
		deployer,
		[communityAdminProxyAddress],
		[0],
		["migrateCommunity(address[],address)"],
		[["address[]", "address"]],
		[[[deployer.address], oldCommunityAddress]]
	);
}

async function createAddCommunityProposal() {
	console.log("Creating new proposal for governance");
	await createProposal(
		GovernanceProxy,
		deployer,
		[communityAdminProxyAddress],
		[0],
		["addCommunity(address[],uint256,uint256,uint256,uint256,uint256,uint256,uint256)"],
		[["address[]", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"]],
		[[[deployer.address], parseEther("0.1"), parseEther("1"), parseEther("0.01"), parseEther("60"), parseEther("1"), parseEther("1"), parseEther("10")]]
	);
}

async function createUpdateCommunityProposal() {
	console.log("Creating new proposal for governance");

	await createProposal(
		GovernanceProxy,
		deployer,
		[communityAdminProxyAddress],
		[0],
		["updateCommunityParams(address,uint256,uint256)"],
		[["address","uint256", "uint256"]],
		[['0xD752A332a5Aa4E1c1cf31d35145fBd0556aE0004',"400000000000000000000", '700000000000000000000']]
	);
}

export default func;
func.tags = ["Release1Community"];
