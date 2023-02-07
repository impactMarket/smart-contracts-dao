import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { constants } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const originalBlockFormatter = ethers.provider.formatter._block;
	ethers.provider.formatter._block = (value: any, format: any) => {
		return originalBlockFormatter(
			{
				gasLimit: constants.Zero,
				...value,
			},
			format
		);
	};

	// const block = await web3.getBlock(blockNumber);

	// ethers.provider.formatter._block()

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const ImpactProxyAdminResult = await deploy("ImpactProxyAdmin", {
		from: deployer.address,
		args: [],
		log: true,
	});
};

export default func;
func.tags = ["ImpactProxyAdminTest", "Test"];
