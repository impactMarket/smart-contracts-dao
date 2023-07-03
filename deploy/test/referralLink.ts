import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";

const socialConnectAddress = "0x0aD5b1d0C25ecF6266Dd951403723B2687d6aff2"; //mainnet
const socialConnectIssuerAddress = "0x388612590F8cC6577F19c9b61811475Aa432CB44"; //mainnet

// const socialConnectAddress = "0x70F9314aF173c246669cFb0EEe79F9Cfd9C34ee3";  //alfajores
// const socialConnectIssuerAddress = "0xe3475047EF9F9231CD6fAe02B3cBc5148E8eB2c8";  //alfajores

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const signerWalletAddress = accounts[1].address;

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");

	const ReferralLinkImplementationResult = await deploy(
		"ReferralLinkImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const ReferralLinkProxyResult = await deploy("ReferralLinkProxy", {
		from: deployer.address,
		args: [
			ReferralLinkImplementationResult.address,
			ImpactProxyAdmin.address,
		],
		log: true,
	});

	const ReferralLinkContract = await ethers.getContractAt(
		"ReferralLinkImplementation",
		ReferralLinkProxyResult.address
	);

	await ReferralLinkContract.initialize(
		signerWalletAddress,
		socialConnectAddress,
		socialConnectIssuerAddress
	);
};

export default func;
func.dependencies = ["ImpactProxyAdminTest"];
func.tags = ["ReferralLinkTest", "Test"];
