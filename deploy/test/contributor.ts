import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {uniswapExchangePathCUSDToPACT, uniswapQuoterAddress} from "../../test/utils/uniswap";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];
	const owner = accounts[1];

	const ImpactMultiSigProxyAdminResult = await deployments.get("ImpactMultiSigProxyAdmin");
	const PACT = await deployments.get("PACTToken");

	// deploy contributor
	const contributorImplementationResult = await deploy(
		"ContributorImplementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	const contributorProxyResult = await deploy("ContributorProxy", {
		from: deployer.address,
		args: [
			contributorImplementationResult.address,
			ImpactMultiSigProxyAdminResult.address,
		],
		log: true,
	});

	const contributorContract = await ethers.getContractAt(
		"ContributorImplementation",
		contributorProxyResult.address
	);

	const claimDelay = 3600 * 24 * 7;
	await contributorContract.initialize(
		PACT.address,
		uniswapQuoterAddress,
		uniswapExchangePathCUSDToPACT,
		claimDelay
	);

	await contributorContract.transferOwnership(owner.address);
};

export default func;
func.dependencies = ["ImpactMultiSigProxyAdminTest", "PactTest"];
func.tags = ["ContributorTest"];
