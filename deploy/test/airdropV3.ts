import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { toEther } from "../../test/utils/helpers";

//alfajores
// const socialConnectAddress = "0x70F9314aF173c246669cFb0EEe79F9Cfd9C34ee3";
// const socialConnectIssuerAddress = "0xe3475047EF9F9231CD6fAe02B3cBc5148E8eB2c8";

//mainnet
const socialConnectAddress = "0x0aD5b1d0C25ecF6266Dd951403723B2687d6aff2";
const socialConnectIssuerAddress = "0x388612590F8cC6577F19c9b61811475Aa432CB44";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;

	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const ownerAddress = deployer.address; //dev

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");
	const DonationMiner = await ethers.getContractAt(
		"DonationMinerImplementation",
		(
			await deployments.get("DonationMinerProxy")
		).address
	);

	const airdropV3ImplementationResult = await deploy(
		"AirdropV3Implementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const airdropV3ProxyResult = await deploy("AirdropV3Proxy", {
		from: deployer.address,
		args: [airdropV3ImplementationResult.address, ImpactProxyAdmin.address],
		log: true,
		// gasLimit: 13000000,
	});

	const airdropV3Contract = await ethers.getContractAt(
		"AirdropV3Implementation",
		airdropV3ProxyResult.address
	);

	const amount = toEther(1);

	await airdropV3Contract.initialize(
		DonationMiner.address,
		socialConnectAddress,
		socialConnectIssuerAddress,
		amount
	);

	await airdropV3Contract.transferOwnership(ownerAddress);
	await DonationMiner.updateAirdropV3(airdropV3Contract.address);
};

export default func;
func.dependencies = ["ImpactProxyAdminTest", "DonationMinerTest"];
func.tags = ["AirdropV3Test", "Test"];
