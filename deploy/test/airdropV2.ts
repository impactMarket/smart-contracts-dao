import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { toEther } from "../../test/utils/helpers";
import { generateMerkleTree } from "../../script/merkleTree/generateMerkleTree";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	// const ownerAddress = (await deployments.get("PACTTimelock")).address; //prod
	const ownerAddress = deployer.address; //dev

	const ImpactProxyAdmin = await deployments.get("ImpactProxyAdmin");
	const PACT = await deployments.get("PACTToken");

	const airdropV2ImplementationResult = await deploy(
		"AirdropV2Implementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const airdropV2ProxyResult = await deploy("AirdropV2Proxy", {
		from: deployer.address,
		args: [airdropV2ImplementationResult.address, ImpactProxyAdmin.address],
		log: true,
		// gasLimit: 13000000,
	});

	const airdropV2Contract = await ethers.getContractAt(
		"AirdropV2Implementation",
		airdropV2ProxyResult.address
	);

	const startTime = 0;
	const trancheAmount = toEther(100);
	const totalAmount = toEther(1000);
	const cooldown = 3600;

	await airdropV2Contract.initialize(
		PACT.address,
		startTime,
		trancheAmount,
		totalAmount,
		cooldown,
		generateMerkleTree([deployer.address])
	);

	await airdropV2Contract.transferOwnership(ownerAddress);
};

export default func;
func.dependencies = ["ImpactProxyAdminTest", "TokenTest"];
func.tags = ["AirdropV2Test"];
