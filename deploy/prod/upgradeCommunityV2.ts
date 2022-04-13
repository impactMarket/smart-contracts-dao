import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments } from "hardhat";
import { createAndExecuteProposal, createProposal } from "../../test/utils/helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const governanceDelegatorAddress = '0x266999AefE3523bbB1F8e978520B435A7f0Ef1ac';
	const proxyAdminAddress = '0x63431dDac59f49f0d27E4B5e36D9Aae7c7424D1A';
	const communityAdminProxyAddress = '0xaD8C06F1b2808E7919141A5B818B4D0D5d7A129a';
	const communityImplementationAddress = (await deploy(
		"CommunityImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	)).address;
	await new Promise((resolve) => setTimeout(resolve, 6000));

	// constructor's parameters are not important because this is a middle proxy contract
	// so, we can use any contract address and any address in order to create the contract
	const communityMiddleProxyAddress = (await deploy(
		"CommunityMiddleProxy",
		{
			from: deployer.address,
			args: [communityImplementationAddress, communityImplementationAddress],
			log: true,
			// gasLimit: 13000000,
		}
	)).address;
	await new Promise((resolve) => setTimeout(resolve, 6000));
	const communityAdminImplementationAddress = (await deploy(
		"CommunityAdminImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	)).address;

	const governance = await ethers.getContractAt(
		"PACTDelegate",
		governanceDelegatorAddress
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await createProposal(
		governance,
		deployer,
		[proxyAdminAddress, communityAdminProxyAddress, communityAdminProxyAddress],
		[0,0,0],
		["upgrade(address,address)","updateCommunityMiddleProxy(address)","updateCommunityImplementation(address)"],
		[
			["address", "address"],
			["address"],
			["address"]
		],
		[
			[communityAdminProxyAddress, communityAdminImplementationAddress],
			[communityMiddleProxyAddress],
			[communityImplementationAddress]
		]
	);
};

export default func;
func.tags = ["UpgradeCommunityProd"];
